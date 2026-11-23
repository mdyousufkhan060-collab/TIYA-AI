import { LiveModelInfo } from '../types/tiya';

export type FriendlyErrorLabel =
  | 'No API key'
  | 'Invalid API key'
  | 'Model not available'
  | 'Quota finished'
  | 'Microphone permission denied'
  | 'Connection failed';

export function classifyGeminiError(rawMessage?: string, statusCode?: number): {
  label: FriendlyErrorLabel;
  detail: string;
  shouldFallback: boolean;
} {
  const msg = (rawMessage || '').toLowerCase();

  if (!rawMessage && statusCode === 401) {
    return {
      label: 'No API key',
      detail: 'Add your Gemini API key in Settings > Connections.',
      shouldFallback: false,
    };
  }

  if (
    msg.includes('no api key') ||
    msg.includes('missing api key') ||
    msg.includes('api key is required')
  ) {
    return {
      label: 'No API key',
      detail: 'Add your Gemini API key in Settings > Connections.',
      shouldFallback: false,
    };
  }

  if (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid api key') ||
    msg.includes('permission_denied') ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    return {
      label: 'Invalid API key',
      detail: 'The Gemini API key was rejected. Check Settings > Connections.',
      shouldFallback: false,
    };
  }

  if (
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    statusCode === 429
  ) {
    return {
      label: 'Quota finished',
      detail: 'API quota limit reached for this key or model.',
      shouldFallback: true,
    };
  }

  if (
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('not supported') ||
    msg.includes('model not available') ||
    msg.includes('invalid model') ||
    msg.includes('bidigeneratecontent') ||
    statusCode === 404
  ) {
    return {
      label: 'Model not available',
      detail: 'Selected Live model is not available for this key.',
      shouldFallback: true,
    };
  }

  if (msg.includes('microphone') || msg.includes('notallowederror') || msg.includes('permission')) {
    return {
      label: 'Microphone permission denied',
      detail: 'Allow microphone access to talk with ROSE.',
      shouldFallback: false,
    };
  }

  return {
    label: 'Connection failed',
    detail: rawMessage || 'Could not reach Gemini Live service.',
    shouldFallback: true,
  };
}

export function getFallbackCandidates(
  selectedModel: string,
  availableModels: LiveModelInfo[],
  attemptedModels: string[],
): string[] {
  const attempted = new Set(attemptedModels);
  const allIds = availableModels.map((m) => m.id);
  const ordered = [selectedModel, ...allIds.filter((id) => id !== selectedModel)];
  return ordered.filter((id) => Boolean(id) && !attempted.has(id));
}
