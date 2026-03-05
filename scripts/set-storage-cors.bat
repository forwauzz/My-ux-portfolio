@echo off
REM Run from Google Cloud SDK Shell. If 404, run: gsutil ls -p ux-accelerator-console
REM Then use the bucket name shown (e.g. gs://ux-accelerator-console.appspot.com) in the command below.
cd /d "%~dp0.."
if not exist storage.cors.json (
  echo Error: storage.cors.json not found in project root.
  exit /b 1
)
echo Listing buckets for project ux-accelerator-console...
gsutil ls -p ux-accelerator-console
echo.
echo Applying CORS (trying .appspot.com first; if 404, use the bucket name from the list above)...
gsutil cors set storage.cors.json gs://ux-accelerator-console.appspot.com
if errorlevel 1 (
  echo.
  echo If you saw "bucket does not exist", run: gsutil ls -p ux-accelerator-console
  echo Then: gsutil cors set storage.cors.json gs://BUCKET_NAME_FROM_LIST
  echo And set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local to that bucket name without gs://
  exit /b 1
)
echo Done. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ux-accelerator-console.appspot.com in .env.local, restart dev server, then try uploading again.
