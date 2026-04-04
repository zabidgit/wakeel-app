# CLAUDE.md — Wakeel iOS App Developer Handoff

## What is this?
Wakeel is a personal AI assistant iOS app built with React Native / Expo (SDK 55, managed workflow). It connects to an OpenClaw-powered backend running in Docker containers on a Hetzner VPS. Each user gets their own container with a personalized AI agent.

## Repo & Branches
- **Repo:** `https://github.com/zabidgit/wakeel-app.git`
- **Primary branch:** `stable-working` (= `master`, kept in sync)
- **Gold standard tag:** `v1.0.0-build102-sprint3` at commit `a68b5a9`
- **Current HEAD:** commit `7800b4a` (Sprint 4 complete, ahead of gold tag)
- **Stale branches (can delete):** `sprint1/security-cleanup`, `sprint2/reliability-fixes`, `sprint4/quality-push`

## Tech Stack
- **Framework:** React Native + Expo SDK 55 (managed workflow)
- **Language:** TypeScript
- **Build:** EAS Build (iOS only for now)
- **OTA:** EAS Update (production branch, runtime version = app version via `appVersion` policy)
- **State:** AsyncStorage (no Redux/Zustand)
- **Navigation:** React Navigation (native stack)
- **Auth:** Apple Sign-In + Google Sign-In (OAuth → account token → container provisioning)
- **Comms:** WebSocket to OpenClaw gateway (webchat protocol)
- **Push:** Expo Push Notifications → custom push relay server
- **Voice:** expo-audio recording → Whisper transcription on server
- **Styling:** StyleSheet (no styled-components, no Tailwind)
- **Markdown:** react-native-markdown-display (for agent messages)

## Architecture Overview

```
┌──────────────┐     WebSocket      ┌─────────────────────┐
│  Wakeel App  │ ◄──────────────► │ OpenClaw Container   │
│  (iOS/Expo)  │                    │ (Docker, per-user)   │
└──────┬───────┘                    └──────────┬──────────┘
       │                                       │
       │ HTTPS                                 │ Anthropic API
       ▼                                       ▼
┌──────────────────┐                ┌──────────────────┐
│ Provisioning     │                │ Claude Sonnet    │
│ Server (:3200)   │                │ (LLM backend)    │
│ + Push Relay     │                └──────────────────┘
│ + Auth Server    │
└──────────────────┘
```

### Key URLs
- **Provisioning/Auth/Push server:** `https://app.getwakeel.app` (proxied to `wakeel-clients:3200`)
- **User containers:** `https://{clientId}.getwakeel.app` (e.g., `zain-5936.getwakeel.app`)
- **EAS Updates:** `https://u.expo.dev/621af8c4-fdbd-492d-bf22-2db15c196ebe`
- **EAS Project ID:** `621af8c4-fdbd-492d-bf22-2db15c196ebe`

## File Structure

```
App.tsx                          — Root: auth state, OTA checker, navigation, update banner
src/
├── screens/
│   ├── ChatScreen.tsx           — Main chat (1398 lines, the big one)
│   ├── AuthScreen.tsx           — Apple/Google sign-in
│   ├── PairingScreen.tsx        — Legacy manual pairing (pre-auth flow)
│   ├── SettingsScreen.tsx       — Account, theme, deprovision, multi-chat
│   ├── WhatCanWakeelDoScreen.tsx — Feature showcase
│   └── onboarding/
│       ├── WelcomeScreen.tsx
│       ├── AboutYouScreen.tsx
│       ├── PeopleScreen.tsx
│       ├── PersonalityScreen.tsx
│       ├── NameWakeelScreen.tsx
│       ├── PermissionsScreen.tsx
│       ├── ProvisioningScreen.tsx  — Container provisioning flow
│       └── ReadyScreen.tsx
├── components/
│   ├── MessageBubble.tsx        — Message rendering + status dot + retry
│   ├── MessageContent.tsx       — Markdown + inline image detection
│   ├── ConnectionBanner.tsx     — WS status banner
│   ├── Sidebar.tsx              — Multi-chat sidebar
│   ├── TypingIndicator.tsx
│   ├── StreamingCursor.tsx
│   └── OwlLogo.tsx
├── useWebSocket.ts              — WebSocket hook (connect, send, reconnect, auth)
├── notifications.ts             — Push notification registration + relay
├── storage.ts                   — AsyncStorage wrapper (messages, pairing data)
├── auth.ts                      — Apple/Google OAuth → server auth
├── attachments.ts               — Image/document picker + upload
├── deviceSync.ts                — Calendar/reminders/location sync to server
├── voice.ts                     — Audio recording + Whisper transcription
├── fetchWithTimeout.ts          — Fetch wrapper with AbortController
├── ErrorBoundary.tsx            — App-level crash handler
├── types.ts                     — TypeScript interfaces
├── theme.ts                     — Dark/light theme colors
└── ThemeContext.tsx              — Theme provider
```

