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
import { ALL_MODES } from './roseFiles/plansAndModes';
import { STORE_BUILDER } from './roseFiles/storeBuilder';
import { PREMIUM } from './roseFiles/premiumPlan';

export function getRoseGuide(mode: string | null | undefined, isAdmin: boolean): string {
  if (isAdmin) return [WHATS_NEW_ADMIN, COMMON, ACTIONS, ADMIN, BUSINESS, STUDENT, PERSONAL, ALL_MODES, PREMIUM, STORE_BUILDER].join('\n\n');
  const own = mode === 'business' ? BUSINESS : mode === 'student' ? STUDENT : PERSONAL;
  return [
    COMMON,
    ACTIONS,
    own,
    ALL_MODES,
    PREMIUM,
    STORE_BUILDER,
    WHATS_NEW_USER,
    'You may explain every mode and plan to anyone, but only DO the tools of this user\'s own mode. Never describe the Admin panel to normal users.',
  ].join('\n\n');
}
