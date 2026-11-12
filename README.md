# Kashawt

Android app for a sari-sari store. Staff record every GCash cash-out by its **13-digit reference number**, so the GCash inbox can be cleared without anything being paid twice or lost.

- Take a photo or pick a screenshot. The app reads the reference number, amount, date, name and number (Google ML Kit, on the phone, works offline).
- Staff check the numbers and tap **Save**. Nothing is saved without that tap.
- Saved records sync to everyone's phones (Firebase, free plan). Works offline and syncs later.
- Same reference twice? The app warns and shows who saved it and when.
- **Taglish or English**, your choice in Settings. In Taglish the buttons are **Nakuha na** and **Hindi pa nakuha**.
- **A scan is never lost:** if you leave Check and save without saving, the app asks first, keeps a draft for 24 hours, shows it on Home, and sends a phone reminder after 10 minutes.
- Warm green design with dark mode, adjustable text size, and a two-column layout on tablets.
- Live camera with a frame guide. A phone camera app is the fallback.
- **Auto capture:** hold the receipt still and the app takes the photo by itself (switch in Settings). It still opens Check and save, never saves alone.
- **Share from GCash:** share a receipt picture or text to Kashawt and it opens Check and save.
- After Save, **Scan next** goes straight back to the camera.
- Same reference scanned again? The warning shows on Check and save at once, with **Show saved record** (or **Mark as paid** if it is pending).
- **Mark paid** button on pending rows, with Undo for a few seconds.
- The name is filled in from an earlier record with the same number.
- The person who saved a record can **Edit** it. Every change is kept in **History**.
- Record now, give the cash later: **Save · Pending**, then **Mark as paid**. Pending records turn red after 2 hours. Totals and fees count only paid records.
- Warnings for old receipts, big amounts and bad reference numbers. Undo for 5 seconds after Save.
- Fee comes from the store's rate table (pick a tier or type one).
- Records: search, dates (including a custom range), amount range, staff. The Closing totals sit at the top, with Send, Excel (CSV) and PDF export.
- Only the person who saved a record can edit or delete it.
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
