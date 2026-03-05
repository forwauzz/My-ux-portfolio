# Deploy Learning Portfolio to the Web (Netlify + GitHub)

This app runs on **Netlify** with **Next.js** and **Firebase**. Users access it via a public URL (e.g. `https://your-site.netlify.app`). No secrets are stored in the repo; all sensitive values are set in Netlify’s dashboard.

---

## 1. Secrets and security

- **Never commit** `.env`, `.env.local`, or any file containing API keys or passwords.  
  They are listed in `.gitignore` and must stay out of the repo.
- **Firebase** config (`NEXT_PUBLIC_*`) is intended to be public (client-side SDK).  
  It is loaded from **environment variables** in Netlify, not hardcoded.
- **ImgBB** key (`IMGBB_API_KEY`) is **server-only** (used in `/api/upload-image`).  
  Set it only in Netlify **Environment variables**; it is never sent to the browser.

Before pushing or deploying, confirm:

- [ ] No `.env` or `.env.local` is tracked by Git (`git status` should not show them).
- [ ] No API keys, passwords, or tokens appear in source code (only `process.env.*`).

---

## 2. Connect this project to GitHub

If this folder is not yet a Git repo:

```bash
cd "c:\Users\alici\Downloads\UI UX-20260228T013127Z-1-001\UI UX\b_8DClys4PODx-1772585174198"
git init
git add .
git commit -m "feat: Learning Portfolio app - ready for Netlify deploy"
git branch -M main
git remote add origin https://github.com/forwauzz/My-ux-portfolio.git
git push -u origin main
```

If the repo already exists and has a different remote, point it to your repo and push:

```bash
git remote set-url origin https://github.com/forwauzz/My-ux-portfolio.git
git push -u origin main
```

Use a **personal access token** (not your password) if GitHub prompts for credentials:  
[GitHub: Creating a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token).

---

## 3. Deploy on Netlify

1. **Sign in** at [netlify.com](https://www.netlify.com) and go to **Add new site** → **Import an existing project**.
2. **Connect to GitHub** and choose the repo **forwauzz/My-ux-portfolio**.
3. **Build settings** (Netlify usually detects Next.js):
   - **Build command:** `npm run build`
   - **Publish directory:** leave empty (Next.js is handled by Netlify’s adapter).
   - **Base directory:** leave empty unless the app lives in a subfolder.
4. **Environment variables** (Site settings → Environment variables → Add variable / Import from .env):

   Add the same names as in `.env.example` (values from your local `.env.local`; do **not** commit that file):

   | Variable | Where it’s used | Secret? |
   |----------|-----------------|--------|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | Client (Firebase) | Public by design |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Client | Public |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Client | Public |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Client | Public |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Client | Public |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | Client | Public |
   | `IMGBB_API_KEY` | Server only (`/api/upload-image`) | **Yes — set in UI only** |

   Scopes: **All** or at least **Production** (and **Deploy Previews** if you use branch deploys).

5. **Deploy.** Netlify runs `npm run build` and deploys the Next.js app. Your site URL will look like `https://<random>.netlify.app` (you can change it in **Domain settings**).

---

## 4. Firebase: allow your Netlify URL

For login and Firebase features to work on the live site:

1. Open [Firebase Console](https://console.firebase.google.com) → your project.
2. **Authentication** → **Settings** → **Authorized domains**.
3. Add your Netlify domain, e.g. `your-site.netlify.app` (no `https://`).

Without this, Firebase Auth will block sign-in on the deployed URL.

---

## 5. After deploy

- **Site URL:** Netlify Dashboard → your site → **Site overview** (e.g. `https://your-site.netlify.app`).
- **Future updates:** Push to `main` on GitHub; Netlify will rebuild and deploy automatically.
- **Image uploads:** If they fail, confirm `IMGBB_API_KEY` is set in Netlify and that the key is valid in the [ImgBB API](https://api.imgbb.com/) docs.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Ensure no secrets in repo; use only env vars. |
| 2 | Push code to `https://github.com/forwauzz/My-ux-portfolio`. |
| 3 | In Netlify: import repo, set build command to `npm run build`, add all env vars from `.env.example`. |
| 4 | In Firebase: add Netlify domain to Authorized domains. |
| 5 | Deploy; share the Netlify URL so users can access the app on the web. |
