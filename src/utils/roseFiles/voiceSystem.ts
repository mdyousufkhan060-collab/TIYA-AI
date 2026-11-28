/**
 * ROSE file: HOW ROSE'S PREMIUM VOICE WORKS — the locked list. One topic per file.
 * Every rule here was asked for by the owner (MD YOUSUF KHAN) and tested; a later change must keep all of them.
 * Each part lives in its own file, so changing one never breaks another:
 *   src/lib/quietMic.ts        mic stays open (no start beep), voice band only (120 Hz – 4 kHz: no car/fan/TV rumble),
 *                              speech must stand above the room noise, 1.2 s of quiet ends his sentence (never cut him
 *                              off), live partial every ~2 s while he talks
 *   src/lib/voiceCaptions.ts   his words show live in the chat while he talks; ROSE's reply types itself in step with
 *                              her voice (never the whole text first)
 *   src/lib/pcmStream.ts       ROSE's voice plays while it streams in (first sound ~0.7 s after the server starts)
 *   src/lib/voiceMute.ts       the small mic button is MUTE while voice is on
 *   src/hooks/usePremiumVoice.ts  the talk loop: listen → server STT → answer (phone actions as tool calls, fixed
 *                              recipes like Facebook comment replies) → stream the voice → listen again
 *   supabase/functions/tiya-premium/index.ts  server: Groq Whisper STT (Gemini backup, only the main close speaker),
 *                              thinking off for voice, streamed Gemini TTS (old one as backup), time of every step logged
 *   src/lib/quickAnswers.ts    time, date, day: answered at once from the phone's clock (never Google, never the AI)
 *   src/lib/replyRequest.ts    "reply to my post/video comments" + which post (দুই নম্বর, দুনামবার, ২য়, second); starts the fixed reply job
 *   LOCKED go to video N: replyRequest.goToPostNumber → "go to post N" → stops there → "আমি তোমার N নম্বর ভিডিওর কাছে আছি। এখন কী করবো বলো?"; "reply here" after it = that same video
 *   LOCKED (Nov 28 9:13 PM, owner): public/demos/view.html preview (PHONE + COMPUTER / PHONE / COMPUTER, fills the screen, no black edges). Do not change.
 *   LOCKED (Nov 28 9:10 PM, owner, FINAL): BUSINESS PREMIUM = PERSONAL · STUDENT + 1,500 Tk (1m 3,000 · 3m 5,500 · 6m 7,000 · 9m 9,500 · 12m 12,000),
 *     only Business changes the website design; same CONDITIONS (src/utils/planConditions.ts) for every plan. Do not change.
 *   LOCKED (Nov 28 8:36 PM, owner): website plans + ROSE PLANS GUIDE: src/utils/storePlans.ts, liveStorePrices.ts, roseFiles/plansGuide.ts,
 *     DB store_plan_totals / store_plan_price / start_website_trial (10 days) / _approve_store_payment (plan starts on the purchase day) /
 *     store_design_allowed (only BUSINESS PREMIUM changes the design). Do not change.
 *   LOCKED (Nov 28 8:14 PM, owner): /start page (src/components/site/StartStorePage.tsx) pink square-corner design, full width, designs left + sign-in/form right on computers. Do not change.
 *   LOCKED (Nov 28 7:53 PM, owner): public/demos/index.html pink design (hero + laptop, 4 steps, card list). Do not change.
 *   LOCKED (Nov 28 7:04 PM, owner): shop Account → "Store admin" ALWAYS opens the website owner's 6-bar WORKSPACE
 *     (App.tsx sets sessionStorage rose_from_store → WorkspacePage reads it even in MODE ADMIN · ALL). Do not change.
 *   LOCKED (Nov 28 6:31 PM, owner 100%): "ফেসবুকে ঢুকো" = only open Facebook + say so (pageRequest.asksOpenFacebookOnly);
 *     "নিচে স্ক্রল করো" = one feed post down + whose post ("feed next", Android FeedNext.kt); "হোম স্ক্রিন" = phone
 *     home and stay (asksPhoneHome); back to ROSE by the ball = stop the job and talk (rose-user-back, JobGuard.kt)
 *   LOCKED video by age: replyRequest.postAgeMinutes ("৩ ঘণ্টা আগে") → "find post age <min>" (Android PostByTime.kt) → exact: go on / ask; closest: "এটাতে ঢুকবো?" → yes → "open comments here" (+ reply all)
 *   src/lib/nameCall.ts        calls him by name ("ঠিক আছে ইউসুফ, …"); "রোজ" alone → "জি ইউসুফ, আমি আছি…"
 *   LOCKED CLEAR WORDS: tiya-premium callStt keeps unsure Bengali words (no more broken sentences); when Whisper is
 *                              unsure, Gemini listens once more (max 7 s). usePremiumVoice: an answer with no words
 *                              is asked again once, then ROSE says "কথাটা ঠিক ধরতে পারিনি" (never silent, never stuck)
 *   LOCKED NEVER SILENT: supabase/functions/tiya-premium/ttsGuard.ts (skips a voice model/key that is out of Google quota
 *                              or broken, tries every TTS model the key has) + src/lib/phoneVoice.ts and Android
 *                              RoseSpeak.kt (the phone's own voice says the words when the server gives no sound)
 *   phoneActions waitNativeResult  comment jobs get time: open post 90 s, reply all 4 min (was 20 s → "দেরি হচ্ছে")
 *   usePremiumVoice watchdog   a phone step with no result for 30 s (or 12 steps) → ROSE says so and listens again, never silent
 *   usePremiumVoice wantsWebAnswer + LIVE ANSWER  news, prices, weather, scores: the server's Google search answers and
 *                              ROSE says it on her home screen; a question is never turned into "open Google"
 *   src/utils/prompts.ts (ownerTimeContext) + roseFiles/talkWithAdmin.ts  back after 30+ minutes: one warm playful line
 *                              with the real clock times
 */
export const VOICE_SYSTEM = `ROSE VOICE (for questions about how the voice works): ROSE listens all the time while voice is on without the start beep; she hears only the person close to the phone (TV, traffic, fans and far voices are filtered out); she waits about 1.2 seconds after he stops so she never cuts him off; his words appear live in the chat while he talks and her reply types itself while she speaks; the small mic button mutes his microphone while ROSE stays on; when he comes back after 30 minutes or more she notices it once with the real times. Time and date come from the phone's clock; news, prices and weather from a web search she reads out herself. She never opens Google or a browser to answer a question.`;
