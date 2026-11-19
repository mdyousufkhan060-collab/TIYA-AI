import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMotivationReplyBn,
  getFirstLine,
  hasBengaliScript,
  isMotivationRequest,
} from './motivation';

test('isMotivationRequest matches Bengali, Banglish, and English motivation prompts', () => {
  assert.equal(isMotivationRequest('আজকের মোটিভেশন বলো'), true);
  assert.equal(isMotivationRequest('মোটিভেশন শোনাও'), true);
  assert.equal(isMotivationRequest('আজকের অনুপ্রেরণা দিন'), true);
  assert.equal(isMotivationRequest('ajker motivation bolo'), true);
  assert.equal(isMotivationRequest("Tell me today's motivation"), true);
  assert.equal(isMotivationRequest('Read motivation'), true);

  assert.equal(isMotivationRequest('আজকের আবহাওয়া কেমন?'), false);
  assert.equal(isMotivationRequest('৪ নম্বর খোলো'), false);
  assert.equal(isMotivationRequest(''), false);
});

test('getFirstLine extracts trimmed first non-empty line', () => {
  assert.equal(getFirstLine('\n\n  First line here \nSecond line'), 'First line here');
  assert.equal(getFirstLine('Short'), 'Short');
});

test('formatMotivationReplyBn formats post and empty states in Bengali', () => {
  assert.equal(
    formatMotivationReplyBn(null),
    'এখনো কোনো প্রকাশিত মোটিভেশন পাওয়া যায়নি।',
  );
  assert.equal(
    formatMotivationReplyBn({ title: 'Motivation', body: 'নিজের উপর বিশ্বাস রাখো।' }),
    'আজকের মোটিভেশন:\nনিজের উপর বিশ্বাস রাখো।',
  );
  assert.equal(
    formatMotivationReplyBn({ title: 'সকালের বার্তা', body: 'প্রতিদিন একটু এগিয়ে যাও।' }),
    'আজকের মোটিভেশন — সকালের বার্তা:\nপ্রতিদিন একটু এগিয়ে যাও।',
  );
});

test('hasBengaliScript detects Bengali Unicode range accurately', () => {
  assert.equal(hasBengaliScript('সুপ্রভাত'), true);
  assert.equal(hasBengaliScript('Keep pushing forward!'), false);
});
