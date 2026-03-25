# Debug History: Builds 27-33 (Working State)

Saved from conversation transcript — March 24, 2026.
This documents the exact issues found and fixes applied to get the app working end-to-end.

## Timeline

### Build 27 (Starting Point)
- Connected, could send messages, received replies
- Issues: double messages (streaming deltas creating new bubbles), tick keepalive rejected

### Builds 28-30: Streaming + OTA Channel Fix
- Fixed streaming: accumulate deltas into single message, show final only
- Fixed keepalive: `tick` → `health` method
- OTA wasn't working: "production" channel didn't exist in EAS
- Created channel, linked to branch, added `"channel": "production"` to eas.json
- Build 30 first build with OTA channel configured

### Build 31: Device Auth Disabled (Clean Working State)
- Device auth OFF, gateway patch handles scopes
- Works great — single messages, no errors, clean gateway logs
- OTA channel still not working (build compiled before channel existed)

### Build 32: OTA + Device Auth Re-enabled
- `"channel": "production"` baked into eas.json
- Device auth re-enabled
- **FAILED**: "device identity mismatch" error
- Root cause: Pure JS SHA-256 produces different output on Hermes (React Native JS engine) than Node.js

### The SHA-256 / Hermes Bug
- Pure JS SHA-256 implementation works perfectly in Node.js tests
- On Hermes runtime (React Native), produces DIFFERENT hash for same input
- Fix: Use `expo-crypto`'s native `digest()` which calls iOS CommonCrypto
- `Crypto.digest(CryptoDigestAlgorithm.SHA256, rawBytes)` → native platform crypto

### Stale Device ID Bug
- Even after fixing SHA-256, stored device identity in SecureStore still had OLD wrong deviceId
- Fix: Re-derive deviceId from stored publicKey on EVERY load using native crypto
- Auto-corrects and saves back if different

### Build 33: THE WORKING BUILD 🎉
- Native SHA-256 via expo-crypto for device ID derivation
- Auto-fix stale device IDs on load
- Device pairing approved by gateway
- Device ID: `33810767ace549d9cc60d3ff273a662440686290e3d5f26daac4baf9fd7f2d66`
- Full end-to-end working: connect → device auth → chat → streaming

## Device Auth v3 Spec (Reverse-Engineered from Gateway)

### Connect Params Device Object
```json
{
  "id": "SHA-256(raw_public_key) as hex string",
  "publicKey": "base64url(raw_32_byte_ed25519_pubkey)",
  "signature": "base64url(ed25519_sign(v3_payload_string))",
  "signedAt": 1711234567890,
  "nonce": "random_alphanumeric_string"
}
```

### v3 Payload String (pipe-separated)
```
v3|{deviceId}|openclaw-ios|webchat|operator|operator.read,operator.write,operator.admin|{signedAtMs}|{token}|{nonce}|ios|phone
```

### Client Object Must Include
```json
{
  "id": "openclaw-ios",
  "mode": "webchat",
  "platform": "ios",
  "version": "1.0.0",
  "deviceFamily": "phone"
}
```

### Original Field Name Bugs (Build 30)
- `deviceId` → should be `id`
- `signedAtMs` → should be `signedAt`
- `version: 3` → not in schema (additionalProperties: false rejects it)
- Missing `deviceFamily: 'phone'` in client object

## Key Learnings
1. **Hermes SHA-256 is broken** for our use case — always use expo-crypto native digest
2. **Stored identities can be stale** — always re-derive deviceId from publicKey on load
3. **OTA channel must be configured at build time** — adding channel after build doesn't work
4. **Gateway scope patch** (`clearUnboundScopes` bypass) survives container RESTART but not RECREATE
5. **First device pairing takes a few seconds** — gateway approval flow. Subsequent connects are instant.
