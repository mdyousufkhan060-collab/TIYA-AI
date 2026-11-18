import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWebFallback,
  executePhoneAction,
  extractActionFromText,
  getConfirmationPromptText,
  requiresConfirmation,
  validatePhoneAction,
} from './phoneActions';

test('validates all 6 supported phone action payloads', () => {
  assert.deepEqual(validatePhoneAction({ action: 'open_app', app: 'YouTube' }), {
    action: 'open_app',
    app: 'YouTube',
  });
  assert.deepEqual(validatePhoneAction({ action: 'call', contact: 'Maa' }), {
    action: 'call',
    contact: 'Maa',
  });
  assert.deepEqual(validatePhoneAction({ action: 'whatsapp_call', contact: 'Rafi' }), {
    action: 'whatsapp_call',
    contact: 'Rafi',
  });
  assert.deepEqual(
    validatePhoneAction({ action: 'whatsapp_message', contact: 'Rafi', text: 'Aschi' }),
    { action: 'whatsapp_message', contact: 'Rafi', text: 'Aschi' },
  );
  assert.deepEqual(
    validatePhoneAction({ action: 'messenger_message', contact: 'Sadia', text: 'Hi' }),
    { action: 'messenger_message', contact: 'Sadia', text: 'Hi' },
  );
  assert.deepEqual(validatePhoneAction({ action: 'messenger_call', contact: 'Sadia' }), {
    action: 'messenger_call',
    contact: 'Sadia',
  });
  assert.equal(validatePhoneAction({ action: 'delete_files' }), null);
  assert.equal(validatePhoneAction({ action: 'call', contact: '   ' }), null);
});

test('extractActionFromText parses fenced and inline JSON actions cleanly', () => {
  const fenced = 'ঠিক আছে।\n```json\n{"action":"whatsapp_message","contact":"Karim","text":"Bhalo acho?"}\n```';
  const res = extractActionFromText(fenced);
  assert.equal(res.cleanText, 'ঠিক আছে।');
  assert.deepEqual(res.action, {
    action: 'whatsapp_message',
    contact: 'Karim',
    text: 'Bhalo acho?',
  });

  const inline = 'অ্যাপ খুলছি {"action":"open_app","app":"YouTube"}';
  const res2 = extractActionFromText(inline);
  assert.equal(res2.cleanText, 'অ্যাপ খুলছি');
  assert.deepEqual(res2.action, { action: 'open_app', app: 'YouTube' });
});

test('confirmation requirements and Bengali confirmation wording', () => {
  assert.equal(
    requiresConfirmation({ action: 'whatsapp_message', contact: 'Nadia', text: 'Hello' }),
    true,
  );
  assert.equal(requiresConfirmation({ action: 'call', contact: '01700000000' }), true);
  assert.equal(requiresConfirmation({ action: 'open_app', app: 'YouTube' }), false);

  assert.match(
    getConfirmationPromptText({ action: 'whatsapp_message', contact: 'Nadia', text: 'Hello' }),
    /পাঠাবো\?/,
  );
  assert.match(getConfirmationPromptText({ action: 'call', contact: 'Abbu' }), /কল দেবো\?/);
});

test('executePhoneAction uses TiyaNative bridge when available and never fakes success', async () => {
  const okBridge = {
    run: async (json: string) => {
      const parsed = JSON.parse(json);
      return JSON.stringify({ success: true, message: `Opened ${parsed.app}` });
    },
  };
  const okRes = await executePhoneAction({ action: 'open_app', app: 'YouTube' }, okBridge);
  assert.equal(okRes.success, true);
  assert.equal(okRes.via, 'android_native');

  const failBridge = {
    run: () => ({ success: false, message: 'Permission missing' }),
  };
  const failRes = await executePhoneAction({ action: 'call', contact: 'Maa' }, failBridge);
  assert.equal(failRes.success, false);
  assert.equal(failRes.via, 'android_native');
});

test('browser fallbacks use tel:/wa.me for phone numbers and honest Bengali notice otherwise', () => {
  const telFallback = buildWebFallback({ action: 'call', contact: '+8801711223344' });
  assert.equal(telFallback.success, true);
  assert.equal(telFallback.via, 'web_fallback');
  assert.equal(telFallback.fallbackUrl, 'tel:+8801711223344');

  const nameCallFallback = buildWebFallback({ action: 'call', contact: 'Abbu' });
  assert.equal(nameCallFallback.success, false);
  assert.equal(nameCallFallback.via, 'unsupported');
  assert.match(nameCallFallback.messageBn, /TIYA Android/);

  const waFallback = buildWebFallback({
    action: 'whatsapp_message',
    contact: '8801711223344',
    text: 'Kemon acho?',
  });
  assert.equal(waFallback.success, true);
  assert.match(waFallback.fallbackUrl || '', /^https:\/\/wa\.me\/8801711223344\?text=/);

  const messengerFallback = buildWebFallback({ action: 'messenger_call', contact: 'Rana' });
  assert.equal(messengerFallback.success, false);
  assert.match(messengerFallback.messageBn, /TIYA Android/);
});
