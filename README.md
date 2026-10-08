# SafePath

An offline-first safety map. People can pin unsafe or safe spots (poor lighting, isolated stretches, harassment, theft, well-lit areas) with no signal and no account. Everything is saved on the device first and syncs safely when connectivity returns. If two people edit the same pin offline, the app detects it and asks the user to decide, so nothing is silently overwritten.

- Live demo: https://safepath-mha55m83r-shiz1ee.vercel.app
- Best used on a phone: live location, safety alerts and vibration depend on the device GPS.

## Features

- Leaflet map with OpenStreetMap tiles
- Pin types: dim lighting, isolated stretch, broken CCTV, blocked path, harassment, theft, well lit, busy
- Anonymous: no accounts, no personal data. A pin holds only location, type, day/night and a confirmation count
- "I saw this too" confirmations
- Safety alerts: warning banner and vibration within 150 m of a reported hazard (works offline)
- Live blue-dot location with smooth movement and a "My location" button
- Full screen map, "How it works" guide with legend, installable PWA

## Tech stack

- React
- Vite
- react-leaflet
- vite-plugin-pwa (Workbox)
- Dexie.js (IndexedDB)
- Vercel serverless functions (`api` folder)
- Upstash Redis. A small Express server in `server` is used for local development.

## Demo script

1. Open the app in two windows, both online. Drop a pin in window A and see it appear in window B.
2. Turn both offline.
3. In A, change the pin type to Harassment. In B, change the same pin to Busy.
4. Bring A online (syncs cleanly), then B. The conflict box appears. Choose Keep mine or Keep theirs.

## Credits and disclosure

- Map data and tiles: OpenStreetMap contributors
- Hosting: Vercel. Database: Upstash Redis (free tier)
- Libraries: React, Vite, react-leaflet, Leaflet, Dexie.js, vite-plugin-pwa, @upstash/redis, Express (local only)
- AI assistance: Claude (Anthropic) was used as a coding and planning assistant. The team reviewed, tested and debugged the code.

## License

See the `LICENSE` file.
