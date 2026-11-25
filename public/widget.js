/*! ROSE website chat \u00b7 myrosebd.com
 * <script src="https://www.myrosebd.com/widget.js" data-key="YOUR_CHAT_KEY" data-color="#16a34a" async></script>
 * For ROSE Business. ROSE answers customers in Bangla or English from the Business Profile, products and FAQ.
 */
(function () {
  if (window.__roseChat) return;
  window.__roseChat = true;
  var me = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var KEY = (me && me.getAttribute('data-key')) || '';
  if (!/^[a-zA-Z0-9]{8,64}$/.test(KEY)) return;
  var COLOR = (me.getAttribute('data-color') || '#e11d48').replace(/[^#a-zA-Z0-9(),. ]/g, '');
  var URL = 'https://ukgwipazzjstjkdfaozg.supabase.co/functions/v1/rose-chat';
  var ANON = 'sb_publishable_CRMgURG899vqIqUIsADWgw_p90ZliES';
  var vis;
  try { vis = localStorage.getItem('rose_chat_v'); } catch (e) {}
  if (!vis) { vis = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); try { localStorage.setItem('rose_chat_v', vis); } catch (e) {} }
  var call = function (b) {
    b.key = KEY; b.visitor = vis;
    return fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON }, body: JSON.stringify(b) }).then(function (r) { return r.json(); });
  };
  var bn = (navigator.language || '').indexOf('bn') === 0;
  var css = '#rc-b{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:56px;height:56px;border-radius:99px;border:0;background:' + COLOR + ';color:#fff;box-shadow:0 8px 22px rgba(0,0,0,.25);cursor:pointer;display:grid;place-items:center}' +
    '#rc-w{position:fixed;right:18px;bottom:84px;z-index:2147483000;width:min(330px,calc(100vw - 24px));background:#fff;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.28);overflow:hidden;display:none;font:14px/1.4 system-ui,-apple-system,"Noto Sans Bengali",sans-serif;color:#111}' +
    '#rc-w.on{display:block}#rc-h{background:' + COLOR + ';color:#fff;padding:10px 12px;display:flex;align-items:center;gap:8px}#rc-h b{display:block;font-size:14px}#rc-h small{font-size:11px;opacity:.9}#rc-x{margin-left:auto;background:rgba(255,255,255,.2);border:0;color:#fff;width:28px;height:28px;border-radius:99px;cursor:pointer}' +
    '#rc-m{height:300px;overflow-y:auto;padding:10px;background:#f8fafc;display:flex;flex-direction:column;gap:6px}#rc-m div{max-width:84%;padding:7px 10px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}#rc-m .b{background:#fff;border:1px solid #e5e7eb;align-self:flex-start}#rc-m .u{background:' + COLOR + ';color:#fff;align-self:flex-end}#rc-m .w{font-size:10px;color:#64748b;background:none;border:0;padding:0;margin:0 0 -4px 4px}' +
    '#rc-f{display:flex;border-top:1px solid #e5e7eb}#rc-f input{flex:1;border:0;padding:11px 12px;font:inherit;outline:0;min-width:0}#rc-f button{border:0;background:none;color:' + COLOR + ';padding:0 12px;cursor:pointer}#rc-p{font-size:10px;color:#94a3b8;text-align:center;padding:3px 0 5px}#rc-p a{color:#94a3b8}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var b = document.createElement('button'); b.id = 'rc-b'; b.setAttribute('aria-label', 'Chat');
  b.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="3"/></svg>';
  var w = document.createElement('div'); w.id = 'rc-w';
  w.innerHTML = '<div id="rc-h"><span><b id="rc-n">Chat</b><small>\ud83c\udf39 ROSE AI \u00b7 ' + (bn ? '\u09b8\u09be\u09a5\u09c7 \u09b8\u09be\u09a5\u09c7 \u0989\u09a4\u09cd\u09a4\u09b0' : 'replies at once') + '</small></span><button id="rc-x" aria-label="Close">\u2715</button></div><div id="rc-m"></div><form id="rc-f"><input id="rc-i" maxlength="1000" autocomplete="off" placeholder="' + (bn ? '\u09ae\u09c7\u09b8\u09c7\u099c \u09b2\u09bf\u0996\u09c1\u09a8\u2026' : 'Type a message\u2026') + '"><button aria-label="Send"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/></svg></button></form><div id="rc-p">Powered by <a href="https://www.myrosebd.com" target="_blank" rel="noopener">ROSE</a></div>';
  document.body.appendChild(b); document.body.appendChild(w);
  var m = w.querySelector('#rc-m'), seen = {}, last = '', timer = 0, started = false, shop = '';
  var say = function (t, cls, who) {
    if (who) { var l = document.createElement('div'); l.className = 'w'; l.textContent = who; m.appendChild(l); }
    var d = document.createElement('div'); d.className = cls; d.textContent = t; m.appendChild(d); m.scrollTop = 1e6; return d;
  };
  var show = function (list) { (list || []).forEach(function (x) { if (seen[x.id]) return; seen[x.id] = 1; last = x.created_at; x.sender === 'customer' ? say(x.body, 'u') : say(x.body, 'b', x.sender === 'rose' ? '\ud83c\udf39 ROSE' : shop); }); };
  var open = function () {
    w.classList.add('on');
    if (!started) {
      started = true;
      call({ action: 'info' }).then(function (r) {
        if (r && r.error) return say(r.error, 'b');
        shop = r.name || ''; w.querySelector('#rc-n').textContent = shop;
        say(r.welcome || (bn ? '\u09b9\u09cd\u09af\u09be\u09b2\u09cb! \ud83d\udc4b ' + shop + '-\u098f \u09b8\u09cd\u09ac\u09be\u0997\u09a4\u09ae\u0964 \u0995\u09c0 \u099c\u09be\u09a8\u09a4\u09c7 \u099a\u09be\u09a8 \u09b2\u09bf\u0996\u09c1\u09a8\u0964' : 'Hi! \ud83d\udc4b Welcome to ' + shop + '. How can I help you?'), 'b', '\ud83c\udf39 ROSE');
        return call({ action: 'poll', after: '' }).then(function (p) { show(p.messages); });
      }).catch(function () {});
    }
    clearInterval(timer);
    timer = setInterval(function () { if (!w.classList.contains('on')) return clearInterval(timer); call({ action: 'poll', after: last }).then(function (p) { show(p.messages); }).catch(function () {}); }, 7000);
  };
  b.onclick = function () { w.classList.contains('on') ? w.classList.remove('on') : open(); };
  w.querySelector('#rc-x').onclick = function () { w.classList.remove('on'); };
  w.querySelector('#rc-f').onsubmit = function (e) {
    e.preventDefault();
    var i = w.querySelector('#rc-i'), t = i.value.trim(); if (!t) return; i.value = '';
    say(t, 'u'); var ty = say('\u2022 \u2022 \u2022', 'b');
    call({ action: 'send', text: t }).then(function (r) {
      ty.remove();
      if (r.error) return say(r.error, 'b');
      if (r.reply) { seen[r.reply.id] = 1; last = r.reply.created_at; say(r.reply.body, 'b', '\ud83c\udf39 ROSE'); }
      else say(/[\u0980-\u09ff]/.test(t) ? '\u09a7\u09a8\u09cd\u09af\u09ac\u09be\u09a6! \u0996\u09c1\u09ac \u09b6\u09bf\u0997\u0997\u09bf\u09b0 \u0989\u09a4\u09cd\u09a4\u09b0 \u09a6\u09c7\u0993\u09af\u09bc\u09be \u09b9\u09ac\u09c7\u0964' : 'Thanks! We will reply soon.', 'b', shop);
    }).catch(function () { ty.remove(); say(/[\u0980-\u09ff]/.test(t) ? '\u09aa\u09be\u09a0\u09be\u09a8\u09cb \u0997\u09c7\u09b2 \u09a8\u09be, \u0986\u09ac\u09be\u09b0 \u099a\u09c7\u09b7\u09cd\u099f\u09be \u0995\u09b0\u09c1\u09a8\u0964' : 'Could not send. Please try again.', 'b'); });
  };
})();
