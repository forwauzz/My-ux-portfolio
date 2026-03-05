# Apply CORS to Firebase Storage bucket. Requires Google Cloud SDK (gsutil) installed and authenticated.
# Run once: gcloud auth login && gcloud config set project ux-accelerator-console
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$corsFile = Join-Path $projectRoot "storage.cors.json"
$bucket = "gs://ux-accelerator-console.firebasestorage.app"
if (-not (Test-Path $corsFile)) {
  Write-Error "Not found: $corsFile"
}
Write-Host "Applying CORS from $corsFile to $bucket ..."
& gsutil cors set $corsFile $bucket
if ($LASTEXITCODE -ne 0) {
  Write-Error "gsutil failed. Install Google Cloud SDK and run: gcloud auth login; gcloud config set project ux-accelerator-console"
}
Write-Host "Done. Restart your dev server and try uploading an image again."
