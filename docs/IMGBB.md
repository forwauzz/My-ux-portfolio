# Image uploads (ImgBB)

Image uploads (Ideas, Artefacts, Design votes, Daily log, Sprint tracker, Knowledge vault) use [ImgBB](https://imgbb.com/) via the free API. No Firebase Storage or CORS setup is required.

## Setup

1. Get a free API key at [https://api.imgbb.com/](https://api.imgbb.com/).
2. Add to `.env.local`:
   ```env
   IMGBB_API_KEY=your_key_here
   ```
3. Restart the dev server.

Uploads go through the app’s API route (`/api/upload-image`), so the key stays server-side. Max file size is 32 MB per ImgBB limits.
