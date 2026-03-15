# Wakeel App — Playbook

## The Decision
**Date:** March 14, 2026 (Saturday night, same day as pregnancy news 💛)
**Decision by:** Bhai (Zain)
**Trigger:** Amina's feedback — "my reflex was to just use ChatGPT cz it was right there... I almost forgot about tiny." Discord is the wrong channel. The product works, the delivery doesn't.

---

## What We're Building
A mobile app for iOS + Android. Simple chat interface — you open it, you talk to your Wakeel. That's it.

**Name:** Wakeel
**Tagline:** TBD
**Design:** Owl logo, gold and black color scheme (matches onboarding PDF branding)

---

## Tech Stack

| Component | Technology | Why |
|---|---|---|
| Framework | React Native (Expo managed) | iOS + Android from one codebase, no Mac needed |
| Language | TypeScript | Type-safe, industry standard |
| Build/Deploy | EAS Build + EAS Submit | Cloud Macs compile iOS, submit to App Store |
| Connection | WebSocket (WSS) | Same protocol OpenClaw Control UI uses |
| Push Notifications | APNs (iOS) + FCM (Android) | Native, reliable |
| Local Storage | SQLite / AsyncStorage | Messages persist on device |
| Auth | OpenClaw device pairing | One-time pairing code, device-pinned token |
| SSL/TLS | Cloudflare Tunnel or Nginx + Let's Encrypt | Mandatory WSS |

### Why Not SwiftUI?
- Needs a Mac for Xcode — Bhai doesn't have one
- iOS only — would need separate Android app
- React Native is industry standard for chat apps (WhatsApp, Discord, Messenger all use it)
- Expo EAS builds on cloud Macs — zero local Apple tooling needed

---

## Architecture

```
┌─────────────┐     WSS      ┌──────────────────┐
│  Wakeel App  │◄────────────►│  OpenClaw Gateway │
│  (phone)     │              │  (Docker container)│
└──────┬──────┘              └────────┬─────────┘
       │                              │
       │  APNs/FCM                    │ webhook
       │                              │
┌──────▼──────┐              ┌────────▼────────┐
│    Apple/    │◄─────────────│  Push Relay     │
│   Google    │               │  (VPS service)  │
│   Servers   │               └─────────────────┘
└─────────────┘
```

### How It Connects
- Each Wakeel container runs its own OpenClaw gateway
- The app connects directly to the specific container via WSS
- Pairing code encodes: `{ "url": "wss://address:port", "token": "auth" }`
- No central routing service needed
- Multi-server scaling: just add VPSes, generate new pairing codes

### Push Notifications
- Small Node.js relay service on VPS
- Receives webhooks from OpenClaw when messages are sent
- Forwards to APNs (iOS) / FCM (Android)
- Minimal payload: "New message from Tiny" — full content loads in-app over WSS
- Webhook authenticated with shared secret per container

---

## Multi-Server Scaling

```
VPS 1 (Hetzner US)           VPS 2 (Hetzner EU)
├── wakeel-saad               ├── wakeel-khan
├── wakeel-talha              ├── wakeel-client-5
└── wakeel-haider             └── wakeel-client-6
```

| Clients | VPSes | Monthly Infra Cost | Revenue |
|---|---|---|---|
| 3 | 1 | ~$16 | $300 |
| 10 | 2-3 | ~$48 | $1,500+ |
| 25 | 5-6 | ~$96 | $4,500+ |
| 50 | 10-12 | ~$192 | $9,500+ |

---

## Design Spec

