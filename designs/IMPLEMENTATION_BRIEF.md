# Wakeel App UI Redesign — Implementation Brief

## Overview
Redesign the Wakeel iOS app (React Native / Expo) to match the three HTML design mockups in this folder. The app is a personal AI assistant chat app that connects to an OpenClaw gateway via WebSocket.

## Design Files
- `pairing-screen.html` — Initial pairing/onboarding screen
- `chat-screen.html` — Main chat interface
- `settings-screen.html` — Settings page

## Design System (Material Design 3 inspired, dark luxury)

### Colors (from Tailwind config in designs)
```
Background: #050505 / #131313
Surface: #131313
Surface Container: #201f1f
Surface Container High: #2a2a2a
Surface Container Highest: #353534
Surface Container Low: #1c1b1b
Surface Container Lowest: #0e0e0e
Primary: #ffe9b0 (gold text)
Primary Container: #f2ca50 (gold buttons/accents)
On Primary Container: #6b5500
Secondary: #cfbcff (purple accent)
Secondary Container: #6200ea
Error: #ffb4ab
On Surface: #e5e2e1
On Surface Variant: #d0c5af
Outline: #99907c
Yellow-200: used for active nav, status dots
```

### Typography
- **Headlines:** Cormorant Garamond (serif) — large titles, elegant feel
- **Body/Labels:** Manrope (sans-serif) — clean, modern
- **Serif accent:** Newsreader — used for "Wakeel" branding in chat header

### Key Design Elements
1. **Nebula glow effects** — Large blurred circles (purple/gold) in background, very subtle (opacity 0.08-0.15)
2. **Gold accent color** (#f2ca50) — buttons, active states, status indicators
3. **Tracking-widest uppercase labels** — Used for small labels (10px, uppercase, letter-spacing 0.2-0.4em)
4. **Rounded corners** — 1rem default, full for buttons/pills
5. **Backdrop blur** — Headers and input areas use backdrop-blur-xl/2xl
6. **Bottom navigation** — Floating pill-shaped nav with 3 tabs: Connect, Chat, Settings
7. **Streaming cursor** — Blinking `|` after streaming text in chat

## Screens to Implement

### 1. Pairing Screen (PairingScreen.tsx)
- Large owl logo at top with glow effect
- "Pair Device" headline (Cormorant Garamond)
- Text input for pairing code (centered, tracking-wide)
- "Connect" gold button (full width, rounded-full)
- "or" divider
- "Scan QR" button (outline style)
- Footer: "End-to-End Astral Encryption" (tiny label) — CHANGE to "End-to-End Encrypted" for production
- NOTE: Logo has weird text under it in the mockup image. Replace with "وكيل" (Wakeel in Arabic) rendered as text below the logo, or just use the logo without text.

### 2. Chat Screen (ChatScreen.tsx) — MOST IMPORTANT
- **Header:** Logo + "Wakeel" name + connection status dot (pulsing green/gold when connected)
- **Messages:**
  - User messages: right-aligned, dark surface background (#353534), rounded with top-right corner cut
  - AI messages: left-aligned, no background, with:
    - Small avatar (star icon in gold circle)
    - "Wakeel Oracle" label (or just agent name)
    - Large italic serif headline for first line (Cormorant Garamond)
    - Body text in Manrope, light weight
    - Copy/refresh action buttons (appear on hover/long-press)
  - Typing indicator: 3 gold dots pulsing + "Wakeel is contemplating..." text
  - Streaming: show blinking cursor `|` after last character while streaming
- **Input area:**
  - Floating at bottom with subtle gold gradient border on focus
  - Dark background with backdrop blur
  - Attachment button (+ circle) on left
  - Text input with placeholder "Whisper your inquiry..." — CHANGE to something less pretentious, like "Message Wakeel..." or keep if client likes it
  - Gold send button (arrow up, filled) on right
- **Bottom nav:** 3-tab floating pill (Connect, Chat, Settings)
- Date marker: "The Present Moment" — CHANGE to actual date

### 3. Settings Screen (SettingsScreen.tsx)
- Large "Settings" headline
- Subtitle text about managing preferences
- List items with:
  - Icon in colored circle
  - Title (Cormorant Garamond, large)
  - Subtitle (tiny uppercase label)
  - Right-side value text + chevron
- Items: Connection, Language, Privacy, Disconnect (red/error colored)
- Footer: Version info + links
- Bottom nav

## Technical Requirements

### Fonts
Install Google Fonts for Expo:
- `expo-google-fonts/cormorant-garamond` (or use expo-font with Google Fonts)
- `expo-google-fonts/manrope`
- `expo-google-fonts/newsreader`

Or use `expo-font` + `@fontsource` packages. Check what's easiest with Expo 55.

### Icons
Use `@expo/vector-icons` MaterialCommunityIcons or install `react-native-vector-icons` for Material Symbols. Alternatively, map the Material Symbols used in the designs to equivalent icons from Expo's built-in icon sets.

### Navigation
The app already uses React Navigation. Add a bottom tab navigator with 3 tabs:
- Connect (pairing) — `auto_awesome` icon
- Chat — `chat_bubble` icon  
- Settings — `settings` icon

Active tab: gold color with fill. Inactive: neutral-500, opacity 60%.

### Existing Code to Preserve
- `src/useWebSocket.ts` — WebSocket connection logic (DO NOT MODIFY)
- `src/deviceIdentity.ts` — Device identity crypto (DO NOT MODIFY)
- `src/storage.ts` — AsyncStorage helpers (DO NOT MODIFY)
- `src/types.ts` — Type definitions (can extend)

### Existing Screens to Redesign
- `src/screens/PairingScreen.tsx` — Redesign to match pairing mockup
- `src/screens/ChatScreen.tsx` — Redesign to match chat mockup (preserve message handling logic)
- Create new `src/screens/SettingsScreen.tsx`

### Important Notes
- This is React Native with Expo SDK 55, NOT web. Don't use web-only CSS.
- Use `StyleSheet.create()` for styles, not Tailwind (we're not using NativeWind).
- The designs use Tailwind CSS classes — translate them to React Native StyleSheet equivalents.
- LinearGradient: use `expo-linear-gradient`
- BlurView: use `expo-blur` for backdrop blur effects
- Animations: use `react-native-reanimated` if needed, or simple Animated API
- Safe area: wrap in SafeAreaView for iPhone notch/home indicator
- The owl logo is a remote URL in the mockups — we should bundle a local asset instead. For now, use the remote URL as placeholder.

### Message Rendering
The current ChatScreen has message handling logic for streaming (delta/final). Preserve this logic but restyle the message bubbles to match the design. Key changes:
- AI messages get the large italic headline treatment
- User messages get the dark rounded bubble
- Typing indicator matches the gold dots design
- Streaming cursor (blinking |) appended to streaming messages

### What NOT to change
- WebSocket connection flow
- Device identity / pairing logic
- Message send/receive logic
- Storage layer
- app.json / eas.json configuration
