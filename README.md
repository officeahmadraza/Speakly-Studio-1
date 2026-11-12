# Speakly Studio — AI Text to Speech

> "Discover voices. Create naturally. Bring your words to life."

Speakly Studio is a full-stack web application (React + TypeScript frontend, Node/Express backend) that interfaces with the ElevenLabs voice synthesis engine exposed by the OpenSpeaker API. It allows users to browse authentic voice profiles, audition sample previews, curate favorites, generate natural AI speech, and stream/download high-fidelity audio tracks.

---

## Architecture Overview

```
Frontend (React 19 + TypeScript + Tailwind CSS v4)
  │
  ├─ Top Bar Contract (Wordmark, Clean Nav Links, Primary Context)
  ├─ Create Speech (Script Editor, Limits, Speed Tuning, Task Lifecycle)
  ├─ Voice Library (Catalog Search, Dynamic Facets, Preview Controller)
  ├─ Favorites (Local Versioned Persistence, Quick Select)
  ├─ Generation History (Full Text Stored Locally, Playback & Download)
  └─ Shared Audio Controller (Single-Audio Streamer & Audition Verifier)
         │  (HTTP / JSON & Form Multipart proxy)
         ▼
Express Backend (`server.ts`)
  ├─ Config & Security (`server/config.ts`)
  ├─ Sliding Window IP Rate Limiting (`server/rateLimiter.ts`)
  ├─ OpenSpeaker HTTP Client (`server/services/openspeakerClient.ts`)
  ├─ Voice Catalog Cache & Field Inspector (`server/services/voiceService.ts`)
  ├─ TTS Task Submission (`server/services/ttsService.ts`)
  ├─ Upstream Polling Engine (`server/services/taskService.ts`)
  └─ Secure Download Streamer (`server/services/downloadService.ts`)
         │  (Authenticated `xi-api-key`)
         ▼
OpenSpeaker Upstream API (`https://api.ai33.pro`)
  ├─ GET /v1/health-check
  ├─ GET /v3/voices?provider=elevenlabs&page=N&page_size=100
  ├─ POST /v3/text-to-speech (multipart FormData)
  └─ GET /v1/task/{task_id}
```

---

## Adding Your API Key in Google AI Studio

For security, the API key **never** reaches the browser or bundle:

1. In the Google AI Studio interface, open the **Secrets** or **Environment Variables** panel.
2. Add a new secret with the name:
   ```
   OPENSPEAKER_API_KEY
   ```
3. Set its value to your OpenSpeaker / ElevenLabs API key.
4. Optional variables:
   - `OPENSPEAKER_API_BASE_URL`: defaults to `https://api.ai33.pro`.
   - `MAX_TEXT_CHARS`: character limit protection (default `5000`).
   - `APP_ACCESS_CODE`: optional passcode to guard generation endpoints.
   - `AUDIO_HOST_ALLOWLIST`: comma-separated allowed hostnames for audio download proxy (default includes `api.ai33.pro`).
5. Restart the server or trigger a fresh deployment. The server will immediately detect the key and transition from "Missing Key" to "Configured".

---

## How It Works

### 1. Voice Catalog & Response Inspection
- The backend queries `GET /v3/voices?provider=elevenlabs&page=N&page_size=100`.
- It fetches pages consecutively until a page returns fewer than 100 items (or empty).
- On the first run, the server inspects the raw payload, logging discovered fields and extracting dynamic facet options (genders, languages, accents, categories, tags).
- Full catalog data is cached in-memory for 1 hour (`CACHE_TTL_MS = 3600000`).
- Users can click **Sync Catalog** or **Force Re-fetch Upstream** in Settings to manually bust the cache.

### 2. Voice Previews
- The application inspects voice records for audio preview fields (`preview_url`, `sample_url`, etc.).
- A unified HTML5 audio controller guarantees that starting an audition sample stops any other audio playback.
- Voices without valid preview URLs display "Preview unavailable".
- A voice is only marked as auditioned if authentic audio actually begins playing.

### 3. Speech Generation & Polling
- When the user clicks **Generate Speech**, the frontend sends text, voice ID, speed (0.5–1.5x), transcript flag, and optional filename to `POST /api/tts`.
- The backend serializes the parameters into standard `multipart/form-data` and dispatches it upstream to `POST /v3/text-to-speech`.
- The backend returns `{ success: true, taskId }`.
- The client persists the active task ID in `localStorage` so refreshing the page safely resumes polling.
- Status is polled from `GET /v1/task/{task_id}` every 2–3 seconds with exponential backoff and jitter, honoring HTTP 429 `Retry-After` headers and retrying HTTP 503 `server_busy`.
- Terminal states (`done`, `completed`, `failed`) finalize the task lifecycle.

### 4. Audio Streaming & Secure Downloads
- `GET /api/download/:taskId` verifies that the task has status `done` upstream.
- The server validates that `metadata.audio_url` uses `https:` and its hostname is strictly within the authorized host allowlist (`api.ai33.pro` + observed audio hosts).
- Audio is streamed directly with `Content-Type: audio/mpeg` and sanitized `Content-Disposition: attachment; filename="<sanitized_name>.mp3"`.
- Arbitrary client-provided URLs are rejected at the route level.

### 5. History & Local Persistence
- Upstream task records truncate script text to 1,000 characters. Speakly Studio preserves the **complete script text** in versioned client storage (`speaklystudio_history_v1`).
- Upstream storage URLs have an expiration lifespan; users are alerted to download their MP3 files for permanent archiving.

---

## Running and Building

```bash
# Install dependencies
npm install

# Start full-stack development server (Express + Vite on Port 3000)
npm run dev

# Type check and lint
npm run lint

# Production build
npm run build

# Start production server
npm run start
```
