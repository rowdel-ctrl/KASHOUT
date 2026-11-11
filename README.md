# Cash-out Log

Android app for a sari-sari store. Staff record every GCash cash-out by its **13-digit reference number**, so the GCash inbox can be cleared without anything being paid twice or lost.

- Take a photo or pick a screenshot. The app reads the reference number, amount, date, name and number (Google ML Kit, on the phone, works offline).
- Staff check the numbers and tap **Save**. Nothing is saved without that tap.
- Saved records sync to everyone's phones (Firebase, free plan). Works offline and syncs later.
- Same reference twice? The app warns and shows who saved it and when.
- Warnings for old receipts and big amounts. Undo for 5 seconds after Save.
- Fee comes from the store's rate table. Search, daily Closing totals, Excel (CSV) and PDF export.
- Records older than 1 year are deleted automatically.

## Set it up

Follow **[docs/SETUP.md](docs/SETUP.md)**. About 45 minutes, all free, no card.

## For developers

```bash
npm install
npm run dev          # browser demo with sample data (no Firebase needed)
npm test             # receipt reading, fees, CSV
npm run test:rules   # Firestore security rules (needs Java; starts the emulator)
npm run build        # type-check and build the web app
```

- Web app: React + Vite + TypeScript. Android shell: Capacitor 8.
- `src/lib/parse.ts` reads the receipt text. `tests/parse.test.ts` has the four receipt layouts (all fake numbers).
- Without `android/app/google-services.json` the app runs in **demo mode** (in-memory sample data).
- The APK is built by GitHub Actions (`.github/workflows/android.yml`). No Android Studio needed.
- Nothing private is committed: the Firebase file, signing key, allowlist emails and alert topic all stay out of the repo.
