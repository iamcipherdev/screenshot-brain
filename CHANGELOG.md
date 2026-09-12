# Changelog

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
