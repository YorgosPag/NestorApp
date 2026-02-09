# ADR-156: Voice Message Transcription (OpenAI Whisper)

**Status**: APPROVED
**Date**: 2026-02-09
**Category**: Backend Systems

---

## Context

Τα voice messages στο Telegram φτάνουν με `message.voice` αλλά **χωρίς `message.text`**. Ο handler.ts ελέγχει `messageText.trim().length > 0` σε 3 σημεία:
- Admin detection (ADR-145): SKIP
- Pipeline feed (ADR-132): SKIP
- `after()` hook (ADR-134): SKIP

Αποτέλεσμα: τα voice messages κατεβαίνονταν ως media (ADR-055) αλλά το περιεχόμενό τους **δεν αναλυόταν ποτέ**.

## Decision

Χρήση OpenAI Whisper API (`POST /v1/audio/transcriptions`) για μεταγραφή voice messages σε κείμενο. Χρησιμοποιεί τo ήδη υπάρχον `OPENAI_API_KEY` στο Vercel.

**Κόστος**: ~$0.006/λεπτό (ουσιαστικά δωρεάν).

## Architecture

```
Telegram voice (.ogg)
  → handler.ts: detect message.voice (no text)
  → whisper-transcription.ts: download .ogg → POST Whisper API
  → effectiveMessageText = "Greek transcribed text"
  → Admin detection works (ADR-145)
  → processMessage() gets text
  → feedTelegramToPipeline() feeds text (ADR-132)
  → after() triggers pipeline batch (ADR-134)
```

## Files Modified

| File | Change |
|------|--------|
| `src/config/ai-analysis-config.ts` | Added `WHISPER_MODEL`, `WHISPER_TIMEOUT_MS`, `WHISPER_DEFAULT_LANGUAGE` to `AI_ANALYSIS_DEFAULTS.OPENAI` |
| `src/app/.../telegram/media-download.ts` | Exported `getTelegramFile` and `downloadTelegramFile` (were private) |
| `src/app/.../telegram/whisper-transcription.ts` | **NEW** — Whisper API service (~110 lines) |
| `src/app/.../handler.ts` | Voice transcription in `processTelegramUpdate()`, updated `feedTelegramToPipeline()` signature, fixed `after()` condition |
| `src/app/.../message/process-message.ts` | Added `overrideText` parameter, CRM stores transcribed text |
| `src/app/.../crm/store.ts` | Added `isVoiceTranscription` field to `CRMStoreMessage`, included in `providerMetadata` |

## Configuration

No new environment variables needed. Uses existing:
- `OPENAI_API_KEY` (already in Vercel)
- `OPENAI_API_BASE_URL` (optional, defaults to `https://api.openai.com/v1`)

Constants in `ai-analysis-config.ts`:
- `WHISPER_MODEL`: `whisper-1`
- `WHISPER_TIMEOUT_MS`: `30000`
- `WHISPER_DEFAULT_LANGUAGE`: `el` (Greek)

## Verification

1. **TypeScript**: `npx tsc --noEmit` — zero errors
2. **Test στο Telegram**: Στείλε voice message → πρέπει να μεταγραφεί
3. **Vercel logs**: Ψάξε `🎤` emoji logs
4. **Firestore**: Messages πρέπει να έχουν `providerMetadata.isVoiceTranscription: true`

## Changelog

| Date | Change |
|------|--------|
| 2026-02-09 | Initial implementation |
