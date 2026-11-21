import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TranscriptStreamBuffer,
  getLanguageCodesForLiveTranscribe,
  getSpeechRecognitionLang,
  getWhisperLanguageCode,
} from './transcriptBuffer.ts';

test('1. Short Bengali sentence streams progressively word-by-word without duplicates', () => {
  const buf = new TranscriptStreamBuffer();

  assert.equal(buf.setInterim('আমি'), 'আমি');
  assert.equal(buf.setInterim('আমি আজ'), 'আমি আজ');
  assert.equal(buf.setInterim('আমি আজ খুব'), 'আমি আজ খুব');
  assert.equal(buf.setInterim('আমি আজ খুব ভালো'), 'আমি আজ খুব ভালো');
  assert.equal(buf.commitFinal('আমি আজ খুব ভালো আছি।'), 'আমি আজ খুব ভালো আছি।');
  assert.equal(buf.getInterim(), '');
  assert.equal(buf.finalize(), 'আমি আজ খুব ভালো আছি।');
});

test('2. Long Bengali paragraph across multiple segments preserves all words in exact order', () => {
  const buf = new TranscriptStreamBuffer();

  buf.setInterim('আজ সকাল থেকে');
  buf.commitFinal('আজ সকাল থেকে খুব সুন্দর বৃষ্টি হচ্ছে।');

  buf.setInterim('আমি জানালার পাশে');
  buf.setInterim('আমি জানালার পাশে বসে চা');
  buf.commitFinal('আমি জানালার পাশে বসে চা খাচ্ছি');

  buf.setInterim('এবং গান');
  buf.commitFinal('এবং গান শুনছি।');

  assert.equal(
    buf.finalize(),
    'আজ সকাল থেকে খুব সুন্দর বৃষ্টি হচ্ছে। আমি জানালার পাশে বসে চা খাচ্ছি এবং গান শুনছি।',
  );
});

test('3. Mixed Bengali-English sentence preserves original languages without translation', () => {
  const buf = new TranscriptStreamBuffer();

  buf.setInterim('আমি আজকে');
  buf.setInterim('আমি আজকে office থেকে');
  buf.setInterim('আমি আজকে office থেকে একটু late');
  buf.commitFinal('আমি আজকে office থেকে একটু late করে ফিরব, please wait করো।');

  assert.equal(
    buf.finalize(),
    'আমি আজকে office থেকে একটু late করে ফিরব, please wait করো।',
  );
});

test('4. Brief mid-sentence pause followed by continuation keeps confirmed words intact', () => {
  const buf = new TranscriptStreamBuffer();

  buf.setInterim('তুমি কি কালকে');
  buf.commitFinal('তুমি কি কালকে');

  // Brief pause happens here — buffer stays active and receives next clause
  buf.setInterim('আমাদের বাসায়');
  buf.setInterim('আমাদের বাসায় আসবে?');
  buf.commitFinal('আমাদের বাসায় আসবে?');

  assert.equal(buf.finalize(), 'তুমি কি কালকে আমাদের বাসায় আসবে?');
});

test('5. Prevents repeated interim appending, cumulative re-emits, and overlapping boundaries', () => {
  const buf = new TranscriptStreamBuffer();

  buf.commitFinal('আমি ঢাকা থেকে বলছি');
  // Engine re-emits exact duplicate final
  assert.equal(buf.commitFinal('আমি ঢাকা থেকে বলছি'), 'আমি ঢাকা থেকে বলছি');

  // Engine sends interim that overlaps last words of committed text
  assert.equal(buf.setInterim('ঢাকা থেকে বলছি এখন'), 'আমি ঢাকা থেকে বলছি এখন');
  assert.equal(buf.setInterim('ঢাকা থেকে বলছি এখন কাজ করছি'), 'আমি ঢাকা থেকে বলছি এখন কাজ করছি');

  // Engine sends multi-word overlapping final
  assert.equal(buf.commitFinal('থেকে বলছি এখন কাজ করছি।'), 'আমি ঢাকা থেকে বলছি এখন কাজ করছি।');

  // Engine sends cumulative re-emit with extra clause
  assert.equal(
    buf.commitFinal('আমি ঢাকা থেকে বলছি এখন কাজ করছি। পরে ফোন দেব।'),
    'আমি ঢাকা থেকে বলছি এখন কাজ করছি। পরে ফোন দেব।',
  );
});

test('6. Preserves natural Bengali reduplication on normal commits while deduplicating boundary restarts', () => {
  const buf = new TranscriptStreamBuffer();

  buf.commitFinal('আস্তে');
  buf.commitFinal('আস্তে কথা বলো');
  assert.equal(buf.getValue(), 'আস্তে আস্তে কথা বলো');

  // On fallback engine restart boundary, single repeated boundary word is stripped
  buf.commitFinal('বলো না প্লিজ', { deduplicateBoundaryWord: true });
  assert.equal(buf.getValue(), 'আস্তে আস্তে কথা বলো না প্লিজ');
});

test('7. Joins sub-word Bengali deltas without inserting spurious spaces', () => {
  const buf = new TranscriptStreamBuffer();

  assert.equal(buf.commitFinal('বাং', { isDelta: true }), 'বাং');
  assert.equal(buf.commitFinal('লা', { isDelta: true }), 'বাংলা');
  assert.equal(buf.commitFinal(' দেশ', { isDelta: true }), 'বাংলা দেশ');
  assert.equal(buf.commitFinal(' সুন্দর।', { isDelta: true }), 'বাংলা দেশ সুন্দর।');
});

test('8. Preserves pre-existing typed text and promotes unfinalized interim on stop', () => {
  const buf = new TranscriptStreamBuffer('প্রিয় বন্ধু,');

  assert.equal(buf.setInterim('কেমন আছো'), 'প্রিয় বন্ধু, কেমন আছো');
  // User taps Stop before server sends final event — interim is safely promoted
  assert.equal(buf.finalize(), 'প্রিয় বন্ধু, কেমন আছো');
  assert.equal(buf.getInterim(), '');
  assert.equal(buf.getCommitted(), 'কেমন আছো');
});

test('9. Language helper codes prioritize Bengali + English mixed recognition', () => {
  assert.deepEqual(getLanguageCodesForLiveTranscribe('Bengali'), ['bn-BD', 'en-US']);
  assert.deepEqual(getLanguageCodesForLiveTranscribe('English'), ['en-US']);
  assert.deepEqual(getLanguageCodesForLiveTranscribe('Hindi'), ['hi-IN', 'en-US']);
  assert.equal(getSpeechRecognitionLang('Bengali'), 'bn-BD');
  assert.equal(getWhisperLanguageCode('Bengali'), 'bn');
  assert.equal(getWhisperLanguageCode('English'), 'en');
});
