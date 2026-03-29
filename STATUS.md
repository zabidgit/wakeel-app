# Wakeel App — Build Status

Last updated: 2026-03-29

---

## Current State

| Layer | Version | Status |
|---|---|---|
| Native shell (installed) | Build 55 | ✅ Live on TestFlight |
| JS bundle (OTA) | auth sprint OTA | ✅ Applied automatically |
| Last failed EAS build | Build 59 | ❌ Missing Apple capability |
| Next EAS build | Build 60 (pending) | ⏳ Blocked on Dev Portal fix |

---

## ✅ Tested & Confirmed Working

### Core Chat
- WebSocket connection to Wakeel gateway
- Streaming messages at ~60fps (16ms throttle)
- Image/file upload — `POST https://app.getwakeel.app/upload` with bearer token
- Clear chat — reloads correctly on focus via `useFocusEffect`
- Multi-chat sidebar (separate threads per session)

### Onboarding Flow
- Welcome → Name Wakeel → About You → People → Personality → Provisioning → Ready → Chat
- Full end-to-end provision via `POST /api/provision`
- `accountToken` threaded through entire flow (auth path + dev/API key path both work)

### Settings
- Cancel Wakeel — deprovisions container, archives, returns to pairing
- Privacy policy page with tappable links
- Account section UI (Sign Out, Invite — visible but auth-gated)
- Appearance toggle (dark/night mode UI — needs native build to fully activate)

### Infrastructure
- `*.getwakeel.app` wildcard SSL live (expires 2026-06-26)
- `app.getwakeel.app` nginx: `/api/` → provisioning server, `/upload` → provisioning server
- Provisioning server: full lifecycle, rollback, rate limiting, port management

---

## ⚠️ In Code — Not Yet Native-Tested

These features are in the JS bundle (shipped via OTA) but require a new native build to fully work:

### Sign in with Apple
- **Blocker:** `com.getwakeel.app` identifier in Apple Dev Portal needs "Sign In with Apple" capability enabled
- **Fix:** https://developer.apple.com/account/resources/identifiers/list → `com.getwakeel.app` → Enable "Sign In with Apple" → Save
- **Then:** Trigger EAS build 60 → submit to TestFlight → test

### Sign in with Google
- **Blocker:** No Google Cloud project / OAuth client ID configured
- **Fix:** Create GCP project → OAuth iOS client ID → set `GOOGLE_CLIENT_ID=...` in `/home/openclaw/provisioning/.env` → restart service
- **Then:** Test via new native build

### Dark / Night Mode
- ThemeContext with warm amber palette (`#0c0800` bg, `#f5b942` gold)
- Persisted via AsyncStorage key `wakeel_theme_mode`
- Toggle in Settings → Appearance
- Fully coded, needs native build to confirm rendering

### Account Management
- Sign out (clears SecureStore `wakeel_account_token` + `wakeel_account_info`)
- Invite system — 6-char alphanumeric code, 48hr expiry
- Household accounts (primary + secondary users share householdId)

---

## ❌ Not Built Yet

| Feature | Notes |
|---|---|
| **Voice input (Whisper)** | Hold mic → record → POST /api/transcribe → Whisper → send as text |
| **Voice output (TTS)** | POST /api/tts → OpenAI TTS or ElevenLabs → play audio |
| **RevenueCat SDK** | Hard blocker for paid launch — subscription management |
| **Push notifications (APNs)** | Infrastructure done (APNs key 43ZP5JWDHJ, push server live) — needs wiring into app |
| **WebSocket error feedback** | Show user-visible banner when connection drops mid-message |

---

## Rate Limit — IMPORTANT
`server.js` line 39: `RATE_LIMIT_MAX = 20` — **revert to 5 before production launch**

---

## Key Config

| Item | Value |
|---|---|
| Bundle ID | `com.getwakeel.app` |
| EAS Project | `621af8c4-fdbd-492d-bf22-2db15c196ebe` |
| EAS Owner | `getwakeel` |
| OTA Channel | `production` |
| Apple Team | `GJU7G87T5H` (Zain Abid Individual) |
| Provisioning Profile | `9ULD47CFB7` (active, expires Mar 2027) |
| Dist Certificate | `FDCC643FB0940C0C777A7BD01E4A058` (expires Mar 2027) |
| PROVISION_API_URL | `https://app.getwakeel.app` |
| Provisioning server | Port 3200, systemd `wakeel-provisioning.service` |
| VPS | `wakeel-clients` SSH alias, `178.156.205.37` |

---

## Next Steps (Priority Order)

1. **Enable "Sign In with Apple"** in Apple Dev Portal → trigger EAS Build 60
2. **Set up Google Cloud project** → get OAuth iOS client ID → set `GOOGLE_CLIENT_ID` in `.env`
3. **Voice sprint** — mic button + Whisper transcription + TTS response (needs `OPENAI_API_KEY`)
4. **RevenueCat SDK** integration (hard blocker for paid launch)
5. **Revert rate limit** to 5/hr in `server.js` line 39 before prod
6. **Push GitHub token** to Sarkit → connect all three repos to remote

---

## Permanent Containers (Never Touch)
`wakeel-haider` | `wakeel-talha` | `wakeel-saad` | `wakeel-apple-test`
