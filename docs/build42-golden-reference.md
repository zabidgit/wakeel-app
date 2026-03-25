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

## Connect Frame Format (WORKING)
```json
{
  "type": "connect",
  "token": "<gateway_token>",
  "minProtocol": 3,
  "maxProtocol": 3,
  "role": "operator",
  "scopes": ["operator.read", "operator.write", "operator.admin"],
  "mode": "webchat",
  "client": {
    "id": "openclaw-ios",
    "platform": "ios",
    "version": "1.0.0",
    "deviceFamily": "phone"
  },
  "device": {
    "id": "<sha256_hex_of_pubkey>",
    "publicKey": "<base64url_ed25519_pubkey>",
    "signature": "<base64url_ed25519_signature>",
    "signedAt": 1711234567890,
    "nonce": "<random_string>"
  }
}
```

## chat.send Format (WORKING)
```json
{
  "type": "request",
  "id": "wk-<timestamp>-<counter>",
  "method": "chat.send",
  "params": {
    "sessionKey": "main",
    "message": "<user_message>",
    "idempotencyKey": "<timestamp>-<random>"
  }
}
```

## Known Issue
- Double messages: streaming delta creates one bubble, final creates another
- Fix needed in ChatScreen.tsx message handling
