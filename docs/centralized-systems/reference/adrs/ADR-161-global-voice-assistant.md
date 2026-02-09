# ADR-161: Global Voice Assistant (Header Microphone)

**Status**: APPROVED
**Date**: 2026-02-09
**Category**: Frontend / Backend Systems

---

## Context

Ο Γιώργος θέλει **καθολική χρήση φωνής** σε όλη την εφαρμογή — αναζήτηση, εντολές, μηνύματα. Ένα κουμπί μικροφώνου στο header, ορατό σε κάθε σελίδα.

### Υπάρχουσα κατάσταση
- `quick-add-menu.tsx`: Voice dictation με **Web Speech API** — δωρεάν αλλά **αναξιόπιστο** (Firefox/Safari issues, μέτρια ελληνικά)
- ADR-156 `whisper-transcription.ts`: **OpenAI Whisper API** — αξιόπιστο, εξαιρετικά ελληνικά, cross-browser, $0.006/λεπτό

### Γιατί MediaRecorder + Whisper (αντί για Web Speech API)
| Feature | Web Speech API | MediaRecorder + Whisper |
|---------|---------------|----------------------|
| Firefox | ❌ | ✅ |
| Safari/iOS | Inconsistent | ✅ |
| Greek accuracy | Μέτρια | Εξαιρετική |
| Cost | Free | $0.006/min |
| Server dependency | Google servers | OpenAI API |

## Decision

Global voice button στο header, χρήση **MediaRecorder API** (browser) → **Whisper API** (server) για cross-browser voice-to-text.

**Κόστος**: ~$0.002/voice command (10-15 sec average) → ~$6/μήνα for 100 commands/day.

## Architecture

```
[Header: Mic Button] → Click
  → Dialog opens: idle state
  → Click record: MediaRecorder API starts (WebM/Opus or MP4/AAC)
  → Visual: animated pulse + "Ακούω..."
  → Click stop: MediaRecorder stops → audio Blob
  → POST /api/voice/transcribe (authenticated)
  → Server: Whisper API → text
  → Dialog shows transcription + Copy button
```

## Files

| File | Type | Description |
|------|------|-------------|
| `src/hooks/useVoiceRecorder.ts` | NEW | Cross-browser MediaRecorder hook with Whisper API integration |
| `src/app/api/voice/transcribe/route.ts` | NEW | Server-side endpoint: auth + rate limit + Whisper API |
| `src/components/header/voice-assistant-button.tsx` | NEW | Header button + Dialog with recording/transcription UI |
| `src/components/app-header.tsx` | MODIFIED | Added VoiceAssistantButton to header button cluster |
| `src/i18n/locales/el/common.json` | MODIFIED | Added `voiceAssistant.*` keys (Greek) |
| `src/i18n/locales/en/common.json` | MODIFIED | Added `voiceAssistant.*` keys (English) |

## Security

- **Auth**: `withAuth` middleware — only authenticated users
- **Rate limit**: `withHeavyRateLimit` (10 req/min) — audio processing is resource-intensive
- **File validation**: Max 25MB, `audio/*` MIME only
- **No storage**: Audio is transcribed and discarded — never persisted

## Reused Enterprise Patterns

- **Whisper config**: `AI_ANALYSIS_DEFAULTS.OPENAI` (same as ADR-156)
- **Auth**: `withAuth` from `@/lib/auth`
- **Rate limit**: `withHeavyRateLimit` from `@/lib/middleware`
- **UI**: `useIconSizes()`, `Dialog`, `Button`, `useTranslation('common')`
- **Header pattern**: Same structure as `help-button.tsx`, `NotificationBell`

## Changelog

| Date | Change |
|------|--------|
| 2026-02-09 | Initial implementation: hook + API + component + header integration |
