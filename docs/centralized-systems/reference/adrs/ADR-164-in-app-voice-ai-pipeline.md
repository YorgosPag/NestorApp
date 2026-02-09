# ADR-164: In-App Voice AI Pipeline — Right-Side Chat Panel

| Field | Value |
|-------|-------|
| **Status** | Implemented |
| **Date** | 2026-02-09 |
| **Author** | Claude (Anthropic) + Giorgos Pagonis |
| **Category** | AI Pipeline / Voice / UX |
| **Related** | ADR-161 (Voice Assistant), ADR-080 (Pipeline), ADR-145 (Super Admin) |

## Context

Voice commands from the web app should enter the same AI pipeline as Telegram messages, with the AI response displayed in a right-side chat panel (industry standard: SAP Joule, Microsoft Copilot, Google Gemini, Salesforce Einstein).

**Before**: Mic button -> Dialog -> transcribe -> Copy text (end)
**After**: Mic button -> Dialog -> transcribe -> "Send Command" -> Right panel -> AI pipeline -> real-time AI response

## Decision

Implement the IN_APP channel as a third adapter for the Universal AI Pipeline, alongside Email and Telegram.

## Data Flow

```
Header Mic -> Record -> POST /api/voice/transcribe -> transcribed text
  -> User clicks "Send Command"
  -> POST /api/voice/command (NEW)
    -> Firestore: voice_commands/{id} (status: pending)
    -> InAppChannelAdapter.feedToPipeline()
      -> isSuperAdminFirebaseUid() (NEW) — admin detection
      -> enqueuePipelineItem() -> ai_pipeline_queue
    -> after() -> processAIPipelineBatch()
  -> Client: onSnapshot(voice_commands/{id})
    -> status: processing -> "Processing..."
    -> status: completed  -> AI Response displayed in panel
```

## Architecture

### New Files
| File | Lines | Purpose |
|------|-------|---------|
| `src/types/voice-command.ts` | ~65 | VoiceCommandDoc, VoiceCommandStatus, SubmitCommandResult |
| `src/services/ai-pipeline/channel-adapters/inapp-channel-adapter.ts` | ~120 | Third channel adapter (mirrors TelegramChannelAdapter) |
| `src/app/api/voice/command/route.ts` | ~160 | POST endpoint: create doc -> enqueue -> trigger worker |
| `src/stores/voiceCommandStore.ts` | ~90 | Zustand store for panel state + history |
| `src/hooks/useVoiceCommand.ts` | ~80 | Hook: submitCommand(text) -> POST /api/voice/command |
| `src/hooks/useVoiceCommandSubscription.ts` | ~70 | Hook: Firestore onSnapshot for real-time updates |
| `src/components/voice-ai/VoiceAIPanel.tsx` | ~240 | Right-side Sheet panel with conversation bubbles |

### Modified Files
| File | Change |
|------|--------|
| `src/types/super-admin.ts` | +`firebase_uid` to AdminResolvedVia |
| `src/types/ai-pipeline.ts` | +`firebase_uid` to AdminCommandMeta.resolvedVia |
| `src/config/firestore-collections.ts` | +VOICE_COMMANDS collection |
| `src/services/ai-pipeline/shared/super-admin-resolver.ts` | +isSuperAdminFirebaseUid() |
| `src/services/ai-pipeline/shared/channel-reply-dispatcher.ts` | +IN_APP case + dispatchInApp() |
| `src/components/header/voice-assistant-button.tsx` | +"Send Command" button |
| `src/app/components/ConditionalAppShell.tsx` | +VoiceAIPanel mount |
| `src/i18n/locales/el/common.json` | +12 voiceAssistant keys |
| `src/i18n/locales/en/common.json` | +12 voiceAssistant keys |
| 12 UC modules | +inAppCommandId in sendChannelReply() calls |

### Firestore Document: `voice_commands/{id}`
```typescript
{
  userId: string,              // Firebase Auth UID
  companyId: string,           // Tenant isolation
  transcript: string,          // User's spoken command
  status: 'pending' | 'processing' | 'completed' | 'failed',
  pipelineRequestId: string | null,
  pipelineQueueId: string | null,
  aiResponse: string | null,
  intent: string | null,
  moduleId: string | null,
  isAdmin: boolean,
  error: string | null,
  channel: 'in_app',
  createdAt: string,           // ISO 8601
  completedAt: string | null,
}
```

## Admin Detection

Super admin detection for in-app uses `isSuperAdminFirebaseUid(uid)` which matches on `admin.firebaseUid` in the super admin registry. This is different from Telegram (userId) and Email (address), but follows the same caching pattern.

## Cost

~$0.002/voice command (Whisper) + ~$0.001/AI analysis (GPT-4o-mini) = ~$0.003/command total

## Consequences

- Voice commands now flow through the full AI pipeline with all UC modules
- Super admins can use voice commands with admin privileges (same as Telegram)
- Real-time feedback via Firestore onSnapshot (no polling)
- Consistent with existing channel patterns (Email, Telegram)
