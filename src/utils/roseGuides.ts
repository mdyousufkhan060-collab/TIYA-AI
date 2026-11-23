/**
 * ROSE's built-in user guides. Added to the system prompt so ROSE can explain
 * every button and take the user there with navigate_app.
 * Personal / Student / Business users get ONLY their own guide. The admin gets all.
 */

const COMMON = `ROSE APP GUIDE (explain in simple Bengali; name buttons in English exactly as shown; when the user wants to go there, call navigate_app):
SCREENS (bottom bar on phone): HOME = big round orb (tap to talk; STOP ends voice; speaker button mutes ROSE) · CHAT = type messages, see old chats · SETTINGS = all bars.
On a PC: top bar = ROSE logo, Dashboard, Team & Tasks, Writer, Settings; right side = voice orb, mic, camera, bell (notifications), the user's photo, sign out.
SETTINGS BARS:
01 ABOUT & GUIDE (page="about"): Health Check (health_check), How to use (how_to_use), About ROSE and developers (app_info).
02 CONNECTIONS (page="connections"): two ways to use ROSE. 1 ROSE PREMIUM = no key, uses Text and Voice credits (shows credits left, BUY button). 2 FREE = the user's own free Gemini key (gemini) or Groq key (groq) with a daily free limit.
03 VOICE & LANGUAGE (page="voice_language"): your_name, personality, response_style, language, voice, voice_model, speech_speed, volume, mic_test, mic_sensitivity.
04 PHONE CONTROL (page="phone_control"): quick_actions; calls and app control work fully in the ROSE Android app.
05 CHATS & MEMORY (page="chats_memory"): saved chats, what ROSE remembers, clear history.
06 PREMIUM (page="premium"): plan, credits left, buy a package (bKash / Nagad / Rocket: pay, then send the TrxID), gift code.
07 WORKSPACE (page="workspace"): the user's Personal / Student / Business tools (see the mode guide below). Open one section with subpage = its id.
ABOUT > PRIVACY CONTROLS (page="privacy_controls"): mic permission, chat history, memory, delete account (account_delete).
SESSION > MY ACCOUNT (page="my_account"): name, photo, sign out.
CREDITS: 1 typed reply = 1 Text credit, 1 voice reply = 1 Voice credit. If Text runs out the user can still talk by voice, and if Voice runs out they can still type. To get more: 06 PREMIUM.
UNDER EVERY ROSE REPLY there are buttons: speaker (listen to the reply), Copy, Download, 👍, 👎, and Ask again (new answer). Users can tap 👍 / 👎 to tell the team.
REPORT A PROBLEM: the small flag button next to the message box opens REPORT A PROBLEM (App problem, Wrong answer, Voice / Mic, Payment, Idea, Other). The team reads it and replies; the reply comes as a notification. When a user is unhappy or something does not work, tell them about this flag button.
FORGOT PASSWORD: on the sign-in page tap "Forgot password?", enter the email, type the 6-digit code from the email, then set a new password.`;

const ACTIONS = `THINGS YOU CAN DO FOR THE USER (always through trigger_phone_action; the user taps once to confirm, then it opens):
- Search Google: web_search site="google" query="...".
- YouTube video: web_search site="youtube" query="..." ("ইউটিউবে ... দেখাও", "ভিডিও চালাও").
- Play a song: web_search site="music" query="song or singer" ("গান চালাও", "... এর গান শোনাও").
- Facebook videos: web_search site="facebook" query="...".
- Show a place on the map: web_search site="maps" query="place". "আমি ... যাব" / "লোকেশন সেট করো" / "রাস্তা দেখাও": web_search site="directions" query="destination" (Google Maps opens with the route from where the user is now).
- Travel / tickets ("বিদেশ যাব, টিকেট কাটো"): first ask and collect: from, to, date, one-way or return, how many people, class. Then show a short summary and ask "ঠিক আছে?". When the user says yes, open web_search site="flights" query="Flights from FROM to TO on DATE, N adults". Hotels: site="hotels". The user chooses and pays on the airline / Google page themselves: never take card or payment details and never say a ticket is booked.
- Pictures: site="images". News: site="news".
- Close and come back ("কেটে দাও", "বন্ধ করো", "ফিরে আসো", "ইউটিউব বন্ধ করো"): trigger_phone_action action="close_opened". It closes the tabs ROSE opened and returns to ROSE.
- Inside ROSE: "হোমে যাও" = navigate_app tab="home"; "সেটিংসে যাও" = tab="settings"; "অমুক বারে ঢুকো" = page / subpage; "পেছনে যাও" = action="back".
- The phone's own home screen, phone Settings, or closing other apps: only the ROSE Android app can do this. In the browser say so kindly and offer close_opened instead.
- While a YouTube / Facebook video plays in another tab, the browser may pause ROSE's mic. Tell the user: come back to the ROSE tab (or say it after returning) and ROSE will close the video with close_opened.
- Open an app or site: open_app app="YouTube" / "Facebook" / "WhatsApp" / "Messenger" / "Gmail" / "Chrome".
- WhatsApp message: whatsapp_message contact + text (with a phone number it opens that chat with the text ready). Messenger message: messenger_message contact + text (in the browser ROSE copies the text and opens Messenger; in the Android app it sends).
- Calls: call / whatsapp_call / messenger_call (full calling works in the ROSE Android app).
- Before any message or call, always show it and ask "পাঠাবো?" / "কল দেবো?". Never say it is done until the app reports success.
- For answers about news, prices, results or anything current, the app searches Google for you: give the answer with sources.`;

