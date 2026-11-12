# Kashawt: working rules

Android app (React + Vite + TypeScript + Capacitor, Firebase). Staff record GCash cash-outs.

## How to work with the owner
- **Every time the owner says to build something, show mockups first. Get their approval, then code.** This applies to every UI change, big or small. (Mockups: Design artifact.)
- Build the APK only when the owner says "build". Every build publishes a GitHub Release.
- Whenever the Firestore rules change, paste the full rules text in chat.
- Check layouts yourself before showing (browser audit at phone, tablet and landscape sizes, plus screenshots).
- Keep replies short, in plain English. Lists over prose. Skip caveats unless they change what the owner should do.
- The app is Taglish by default (English switch). Every `t('...')` key needs a Taglish entry in `src/lib/tl.ts` (a test enforces it).

## Safety
- Never put secrets, allowlist emails, the alert topic, the keystore or real customer data in the repo or in chat.
- Use fake numbers in tests and mockups.
- Do not send the owner's personal details to outside services.