## Build & Deploy

### EAS Build (native binary — costs ~$2)
```bash
# Only needed when adding native modules or changing app.json native config
npx eas build --platform ios --profile production --environment production
```

### EAS Update (OTA — free, instant)
```bash
# For JS-only changes (most fixes). No build needed.
CI=1 npx eas update --branch production --message "description" --environment production
```

### Submit to App Store
```bash
npx eas submit --platform ios --environment production
```

### Critical OTA rule
- `runtimeVersion.policy: "appVersion"` means OTA runtime = `expo.version` in app.json
- If you bump `version`, ALL existing OTAs become invisible to old builds
- Current version: `1.0.0`, buildNumber: `102`
- **Never bump version without a new native build**

### Git workflow
- Branch per fix off `stable-working`
- Review diff before commit
- Test OTA → confirm with Bhai → merge to stable-working + master
- **No shotgun commits** — one fix, one OTA, one confirmation

## Server Infrastructure

### VPS (Hetzner)
- **Host:** `178.156.205.37` (8GB RAM, 150GB disk)
- **SSH:** `ssh wakeel-clients` (user=`openclaw`, key=`~/.ssh/wakeel_clients`)
- **Never use root or ubuntu user**

### Containers
- `wakeel-zain-5936` — Bhai's test Wakeel (OpenClaw 2026.4.2)
- `wakeel-haider` — Client (OpenClaw 2026.3.28)
- `wakeel-talha` — Client (OpenClaw 2026.3.28)
- `wakeel-saad` — Client (OpenClaw 2026.3.28)

### Provisioning Server
- **Location:** `/home/openclaw/provisioning/server.js` on wakeel-clients
- **Service:** `systemd wakeel-provisioning.service`
- **Port:** 3200
- **What it does:** Auth (Apple/Google), container provisioning, push relay, device sync endpoint, file uploads
- **Accounts registry:** `/home/openclaw/provisioning/accounts-registry.json`
- **Push tokens:** `/home/openclaw/provisioning/push-tokens.json`
- **Clients registry:** `/home/openclaw/docker/clients-registry.json`

### Docker
- **Compose file:** `/home/openclaw/docker/docker-compose.clients.yml`
- **Template:** `/home/openclaw/docker/templates/client-template/`
- **Env file:** `/home/openclaw/docker/.env` (has API keys)

## Known Issues & Remaining Work

### QA Score: 8.0/10

### Remaining for 9.0 (all need 1 native build, ~$2)
- **Clipboard replacement:** `@react-native-clipboard/clipboard` (deprecated `Clipboard` from react-native still used in ChatScreen + SettingsScreen)
- **Haptic feedback:** `expo-haptics` needs to be added to package.json + native build
- **Encrypted message storage:** Replace AsyncStorage with encrypted alternative

