import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContextualMemorySummary,
  extractExplicitMemories,
  mergeMemories,
} from './memoryEngine';
import { loadChats, loadMemories, saveChats, saveMemories } from './storage';

test('extractExplicitMemories captures explicitly stated preferences, projects, and remember-notes without fabricating on questions or ordinary chatter', () => {
  const prefBn = extractExplicitMemories('আমি কালো কফি খুব পছন্দ করি।', [], 'admin');
  assert.equal(prefBn.length, 1);
  assert.equal(prefBn[0].category, 'preference');
  assert.equal(prefBn[0].scope, 'admin');

  const projEn = extractExplicitMemories("I'm working on the TIYA voice assistant upgrade.", [], 'admin');
  assert.equal(projEn.length, 1);
  assert.equal(projEn[0].category, 'project');

  const ctxNote = extractExplicitMemories('মনে রেখো আমার রাত ১০টায় মিটিং আছে।', [], 'user');
  assert.equal(ctxNote.length, 1);
  assert.equal(ctxNote[0].category, 'context');
  assert.equal(ctxNote[0].scope, 'user');

  // Pure questions and ordinary greetings must NOT fabricate memories
  assert.equal(extractExplicitMemories('আজকের আবহাওয়া কেমন?', [], 'admin').length, 0);
  assert.equal(extractExplicitMemories('Do I like coffee?', [], 'admin').length, 0);
  assert.equal(extractExplicitMemories('হ্যালো টিয়া', [], 'admin').length, 0);

  // Deduplication prevents duplicate entries
  const dup = extractExplicitMemories('আমি কালো কফি খুব পছন্দ করি।', prefBn, 'admin');
  assert.equal(dup.length, 0);

  const merged = mergeMemories(prefBn, projEn);
  assert.equal(merged.length, 2);
});

test('buildContextualMemorySummary strictly filters memories by admin vs user scope', () => {
  const mixed = [
    { id: 'a1', text: 'Admin private project roadmap', createdAt: 1, scope: 'admin' as const, category: 'project' as const },
    { id: 'u1', text: 'User prefers evening reminders', createdAt: 2, scope: 'user' as const, category: 'preference' as const },
  ];

  const adminSummary = buildContextualMemorySummary([], mixed, { isAdminScope: true });
  assert.ok(adminSummary.includes('Admin private project roadmap'));
  assert.ok(!adminSummary.includes('User prefers evening reminders'));

  const userSummary = buildContextualMemorySummary([], mixed, { isAdminScope: false });
  assert.ok(userSummary.includes('User prefers evening reminders'));
  assert.ok(!userSummary.includes('Admin private project roadmap'));
});

test('storage.ts isolates Admin private chats & memories from ordinary user accounts', () => {
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  (globalThis as unknown as { window?: unknown }).window = { localStorage: mockLocalStorage };

  const adminScope = { userId: 'uid-admin-1', isVerifiedAdmin: true };
  const userScope = { userId: 'uid-user-2', isVerifiedAdmin: false };
  const spoofSameUidNonAdmin = { userId: 'uid-admin-1', isVerifiedAdmin: false };

  saveMemories(
    [{ id: 'm-admin', text: 'Admin confidential note', createdAt: 100, scope: 'admin' }],
    adminScope,
  );
  saveChats(
    [{ id: 'c-admin', role: 'user', text: 'Admin private chat', timestamp: 100, source: 'chat' }],
    adminScope,
  );

  saveMemories(
    [{ id: 'm-user', text: 'Regular user note', createdAt: 200, scope: 'user' }],
    userScope,
  );
  saveChats(
    [{ id: 'c-user', role: 'user', text: 'Regular user chat', timestamp: 200, source: 'chat' }],
    userScope,
  );

  assert.equal(loadMemories(adminScope).length, 1);
  assert.equal(loadMemories(adminScope)[0].text, 'Admin confidential note');
  assert.equal(loadChats(adminScope)[0].text, 'Admin private chat');

  assert.equal(loadMemories(userScope).length, 1);
  assert.equal(loadMemories(userScope)[0].text, 'Regular user note');
  assert.equal(loadChats(userScope)[0].text, 'Regular user chat');

  // Even same UID without backend-verified isVerifiedAdmin cannot read Admin private namespace
  assert.equal(loadMemories(spoofSameUidNonAdmin).length, 0);
  assert.equal(loadChats(spoofSameUidNonAdmin).length, 0);

  delete (globalThis as unknown as { window?: unknown }).window;
});
