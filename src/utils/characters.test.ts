import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_CHARACTER_ID,
  ADMIN_COMPANION_CHARACTER,
  buildProactiveVoiceCue,
  DEFAULT_PUBLIC_CHARACTER_ID,
  getSelectableCharacters,
  registerPublicCharacter,
  resolveActiveCharacter,
  sanitizePublicCharacterId,
} from './characters';

test('protected Admin character is never listed in selectable public characters', () => {
  const publicAdult = getSelectableCharacters(false);
  const publicMinor = getSelectableCharacters(true);

  assert.ok(publicAdult.length >= 4);
  assert.equal(publicAdult.some((c) => c.id === ADMIN_CHARACTER_ID || c.access === 'admin_only'), false);
  assert.equal(publicMinor.some((c) => c.id === ADMIN_CHARACTER_ID || c.access === 'admin_only'), false);
});

test('resolveActiveCharacter strictly binds Admin character to backend-verified Admin flag and rejects localStorage tampering', () => {
  // Backend-verified Admin always receives protected Admin character even if ordinary character selected
  const adminResolved = resolveActiveCharacter({ selectedCharacterId: 'tiya_zara' }, true, false);
  assert.equal(adminResolved.id, ADMIN_CHARACTER_ID);
  assert.equal(adminResolved.access, 'admin_only');
  assert.equal(adminResolved.initiationBehavior.enabled, true);
  assert.equal(adminResolved.capabilities.cameraVisualContext, true);

  // Ordinary user attempting to select tiya_admin_companion is rejected and safely falls back to classic
  const tamperedUser = resolveActiveCharacter({ selectedCharacterId: ADMIN_CHARACTER_ID }, false, false);
  assert.equal(tamperedUser.id, DEFAULT_PUBLIC_CHARACTER_ID);
  assert.equal(tamperedUser.access, 'public');
  assert.equal(tamperedUser.initiationBehavior.enabled, false);
  assert.equal(tamperedUser.capabilities.cameraVisualContext, false);

  // Sanitizer strips admin character IDs cleanly
  assert.equal(sanitizePublicCharacterId(ADMIN_CHARACTER_ID), DEFAULT_PUBLIC_CHARACTER_ID);
  assert.equal(sanitizePublicCharacterId('tiya_maya'), 'tiya_maya');
  assert.equal(sanitizePublicCharacterId('nonexistent_char'), DEFAULT_PUBLIC_CHARACTER_ID);
});

test('extensible multi-character architecture supports runtime registration of new public female characters without exposing admin_only', () => {
  // Attempting to register an admin_only or colliding character is rejected
  assert.equal(
    registerPublicCharacter({
      ...ADMIN_COMPANION_CHARACTER,
      id: 'spoof_admin',
      access: 'admin_only',
    }),
    false,
  );
  assert.equal(
    registerPublicCharacter({
      ...ADMIN_COMPANION_CHARACTER,
      id: ADMIN_CHARACTER_ID,
      access: 'public',
    }),
    false,
  );

  // Registering a new public female character works cleanly
  const added = registerPublicCharacter({
    ...getSelectableCharacters(false)[0],
    id: 'tiya_ira_test',
    displayLabel: 'Ira · Creative Storyteller',
    tagline: 'Imaginative, expressive creative writing & brainstorming companion',
    access: 'public',
  });
  assert.equal(added, true);
  assert.ok(getSelectableCharacters(false).some((c) => c.id === 'tiya_ira_test'));
  assert.equal(
    resolveActiveCharacter({ selectedCharacterId: 'tiya_ira_test' }, false, false).displayLabel,
    'Ira · Creative Storyteller',
  );
});

test('buildProactiveVoiceCue produces non-scripted context cues with strict camera honesty and anti-robotic instructions', () => {
  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
  const openingCueOff = buildProactiveVoiceCue({
    kind: 'session_opening',
    language: 'Bengali',
    recentMessages: [{ id: '1', role: 'user', text: 'কাজে যাচ্ছি', timestamp: fourHoursAgo, source: 'voice' }],
    cameraActive: false,
  });

  assert.ok(openingCueOff.includes('4 hours since the last conversation'));
  assert.ok(openingCueOff.includes('Camera is OFF; do NOT claim to see anything visually'));
  assert.ok(openingCueOff.includes('do NOT use any scripted greeting'));
  assert.ok(openingCueOff.includes('How can I help you?'));
  assert.ok(openingCueOff.includes('স্যার'));

  const idleCueOn = buildProactiveVoiceCue({
    kind: 'idle_checkin',
    language: 'Bengali',
    recentMessages: [],
    cameraActive: true,
  });

  assert.ok(idleCueOn.includes('Camera visual context is currently ON'));
  assert.ok(idleCueOn.includes('pressure-free'));
  assert.ok(idleCueOn.includes('without guilt-tripping'));
});
