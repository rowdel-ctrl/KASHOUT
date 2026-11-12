# Setup guide

Everything here is free. You need a Google account and a GitHub account (you already have both).
Do the steps in order. Total time: about 45 minutes.

You will end up with: one APK file you install on each phone.

---

## Part 1. Firebase (the shared database)

### 1.1 Create the project
1. Go to <https://console.firebase.google.com> and click **Create a project**.
2. Name it `kashawt`. Turn **Google Analytics off**. Click **Create**.
3. Make sure you stay on the **Spark (free)** plan. Never click Upgrade.

### 1.2 Turn on Google sign-in
1. Left menu: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → switch **Enable** on → pick your email as the support email → **Save**.

### 1.3 Create the database
1. Left menu: **Build → Firestore Database → Create database**.
2. Location: **asia-southeast1 (Singapore)** is closest to the Philippines.
3. Choose **Production mode** → **Create**.

### 1.4 Add the security rules

> After an app update, copy `firestore.rules` into Firebase again and tap **Publish**. New features (Edit, Undo for Mark as paid) need the new rules.
1. In Firestore, open the **Rules** tab.
2. Delete everything there. Open the file `firestore.rules` from this repository, copy all of it, paste it in.
3. Click **Publish**.

### 1.5 Add who may use the app (the allowlist)
Only the emails on this list can read or save records. Everyone else is blocked.

1. In Firestore, open the **Data** tab → **Start collection**.
2. Collection ID: `config` → Next.
3. Document ID: `allowlist`.
4. Add one field: name `emails`, type **array**. Add each person's Gmail address as a string.
   **Use lowercase letters only**, for example `ana@gmail.com`.
5. Save.

To add or remove a person later, edit this document. Never put these emails on GitHub.

---

## Part 2. The signing key

The signing key proves that each new APK comes from you. **If you lose it, nobody can update the app without uninstalling it first.** Keep a copy somewhere safe (not in GitHub).

