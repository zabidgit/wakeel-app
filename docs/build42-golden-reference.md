# Build 42 — Golden Reference

## Build Info
- **Build Number:** 42
- **EAS Build ID:** 4a58b2d2-d901-46c9-a145-deaae23a145c
- **Git Commit:** 1f6d126 ("feat: restore device identity auth (expo-crypto + tweetnacl), prep for Build 41")
- **Fingerprint:** 15d1e14668c3c33089187d4a9bdd0eed5d69cf2b
- **SDK:** 55.0.0
- **Runtime Version:** 1.0.0
- **Channel:** production
- **IPA:** https://expo.dev/artifacts/eas/abtBa4GHYXEFRYkVXZwE8f.ipa

## Why This Build Works
- Uses `type: 'connect'` legacy frame format (NOT `type: 'req'`)
- Token at top level, mode at top level
- `type: 'request'` for chat.send and health (NOT `type: 'req'`)
- Native binary includes: expo-crypto, tweetnacl, expo-updates, expo-secure-store
- OTA channel "production" configured

## Connect Frame Format (WORKING — via OTA)
⚠️ Build 42's EMBEDDED code uses legacy `type: 'connect'` which the gateway REJECTS.
The app only works with OTA override using `type: 'req'` format:
```json
{
  "type": "req",
  "id": "r1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "role": "operator",
    "scopes": ["operator.read", "operator.write", "operator.admin"],
    "auth": { "token": "<gateway_token>" },
    "client": {
      "id": "openclaw-ios",
      "mode": "webchat",
      "platform": "ios",
      "version": "1.0.0",
      "deviceFamily": "phone"
    }
  }
}
```

## chat.send Format (WORKING)
```json
{
  "type": "req",
  "id": "r2",
  "method": "chat.send",
  "params": {
    "sessionKey": "main",
    "message": "<user_message>",
    "idempotencyKey": "<timestamp>-<random>"
  }
}
```

## Current OTA (commit 869c51d)
- ✅ type:req connect format
- ✅ Health keepalive every 25s
- ✅ Single messages (delta=accumulated, final replaces in-place)
- ❌ No device identity (token auth only — works fine with gateway sharedAuthOk)
