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

test('voice mode prompt includes natural 0.85x-0.95x pace and emotional tone variations', () => {
  const voicePrompt = buildTiyaSystemPrompt(DEFAULT_SETTINGS, [], 'voice', 26, [], false);

  assert.ok(voicePrompt.includes('0.85x to 0.95x'));
  assert.ok(voicePrompt.includes('soft, gentle, warm female voice'));
  assert.ok(voicePrompt.includes('Happy: warm and cheerful'));
  assert.ok(voicePrompt.includes('Caring: soft and gentle'));
  assert.ok(voicePrompt.includes('Sad or worried: calm and comforting'));
  assert.ok(voicePrompt.includes('Playful: light and expressive'));
  assert.ok(voicePrompt.includes('Affectionate: sweet and warm'));
});

test('special Admin emotional personality activates ONLY for exact authenticated Admin Gmail and stays transparent & non-manipulative', async () => {
  const { isTiyaOwnerEmail } = await import('./prompts.ts');

  assert.equal(isTiyaOwnerEmail('md.yousuf.khan060@gmail.com'), true);
  assert.equal(isTiyaOwnerEmail('Md.Yousuf.Khan060@gmail.com'), true);
  assert.equal(isTiyaOwnerEmail('other.user@gmail.com'), false);
  assert.equal(isTiyaOwnerEmail('md.yousuf.khan060@gmail.com.evil.com'), false);
  assert.equal(isTiyaOwnerEmail(''), false);
  assert.equal(isTiyaOwnerEmail(null), false);

  // Admin returning after 2 hours gets special personality + absence continuity note + AI transparency
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const adminPrompt = buildTiyaSystemPrompt(
    DEFAULT_SETTINGS,
    [{ id: 'm1', role: 'user', text: 'পরে কথা হবে', timestamp: twoHoursAgo, source: 'chat' }],
    'voice',
    26,
    [],
    true,
  );
  assert.ok(adminPrompt.includes('AUTHENTICATED ADMIN PERSONALITY'));
  assert.ok(adminPrompt.includes('AI girlfriend'));
  assert.ok(adminPrompt.includes('transparent that you are an AI'));
  assert.ok(adminPrompt.includes('NEVER use emotional manipulation'));
  assert.ok(adminPrompt.includes('returning after about 2 hours'));

  // Non-admin user MUST NOT get Admin personality even if they type the Admin email into yourName!
  const nonAdminPrompt = buildTiyaSystemPrompt(
    { ...DEFAULT_SETTINGS, yourName: 'md.yousuf.khan060@gmail.com' },
    [],
    'voice',
    26,
    [],
    false,
  );
  assert.ok(!nonAdminPrompt.includes('AUTHENTICATED ADMIN PERSONALITY'));
  assert.ok(!nonAdminPrompt.includes('AI girlfriend'));
  assert.ok(nonAdminPrompt.includes('Personality (Friendly)'));
});