### Other known issues
- **WS 1006 drops:** iOS kills WebSocket connections in background. App reconnects automatically but messages sent during the gap are lost (delivery queue helps but isn't perfect)
- **`device.registerPush` errors:** Gateway returns "unknown method" — harmless, push still works via relay server
- **`PROVISION_API_KEY` still in ProvisioningScreen.tsx** — used for dev/manual provisioning flow only
- **13 empty catch blocks** — intentional (non-critical failures like notification permission, device sync)
- **No crash reporting** — Sentry JS-only mode planned
- **ChatScreen still 1398 lines** — could extract InputBar, but functional as-is

### Content filtering (SUPPRESSED_PATTERNS in ChatScreen)
These server-side messages are filtered from display:
- `NO_REPLY`
- `HEARTBEAT_OK`
- `Pre-compaction memory flush`
- `System: [...Post-compaction`
- `Session was just compacted`

## Message Flow

### Sending a message
1. User types → hits send
2. Message added to local state with `status: 'sending'`, `id: Date.now()`
3. Location prefix `[📍 lat, lon]` prepended (from cached `getLastKnownPositionAsync`)
4. `send()` via WebSocket → OpenClaw gateway
5. On WS ack: `status → 'sent'`
6. On failure: `status → 'failed'`, shown dimmed with "⚠️ Tap to retry"
7. On WS reconnect: all failed messages auto-retry

### Receiving a message
1. WS `onMessage` → parse JSON
2. Agent messages arrive as streaming chunks (type: `chat.content.delta`)
3. Chunks accumulated, throttled render (200ms)
4. On `chat.content.done` → final message saved to AsyncStorage
5. Content dedup: 30-second window, first 100 chars comparison
6. Messages sorted by timestamp, capped at 500 in storage

### Push notifications
1. App registers Expo push token with provisioning server
2. When agent responds while app is backgrounded, server sends push via Expo
3. Push body: truncated to 200 chars
4. Push `data.fullText`: complete message text
5. On notification tap: message injected into chat from `data.fullText`

## Device Sync
`src/deviceSync.ts` runs every 15 minutes:
- **Calendar:** Next 7 days of events
- **Reminders:** Incomplete reminders from last 30 days
- **Location:** Current coordinates
- Sent to `/api/device-sync` on the provisioning server, forwarded to user's container

## Auth Flow
1. User taps Apple/Google sign-in
2. OAuth token → `POST /api/auth/apple` or `/api/auth/google`
3. Server validates → returns `accountToken`
4. `accountToken` stored in iOS Keychain (via expo-secure-store)
5. **Keychain survives app deletion** — must handle stale tokens at startup
6. `accountToken` used for: provisioning, deprovision, push registration

## Important Patterns

### WebSocket reconnect
- `MAX_RECONNECT_ATTEMPTS = 5`
- Backoff: exponential with jitter
- On max attempts: `onConnectionFailed` callback → clears pairing → back to auth screen
- WS 1006 (iOS background kill) is NORMAL — auto-reconnects

### Storage
- Key: `wakeel_messages_${sessionKey}` (default session: `agent:main:main`)
- Messages trimmed to last 500 on save
- Pairing data: `PAIRING_KEY` in AsyncStorage
- Account token: SecureStore (iOS Keychain)

### Multi-chat
- Sessions created via sidebar
- Each session = separate WS session key
- Session key format: `chat-{timestamp}-{random4}`
- All sessions share the same container/agent but different conversation threads

## Lessons Learned (the hard way)

1. **`runtimeVersion.policy: "appVersion"`** — bump version = all OTAs invisible. Always verify runtime matches.
2. **Expo OTA requires kill+reopen** — also periodic check every 30 min now baked in
3. **Module-level notification capture > component-level** — iOS processes taps before React mounts
4. **TCP buffer message loss** — killed app = server doesn't know for 30-60s, messages in that window are lost
5. **`getLastNotificationResponseAsync()` unreliable in some builds** — always wrap in try/catch
6. **Python `w+` mode truncates on open** — use separate open() calls for read-then-write
7. **`getCurrentPositionAsync()` blocks for 5-10s** — use `getLastKnownPositionAsync()` (instant cache)
8. **Expo managed workflow** — modules must be in package.json AND native binary to work at runtime
9. **iOS Keychain survives app deletion** — auth flows must handle stale tokens gracefully
10. **Content dedup window** — 1 hour was too aggressive (swallowed legit messages), 30 seconds is right

## Testing

### Your test container
- **Container:** `wakeel-zain-5936` on `wakeel-clients`
- **URL:** `https://zain-5936.getwakeel.app`
- **Gateway token:** `af7d962fb8136959f1d48c1972c6dd91ccb1321d`
- **To restart:** `ssh wakeel-clients "docker restart wakeel-zain-5936"`
- **To check logs:** `ssh wakeel-clients "docker logs wakeel-zain-5936 --tail 30"`

### Never test against live client containers
`wakeel-haider`, `wakeel-talha`, `wakeel-saad` are real users. Don't touch them.

## Quick Reference

| What | Command |
|------|---------|
| OTA push | `CI=1 npx eas update --branch production --message "msg" --environment production` |
| Native build | `npx eas build --platform ios --profile production --environment production` |
| Check container | `ssh wakeel-clients "docker logs wakeel-zain-5936 --tail 30"` |
| Restart container | `ssh wakeel-clients "docker restart wakeel-zain-5936"` |
| Container version | `ssh wakeel-clients "docker exec wakeel-zain-5936 openclaw --version"` |
| Git status | `git log --oneline -5 && git status` |
