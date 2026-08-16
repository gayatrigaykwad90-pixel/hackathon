# SignalMap — Campus WiFi Dead-Zone Mapper (48-hour hackathon)

This is a demo Vite + React frontend for SignalMap. It supports a Supabase realtime backend if you provide credentials, otherwise it falls back to localStorage for quick demos.

Quick start (dev):

1. Install dependencies

```bash
npm install
```

2. Run dev server

```bash
npm run dev
```

Supabase (optional, recommended for realtime demo):

- Create a Supabase project and create a table `readings` with columns matching the JSON shape: `id text primary key, x int, y int, buildingLabel text, bars int, timestamp timestamptz`.
 - Create a Supabase project and create a table `readings` with columns matching the JSON shape: `id text primary key, x int, y int, buildingLabel text, bars int, timestamp timestamptz`.

SQL to create table (run in Supabase SQL editor):

```sql
create table public.readings (
	id text primary key,
	x int,
	y int,
	buildingLabel text,
	bars int,
	downlink numeric,
	effectiveType text,
	timestamp timestamptz
);
```
- Set the anon key and URL in your environment before running dev/seed, e.g. in `.env`:

```
VITE_SUPABASE_URL=https://your.supabase.url
VITE_SUPABASE_ANON_KEY=public-anon-key
```

- Seed demo data: `npm run seed` (will write ~40 random sample readings).
 - Seed demo data: `npm run seed` (will write ~40 random sample readings), or use the in-app "Seed demo data" button in the side panel to populate quickly (writes to Supabase if configured, otherwise localStorage).

Notes and next steps:
- Replace building names in `src/components/CampusMap.jsx` with your real campus building names.
- The app intentionally uses self-reported bars (0–4). The UI may show an auto-suggested rating when the Network Information API is available (Chrome/Android only).
- Stretch ideas: IT action view, email-domain auth via Supabase Auth, time decay for readings.
 - Stretch ideas: IT action view (built-in), email-domain auth via Supabase Auth, time decay for readings.

Remember judge one-liner: "Browsers don't expose real WiFi signal to webpages — no framework can work around that. We use self-reporting plus connection-speed as an honest proxy." 