### Branding
- **Logo:** Owl (same as onboarding PDF)
- **Primary colors:** Gold (#D4A843 or similar) + Black (#1A1A1A)
- **Accent:** White text on dark backgrounds
- **Font:** Clean sans-serif (SF Pro on iOS, Roboto on Android — system defaults)
- **Vibe:** Professional, warm, trustworthy. Not techy. Not corporate.

### Screens
1. **Onboarding / Pairing**
   - Owl logo + "Welcome to Wakeel"
   - "Enter your pairing code" input field
   - OR QR code scanner
   - One screen, one action

2. **Chat (main screen)**
   - Message bubbles (user = gold/dark, Wakeel = light/white)
   - Input bar at bottom with send button
   - Wakeel's name + avatar at top
   - Clean, minimal, fast

3. **Settings**
   - Connection status (connected/reconnecting)
   - Wakeel name/info
   - Notification preferences
   - Face ID / biometric lock toggle
   - Logout / re-pair
   - About / privacy policy link

### No:
- No tabs, no sidebar, no bottom navigation
- No feed, no discovery, no social features
- No in-app purchases
- Just chat. That's the product.

---

## Security

| Threat | Severity | Mitigation |
|---|---|---|
| WebSocket interception | High | WSS (TLS) mandatory |
| Token theft | High | One-time pairing, device-pinned session |
| Push content exposure | Low | Minimal payload, full content via WSS |
| Phone stolen | Medium | iOS Data Protection + optional Face ID lock |
| VPS compromised | Critical | Docker isolation, SSH keys, fail2ban, disk encryption |
| Push relay compromise | Medium | Webhook auth (shared secret), HTTPS only |
| Brute force pairing | Medium | Time-limited codes (1hr), rate limiting |
| Supply chain (npm) | Medium | Minimal deps, locked versions, Expo managed |

### Privacy Advantage
"Your data never leaves your dedicated server. Messages are encrypted in transit. No data is sold, shared, or stored on third-party servers. Your Wakeel is yours."

This is a genuine competitive advantage over ChatGPT, Alexa, Google Assistant.

---

## App Store Strategy

### Why Apple Will Approve
- Native React Native UI (not a web wrapper)
- Clear purpose: "Personal AI assistant"
- Precedent: Mattermost, Rocket.Chat, Element, Home Assistant all approved
- Privacy policy included
- No in-app purchases, no content issues

### The Login Question
Apple may ask "how does a user get access?" Answer:
- Screen: "Enter your pairing code. Don't have one? Visit wakeel.ai"
- Same pattern Mattermost, Rocket.Chat use
- Apple approves this consistently

### Requirements
- Apple Developer account ($99/year)
- Google Play Developer account ($25 one-time)
- Privacy policy URL (host on wakeel.ai)
- App Store screenshots + description
- App icon (owl logo, gold/black)

### Rejection Risk: ~5-10%
If rejected, usually minor fix (description tweak, screenshot update). Rejections tell you exactly what to fix.

---

## Development Plan

### Phase 1: Core App (Days 1-3)
- [ ] Project setup (Expo + TypeScript)
- [ ] WebSocket client (connect to OpenClaw gateway)
- [ ] Chat UI (message bubbles, input bar, auto-scroll)
- [ ] Local message storage
- [ ] Pairing flow (enter code → connect)
- [ ] Reconnection handling (auto-reconnect on network loss)

### Phase 2: Polish + Push (Days 3-5)
- [ ] Push notification setup (APNs + FCM)
- [ ] Push relay service on VPS
- [ ] Cloudflare Tunnel or Nginx for WSS exposure
- [ ] Face ID / biometric lock option
- [ ] Settings screen
- [ ] App icon + splash screen (owl/gold/black)
- [ ] Error states (offline, reconnecting, server unreachable)

### Phase 3: Testing (Days 5-7)
- [ ] Test via Expo Go on Bhai's phone
- [ ] EAS build → TestFlight
- [ ] Test with Sarkit (Bhai's Wakeel)
- [ ] Test with Tiny (Saad + Amina)
- [ ] Test with R2 (Talha)
- [ ] Test with Alfred (Haider)
- [ ] Push notification testing
- [ ] Offline/reconnection testing

### Phase 4: Ship (Days 7-13)
- [ ] Iterate based on tester feedback
- [ ] App Store screenshots + description
- [ ] Privacy policy page on wakeel.ai
- [ ] EAS submit to App Store
- [ ] EAS submit to Google Play
- [ ] Apple review (1-3 days)
- [ ] 🚀 LIVE

---

## Testing Strategy

### Expo Go (during development)
- Bhai scans QR code → app runs on phone instantly
- Live reload — code changes appear in real time
- No build step needed

### TestFlight (pre-launch)
- Real app, real push notifications
- Up to 10,000 testers
- No App Store review (automated check only, ~1 hour)
- 90-day validity per build
- All 4 Wakeels tested by real clients

### App Store (launch)
- Human review by Apple (1-3 days)
- Once approved, available to anyone

---

## Infrastructure Prerequisites

Before the app can connect, need to set up on VPS:

1. **Expose gateways** — Cloudflare Tunnel (preferred, free, handles SSL) or Nginx + Let's Encrypt
2. **Domain** — e.g. `wakeel.ai` or similar
3. **Subdomains** — `saad.wakeel.ai`, `talha.wakeel.ai`, `haider.wakeel.ai`
4. **Push relay service** — Node.js, runs on VPS, receives webhooks → sends APNs/FCM
5. **APNs key** — from Apple Developer account (one key covers all clients)
6. **FCM setup** — from Firebase console (free)

---

## What Bhai Needs To Do

- [ ] Apple Developer account signup ($99/year) — developer.apple.com
- [ ] Google Play Developer account ($25) — play.google.com/console
- [ ] Domain registration (wakeel.ai or alternative)
- [ ] Expo account signup (free) — expo.dev

---

## Competitive Advantage

| Feature | ChatGPT | Alexa | Wakeel |
|---|---|---|---|
| Knows your life | ❌ | ❌ | ✅ |
| Proactive reminders | ❌ | Basic | ✅ Deep |
| Private (no data harvesting) | ❌ | ❌ | ✅ |
| Personalized to your family | ❌ | ❌ | ✅ |
| Checks your email/calendar | ❌ | Limited | ✅ |
| Push notifications | ❌ | ❌ | ✅ |
| Works for couples | ❌ | ❌ | ✅ |

---

## Context

### Why Not Other Channels?
- **Discord:** Nobody uses it daily. Clients forget about their Wakeel. Amina confirmed.
- **WhatsApp (Baileys):** Ban risk, ToS violation, SIM management overhead ($5/client/mo).
- **Slack:** Wrong vibe for personal assistants. Good for B2B (Khan's play), wrong for families.
- **PWA:** No reliable push notifications on iOS Safari. Dead end.
- **OpenClaw mobile app:** TestFlight only, not publicly released. Says "OpenClaw" not "Wakeel."

### Why Build Our Own?
- Own the platform — no third-party dependency
- Own the brand — "Download your Wakeel"
- Own the data — genuine privacy story
- Own the experience — exactly what we want, nothing we don't
- Scale without permission — no ban risk, no ToS, no platform changes

---

## Reference
- **Amina's feedback screenshot:** Saved in memory (March 14, 2026). Key quote: "my reflex was to just use ChatGPT cz it was right there"
- **Industry precedent:** Mattermost, Rocket.Chat, Element, Home Assistant — all App Store approved self-hosted apps
- **OpenClaw gateway protocol:** WebSocket, documented in openclaw/docs/gateway/protocol.md
- **Proactive Intelligence Framework:** Deployed to all Wakeels same night (SOUL.md update)
