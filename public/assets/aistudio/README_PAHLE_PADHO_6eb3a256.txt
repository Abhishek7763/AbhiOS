AI STUDIO PROMPT PACK - KAISE USE KARNA HAI

Har .txt file SELF-CONTAINED hai (context + task dono andar hain).
Ek file = AI Studio me ek message. Poori file select karke copy -> paste.

Order (mat badlo):
  00  DB connection (Cloud SQL <- Vercel)      [pehle ye, sabse safe]
  01  Security hardening
  02  Real reminders  (app ka main purpose)
  03  Safe sync
  04  PWA / service worker
  05  Duty roster + routine insights
  06  UI as per sketches
  07  Refactor (sabse last)

Har step ke baad:
  1) AI Studio ka diff dekho (unrelated files badli to "revert unrelated changes" bolo)
  2) File ke andar jo CHECK likha hai wo khud chalao
  3) GitHub commit -> Vercel deploy -> phone par test
  4) Pass ho tabhi agla step

Backup: kuch bhi badalne se pehle app se JSON export le lo.
