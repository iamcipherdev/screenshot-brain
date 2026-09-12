<p align="center">
  <img src="docs/assets/icon.png" width="84" alt="Screenshot Brain logo" />
</p>

<h1 align="center">Screenshot Brain</h1>

<p align="center">
  <b>Your screenshots remember everything. Now you can too.</b><br/>
  Turn forgotten screenshots into searchable personal memory — on-device OCR, smart organization,<br/>
  and grounded AI that cites your actual screenshots.
</p>

<p align="center">
  <a href="https://github.com/iamcipherdev/screenshot-brain/releases/latest"><img alt="Release" src="https://img.shields.io/badge/download-v1.1.0-167A55" /></a>
  <img alt="Platform" src="https://img.shields.io/badge/platform-Android%208.0%2B-191B18" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-84887F" />
  <img alt="AI" src="https://img.shields.io/badge/AI-optional%20%C2%B7%20your%20key-BFDCCD" />
</p>

<p align="center">
  <a href="https://iamcipherdev.github.io/screenshot-brain/">Landing page</a> ·
  <a href="#-download">Download APK</a> ·
  <a href="#-build-it-yourself">Build instructions</a> ·
  <a href="#-privacy-model">Privacy model</a>
</p>

---

**Screenshot Brain** is a local-first Android app that imports your screenshots, reads their text
offline, organizes them into smart collections, and lets you search them the way you remember —
*“receipt from last week”*, *“product under Rs 5000”*, *“that React error”* — or just **ask**:
answers about your library cite the exact screenshots they came from.

Made by **CIPHER**.

## ✨ Features

| Area | What you get |
| --- | --- |
| 📥 **Import** | Gallery picker, batch import, MediaStore scan of your Screenshots folder, and a native **Share Target** (`Share → Screenshot Brain`) from any app |
| 🔍 **OCR** | ML Kit **on-device, offline** text recognition on a sharp 1600px frame — text stays searchable forever |
| 🧠 **AI understanding** *(optional)* | Title, summary, category, tags + entities: dates, deadlines, orgs, people, places, prices, URLs, emails, phones, tasks, content type, usefulness score |
| 💬 **Ask Screenshot Brain** | Full chat: streaming responses, conversation history with rename/delete, retry, copy, share, follow-up suggestions — every screenshot-grounded claim carries a numbered, tappable citation. Handles general questions too, and says *"I couldn't find enough information in your screenshot library"* instead of inventing answers |
| 🔎 **Search** | Natural-language parsing (price ranges, relative dates), semantic synonym matching, entities, phrases, `tag:`/`category:` filters — with a visible **why it matched** reason on every result |
| 🗂 **Smart collections** | Auto-maintained collections (University, Travel, Receipts, Job Applications, Development Errors, Documents, Products, Important) plus manual and AI-suggested ones |
| 🧹 **Cleanup** | Duplicate groups with similarity %, keeper recommendation and storage estimates; blurred/empty/low-info/outdated detection; Keep best · Select · Delete · Keep all — everything goes to **Trash with Undo**, nothing auto-deletes |
| 🔒 **Privacy & security** | PIN + biometric app lock, per-screenshot blur protection, per-screenshot “exclude from AI”, accurate local-vs-cloud disclosure |
| 🌙 **Polish** | Warm editorial design, light/dark, onboarding, offline banner, indexed pipeline with progress, empty/error states everywhere, accessibility (touch targets, focus, reduced motion) |

## 📱 Download

