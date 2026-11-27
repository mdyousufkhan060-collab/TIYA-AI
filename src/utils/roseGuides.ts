/**
 * ROSE's built-in user guides. Added to the system prompt so ROSE can explain
 * every button and take the user there with navigate_app.
 * Personal / Student / Business users get ONLY their own guide. The admin gets all.
 */
import { COMMON } from './roseFiles/appSettings';
import { ACTIONS } from './roseFiles/phoneTools';
import { PERSONAL } from './roseFiles/personalMode';
import { STUDENT } from './roseFiles/studentMode';
import { BUSINESS } from './roseFiles/businessMode';
import { ADMIN } from './roseFiles/roseAdmin';
import { WHATS_NEW_ADMIN } from './roseFiles/whatsNew';
import { WHATS_NEW_USER } from './roseFiles/whatsNewUser';
import { plansFile } from './roseFiles/plansAndModes';
import { STORE_BUILDER } from './roseFiles/storeBuilder';
import { premiumFile } from './roseFiles/premiumPlan';
import { refreshLivePrices } from './roseFiles/livePrices';

// load today's prices as soon as ROSE starts, so even her first answer uses them
void refreshLivePrices();

// Users: only the files their talk needs go with each reply (smaller prompt = lower AI cost, same answers).
const WANTS_PLANS = /plan|প্ল্যান|প্লান|premium|প্রিমিয়াম|প্রিমিয়াম|price|দাম|টাকা|tk|credit|ক্রেডিট|package|প্যাকেজ|buy|কিন|subscription|mode|মোড|student|স্টুডেন্ট|business|বিজনেস|personal|পার্সোনাল|free|ফ্রি|key|কী|চাবি|lifetime|লাইফটাইম|offer|অফার|install|ইনস্টল/i;
const WANTS_STORE = /website|ওয়েবসাইট|ওয়েব|store|shop|দোকান|শপ|অনলাইন|online|myrosebd|demo|ডেমো|order|অর্ডার|product|প্রোডাক্ট|পণ্য|courier|কুরিয়ার|chat|চ্যাট/i;
const WANTS_NEW = /new|নতুন|update|আপডেট|added|যোগ/i;

export function getRoseGuide(mode: string | null | undefined, isAdmin: boolean, recentText = ''): string {
  if (isAdmin) return [WHATS_NEW_ADMIN, COMMON, ACTIONS, ADMIN, BUSINESS, STUDENT, PERSONAL, plansFile(), premiumFile(), STORE_BUILDER].join('\n\n');
  const own = mode === 'business' ? BUSINESS : mode === 'student' ? STUDENT : PERSONAL;
  const t = recentText || '';
  // without any recent text (first message) keep everything, so nothing is missing
  const all = !t.trim();
  return [
    COMMON,
    ACTIONS,
    own,
    all || WANTS_PLANS.test(t) ? plansFile() : 'PLANS, PREMIUM, STORE: ask ROSE about plans, prices, Premium or a website and the details come.',
    all || WANTS_PLANS.test(t) ? premiumFile() : '',
    all || WANTS_STORE.test(t) || mode === 'business' ? STORE_BUILDER : '',
    all || WANTS_NEW.test(t) ? WHATS_NEW_USER : '',
    'You may explain every mode and plan to anyone, but only DO the tools of this user\'s own mode. Never describe the Admin panel to normal users.',
  ].filter(Boolean).join('\n\n');
}
