import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGeminiError, getFallbackCandidates } from './errorClassifier';
import { DEFAULT_LIVE_MODELS } from '../types/tiya';

test('classifies missing key, invalid key, quota finished, and unavailable model cleanly', () => {
  assert.equal(classifyGeminiError('No API key provided').label, 'No API key');
  assert.equal(classifyGeminiError('API_KEY_INVALID', 400).label, 'Invalid API key');
  assert.equal(classifyGeminiError('RESOURCE_EXHAUSTED: quota exceeded', 429).label, 'Quota finished');
  assert.equal(classifyGeminiError('Model not found for bidiGenerateContent', 404).label, 'Model not available');
});

test('getFallbackCandidates puts selected model first and excludes already attempted models', () => {
  const candidates = getFallbackCandidates(
    'gemini-3.8-live',
    DEFAULT_LIVE_MODELS,
    [],
  );
  assert.deepEqual(candidates, ['gemini-3.8-live', 'gemini-3.8-live-extended-thinking']);

  const next = getFallbackCandidates(
    'gemini-3.8-live',
    DEFAULT_LIVE_MODELS,
    ['gemini-3.8-live'],
  );
  assert.deepEqual(next, ['gemini-3.8-live-extended-thinking']);
});
