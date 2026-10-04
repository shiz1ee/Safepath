# SafePath

An offline-first safety map. People can pin unsafe or safe spots (poor lighting, isolated stretches, harassment, theft, well-lit areas) with no signal and no account. Everything is saved on the device first and syncs safely when connectivity returns. If two people edit the same pin offline, the app detects it and asks the user to decide, so nothing is silently overwritten.

- Live demo: https://safepath-mha55m83r-shiz1ee.vercel.app
- Problem statement: Web Development, Offline-First Application (PS ID: ALG-WEB-02)

## Problem

Many web apps become unusable when connectivity is unstable. This project is an app that stays useful offline (cache, create, edit, delete), queues changes, and synchronizes safely later, with conflicting edits from two offline devices detected and handled without silent overwrite. Safety reporting fits well because the places people most want to check or report (underpasses, lanes, parks) often have weak signal.

## Requirements covered

| Requirement | How SafePath does it |
|---|---|
| Offline cache | Service worker (vite-plugin-pwa / Workbox) caches the app shell and viewed map tiles. Pins are stored in IndexedDB. |
| Offline CRUD | Create, edit, delete and confirm pins offline. Every change is written to IndexedDB first. |
| Pending changes | Each change is added to an outbox table. The header shows how many are waiting. |
| Connectivity detection | Pings `/api/ping` every 5 seconds plus browser online/offline events, so "Wi-Fi but no internet" is detected. |
| Synchronization | Pushes the outbox to the server first, then pulls other people's changes. |
| Sync status | Pins are faded (pending), solid (synced) or white-outlined (conflict). The header pill shows Offline, Syncing or All synced. |
| Conflict handling | Version check on the server with a side-by-side resolution box (see below). |

## Features

- Leaflet map with OpenStreetMap tiles
- Pin types: dim lighting, isolated stretch, broken CCTV, blocked path, harassment, theft, well lit, busy
- Anonymous: no accounts, no personal data. A pin holds only location, type, day/night and a confirmation count
- "I saw this too" confirmations
- Safety alerts: warning banner and vibration within 150 m of a reported hazard (works offline)
- Live blue-dot location with smooth movement and a "My location" button
- Full screen map, "How it works" guide with legend, installable PWA

## Architecture

```
 Browser (React + Vite PWA)                       Server (Vercel)
+------------------------------------+         +-------------------------+
| UI: map, status pill, conflict box |         | /api/ping               |
|        |                           |         | /api/pins  (pull)       |
|        v                           |  HTTPS  | /api/sync  (push)       |
| IndexedDB (Dexie)                  | <-----> |        |                |
|   pins   - local copy + status     |         |        v                |
|   outbox - queued changes (opId)   |         | Upstash Redis           |
|        |                           |         +-------------------------+
|        v                           |
| Sync engine: push, then pull       |
| Service worker: app shell + tiles  |
+------------------------------------+
```

A user action writes the pin and an outbox entry in one IndexedDB transaction. When the server is reachable, the outbox is sent to `/api/sync`. The client deletes an outbox entry only after the server answers for it, then pulls newer pins with `/api/pins?since=<rev>`.

## Sync and conflict handling

- Every pin has a `version`. Each queued edit records the `baseVersion` it started from.
- If `baseVersion` matches the server version, the edit is accepted. If not, the server returns a conflict with its own copy.
- The user sees "Your version" and "Server version" and chooses Keep mine or Keep theirs. Nothing is overwritten until they choose.
- Edit versus delete is handled the same way (for example "Deleted by someone else").
- Confirmations merge by addition, so they never conflict.
- Repeated offline edits to one pin are merged into a single queued change.
- Every operation has a unique `opId`, so retries never create duplicates.
- Pulling never overwrites a local pin that has unsynced changes.

## Edge cases handled

- Reloading the app with no internet
- Offline changes surviving a page reload
- Connection dropping mid-sync (nothing is lost, the next attempt resends)
- Retried operations (no duplicate pins)
- Two devices editing the same pin offline (conflict box)
- One device deleting while another edits (conflict box)
- Two devices confirming the same pin (both counted)
- Wi-Fi connected but server unreachable (shown as offline)

## Tech stack

- React
- Vite
- react-leaflet
- vite-plugin-pwa (Workbox)
- Dexie.js (IndexedDB)
- Vercel serverless functions (`api` folder)
- Upstash Redis. A small Express server in `server` is used for local development.

## Run locally

```bash
npm install
npm run server   # terminal 1: backend
npm run dev      # terminal 2: frontend
```

To test offline behaviour, use `npm run build` and `npm run preview`, then Chrome DevTools, Application, Service workers, Offline. Use a normal window and an incognito window to simulate two devices.

## Demo script

1. Open the app in two windows, both online. Drop a pin in window A and see it appear in window B.
2. Turn both offline.
3. In A, change the pin type to Harassment. In B, change the same pin to Busy.
4. Bring A online (syncs cleanly), then B. The conflict box appears. Choose Keep mine or Keep theirs.

## Known limitations

- Conflicts are resolved per pin, not per field.
- Map tiles are cached only for areas already viewed.
- Safety alerts work only while the app is open (background alerts need a native app).
- No accounts, moderation or pin expiry.
- All pins are stored in one Redis key and sync is by polling, which suits a demo but not large scale.
- No peer-to-peer sync or local encryption.
- GPS accuracy depends on the device and can drift indoors.

## Credits and disclosure

- Map data and tiles: OpenStreetMap contributors
- Hosting: Vercel. Database: Upstash Redis (free tier)
- Libraries: React, Vite, react-leaflet, Leaflet, Dexie.js, vite-plugin-pwa, @upstash/redis, Express (local only)
- AI assistance: Claude (Anthropic) was used as a coding and planning assistant. The team reviewed, tested and debugged the code.

## License

See the `LICENSE` file.
