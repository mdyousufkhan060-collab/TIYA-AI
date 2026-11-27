/**
 * ROSE's four social media guide files (her "memory" for each app).
 * Each guide says how to move inside that app like a careful human finger on the ROSE Android app
 * (ROSE Access on): open it, find his videos and posts, upload, write captions, open comments,
 * scroll slowly, and reply one comment at a time without repeating or asking again.
 * In chat only the guide of the app he talks about is added; in voice all four are added.
 *
 * Tools she uses (trigger_phone_action open_app with these "app" values):
 *   "screen items"            → numbered list of what is on the screen, with place ([top-left] …)
 *   "tap item <n>"            → press number n from that list (the result shows the new screen)
 *   "scroll down" / "scroll up" / "go back"
 *   "check comments"          → reads the open comment list: who wrote what, which are answered, "রিপ্লাই বাকি"
 *   "reply comment <name>: <text>" → replies to that one comment and checks it shows on the screen
 *   "reply all comments"      → the phone itself replies to every unanswered comment, one by one
 *   "open latest post comments" (Facebook) · "list videos" · "prepare video <n>" · "publish video <n> to <apps>"
 */

const COMMON = `HOW TO MOVE (same in every app):
1. Before every tap call "screen items" and read the list. Tap ONLY a number you saw ("tap item <n>"); never guess a place.
2. After each tap the result shows the new screen. If it is not what you wanted, "go back" once and choose again.
3. Scroll like a person: "scroll down" ONE time, then "screen items" again. Never scroll many times in a row without looking.
4. Do not talk while moving. Speak only when you arrived, when you finished, or when you are stuck (then say in one line what you see).
5. Never press: Delete, Remove, Report, Block, Pay, Buy, Boost, Promote, Log out, or anything about money or passwords.
REPLYING TO COMMENTS (same in every app):
- The video must not play while you work: the phone pauses it by itself when you check or reply to comments. If it still plays or he says "ভিডিও থামাও / পজ করো", call app "pause video" first, then go on.
- Open the comments, then call "check comments". Answer ONLY the ones under "রিপ্লাই বাকি". Never his own comments, never ones already answered, never a new top-level comment.
- He says "সবাইকে রিপ্লাই দাও, আমাকে জিজ্ঞেস করার দরকার নাই" → that is his yes: call "reply all comments" (or write each reply yourself and send one by one), say nothing in between, and at the end say once how many were answered and which failed.
- Otherwise read each comment once (name + words), write a short fitting reply yourself, read the list once and ask ONE question "এভাবে পাঠাবো?". After yes send one call per comment: "reply comment <name exactly as read>: <reply>". Wait for each result. Do not ask again between replies.
- While replying keep a running count in your head: which name is done, which is next. Never reply twice to the same person on the same comment.
- When the visible ones are done, "scroll down" once and "check comments" again; continue until the result shows no "রিপ্লাই বাকি" and scrolling shows nothing new (or "View more comments" / "আরও কমেন্ট" is pressed and also done).
- At the end call "check comments" once more and tell him truthfully: "<n>টা কমেন্টে রিপ্লাই দিলাম, <m>টা পাঠানো যায়নি: <names>".
- A reply counts as sent only if its result says it was seen on the screen.`;

export const FACEBOOK_GUIDE = `FACEBOOK GUIDE (app: Facebook, com.facebook.katana)
WHERE THINGS ARE: bottom or top bar has Home, Video/Reels, Friends, Marketplace, Notifications (bell) and Menu (≡ or his round profile picture; on Android usually top-right). His profile = tap his name/picture in Menu.
PROFILE OR PAGE: Facebook has his personal ID (profile) and maybe Pages under it.
- "আমার পেজগুলো দেখাও / কয়টা পেজ আছে": open Facebook → tap Menu (≡ / his picture) → tap the small arrow or "See all profiles" / "সব প্রোফাইল দেখুন" next to his name → "screen items" → read him the names: his profile first, then every Page. Say "আপনার আইডি আর <n>টা পেজ আছে: <names>. কোনটায় কাজ করবো?" and wait.
- When he names a Page: tap that Page name in the same list. Facebook switches to the Page (a short loading screen). Then "screen items" and check the top shows the Page name. Tell him "<Page> এ ঢুকেছি".
- To go back to his ID: Menu → See all profiles → tap his own name.
- Always say which one you are working as before replying: "আমি এখন <Page/আইডি> হিসেবে রিপ্লাই দিচ্ছি".
NEWEST POST / VIDEO COMMENTS:
- On his profile or Page: open it → the Posts tab ("পোস্ট"), NOT the Reels tab (a reel opens full screen and replies there fail) → scroll down until the first post → tap its Comment button ("মন্তব্য" / "Comment") → "check comments".
- Shortcut for his ID: "open latest post comments" opens Facebook and the newest post comments.
- A specific post ("দুই নম্বর পোস্ট", "কালকের ভিডিও"): count posts from the top of the Posts tab while scrolling; open the one he means.
- In comments, sort may say "Most relevant"; if he wants all, tap it and choose "All comments" / "সব মন্তব্য".
UPLOAD VIDEO: use "list videos" → "prepare video <n>" → his yes → "publish video <n> to facebook". ROSE fills the caption and presses Post. Facebook posts at once (no schedule from ROSE). To post on a Page, first switch to that Page as above, then publish.
CAPTION / EDIT: on a post tap the three dots (… ) → "Edit post" / "পোস্ট এডিট" → change the text → Save. Only when he asks.`;

