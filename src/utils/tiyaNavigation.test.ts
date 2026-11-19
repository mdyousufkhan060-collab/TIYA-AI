import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNavigationCommand, validateNavigateToolArgs } from './tiyaNavigation';

test('parses core Bengali & English navigation commands for new 01-06 Settings order', () => {
  assert.deepEqual(parseNavigationCommand('সেটিং খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'hub',
    subpage: null,
    confirmBn: 'সেটিংস খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('৩ নম্বর খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'voice_language',
    subpage: null,
    confirmBn: '3 নম্বর (03 VOICE & LANGUAGE) খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('ভয়েস সেটিং খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'voice_language',
    subpage: null,
    confirmBn: '03 Voice & Language খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('ভয়েস মডেল খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'voice_language',
    subpage: 'voice_model',
    confirmBn: 'Voice Model খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('ফোন কন্ট্রোল খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'phone_control',
    subpage: null,
    confirmBn: '04 Phone Control খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('৬ নম্বর খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'premium',
    subpage: null,
    confirmBn: '6 নম্বর (06 PREMIUM) খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('প্রিমিয়াম খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'premium',
    subpage: null,
    confirmBn: '06 Premium খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('মাইক টেস্ট খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'voice_language',
    subpage: 'mic_test',
    confirmBn: 'Mic Test খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('স্পিচ স্পিড খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'voice_language',
    subpage: 'speech_speed',
    confirmBn: 'Speech Speed খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('গ্রোক কি খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'connections',
    subpage: 'groq',
    confirmBn: 'Groq Key পেজ খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('হেলথ চেক খোলো'), {
    type: 'open',
    tab: 'settings',
    page: 'about',
    subpage: 'health_check',
    confirmBn: 'Health Check খোলা হয়েছে।',
  });

  assert.deepEqual(parseNavigationCommand('পিছনে যাও'), {
    type: 'back',
    confirmBn: 'আগের পেজে ফিরে এসেছি।',
  });

  assert.deepEqual(parseNavigationCommand('হোমে যাও'), {
    type: 'open',
    tab: 'home',
    confirmBn: 'হোম স্ক্রিন খোলা হয়েছে।',
  });
});

test('does not misfire on ordinary numbers or non-navigation sentences', () => {
  assert.equal(parseNavigationCommand('আজকে ৪ তারিখ কেমন আছো?'), null);
  assert.equal(parseNavigationCommand('প্রিমিয়াম কি ভালো?'), null);
  assert.equal(parseNavigationCommand('আমার ভলিউম ঠিক আছে'), null);
});

test('validates navigate_app tool arguments safely including legacy live_model redirect', () => {
  assert.deepEqual(
    validateNavigateToolArgs({ action: 'open', tab: 'settings', page: 'premium' }),
    {
      type: 'open',
      tab: 'settings',
      page: 'premium',
      subpage: null,
      confirmBn: 'নির্ধারিত পেজ খোলা হয়েছে।',
    },
  );
  assert.deepEqual(
    validateNavigateToolArgs({ action: 'open', tab: 'settings', page: 'live_model' }),
    {
      type: 'open',
      tab: 'settings',
      page: 'voice_language',
      subpage: 'voice_model',
      confirmBn: 'Voice Model খোলা হয়েছে।',
    },
  );
  assert.deepEqual(validateNavigateToolArgs({ action: 'back' }), {
    type: 'back',
    confirmBn: 'আগের পেজে ফিরে এসেছি।',
  });
});
