import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from './storage';
import {
  buildTiyaSystemPrompt,
  detectEmotionalVoiceStyle,
  enforceAdminAddressingText,
  isTiyaOwnerEmail,
  resolveEffectivePersona,
} from './prompts';

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

test('system prompt embeds custom personality, public character, memories, and navigation map for ordinary users', () => {
  const prompt = buildTiyaSystemPrompt(
    {
      ...DEFAULT_SETTINGS,
      selectedCharacterId: 'tiya_zara',
      personality: 'Custom',
      customPersonalityPrompt: 'Speak like a Dhaka radio host.',
      affection: 'Medium',
      yourName: 'Ayan',
    },
    [],
    'chat',
    25,
    [{ id: 'm1', text: 'Likes black coffee', createdAt: 1000, scope: 'user' }],
    false,
  );

  assert.ok(prompt.includes('Active Character (Zara · Sharp & Playful)'));
  assert.ok(prompt.includes('Speak like a Dhaka radio host.'));
  assert.ok(prompt.includes('Affection level (Medium)'));
  assert.ok(prompt.includes('Likes black coffee'));
  assert.ok(prompt.includes('04 PHONE CONTROL'));
  assert.ok(prompt.includes('06 PREMIUM'));
  assert.ok(!prompt.includes('08 DEVELOPER TOOLS'));
  assert.ok(!prompt.includes('06 LOOK & FEEL'));
  assert.ok(prompt.includes('CAMERA OFF'));
});

test('voice mode prompt includes single female voice lock, 0.85x-0.95x pace, and all emotional voice behaviors', () => {
  const voicePrompt = buildTiyaSystemPrompt(DEFAULT_SETTINGS, [], 'voice', 26, [], false);

  assert.ok(voicePrompt.includes('SINGLE FEMALE VOICE LOCK'));
  assert.ok(voicePrompt.includes('0.85x to 0.95x'));
  assert.ok(voicePrompt.includes('Affection: Soft, warm, and tender'));
  assert.ok(voicePrompt.includes('Happiness: Light, cheerful, and expressive'));
  assert.ok(voicePrompt.includes('Sadness: Gentle, slow, and comforting'));
  assert.ok(voicePrompt.includes('Concern: Calm, caring, and attentive'));
  assert.ok(voicePrompt.includes('Playful anger / gentle sulking / mild shyness'));
  assert.ok(voicePrompt.includes('Romantic conversation: Soft, warm, and intimate'));
  assert.ok(voicePrompt.includes('Reassurance: Steady, warm, and soothing'));
});

test('dedicated Admin companion personality enforces স্যার + আপনি, non-scripted intelligence, anti-robotic openings, and strict non-admin isolation', () => {
  assert.equal(isTiyaOwnerEmail('md.yousuf.khan060@gmail.com'), true);
  assert.equal(isTiyaOwnerEmail('Md.Yousuf.Khan060@gmail.com'), true);
  assert.equal(isTiyaOwnerEmail('other.user@gmail.com'), false);
  assert.equal(isTiyaOwnerEmail('md.yousuf.khan060@gmail.com.evil.com'), false);
  assert.equal(isTiyaOwnerEmail(''), false);
  assert.equal(isTiyaOwnerEmail(null), false);

  // Backend-verified Admin returning after 2 hours with yourName='Yousuf' and ordinary character selected:
  // Admin companion MUST override ordinary settings, NEVER leak Yousuf, MUST enforce স্যার + আপনি,
  // MUST forbid scripted dialogue loops & robotic "How can I help you?" greetings, and keep full intelligence.
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const adminPrompt = buildTiyaSystemPrompt(
    { ...DEFAULT_SETTINGS, yourName: 'Yousuf', selectedCharacterId: 'tiya_zara', personality: 'Professional' },
    [{ id: 'm1', role: 'user', text: 'পরে কথা হবে', timestamp: twoHoursAgo, source: 'chat' }],
    'voice',
    26,
    [
      { id: 'am1', text: 'Working on TIYA voice engine', createdAt: 1000, scope: 'admin', category: 'project' },
      { id: 'um1', text: 'Ordinary user secret should never leak to admin', createdAt: 1000, scope: 'user' },
    ],
    true,
  );

  assert.ok(adminPrompt.includes('AUTHENTICATED ADMIN PERSONALITY'));
  assert.ok(adminPrompt.includes('MANDATORY GLOBAL ADMIN ADDRESSING RULES'));
  assert.ok(adminPrompt.includes('Address the authenticated Admin STRICTLY as "স্যার"'));
  assert.ok(!adminPrompt.includes('The user\'s name is "Yousuf"'));
  assert.ok(!adminPrompt.includes('Active Character (Zara'));
  assert.ok(!adminPrompt.includes('Personality (Professional)'));
  assert.ok(adminPrompt.includes('NON-SCRIPTED INTELLIGENCE'));
  assert.ok(adminPrompt.includes('NEVER rely on canned phrases'));
  assert.ok(adminPrompt.includes('NEVER sacrifice reasoning accuracy, coding, research'));
  assert.ok(adminPrompt.includes('How can I help you?'));
  assert.ok(adminPrompt.includes('caring girlfriend'));
  assert.ok(adminPrompt.includes('transparent that you are an AI'));
  assert.ok(adminPrompt.includes('NEVER use emotional manipulation'));
  assert.ok(adminPrompt.includes('returning after about 2 hours'));
  assert.ok(adminPrompt.includes('Working on TIYA voice engine'));
  assert.ok(!adminPrompt.includes('Ordinary user secret should never leak to admin'));
  assert.ok(adminPrompt.includes('CAMERA OFF by default'));

  // Camera ON explicitly for Admin reflects real-frame-only honesty and non-biometric rule
  const adminCamPrompt = buildTiyaSystemPrompt(
    DEFAULT_SETTINGS,
    [],
    'voice',
    26,
    [],
    true,
    { cameraActive: true },
  );
  assert.ok(adminCamPrompt.includes('CAMERA ON — Explicit Permission Granted'));
  assert.ok(adminCamPrompt.includes('Never treat visual appearance as proof of Admin identity'));

  // Non-admin user MUST NOT get Admin personality or Admin memories even if they spoof email or selectedCharacterId!
  const nonAdminPrompt = buildTiyaSystemPrompt(
    {
      ...DEFAULT_SETTINGS,
      yourName: 'md.yousuf.khan060@gmail.com',
      selectedCharacterId: 'tiya_admin_companion',
    },
    [],
    'voice',
    26,
    [
      { id: 'am2', text: 'Private admin project notes', createdAt: 1000, scope: 'admin' },
      { id: 'um2', text: 'User likes tea', createdAt: 1000, scope: 'user' },
    ],
    false,
  );
  assert.ok(!nonAdminPrompt.includes('AUTHENTICATED ADMIN PERSONALITY'));
  assert.ok(!nonAdminPrompt.includes('MANDATORY GLOBAL ADMIN ADDRESSING RULES'));
  assert.ok(!nonAdminPrompt.includes('Private admin project notes'));
  assert.ok(nonAdminPrompt.includes('User likes tea'));
  assert.ok(nonAdminPrompt.includes('Personality (Friendly)'));
});

test('enforceAdminAddressingText eliminates prohibited personal names and তুমি/তোমার/তোমাকে cleanly', () => {
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
