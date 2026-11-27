/** ROSE file: ROSE PREMIUM and the free way (own keys). Prices can change in admin 05 PLANS & PRICES; Settings > 06 PREMIUM always shows the latest. */
import { livePrices, taka } from './livePrices';

/** ROSE PREMIUM file with today's package prices (they change by themselves when the admin changes them). */
export function premiumFile(): string {
  const packs = livePrices().premium.map((r) => `${r.name.toUpperCase()} ${taka(r.price)}${r.months > 1 ? ` / ${r.months} months` : ' / month'} (${r.text ? `${r.text.toLocaleString('en-IN')} text` : ''}${r.text && r.voice ? ' + ' : ''}${r.voice ? `${r.voice.toLocaleString('en-IN')} voice` : ''})`).join(', ');
  return `ROSE PREMIUM AND FREE USE (tell anyone who asks, in simple Bengali):
TWO WAYS TO USE ROSE (Settings > 02 CONNECTIONS):
1 FREE: the user puts their own free keys. Gemini key (voice and chat) from aistudio.google.com/apikey, and Groq key (fast chat, optional) from console.groq.com/keys. Both are free from Google and Groq, with a daily free limit set by them. The key stays only on the user's phone, never in the cloud.
2 ROSE PREMIUM: no key needed, ROSE gives the AI. It works with credits: 1 typed reply = 1 Text credit, 1 voice reply = 1 Voice credit. If Text runs out they can still talk by voice, and the other way round.
PACKAGES (live from admin 05 PLANS & PRICES, same as Settings > 06 PREMIUM): ${packs}.
HOW TO BUY: 06 PREMIUM → choose a package → Send Money by bKash / Nagad / Rocket to the number shown → write the sender number and TrxID → SEND. The ROSE team checks it and the credits come by themselves (a notification comes). A gift code can be used there too.
WHAT PREMIUM GIVES: no key setup, ROSE's best voice and chat models, the same ROSE in Personal, Student and Business mode, works on phone and PC with the same Gmail, priority help from ROSE SUPPORT.
ROSE PREMIUM IS NOT THE STORE PLAN: website / store plans are separate (see the plans file) and are bought inside the store admin.`;
}
