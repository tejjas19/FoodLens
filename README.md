# FoodLens

Snap a photo of a meal and get calories, macros, vitamins, minerals, a health score, healthier swaps and recipes. Save meals to a history with daily and monthly trends, and share dishes in a community feed.

Built with TanStack Start (React 19), Tailwind, Supabase (auth, Postgres, storage) and the Google Gemini API.

## Quick start

```sh
cp .env.example .env      # fill in your Supabase URL/key and Gemini key
npm install
npm run dev               # http://localhost:8080
```

The database must exist first: run `supabase/migrations/20260101000000_foodlens_schema.sql` in your Supabase project's SQL Editor.

## Deploying

See [DEPLOY.md](./DEPLOY.md) for the full walkthrough: Supabase setup, Google sign-in, Gemini key, and deploying to Vercel (or Netlify, Cloudflare, or any Node host).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 8080 |
| `npm run build` | Production build (target picked by `NITRO_PRESET`, Vercel auto-detected) |
| `npm run test` | Unit tests |
| `npm run lint` | ESLint |

## Layout

- `src/routes` pages, `src/components` UI
- `src/lib/food-ai.ts` Gemini prompt, call and response validation
- `src/lib/food.functions.ts` authenticated server function that scans a meal
- `src/integrations/supabase` Supabase clients and auth middleware
- `supabase/migrations` database schema, security rules and storage buckets