Grab **`ScreenshotBrain-v1.1.0.apk`** from the
[**Releases page**](https://github.com/iamcipherdev/screenshot-brain/releases/latest).

- Android 8.0+ (API 26)
- No account, no telemetry, no analytics
- AI features need your own free [Gemini API key](https://aistudio.google.com/apikey) (everything else works without it)

## 🏗 Architecture

```
┌────────────────────────── UI (React 19, strict TS) ─────────────────────────┐
│  Home · Search · Brain chat · Cleanup · Library · Detail · Collections ·    │
│  Timeline · Onboarding · Settings · Lock screen                             │
└──────────────┬──────────────────────────────────────────────┬───────────────┘
               │                                              │
┌──────────────▼─────────────┐                ┌──────────────▼───────────────┐
│  Service layer             │                │  Native bridge (Kotlin)      │
│  pipeline  — import/index  │                │  ScreenshotBrainPlugin:      │
│  ocr       — ML Kit first  │◄──────────────►│  MediaStore scan · share     │
│  gemini    — AI + chat     │                │  inbox · ML Kit OCR ·        │
│  search    — NL + semantic │                │  modern permissions ·        │
│  dup       — pHash + sim   │                │  biometric prompt            │
│  cleanup   — groups/blur   │                └──────────────────────────────┘
│  value     — scoring rules │
│  smartcolls— auto groups   │                ┌──────────────────────────────┐
│  repo      — all DB access │◄──────────────►│  IndexedDB (local, private)  │
│  chat      — conversations │                │  shots · blobs · collections │
└────────────────────────────┘                │  conversations · settings    │
                                              └──────────────────────────────┘
```

**Data flow (import pipeline).** Every screenshot goes through:
`thumbnail + perceptual hash → duplicate check → on-device OCR → value scoring → optional AI analysis → searchable index`.
The pipeline runs in the background with live progress, batches thousands of shots, and never blocks the UI. Without a Gemini key, steps run on rules alone and the app stays fully usable.

**AI flow.** Screenshots are analyzed once at import (downscaled ≤1024px, your key, your quota).
Ask Brain retrieves the 10 most relevant shots via the search engine, sends **text excerpts**
(not full images) with the question, streams the answer, and converts `[shot:ID]` citations into
numbered source chips you can tap. If the library can't answer, the model is instructed to say so
verbatim — no invented facts.

## 🔒 Privacy model

| Stays on your device | Goes to Google Gemini — only when *you* trigger it |
| --- | --- |
| Screenshot copies, OCR text, search index | A downscaled copy at import — to write title/summary/tags |
| OCR (ML Kit runs offline) | Your question + text excerpts of relevant shots for Ask Brain |
| Duplicates, blur, value analysis | Nothing — if you have no key, or excluded the shot from AI |
| Collections, tags, chats | Requests use **your key and quota**; the app has no server |
| Your key and PIN (hashed) | |

Extra controls: PIN/biometric app lock · blur sensitive screenshots · exclude any screenshot from AI · Trash with Undo · delete-all in Settings. See the [landing page](https://iamcipherdev.github.io/screenshot-brain/#privacy) for the user-facing version.

## 🛠 Technology

React 19 · TypeScript (strict) · Capacitor 8 · Kotlin · ML Kit Text Recognition · Gemini API (optional) · IndexedDB · AndroidX Biometric · Android 8.0+

## 🔨 Build it yourself

Requirements: Node 20+, JDK 21, Android SDK (platform 36, build-tools 35).

```bash
git clone https://github.com/iamcipherdev/screenshot-brain.git
cd screenshot-brain
npm install
npm run build              # web build → dist/
npx cap sync android       # copy web assets + plugins into the Android project
cd android
./gradlew assembleDebug    # → app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease  # signed release (see below)
```

**Signing.** Release signing reads `android/keystore.properties` (gitignored):

```properties
storeFile=keystore/screenshot-brain.keystore
storePassword=your_store_password
keyAlias=your_alias
keyPassword=your_key_password
```

If the file is absent, release builds fall back to debug signing so the project always compiles.
Never commit real credentials.

**Environment variables** — none required. The Gemini key is entered in-app (Settings → Gemini AI)
and stored only on the device.

### Tests

```bash
npm test        # vitest — search engine, duplicate/cleanup engine, value scoring, utils
```

## 📦 Repo layout

```
src/
  components/   Thumb, Icon, Sheet/Dialog/Toasts, Lock, ErrorBoundary…
  screens/      Home · SearchScreen · Brain · Cleanup · Library · Detail ·
                Collections · Timeline · Onboarding · Settings
  lib/          db · repo · images · ocr · gemini · search · dup · cleanup ·
                value · smartcolls · pipeline · chat-less chat service in repo ·
                native · demo · theme · haptics · util
  state/        store.tsx — navigation, data, settings, toasts
  styles/       app.css — editorial design system (light + dark)
android/        Capacitor host · ScreenshotBrainPlugin.kt-java · share targets · keystore config
docs/           landing page (GitHub Pages, served from /docs)
```

## ⚠️ Known limitations

- AI accuracy depends on Google Gemini; free-tier quotas can rate-limit heavy imports (the app degrades gracefully and marks shots for retry).
- Ask Brain sends text excerpts to the cloud when a key is set — it is not a fully-local LLM.
- OCR covers Latin scripts (ML Kit Latin model); Urdu/Arabic text in screenshots is not recognized yet.
- The PIN lock is a convenience guard (SHA-256 locally), not hardware-backed encryption.
- Deleting from inside the app never removes the original from your phone's gallery — by design.

## 🗺 Roadmap

- [ ] Urdu/Arabic OCR support
- [ ] Full-text FTS index for very large (10k+) libraries
- [ ] Optional fully-local chat via on-device models
- [ ] Auto-backup/restore of the index (encrypted, user-controlled)
- [ ] F-Droid / Play Store distribution

## 📄 License

[MIT](LICENSE) © CIPHER
