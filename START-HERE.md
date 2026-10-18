# FoodLens — How to run this on your computer

This is NOT a plain-HTML website, so the "Live Server" button in VS Code will show a blank page. This app is built with React and needs its own tiny server that comes with the project. Follow these steps once — it takes about 3 minutes.

## Step 1 — Extract
Unzip this folder anywhere (for example `Desktop/foodlens`).

## Step 2 — Open it
- **VS Code:** File → Open Folder → pick the `foodlens` folder.
- Or just open the folder in any terminal.

## Step 3 — Add your settings (once)
FoodLens needs its own free Supabase project and Gemini key. Follow steps 1 and 2 in `DEPLOY.md`, then:

- Copy `.env.example` to a new file named `.env`
- Paste your Supabase URL, publishable key and Gemini key into it

## Step 4 — Install once
Open the terminal in VS Code (menu: Terminal → New Terminal) and run:

```
npm install
```

Wait until it finishes (1–2 minutes).

## Step 5 — Start the app
Run one of these (or double-click the matching start file in the folder):

- Windows: double-click `start-windows.bat`
- Mac/Linux: run `./start-mac-linux.sh`
- Or in the terminal: `npm run dev`

## Step 6 — Open it in your browser
The terminal will show a line like:

```
Local: http://localhost:8080/
```

Ctrl+Click (or Cmd+Click) that link — FoodLens opens. Open **Sign up** and create an account with your email and a unique password (common passwords such as `Password123` are rejected). Google sign-in works once you finish the Google steps in `DEPLOY.md` (add `http://localhost:8080/**` to the Supabase Redirect URLs); phone sign-in is not available. Then open **Scan** and upload a food photo.

## To stop
Press `Ctrl + C` in the terminal. To start it again later, just do Step 5 again (no need to repeat Step 4).

---

## What's inside
- `src/` — all the app code (pages, components, AI food analysis)
- `supabase/migrations/` — the database setup to run in Supabase
- `.env.example` — template for your settings. Your real `.env` holds your keys; never share or upload it
- `DEPLOY.md` — how to put FoodLens online (Vercel + Supabase)
- `start-windows.bat` / `start-mac-linux.sh` — one-double-click starters

## Still not finished (kept as a to-do list)
See `roadmap.md` — comments on posts, daily goals/streaks, and final polish.
