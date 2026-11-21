import { languageCode } from '../types/tiya';

const LEADING_PUNCTUATION_RE = /^[।,.;:!?)\]}'"”’…]+/;
const TERMINAL_PUNCTUATION_RE = /[।.!?…,:;)\]}'"”’]$/;
const BENGALI_COMBINING_START_RE = /^[\u0981-\u0983\u09bc\u09be-\u09cd\u09d7\u200c\u200d]/;
const BENGALI_JOIN_END_RE = /[\u09cd\u200c\u200d]$/;

/**
 * Returns BCP-47 language hints for Gemini Live real-time transcription.
 * Includes English alongside non-English primary languages so mixed speech
 * (e.g., Bengali + inline English words) is recognized accurately in the
 * original spoken script without translating Bengali into English.
 */
export function getLanguageCodesForLiveTranscribe(language?: string): string[] {
  const primary = languageCode(language || 'Bengali');
  if (primary === 'en-US') return ['en-US'];
  return [primary, 'en-US'];
}

/**
 * Returns the BCP-47 locale for browser SpeechRecognition fallback.
 */
export function getSpeechRecognitionLang(language?: string): string {
  return languageCode(language || 'Bengali');
}

/**
 * Returns ISO-639-1 two-letter language code for Groq Whisper fallback.
 */
export function getWhisperLanguageCode(language?: string): string {
  const bcp47 = languageCode(language || 'Bengali');
  return bcp47.split('-')[0].toLowerCase() || 'bn';
}

