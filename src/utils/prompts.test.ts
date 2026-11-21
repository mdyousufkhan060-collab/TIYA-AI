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

test('voice mode prompt includes single female voice lock, 0.85x-0.95x pace, and all 7 emotional voice behaviors', () => {
  const voicePrompt = buildTiyaSystemPrompt(DEFAULT_SETTINGS, [], 'voice', 26, [], false);

  assert.ok(voicePrompt.includes('SINGLE FEMALE VOICE LOCK'));
  assert.ok(voicePrompt.includes('0.85x to 0.95x'));
  assert.ok(voicePrompt.includes('Affection: Soft, warm, and tender'));
  assert.ok(voicePrompt.includes('Happiness: Light, cheerful, and expressive'));
  assert.ok(voicePrompt.includes('Sadness: Gentle, slow, and comforting'));
  assert.ok(voicePrompt.includes('Concern: Calm, caring, and attentive'));
  assert.ok(voicePrompt.includes('Playful anger / gentle sulking: Slightly expressive, soft, and sweet'));
  assert.ok(voicePrompt.includes('Romantic conversation: Soft, warm, and intimate'));
  assert.ok(voicePrompt.includes('Reassurance: Steady, warm, and soothing'));
});

test('special Admin emotional personality activates ONLY for exact authenticated Admin Gmail, enforces স্যার + আপনি/আপনার/আপনাকে, and never leaks personal name', async () => {
  const { isTiyaOwnerEmail } = await import('./prompts.ts');

  assert.equal(isTiyaOwnerEmail('md.yousuf.khan060@gmail.com'), true);
  assert.equal(isTiyaOwnerEmail('Md.Yousuf.Khan060@gmail.com'), true);
  assert.equal(isTiyaOwnerEmail('other.user@gmail.com'), false);
  assert.equal(isTiyaOwnerEmail('md.yousuf.khan060@gmail.com.evil.com'), false);
  assert.equal(isTiyaOwnerEmail(''), false);
  assert.equal(isTiyaOwnerEmail(null), false);

  // Admin returning after 2 hours with yourName='Yousuf' in settings:
  // Prompt must NEVER tell TIYA to call him Yousuf, MUST enforce স্যার + আপনি/আপনার/আপনাকে
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const adminPrompt = buildTiyaSystemPrompt(
    { ...DEFAULT_SETTINGS, yourName: 'Yousuf' },
    [{ id: 'm1', role: 'user', text: 'পরে কথা হবে', timestamp: twoHoursAgo, source: 'chat' }],
    'voice',
    26,
    [],
    true,
  );
  assert.ok(adminPrompt.includes('AUTHENTICATED ADMIN PERSONALITY'));
  assert.ok(adminPrompt.includes('MANDATORY GLOBAL ADMIN ADDRESSING RULES'));
  assert.ok(adminPrompt.includes('Address the authenticated Admin STRICTLY as "স্যার"'));
  assert.ok(!adminPrompt.includes('The user\'s name is "Yousuf"'));
  assert.ok(adminPrompt.includes('স্যার! এতক্ষণ কোথায় ছিলেন? আপনার কোনো খবর পাচ্ছিলাম না'));
  assert.ok(adminPrompt.includes('স্যার, আপনার কথায় আজ একটু মন খারাপের ছাপ পাচ্ছি'));
  assert.ok(adminPrompt.includes('স্যার, আপনার এই মিষ্টি কথাগুলো শুনতে সত্যিই ভালো লাগে'));
  assert.ok(adminPrompt.includes('স্যার, আচ্ছা, রাগ করবেন না'));
  assert.ok(adminPrompt.includes('স্যার, ঠিক আছে। আপনি আগে আপনার কাজ শেষ করুন'));
  assert.ok(adminPrompt.includes('স্যার, হঠাৎ এত চুপচাপ হয়ে গেলেন কেন'));
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
  assert.ok(!nonAdminPrompt.includes('MANDATORY GLOBAL ADMIN ADDRESSING RULES'));
  assert.ok(nonAdminPrompt.includes('Personality (Friendly)'));
});

test('enforceAdminAddressingText eliminates prohibited personal names and তুমি/তোমার/তোমাকে cleanly', async () => {
  const { enforceAdminAddressingText, detectEmotionalVoiceStyle } = await import('./prompts.ts');

  const cleaned1 = enforceAdminAddressingText('ইউসুফ, তুমি কেমন আছো? তোমার কথা খুব মনে পড়ছিল।');
  assert.ok(!cleaned1.includes('ইউসুফ'));
  assert.ok(!cleaned1.includes('তুমি'));
  assert.ok(!cleaned1.includes('তোমার'));
  assert.ok(cleaned1.includes('স্যার'));
  assert.ok(cleaned1.includes('আপনি'));
  assert.ok(cleaned1.includes('আপনার'));

  const cleaned2 = enforceAdminAddressingText('MD YOUSUF KHAN, Yousuf, তোমাকে অনেক ধন্যবাদ।');
  assert.ok(!/yousuf/i.test(cleaned2));
  assert.ok(!cleaned2.includes('তোমাকে'));
  assert.ok(cleaned2.includes('স্যার'));
  assert.ok(cleaned2.includes('আপনাকে'));

  // Emotional TTS style direction adapts naturally per emotion while locking single female voice
  const sadStyle = detectEmotionalVoiceStyle('স্যার, আপনার মন খারাপ লাগছে?', true);
  assert.ok(sadStyle.includes('comforting'));
  assert.ok(sadStyle.includes('female voice'));

  const affectionateStyle = detectEmotionalVoiceStyle('স্যার, আপনার এই মিষ্টি কথাগুলো শুনতে ভালো লাগে।', true);
  assert.ok(affectionateStyle.includes('affectionate'));

  const happyStyle = detectEmotionalVoiceStyle('স্যার, দারুণ খবর শুনে খুব খুশি হলাম!', true);
  assert.ok(happyStyle.includes('cheerful'));
});