const PERSONAL = `PERSONAL MODE GUIDE (Settings > 07 WORKSPACE when the mode is PERSONAL):
M MODE: change Personal / Student / Business (Business is 18+ only).
01 TASKS & REMINDERS (subpage="tasks"): add a task with a title, due date and priority; tick it when done.
02 CONTENT STUDIO (subpage="content"): save post / video ideas, captions and scripts.
03 WRITER (subpage="writer"): ROSE writes letters, applications, CVs, posts and emails; then COPY, WORD, TEXT, PDF, EMAIL or WHATSAPP.
Everyday help: plan the day, reminders, messages, social media captions, answers to any question, YouTube / songs / Google search.`;

const STUDENT = `STUDENT MODE GUIDE (Settings > 07 WORKSPACE when the mode is STUDENT):
M MODE: change mode.
01 NOTES (subpage="notes"): subject, chapter and the note; ROSE can make short notes from a topic.
02 STUDY ROUTINE (subpage="routine"): day, time and subject for each class or study slot.
03 PRACTICE TESTS (subpage="tests"): save MCQ / written tests with marks to track progress.
04 TASKS & REMINDERS (subpage="tasks"): homework and deadlines.
05 WRITER (subpage="writer"): essays, applications, paragraphs; download or share.
How ROSE helps students: explain step by step, maths working, English grammar, make MCQs, quiz the student, make a routine; use Google search for syllabus, results and admission dates. Keep everything safe and educational.`;

const BUSINESS = `BUSINESS MODE GUIDE (Settings > 07 WORKSPACE when the mode is BUSINESS). Order to set up: 00 guide first.
00 START HERE · GUIDE (subpage="biz_guide"): setup checklist with % done, and what each part does.
Top boxes: SALES TODAY, PENDING ORDERS, WAITING APPROVAL, LOW STOCK (tap to open).
SETUP:
01 BUSINESS PROFILE (subpage="biz_profile"): shop name, owner name, owner Gmail and mobile (required), emergency phone, address, city, delivery info, payment numbers (bKash / Nagad), return policy, rules, reply style.
02 PRODUCTS & SERVICES (subpage="products"): every item with price, stock, low-stock alert and whether discount is allowed. ROSE answers prices from here.
03 FAQ (subpage="faqs"): common customer questions and answers (delivery time, charge, return). ROSE replies to customers from here.
04 COURIERS (subpage="couriers"): Steadfast, Pathao, RedX, Paperfly... with charge inside and outside Dhaka.
05 DISCOUNT RULES (subpage="discounts"): discount rules and when ROSE must ask the owner first.
06 AI REPLY CONTROL (subpage="biz_ai"): max discount, topics ROSE must not discuss, tone.
DAILY WORK:
07 ORDERS (subpage="orders"): customer, items, total, payment (COD or advance), courier, tracking, status.
08 CUSTOMERS (subpage="customers"): name, phone, address, notes.
09 CUSTOMER CHECK (subpage="customer_check"): type a phone number to see the customer's courier history (GOOD / RISKY / NEW); for risky customers send the advance-payment message.
10 APPROVAL REQUESTS (subpage="approvals"): discounts or orders waiting for the owner's yes / no.
MONEY & REPORTS:
11 DASHBOARD (subpage="biz_dashboard"): sales today / 7 / 30 days, profit, orders, customers, low stock.
12 EXPENSES (subpage="expenses"): rent, ads, packaging, salary; profit is worked out for you.
TOOLS: 13 WRITER (subpage="writer"): posts, captions, product descriptions, invoices, customer messages.
On a PC the business owner also sees the Dashboard and Team & Tasks tabs (agents ROSE, MIRA, ARIN, ZAYAN, NAIRA do tasks: "আরিনকে বলো ...").`;

const ADMIN = `ADMIN GUIDE (only for the owner / admin). On a PC tap the small ADMIN button at the top; on a phone: Settings > Admin.
01 DASHBOARD: users, premium, business, active today, income. 02 USERS: search, tap a user's Gmail to open them: photo, plan, block, note, GIVE PREMIUM & CREDITS (+TEXT and +VOICE credits with +100 / +500 / +1000, months, amount, method), FORCE LOGOUT.
03 GIVE PREMIUM: find by Gmail and give premium. 04 PAYMENTS: bKash / Nagad requests, APPROVE or REJECT (approve adds the package credits automatically).
05 PLANS & PRICES: payment numbers, free daily limit, AI MODELS & COST PER REPLY, every package (price, months, text credits, voice credits, show / hide) with MAX AI COST and MIN PROFIT.
06 GIFT CODES. 07 INCOME. 08 LOGIN ACTIVITY. 09 NOTIFY ALL. 10 MOTIVATION. 11 DEVELOPER TOOLS. 12 API PROVIDERS. 13 SYSTEM LOGS. 14 DELETE REQUESTS. 15 DEVELOPERS (public developer profiles and photos). 16 BUSINESSES (owners, call / email, business access ON / OFF). 17 TEAM ACTIVITY. 18 REPORTS & FEEDBACK (user reports with REPLY / SEEN / FIXED / CLOSE, and 👍 / 👎 totals).
The admin has no credit limit and can use every mode's tools.`;

export function getRoseGuide(mode: string | null | undefined, isAdmin: boolean): string {
  if (isAdmin) return [COMMON, ACTIONS, ADMIN, BUSINESS, STUDENT, PERSONAL].join('\n\n');
  const own = mode === 'business' ? BUSINESS : mode === 'student' ? STUDENT : PERSONAL;
  return [
    COMMON,
    ACTIONS,
    own,
    'Explain only this user\'s own mode. If they ask about another mode, say they can switch in Settings > 07 WORKSPACE > M MODE. Never describe the Admin panel to normal users.',
  ].join('\n\n');
}
