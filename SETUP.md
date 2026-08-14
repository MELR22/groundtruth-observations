# Ground Truth Observations v2 — setup

This version adds:

- Photos taken directly from the phone camera
- Photo previews before saving
- Photos displayed in map popups
- Observation categories:
  - Trail width
  - Wet trail
  - Other
- Trail width measurement in metres
- Rissa-inspired colours

The visual palette is inspired by the colours visible in the Rissa Citizen Science branding: dark blue-grey, natural green, warm yellow and soft grey.

## 1. Create the Supabase database

Create a Supabase project.

Open **SQL Editor**, paste the contents of `schema.sql`, and run it.

This creates the observation table and the `observation-photos` storage bucket.

## 2. Get your Supabase credentials

In Supabase, find the project's API settings and copy:

- Project URL
- `anon` / public key

Put them into `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_PUBLIC_ANON_KEY"
};
```

Do NOT use the `service_role` key.

## 3. Upload to GitHub

Upload these files to your repository:

- index.html
- style.css
- app.js
- config.js
- schema.sql
- SETUP.md

## 4. Enable GitHub Pages

GitHub repository:

Settings → Pages

Choose:

- Deploy from a branch
- `main`
- `/ (root)`

Then open the generated HTTPS URL on the phones.

## 5. Test photos

On a phone:

1. Select a group.
2. Wait for GPS accuracy.
3. Choose an observation category.
4. Take/select a photo.
5. Add the measurement/note if relevant.
6. Press **Save observation**.
7. Confirm the marker appears on the map.
8. Tap the marker to see the photo.

## Important for tomorrow

This version intentionally has no login system. Anyone who has the URL can submit observations and photos.

That makes it easy for a field exercise, but the database/storage policies should be tightened before using this as a long-term public application.

Also note that photos are compressed in the browser before upload, so normal phone photos should not consume excessive storage.
