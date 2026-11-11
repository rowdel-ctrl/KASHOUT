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

**Alerts to other phones (optional):**
1. Pick a long secret name, for example `cashout-9f3k2x7q` (do not use the store name).
2. On each phone, install the free **ntfy** app and subscribe to that name.
3. In Kashawt: **Settings → Alert code**, type the same name.
4. The message has only the person's name and the amount. No reference number and no customer data.

---

## Part 7. Test before using it for real

Do these once, with fake or test receipts.

1. **Reading receipts.** Take 10 photos or screenshots of the 4 receipt types (inbox messages, Transaction Details, photo of another phone). The reference number should be right at least 9 times out of 10. Staff must always check it before Save.
2. **Offline.** Turn on airplane mode on phone A. Save a cash-out. The Home pill says **Offline** or **Waiting to sync**. Turn airplane mode off. Phone B should show the record, only once.
3. **Duplicate.** Save the same reference twice. The second time you get **Already saved** with who and when.
4. **Not on the list.** Sign in with a Google account that is not on the allowlist. You should see **This account is not allowed** and no records.
5. **Undo.** Save, tap **Undo** within 5 seconds. The record disappears and the form comes back.
6. **Closing and export.** Open **Records**. The Closing card shows the total for the dates you chose. Tap **Send** for the summary alert, and **Export** for Excel or PDF.
7. **Dark mode and text size.** Open **Settings** and try **Theme** and **Text size**.
8. **Delete.** Open a record you saved and tap **Delete this record** twice. You cannot delete a record someone else saved.

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