On any computer that has Java (or in Google Cloud Shell, <https://shell.cloud.google.com>), run:

```bash
keytool -genkeypair -v -keystore release.keystore -alias cashout -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and some details. Write the password down. Then turn the file into text:

```bash
base64 -w0 release.keystore
```

Copy the long text it prints. You need it in Part 4.

---

## Part 3. Connect the Android app to Firebase

1. In Firebase, click the gear icon → **Project settings**.
2. Under **Your apps**, click the Android icon.
3. **Android package name:** `ph.store.cashoutlog` (exactly like this).
4. Skip the SHA-1 for now. Click **Register app**, then **Download google-services.json**. Skip the other steps.
5. Convert that file to text on your computer:

   ```bash
   base64 -w0 google-services.json
   ```

   Copy the long text.
6. Still in Project settings, under **Your apps**, click **Add app → Web** (the `</>` icon). Name it `web`. Register it.
   Copy only the value of **apiKey** from the code it shows. (It looks like `AIzaSy...`.)

---

## Part 4. Give the secrets to GitHub

In your GitHub repository: **Settings → Secrets and variables → Actions → New repository secret**. Add these 6:

| Name | Value |
|---|---|
| `GOOGLE_SERVICES_JSON_BASE64` | the long text from Part 3, step 5 |
| `FIREBASE_WEB_API_KEY` | the apiKey from Part 3, step 6 |
| `KEYSTORE_BASE64` | the long text from Part 2 |
| `KEYSTORE_PASSWORD` | the password you chose in Part 2 |
| `KEY_ALIAS` | `cashout` |
| `KEY_PASSWORD` | the same password (or the key password if you set a different one) |

---

## Part 5. Build the APK

1. Open the **Actions** tab of the repository.
2. Click **Build Android APK** → **Run workflow** (or just push a change).
3. Wait about 5 to 10 minutes. Open the finished run.
4. At the bottom, under **Artifacts**, download **cashout-log-apk**. Unzip it. Inside is `cashout-log.apk`.
5. On the run page, open **Summary**. You will see **Signing fingerprint** with a `SHA1:` line. Copy that line.

### Add the fingerprint to Firebase (needed for Google sign-in)
1. Firebase → Project settings → your Android app → **Add fingerprint**.
2. Paste the SHA-1. Save.
3. Download **google-services.json** again, convert it to text again (`base64 -w0`), and replace the `GOOGLE_SERVICES_JSON_BASE64` secret.
4. Run the workflow once more and download the new APK. Use this one.

---

## Part 6. Install on each phone

1. Send `cashout-log.apk` to the phone (WhatsApp, Google Drive, USB).
2. Open it. Android asks to allow **Install unknown apps** for that app. Allow it.
3. Play Protect may warn that the app is not from the Play Store. Choose **Install anyway**.
4. Open the app and tap **Sign in with Google**. Use an email that is on the allowlist.

**Updating later:** build a new APK and install it over the old one. Records are not lost. This only works if you sign with the same key every time.

**Alerts when someone saves a cash-out (automatic):**
1. Kashawt makes one secret alert name for your store the first time it opens. All your phones share it. Nobody types a code.
2. Install the free **ntfy** app from the Play Store on each phone (once).
3. In Kashawt, open **Settings** and tap **Turn on** next to **Phone alerts**. It opens ntfy already set up. Tap **Subscribe**.
4. Tap **Send** next to **Send a test alert** to check that every phone gets it.
5. From then on, every saved cash-out sends a short alert like "Ana: ₱500 cashed out" to every phone with alerts on. It has no reference number and no customer name.

Alerts only work on phones that did step 3. The phone that saved also gets its own alert.

---

## Part 7. Test before using it for real

Do these once, with fake or test receipts.

1. **Reading receipts.** Take 10 photos or screenshots of the 4 receipt types (inbox messages, Transaction Details, photo of another phone). The reference number should be right at least 9 times out of 10. Staff must always check it before Save.
2. **Offline.** Turn on airplane mode on phone A. Save a cash-out. The Home pill says **Offline** or **Waiting to sync**. Turn airplane mode off. Phone B should show the record, only once.
3. **Duplicate.** Save the same reference twice. The second time you get **Already saved** with who and when.
4. **Not on the list.** Sign in with a Google account that is not on the allowlist. You should see **This account is not allowed** and no records.
5. **Undo.** Save, tap **Undo** within 5 seconds. The record disappears and the form comes back.
6. **Alerts.** On phone A, open Settings and tap **Send a test alert**. Phone B (with alerts on) should show it. Then save a cash-out on phone A. Phone B should get "Name: amount cashed out".
7. **Closing and export.** Open **Records**. The Closing card shows the total for the dates you chose. Tap **Send** for the summary alert, and **Export** for Excel or PDF.
8. **Dark mode and text size.** Open **Settings** and try **Theme** and **Text size**.
9. **Pending.** Scan a receipt and tap **Save · Pending**. Home shows an amber **pending** card. Open the record and tap **Mark as paid**. It turns green and shows who paid. On a second phone, check that the alerts say "pending" and then "cashed out".
10. **Auto capture.** Open **Record a cash-out** and hold a receipt still inside the frame. The frame turns green and **Check and save** opens by itself within about a second. Turn it off in Settings > Scanning > **Take photo automatically**. If it never starts, move closer or add light. The round button always works.
11. **Share.** Open a receipt picture in GCash or the Gallery, tap Share, pick **Kashawt**. **Check and save** opens with the details. Nothing is saved until you tap Save.
12. **Edit.** Open a record you saved and tap **Edit**. Change the amount, save, then tap **Edited · 1 change** to see the old and new values. You cannot edit a record someone else saved.
13. **Mark paid.** In **Records > Pending**, tap **Mark paid** on a row. Tap **Undo** in the message within a few seconds to put it back.
14. **Language.** Settings > Language: Taglish or English. Check that the save buttons read **Nakuha na** and **Hindi pa nakuha** in Taglish.
15. **Unsaved scan.** Scan a receipt, then tap Back. You should be asked **Hindi pa na-save ito**. Choose **Itago muna (draft)**. Home shows a blue card with **Ituloy**. After 10 minutes the phone shows a reminder (allow notifications when asked).
16. **Delete.** Open a record you saved and tap **Delete** twice. You cannot delete a record someone else saved.

You can also test the security rules on a computer: `npm run test:rules` (needs Java).

---

## Staying inside the free plan

Firebase Spark gives 50,000 reads and 20,000 writes per day. The app loads only the newest 3,000 records, so a few phones and a store with many cash-outs a day stay well inside this. Check usage at Firebase → Usage and billing.

## Privacy

- Records hold customer names and phone numbers. Anyone on the allowlist can see all of them.
- The receipt photo kept with each record is a small thumbnail. You can turn it off in Settings.
- Use only fake numbers in tests.
- Never commit `google-services.json`, the keystore, the allowlist or the ntfy topic. The `.gitignore` already blocks the first two.

## If something goes wrong

| Problem | What to check |
|---|---|
| Google sign-in fails on the phone | The SHA-1 from Part 5 must be in Firebase, and `google-services.json` must be downloaded again after adding it. |
| "This account is not allowed" | The email is not in `config/allowlist`, or has capital letters. |
| App says Demo mode | The build ran without `GOOGLE_SERVICES_JSON_BASE64`. Add the secret and build again. |
| Records do not load, "requests blocked" | Add the `FIREBASE_WEB_API_KEY` secret (Part 3, step 6) and build again. |
| APK will not install over the old one | It was signed with a different key. Uninstall first (records stay in the cloud). |