function normalizeSpacing(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function normalizeWordForCompare(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[.,!?;:।'"“”‘’()[\]{}]+|[.,!?;:।'"“”‘’()[\]{}]+$/g, '');
}

function splitWords(text: string): string[] {
  const trimmed = normalizeSpacing(text);
  return trimmed ? trimmed.split(' ') : [];
}

/**
 * Safely joins two text segments without creating double spaces or orphan spaces
 * before punctuation (including Bengali dari "।").
 */
export function joinTranscriptParts(base: string, addition: string): string {
  const cleanBase = base.trimEnd();
  const cleanAddition = addition.trimStart();
  if (!cleanBase) return cleanAddition;
  if (!cleanAddition) return cleanBase;
  if (LEADING_PUNCTUATION_RE.test(cleanAddition)) {
    return `${cleanBase}${cleanAddition}`;
  }
  return `${cleanBase} ${cleanAddition}`;
}

/**
 * Removes word-level suffix/prefix overlap between committed text and an
 * incoming segment.
 *
 * - Always strips exact cumulative prefix matches (when incoming starts with
 *   all of committed).
 * - Always strips multi-word overlaps (>= 2 words) to prevent repeated phrases.
 * - Optionally strips 1-word boundary overlap (enabled for interim previews and
 *   fallback engine reconnect boundaries, disabled on normal final commits so
 *   natural Bengali reduplication like "আস্তে আস্তে" or "ভালো ভালো" is kept).
 */
function stripLeadingOverlap(
  committed: string,
  incoming: string,
  allowSingleWordOverlap: boolean,
): { mode: 'append' | 'replace' | 'skip'; text: string } {
  const committedNorm = normalizeSpacing(committed);
  const incomingNorm = normalizeSpacing(incoming);
  if (!incomingNorm) return { mode: 'skip', text: '' };
  if (!committedNorm) return { mode: 'append', text: incomingNorm };

  // Case 1: Exact full duplicate
  if (incomingNorm.toLowerCase() === committedNorm.toLowerCase()) {
    return { mode: 'skip', text: '' };
  }

  const committedWords = splitWords(committedNorm);
  const incomingWords = splitWords(incomingNorm);

  // Case 2: Cumulative full re-emit (incoming starts with entire committed string)
  // Require >= 2 committed words (or allowSingleWordOverlap) so 1-word Bengali
  // reduplication ("আস্তে" + "আস্তে কথা বলো") is preserved on normal commits.
  if (
    (committedWords.length >= 2 || allowSingleWordOverlap) &&
    incomingNorm.toLowerCase().startsWith(committedNorm.toLowerCase()) &&
    (incomingNorm.length === committedNorm.length ||
      incomingNorm[committedNorm.length] === ' ' ||
      LEADING_PUNCTUATION_RE.test(incomingNorm.slice(committedNorm.length)))
  ) {
    return { mode: 'replace', text: incomingNorm };
  }

  // Case 3: Exact tail duplicate for multi-word phrases
  if (incomingWords.length >= 2 && committedWords.length >= incomingWords.length) {
    const tailSlice = committedWords.slice(committedWords.length - incomingWords.length);
    const isExactTail = tailSlice.every(
      (w, idx) => normalizeWordForCompare(w) === normalizeWordForCompare(incomingWords[idx]),
    );
    if (isExactTail) {
      return { mode: 'skip', text: '' };
    }
  }

  // Case 4: Word-level suffix-prefix overlap
  const maxOverlap = Math.min(12, committedWords.length, incomingWords.length);
  const minOverlap = allowSingleWordOverlap ? 1 : 2;

  for (let overlap = maxOverlap; overlap >= minOverlap; overlap--) {
    let matched = true;
    for (let i = 0; i < overlap; i++) {
      const a = normalizeWordForCompare(committedWords[committedWords.length - overlap + i]);
      const b = normalizeWordForCompare(incomingWords[i]);
      if (!a || a !== b) {
        matched = false;
        break;
      }
    }
    if (matched) {
      const remaining = incomingWords.slice(overlap).join(' ').trim();
      if (!remaining) return { mode: 'skip', text: '' };
      return { mode: 'append', text: remaining };
    }
  }

  return { mode: 'append', text: incomingNorm };
}

export interface CommitFinalOptions {
  /**
   * True when the source emits incremental token/sub-word deltas (e.g., Gemini Live
   * inputTranscription chunks) where leading/trailing spaces carry word-boundary info.
   */
  isDelta?: boolean;
  /**
   * True when reconnecting a fallback recognizer where a single boundary word may be
   * repeated across restart boundaries.
   */
  deduplicateBoundaryWord?: boolean;
}

/**
 * Dual-buffer streaming transcript manager.
 *
 * Strictly separates:
 *   1. prefixText    - text already present in the input before dictation started
 *   2. committedText - finalized speech recognized in the current session
 *   3. interimText   - live unstable hypothesis that updates in place
 *
 * Guarantees:
 * - Interim updates NEVER append repeatedly or mutate committed words.
 * - Previously typed text and confirmed speech NEVER disappear.
 * - Duplicate segments, cumulative re-emits, and overlapping boundaries are
 *   merged cleanly in exact spoken order.
 * - Bengali conjuncts, vowel signs (kars), punctuation ("।"), and mixed
 *   Bengali-English sentences are preserved without translation.
 */
export class TranscriptStreamBuffer {
  private prefixText = '';
  private committedText = '';
  private committedHadTrailingSpace = false;
  private lastCommitWasDelta = false;
  private interimText = '';

  constructor(initialPrefix: string = '') {
    this.reset(initialPrefix);
  }

  public reset(initialPrefix: string = ''): void {
    this.prefixText = initialPrefix.trimEnd();
    this.committedText = '';
    this.committedHadTrailingSpace = false;
    this.lastCommitWasDelta = false;
    this.interimText = '';
  }

  public getPrefix(): string {
    return this.prefixText;
  }

  public getCommitted(): string {
    return this.committedText;
  }

  public getInterim(): string {
    return this.interimText;
  }

  /**
   * Updates the live interim hypothesis in place (never appends to previous interim).
   */
  public setInterim(rawText: string): string {
    const cleaned = normalizeSpacing(rawText || '');
    if (!cleaned) {
      this.interimText = '';
      return this.getValue();
    }

    const deduped = stripLeadingOverlap(this.committedText, cleaned, true);
    if (deduped.mode === 'skip') {
      this.interimText = '';
    } else if (deduped.mode === 'replace') {
      // If interim contains committed + new suffix, keep only the new suffix as interim
      const committedNorm = normalizeSpacing(this.committedText);
      const suffix = deduped.text.slice(committedNorm.length).trimStart();
      this.interimText = suffix;
    } else {
      this.interimText = deduped.text;
    }

    return this.getValue();
  }

  /**
   * Commits a finalized transcript chunk/segment and clears the interim buffer.
   */
  public commitFinal(rawText: string, options: CommitFinalOptions = {}): string {
    const isDelta = options.isDelta === true;
    const deduplicateBoundaryWord = options.deduplicateBoundaryWord === true;

    this.interimText = '';

    if (!rawText) {
      return this.getValue();
    }

    const hasLeadingSpace = /^\s/.test(rawText);
    const hasTrailingSpace = /\s$/.test(rawText);
    const cleaned = normalizeSpacing(rawText);

    if (!cleaned) {
      if (hasLeadingSpace || hasTrailingSpace) {
        this.committedHadTrailingSpace = true;
      }
      return this.getValue();
    }

    // Handle Bengali / Latin sub-word delta continuation (e.g., "বাং" + "লা" -> "বাংলা")
    if (
      isDelta &&
      this.committedText &&
      !this.committedHadTrailingSpace &&
      !hasLeadingSpace &&
      !TERMINAL_PUNCTUATION_RE.test(this.committedText) &&
      !LEADING_PUNCTUATION_RE.test(cleaned) &&
      !cleaned.includes(' ')
    ) {
      const isCombiningContinuation =
        BENGALI_COMBINING_START_RE.test(cleaned) ||
        BENGALI_JOIN_END_RE.test(this.committedText);
      const isShortDeltaFragment = this.lastCommitWasDelta && cleaned.length <= 4;

      if (isCombiningContinuation || isShortDeltaFragment) {
        this.committedText = `${this.committedText}${cleaned}`;
        this.committedHadTrailingSpace = hasTrailingSpace;
        this.lastCommitWasDelta = true;
        return this.getValue();
      }
    }

    // Standard segment/word commit with deduplication
    const deduped = stripLeadingOverlap(
      this.committedText,
      cleaned,
      deduplicateBoundaryWord,
    );

    if (deduped.mode === 'replace') {
      this.committedText = deduped.text;
    } else if (deduped.mode === 'append') {
      this.committedText = joinTranscriptParts(this.committedText, deduped.text);
    }
    // mode === 'skip' leaves committedText unchanged

    this.committedHadTrailingSpace = hasTrailingSpace;
    this.lastCommitWasDelta = isDelta;

    return this.getValue();
  }

  /**
   * Promotes any remaining unfinalized interim words into committedText when
   * recording ends so the speaker's last words are never lost.
   */
  public finalize(): string {
    if (this.interimText) {
      const pending = this.interimText;
      this.interimText = '';
      this.commitFinal(pending, { isDelta: false, deduplicateBoundaryWord: true });
    }
    return this.getValue();
  }

  /**
   * Returns the complete merged display value for the existing chat input box.
   */
  public getValue(): string {
    const spoken = joinTranscriptParts(this.committedText, this.interimText);
    return joinTranscriptParts(this.prefixText, spoken);
  }
}
