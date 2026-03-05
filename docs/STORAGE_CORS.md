# Firebase Storage CORS setup (optional)

**Image uploads use ImgBB by default.** See [IMGBB.md](IMGBB.md). The steps below are only needed if you still use Firebase Storage for uploads.

Uploads from the browser to Firebase Storage require the bucket to allow your app's origin. Otherwise you get CORS errors and uploads fail.

**If you need to install the Google Cloud SDK first (to run `gsutil`):** see [INSTALL_GOOGLE_CLOUD_SDK.md](INSTALL_GOOGLE_CLOUD_SDK.md) for step-by-step Windows install and CORS commands.

## One-time setup

### Option A: Cloud Shell (no local install)

1. Open [Google Cloud Console](https://console.cloud.google.com/), select project **ux-accelerator-console**.
2. Open **Cloud Shell** (terminal icon in the top bar).
3. In the Cloud Shell editor, create `storage.cors.json` with the same contents as in the project root `storage.cors.json`.
4. In the Cloud Shell terminal run:
   ```bash
   gsutil cors set storage.cors.json gs://ux-accelerator-console.firebasestorage.app
   ```

### Option B: Local (after installing Google Cloud SDK)

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (includes `gsutil`).
2. In a new terminal:
   ```bash
   gcloud auth login
   gcloud config set project ux-accelerator-console
   ```
3. From the project root:
   ```bash
   gsutil cors set storage.cors.json gs://ux-accelerator-console.firebasestorage.app
   ```
   Or run the helper script (PowerShell):
   ```powershell
   .\scripts\set-storage-cors.ps1
   ```

If your bucket name is different, use the same value as `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env.local` (with `gs://` prefix in the command).

## "The specified bucket does not exist" (404)

Firebase projects can use either bucket name depending on when Storage was enabled:

- **Legacy:** `ux-accelerator-console.appspot.com`
- **Newer:** `ux-accelerator-console.firebasestorage.app`

**1. List your project’s buckets** (in Google Cloud SDK Shell or a terminal where `gsutil` works):

```bash
gsutil ls -p ux-accelerator-console
```

You’ll see lines like `gs://some-bucket-name/`. Use that exact name in the next step.

**2. Apply CORS to that bucket**, for example:

```bash
gsutil cors set storage.cors.json gs://ux-accelerator-console.appspot.com
```

If the list shows `gs://ux-accelerator-console.firebasestorage.app/`, use that instead.

**3. Match your app config:** Set `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env.local` to the **same** bucket (without `gs://`), e.g. `ux-accelerator-console.appspot.com`, then restart the dev server.

**If no buckets appear** (or both bucket names return 404): the project has no Storage bucket yet. Enable Storage so Firebase creates one:

1. Open **Firebase Console → Storage**:  
   **https://console.firebase.google.com/project/ux-accelerator-console/storage**
2. Click **Get started** (or **Create bucket**).
3. Choose your **location** and accept the default security rules (you can tighten them later). Click **Done**.
4. Wait a minute, then in Google Cloud SDK Shell run again:
   ```bash
   gsutil ls -p ux-accelerator-console
   ```
   You should see one bucket (e.g. `gs://ux-accelerator-console.appspot.com/` or `gs://ux-accelerator-console.firebasestorage.app/`).
5. Apply CORS to that bucket:
   ```bash
   gsutil cors set storage.cors.json gs://BUCKET_NAME_FROM_LIST
   ```
6. Set `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` in `.env.local` to that bucket name (no `gs://`), then restart the dev server.

## Verify

- Restart the dev server and try saving an Idea or Artefact with an image.
- In the browser console you should no longer see CORS errors for `firebasestorage.googleapis.com`.
