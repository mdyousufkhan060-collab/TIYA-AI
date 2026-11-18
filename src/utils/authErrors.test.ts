import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAge,
  computePaidUntilIso,
  isMinorAge,
  mapAuthErrorToBengali,
  parseUseReplyResult,
} from './authErrors';

test('maps Supabase auth errors to clear Bengali messages', () => {
  assert.match(mapAuthErrorToBengali('Invalid login credentials'), /ভুল হয়েছে/);
  assert.match(mapAuthErrorToBengali('Email not confirmed'), /ভেরিফাই করা হয়নি/);
  assert.match(mapAuthErrorToBengali('Too many requests'), /কিছুক্ষণ পর/);
  assert.match(mapAuthErrorToBengali('User already registered'), /আগেই অ্যাকাউন্ট/);
});

test('calculates age and identifies under-18 teen-safe accounts', () => {
  assert.equal(calculateAge(2010, 2026), 16);
  assert.equal(calculateAge(2000, 2026), 26);
  assert.equal(calculateAge(null, 2026), null);

  assert.equal(isMinorAge(2010, 2026), true);
  assert.equal(isMinorAge(2008, 2026), false);
  assert.equal(isMinorAge(null, 2026), false);
});

test('parseUseReplyResult enforces blocked and limit messages and fails open on network errors', () => {
  assert.deepEqual(parseUseReplyResult({ allowed: false, reason: 'blocked' }, null), {
    allowed: false,
    reason: 'blocked',
    messageBn: 'আপনার অ্যাকাউন্ট বন্ধ আছে',
  });

  assert.deepEqual(parseUseReplyResult([{ allowed: false, reason: 'limit' }], null), {
    allowed: false,
    reason: 'limit',
    messageBn: 'আজকের লিমিট শেষ',
  });

  assert.deepEqual(parseUseReplyResult({ allowed: true }, null), {
    allowed: true,
  });

  // Network/RPC failure still allows reply
  assert.deepEqual(parseUseReplyResult(null, new Error('Failed to fetch')), {
    allowed: true,
  });
});

test('computePaidUntilIso advances months accurately', () => {
  const base = new Date('2026-01-15T10:00:00.000Z');
  const plus3 = new Date(computePaidUntilIso(3, base));
  assert.equal(plus3.getUTCFullYear(), 2026);
  assert.equal(plus3.getUTCMonth(), 3); // April (0-indexed)
});
