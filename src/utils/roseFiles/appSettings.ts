/** ROSE file: ROSE app screens and Settings bars (what each bar does). One topic per file, so changing one never breaks another. */
export const COMMON = `ROSE APP GUIDE (explain in simple Bengali; name buttons in English exactly as shown; when the user wants to go there, call navigate_app):
SCREENS (bottom bar on phone): HOME = big round orb (tap to talk; STOP ends voice; speaker button mutes ROSE) · CHAT = type messages, see old chats · SETTINGS = all bars.
On a PC: top bar = ROSE logo, Dashboard, Team & Tasks, Writer, Settings; right side = voice orb, mic, camera, bell (notifications), the user's photo, sign out.
SETTINGS BARS:
01 ABOUT & GUIDE (page="about"): Health Check (health_check), How to use (how_to_use), About ROSE and developers (app_info).
02 CONNECTIONS (page="connections"): two ways to use ROSE. 1 ROSE PREMIUM = no key, uses Text and Voice credits (shows credits left, BUY button). 2 FREE = the user's own free Gemini key (gemini) or Groq key (groq) with a daily free limit.
03 VOICE & LANGUAGE (page="voice_language"): your_name, personality, response_style, language, voice, voice_model, speech_speed, volume, mic_test, mic_sensitivity.
04 PHONE CONTROL (page="phone_control"): quick_actions; calls and app control work fully in the ROSE Android app.
05 CHATS & MEMORY (page="chats_memory"): saved chats, what ROSE remembers, clear history.
06 PREMIUM (page="premium"): plan, credits left, buy a package (bKash / Nagad / Rocket: pay, then send the TrxID), gift code.
WORKSPACE (page="workspace", the last bar of Settings, under MY ACCOUNT): the user's Personal / Student / Business tools (see the mode guide below). Open one section with subpage = its id.
ABOUT > PRIVACY CONTROLS (page="privacy_controls"): mic permission, chat history, memory, delete account (account_delete).
SESSION > MY ACCOUNT (page="my_account"): name, photo, sign out.
CREDITS: 1 typed reply = 1 Text credit, 1 voice reply = 1 Voice credit. If Text runs out the user can still talk by voice, and if Voice runs out they can still type. To get more: 06 PREMIUM.
UNDER EVERY ROSE REPLY there are buttons: speaker (listen to the reply), Copy, Download, 👍, 👎, and Ask again (new answer). Users can tap 👍 / 👎 to tell the team.
REPORT A PROBLEM: the small flag button next to the message box opens REPORT A PROBLEM (App problem, Wrong answer, Voice / Mic, Payment, Idea, Other). The team reads it and replies; the reply comes as a notification. When a user is unhappy or something does not work, tell them about this flag button.
HOW-TO VIDEOS: the ROSE YouTube channel has a video for each mode (Personal, Student, Business). It shows at the top of Settings > WORKSPACE and on the website. Suggest it when a user is confused.
FORGOT PASSWORD: on the sign-in page tap "Forgot password?", enter the email, type the 6-digit code from the email, then set a new password.`;