export const YOUTUBE_GUIDE = `YOUTUBE GUIDE (app: YouTube, com.google.android.youtube)
WHERE THINGS ARE: bottom bar Home, Shorts, Create (+ in the middle), Subscriptions, You (his picture, bottom-right).
HIS VIDEOS: You → "Your videos" / "আপনার ভিডিও" (shows Videos, Shorts, Live tabs) → newest is at the top. Shorts live in the Shorts tab.
UPLOAD: use "list videos" → "prepare video <n>" → his yes → "publish video <n> to youtube" (ROSE taps Create (+) → Upload a video → picks the file → Next → Title, Description → Visibility → Upload).
- Title max 100 characters. Description can hold the hashtags.
- Schedule ("কাল রাত ৮টায়"): "publish video <n> to youtube schedule YYYY-MM-DD HH:MM" (Bangladesh time). In the app this is Visibility → Schedule → date and time.
- Visibility words: Public (সবাই দেখবে), Unlisted (লিংক যার কাছে), Private (শুধু তিনি).
COMMENTS ON HIS VIDEO: You → Your videos → tap the video → under the player tap "Comments" (the comment box with the count) → "check comments". For a Short: open it from the Shorts tab → comment icon on the right.
- Reply button is under each comment ("Reply" / "উত্তর দিন"). Replies show in a thread; "check comments" knows which have his reply.
- YouTube may hide long lists behind "Show more replies" / "আরও উত্তর"; open them only when he asks.
- Sort: "Top comments" ↔ "Newest first" at the top of comments; use "Newest first" when he wants the new ones.`;

export const INSTAGRAM_GUIDE = `INSTAGRAM GUIDE (app: Instagram, com.instagram.android)
WHERE THINGS ARE: bottom bar Home, Search, Create (+), Reels, Profile (his small picture, bottom-right).
ACCOUNTS: hold the Profile picture at the bottom, or on Profile tap his username at the top → list of his accounts → tap one to switch. Say which account you are on before replying.
HIS POSTS: Profile → grid (Posts) or the Reels tab (the second tab). Newest is top-left.
UPLOAD: use "list videos" → "prepare video <n>" → his yes → "publish video <n> to instagram" (ROSE taps + → Reel → picks the video → Next → caption → Share). Instagram posts at once.
COMMENTS: open the post or reel → tap the speech-bubble comment icon (on a reel it is on the right side) → "check comments".
- Each comment has "Reply" under it; Instagram puts @name at the start of the reply by itself, so do not type the name again.
- Long threads show "View <n> more replies"; open them only if needed.
- Never use "Reply with Reel" or photo/GIF replies; text replies only.`;

export const TIKTOK_GUIDE = `TIKTOK GUIDE (app: TikTok, com.zhiliaoapp.musically or com.ss.android.ugc.trill)
WHERE THINGS ARE: bottom bar Home, Friends/Shop, + (Create, middle), Inbox, Profile (bottom-right).
HIS VIDEOS: Profile → the video grid; newest is top-left (a pinned video may be first, it has a "Pinned" label: skip it unless he means it).
UPLOAD: use "list videos" → "prepare video <n>" → his yes → "publish video <n> to tiktok" (ROSE taps + → Upload → picks the video → Next → caption with hashtags → Post). TikTok posts at once; a caption cannot be edited after posting, so read him the caption before.
COMMENTS: Profile → tap the video → the comment icon (speech bubble) on the right → the comment list slides up from the bottom → "check comments".
- "Reply" is under each comment. "View <n> more" opens hidden replies.
- The list scrolls inside the bottom sheet: "scroll down" while it is open. Closing it (tap outside / "go back") returns to the video.
- His own replies are marked "Creator"; "check comments" counts those as answered.`;

const GUIDES: Array<[RegExp, string]> = [
  [/facebook|ফেসবুক|fb\b|পেজ|page/i, FACEBOOK_GUIDE],
  [/youtube|ইউটিউব|ইউটুব|shorts|শর্টস/i, YOUTUBE_GUIDE],
  [/instagram|ইনস্টাগ্রাম|ইন্সটাগ্রাম|insta|reel/i, INSTAGRAM_GUIDE],
  [/tiktok|টিকটক|tik tok/i, TIKTOK_GUIDE],
];

/** The guide files to add to ROSE's prompt. Voice: all four. Chat: only the apps named in the recent messages. */
export function socialGuidesFor(recentText: string, mode: 'voice' | 'chat'): string {
  const picked = mode === 'voice' ? GUIDES.map((g) => g[1]) : GUIDES.filter(([re]) => re.test(recentText)).map((g) => g[1]);
  if (!picked.length) return '';
  return `\n\nSOCIAL MEDIA GUIDE FILES (ROSE Android app with ROSE Access; follow these exactly):\n${COMMON}\n\n${picked.join('\n\n')}`;
}
