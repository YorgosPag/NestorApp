# ADR-342: Voice Input Field SSoT

**Status**: ✅ IMPLEMENTED  
**Date**: 2026-05-09  
**Category**: UI Components / Voice Infrastructure

---

## Context

The CRM Calendar dialog (`CalendarCreateDialog`) needed a voice-to-text input button
for the description field. Before building it, we audited the existing voice infrastructure
(ADR-156, ADR-161, ADR-164) and found:

- `useVoiceRecorder` — cross-browser MediaRecorder + Whisper transcription hook
- `POST /api/voice/transcribe` — Whisper server endpoint
- `VoiceAssistantButton` — global header mic button (bound to AI pipeline, not suitable for field input)

None of these covered the use case of **inline field voice input with AI text polish**.

---

## Decision

Create a dedicated **Voice Input Field** SSoT layer:

```
useVoiceInput (hook — SSoT)
  ├── useVoiceRecorder (existing) → MediaRecorder + Whisper transcription
  └── POST /api/voice/polish (NEW) → gpt-4o-mini text formatting
      └── onResult(polishedText) → callback to field

VoiceMicButton (component — SSoT)
  ├── useVoiceInput
  ├── States: idle | recording | transcribing | polishing | done | error
  └── Props: onResult, disabled, className, skipPolish
```

### Why separate from ADR-161 (Global Voice Assistant)?

ADR-161's `VoiceAssistantButton` routes audio to the **AI command pipeline** (Firestore `voice_commands`, real-time panel). This is for **field-level text input** — simpler, synchronous, no Firestore writes.

---

## Files

| File | Role |
|------|------|
| `src/hooks/useVoiceInput.ts` | SSoT hook — recording + transcription + polish |
| `src/components/voice-input/VoiceMicButton.tsx` | SSoT component — inline mic button |
| `src/app/api/voice/polish/route.ts` | AI polish endpoint (gpt-4o-mini) |
| `src/config/domain-constants.ts` | Added `API_ROUTES.VOICE.POLISH` |
| `src/services/voice/voice-mutation-gateway.ts` | Added `polishVoiceTextWithPolicy()` |

---

## Polish Endpoint

`POST /api/voice/polish`
- Input: `{ text: string }` (max 2000 chars)
- Auth: `withAuth` (authenticated users only)
- Rate: `withStandardRateLimit` (20 req/min)
- Model: `gpt-4o-mini` (via `AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL`)
- Fallback: on any error, client delivers raw transcription text
- Timeout: inherits `AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS` (30s)

---

## Status Transitions

```
idle ──toggle()──> recording ──toggle()──> transcribing ──> polishing ──> done
  ^                                                                         |
  └─────────────────────── reset() ────────────────────────────────────────┘
  
Any state ──error──> error ──toggle()──> idle (via done/error check)
```

---

## Usage

```tsx
// Minimal: appends voice result to existing text
<VoiceMicButton
  onResult={(text) => setDescription(prev => prev ? `${prev}\n${text}` : text)}
/>

// Skip polish (raw Whisper output)
<VoiceMicButton onResult={setText} skipPolish />
```

---

## Current Consumers

- `src/components/crm/calendar/CalendarCreateDialog.tsx` — description field

---

## i18n

Namespace: `crm-inbox` → `calendarPage.dialog.voiceInput`

Keys: `startRecording`, `stopRecording`, `recording`, `transcribing`, `polishing`,
`errorPermission`, `errorGeneric`

---

## Quality Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive? | ✅ Button visible in UI |
| 2 | Race condition? | ✅ `resultFiredRef` prevents double-fire; disabled during processing |
| 3 | Idempotent? | ✅ Multiple calls append text without duplication |
| 4 | Belt-and-suspenders? | ✅ Polish failure → raw text fallback |
| 5 | SSoT? | ✅ One hook + one component |
| 6 | Await? | ✅ Both stopRecording() and polish are awaited |
| 7 | Lifecycle owner? | ✅ useVoiceInput owns recording lifecycle |

✅ Google-level: YES — proactive UI, zero race conditions, raw-text fallback on every failure path

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-09 | Initial implementation — hook + component + API route |
