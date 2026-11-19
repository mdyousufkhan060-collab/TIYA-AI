import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from './storage';
import { buildTiyaSystemPrompt, resolveEffectivePersona } from './prompts';

test('under-18 users lock GF Mode, Companion, and AFFECTION cleanly', () => {
  const minor = resolveEffectivePersona(
    {
      personality: 'GF Mode',
      affection: 'Very affectionate',
      customPersonalityPrompt: '',
    },
    16,
  );
  assert.equal(minor.isMinor, true);
  assert.equal(minor.personality, 'Friendly');
  assert.equal(minor.affection, 'Off');

  const minorCompanion = resolveEffectivePersona(
    {
      personality: 'Companion',
      affection: 'High',
      customPersonalityPrompt: '',
    },
    15,
  );
  assert.equal(minorCompanion.personality, 'Friendly');
  assert.equal(minorCompanion.affection, 'Off');

  const adult = resolveEffectivePersona(
    {
      personality: 'GF Mode',
      affection: 'High',
      customPersonalityPrompt: '',
    },
    24,
  );
  assert.equal(adult.isMinor, false);
  assert.equal(adult.personality, 'GF Mode');
  assert.equal(adult.affection, 'High');
});

test('system prompt embeds custom personality, memories, and navigation map', () => {
  const prompt = buildTiyaSystemPrompt(
    {
      ...DEFAULT_SETTINGS,
      personality: 'Custom',
      customPersonalityPrompt: 'Speak like a Dhaka radio host.',
      affection: 'Medium',
      yourName: 'Yousuf',
    },
    [],
    'chat',
    25,
    [{ id: 'm1', text: 'Likes black coffee', createdAt: 1000 }],
  );

  assert.ok(prompt.includes('Speak like a Dhaka radio host.'));
  assert.ok(prompt.includes('Affection level (Medium)'));
  assert.ok(prompt.includes('Likes black coffee'));
  assert.ok(prompt.includes('04 PHONE CONTROL'));
  assert.ok(prompt.includes('06 PREMIUM'));
  assert.ok(!prompt.includes('08 DEVELOPER TOOLS'));
  assert.ok(!prompt.includes('06 LOOK & FEEL'));
});
