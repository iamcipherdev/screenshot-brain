# Changelog

## v1.2.0 — 2026-09-13

The "public launch" release: complete product website, hardened APK distribution.

### Added
- Complete marketing website (docs/): hero, real product showcase (Home, Search, Brain Chat,
  Library, Cleanup, Detail), 8 feature sections, "Chat with your screenshot memory" section with
  a grounded-answer example, how-it-works, privacy breakdown, download section, open-source
  overview, 8-question FAQ.
- Download buttons always point at the latest GitHub Release APK: permanent
  `releases/latest/download/` links plus a small script that fetches release metadata
  (version, APK size, release date, filename) from the GitHub API, with static fallbacks.
- SEO: Open Graph + Twitter cards, canonical URL, JSON-LD SoftwareApplication schema,
  OG share image generated from real app screenshots.
- Full-page screenshot of the Detail screen added to the site assets.

### Fixed
- **Release signing**: the v1.1.0 APK attached by CI was debug-signed (the repo has no keystore
  secrets). CI no longer attaches APKs when the keystore secret is absent — releases are
  published from local builds signed with the production keystore. v1.1.0's asset has been
  replaced with the properly signed build; users on the debug-signed copy should reinstall from
  the v1.2.0 release.
- package.json version now tracks the Android versionName.

## v1.1.0 — 2026-09-12

The "real assistant" release.

### Added
- Full AI chat system: multi-conversation history (rename, delete, new chat), streaming
  responses, numbered tappable citations, retry/copy/share per message, AI follow-up
  suggestions, auto conversation titles.
- Screenshot understanding pipeline v2: organizations, people, prices, deadlines and
  content-type detection added to entities.
- Natural-language search: price filters ("under Rs 5000"), relative dates ("last week"),
  semantic synonym matching, entity search, stop-word handling, numeric matching ("48500" → "48,500").
- Smart collections: 8 auto-maintained collections derived from the library.
- Cleanup engine v2: similarity percentages, keeper recommendation, storage-saved estimates,
  blurred/empty/low-info detection, Keep best / Select / Keep all actions.
- Trash with Undo: soft delete everywhere, 30-day auto-purge, restore/permanent-delete in Settings.
- Security: 4-digit PIN app lock (SHA-256 hashed), biometric unlock (fingerprint/face via AndroidX),
  per-screenshot blur protection, per-screenshot "exclude from AI".
- Detail page: Ask AI about this, edit tags, Mark Important, Protect, Exclude-from-AI.
- 4-slide onboarding with permission rationale; production states (offline banner, error boundary,
  rate-limit messages, empty states); accessibility pass (focus rings, reduced motion, touch targets).
- Landing website (website/ → GitHub Pages), MIT license, CI workflow for APK builds.

### Fixed
- Search: "receipt from last week" and similar NL queries now return results (content-type
  hard-filter + filler words removed); "university fee screenshot" hint works.
- Home cleanup count now matches the Cleanup screen exactly.
- Duplicate groups include shots flagged dupOf whose hash drifted apart.

## v1.0.0 — 2026-09-11
Initial release: import/scan/share, ML Kit OCR, Gemini analysis, Ask Brain v1, search,
duplicates, collections, timeline, cleanup suggestions, onboarding, dark mode, signed APK.
