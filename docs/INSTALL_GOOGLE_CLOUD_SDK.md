# How to install Google Cloud SDK (Windows)

Use the SDK to run `gsutil` once so your Firebase Storage bucket allows uploads from your app (CORS). These steps are for Windows.

---

## Step 1: Download the installer

1. Open: **https://cloud.google.com/sdk/docs/install**
2. Under **Windows**, click **Download the Cloud SDK installer**.
   - Or direct link: **https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe**
3. Save and run **GoogleCloudSDKInstaller.exe**.

---

## Step 2: Run the installer

1. If Windows asks, choose **Yes** to allow the app to make changes.
2. Follow the wizard:
   - **Install location**: default is fine (e.g. `C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk`).
   - If asked, leave **"Run gcloud init"** checked so you can sign in right after.
3. Click **Install** and wait for it to finish.
4. Click **Finish**. A **Google Cloud SDK Shell** window may open; if not, go to Step 3.

---

## Step 3: Open a terminal where the SDK is available

Do one of the following:

- **Option A**: From the Start menu, open **Google Cloud SDK Shell** (or **gcloud**).
- **Option B**: Close and reopen **PowerShell** or **Command Prompt** (so it picks up the new PATH), then go to Step 4.

---

## Step 4: Sign in and set the project

In that terminal, run these one at a time:

```bash
gcloud auth login
```

- A browser window opens. Sign in with the **Google account that owns the Firebase project** (ux-accelerator-console).
- When it says “You are now logged in”, you can close the browser tab.

Then:

```bash
gcloud config set project ux-accelerator-console
```

You should see: `Updated property [core/project].`

---

## Step 5: Apply CORS to your Storage bucket

Your project may use either `ux-accelerator-console.appspot.com` (legacy) or `ux-accelerator-console.firebasestorage.app` (newer). If you get **404 The specified bucket does not exist**, use the bucket that actually exists.

**5a. List buckets** (same terminal, project folder):

```bash
cd "c:\Users\alici\Downloads\UI UX-20260228T013127Z-1-001\UI UX\b_8DClys4PODx-1772585174198"
gsutil ls -p ux-accelerator-console
```

You’ll see one or more lines like `gs://ux-accelerator-console.appspot.com/`. Note the bucket name.

**5b. Set CORS on that bucket** (use the name from the list; often the legacy one):

```bash
gsutil cors set storage.cors.json gs://ux-accelerator-console.appspot.com
```

If your list showed a different bucket (e.g. `gs://ux-accelerator-console.firebasestorage.app/`), use that instead.

**5c. Match your app:** In `.env.local`, set `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` to that bucket **without** `gs://` (e.g. `ux-accelerator-console.appspot.com`). Restart the dev server and try uploading again.

---

## Troubleshooting

| Issue | What to do |
|--------|------------|
| **"gsutil is not recognized"** | Use **Google Cloud SDK Shell** from the Start menu, or restart your terminal so PATH updates. |
| **"Access denied" / 403** | Use the Google account that has owner or editor access to the Firebase project. |
| **"Bucket not found"** | In Firebase Console → Project settings, check **Storage bucket** and use that exact name with `gs://` in the command. |

For more on why CORS is needed, see [STORAGE_CORS.md](STORAGE_CORS.md).
