# ADR-311 — Desktop Camera Capture via WebRTC (Photo + Video)

| Field | Value |
|-------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-04-17 |
| **Category** | File Management / Media Capture / SSoT Enforcement |
| **Canonical Location** | `src/hooks/useCameraCapture.ts` + `src/hooks/useVideoRecorder.ts` + `src/components/shared/files/CameraCaptureDialog.tsx` |

---

## 1. Problem

From property management → Photos tab → "Προσθήκη αρχείων" menu → "Λήψη φωτογραφίας", the browser opened **Windows Explorer** instead of the webcam, even with a USB camera physically connected to the computer.

**Root cause (code audit)**: `src/components/shared/files/AddCaptureMenu.tsx` rendered

```tsx
<input type="file" accept="image/*" capture="environment" />
```

The HTML `capture` attribute is specified to hint the mobile OS to open the camera app. **Desktop browsers (Chrome, Edge, Firefox, Safari on Windows/Mac/Linux) ignore `capture` entirely** and fall back to the OS file picker. No USB webcam is accessed. Same bug for the "Εγγραφή βίντεο" option.

Audio capture was already fine because `useAddCaptureHandlers.ts` (line 143) uses `navigator.mediaDevices.getUserMedia` — that is the correct WebRTC path. Photo/video were the odd ones out.

---

## 2. Decision

Split camera capture by platform inside the existing `AddCaptureMenu` pipeline:

| Platform | Path |
|----------|------|
| **Mobile** (viewport width `< MOBILE_BREAKPOINT`) | Keep native `<input type="file" capture>` — the OS camera app is still the best UX on phones. |
| **Desktop** (everything else, when `navigator.mediaDevices?.getUserMedia` exists) | Open a **WebRTC dialog** with a live `<video>` preview, a capture button, device selection, and a preview/retake step before the file is committed to the canonical upload pipeline. |

Detection point (single place):

```ts
if (!isMobile && supportsGetUserMedia()) {
  setIsCameraDialogOpen(true);
  return;
}
cameraInputRef.current?.click(); // mobile fallback
```

**Why not replace the `capture` input entirely?** On phones the native camera app (a) survives backgrounding, (b) handles orientation metadata, (c) matches user expectation. Forcing an in-page WebRTC dialog on mobile is a regression.

**Why not build one monolithic hook?** Photo and video have different state machines. `useCameraCapture` only needs a live preview + single canvas grab. `useVideoRecorder` needs `MediaRecorder` + duration tracking + MIME detection. Splitting mirrors the existing `usePhotoCapture` (ADR-170, mobile-only) and `useVoiceRecorder` (ADR-161, audio) split.

---

## 3. Architecture

Three new modules + two edits, each respecting Google SRP (`≤500` lines / `≤40` lines per function) and the i18n SSoT (every label routed through `t()` with keys pre-written in locale JSONs — SOS N.11).

| Layer | Path | Responsibility |
|------|------|----------------|
| Photo hook | `src/hooks/useCameraCapture.ts` | `getUserMedia` → `<video>` preview → canvas grab → `File`. Device enumeration + switching. Cleanup on unmount. |
| Video hook | `src/hooks/useVideoRecorder.ts` | `getUserMedia` (video+audio) → `MediaRecorder` → `Blob` → `File`. Duration tracking, MIME detection (webm/vp9, webm/vp8, mp4 fallback). |
| Dialog UI | `src/components/shared/files/CameraCaptureDialog.tsx` | Radix `Dialog` primitive. Live preview, capture/record button, device selector, preview/retake step, error states. Props: `open`, `mode: 'photo'\|'video'`, `onClose`, `onCapture(File, CaptureMetadata)`. |
| Handler glue | `src/components/shared/files/useAddCaptureHandlers.ts` | New state: `isCameraDialogOpen`, `isVideoDialogOpen`. New handler: `handleDialogCapture`. Platform branch in `handleCameraCapture` / `handleVideoCapture`. |
| Menu render | `src/components/shared/files/AddCaptureMenu.tsx` | Renders `<CameraCaptureDialog>` for both modes alongside the existing hidden inputs. |
| i18n | `src/i18n/locales/{el,en}/files-media.json` | New namespace `capture.cameraDialog.*` (title, buttons, error codes). |

### Error taxonomy

The hooks translate `DOMException.name` into a stable `CameraCaptureErrorCode` union. The dialog picks the matching locale key — no hardcoded error strings:

| Code | DOMException names | i18n key |
|------|--------------------|----------|
| `PERMISSION_DENIED` | `NotAllowedError`, `SecurityError` | `capture.cameraDialog.errorPermissionDenied` |
| `NO_DEVICE` | `NotFoundError`, `OverconstrainedError` | `capture.cameraDialog.errorNoDevice` |
| `DEVICE_BUSY` | `NotReadableError`, `AbortError` | `capture.cameraDialog.errorDeviceBusy` |
| `NOT_SUPPORTED` | `TypeError`, missing `mediaDevices` | `capture.cameraDialog.errorNotSupported` |
| `UNKNOWN` | fallback | `capture.cameraDialog.errorGeneric` |

### Cleanup contract

Every code path (dialog close, retake, unmount, error) stops every track on the `MediaStream` and releases the object URL on the preview. No leaked webcam handles. Verified against the checklist in ADR-161 §Cleanup.

---

## 4. Relationship to existing ADRs

| ADR | Relationship |
|-----|--------------|
| [ADR-031](./ADR-031-enterprise-command-pattern-undo-redo.md) | Extends the canonical file storage system. `onCapture(file, metadata)` still flows through the same upload pipeline — no new storage path. |
| [ADR-161](./ADR-161-global-voice-assistant.md) | Parallel pattern. `useVideoRecorder` mirrors `useVoiceRecorder`'s MIME detection + `MediaRecorder` handling. |
| [ADR-170](./ADR-170-attendance-qr-gps-verification.md) | `usePhotoCapture` (mobile-only, attendance QR flow) is **preserved unchanged** — it is used in a different context where native mobile camera is mandatory. |
| [ADR-001](./ADR-001-select-dropdown-canonicalization.md) | Device selector uses the canonical `@/components/ui/select` (Radix), not `EnterpriseComboBox`. |

---

## 5. SOS / SSoT compliance

- ✅ SOS N.2 — zero `any`, zero `as any`. All error codes typed as discriminated union.
- ✅ SOS N.3 — zero inline styles. Only `cn()` + Tailwind classes.
- ✅ SOS N.4 — semantic HTML: `<section>`, `<video>`, `<output>` for live regions, `<label>` bound to `<SelectTrigger>`.
- ✅ SOS N.7.1 — every new file ≤ 500 lines, every function ≤ 40 lines.
- ✅ SOS N.11 — every user-facing string routed through `t()` with the key pre-written in **both** `el` and `en` locale JSONs. No `defaultValue: 'literal'`.
- ✅ i18n SSoT — new namespace `capture.cameraDialog.*` added in `files-media.json` (el + en) before being referenced in code.

---

## 6. Test plan

Manual (ADR requires user-side verification on a real Windows + USB webcam):

1. Property management → select a property → tab "Φωτογραφίες" → "Προσθήκη αρχείων" → "Λήψη φωτογραφίας".
2. Dialog opens. Browser prompts for camera permission. Grant.
3. Live preview shows USB webcam feed. If multiple cameras: device selector lists them all.
4. Click "Λήψη" → preview of still frame → "Νέα λήψη" returns to live feed; "Χρήση" commits the `File` through `onCapture`, which lands in the canonical upload pipeline and the new photo appears in the gallery.
5. Cancel at any step → camera tracks stop, no webcam LED remains on.
6. Repeat for "Εγγραφή βίντεο" (mode `'video'`) — verify `MediaRecorder` output plays back in preview.
7. Permission denied → dialog shows the Greek error `"Η πρόσβαση στην κάμερα απορρίφθηκε..."`.
8. Unplug USB webcam mid-session → `NO_DEVICE` error surfaces.
9. Mobile device viewport (DevTools emulator) → clicking "Λήψη φωτογραφίας" still opens the native camera input (fallback preserved).

---

## 7. Changelog

- **2026-04-17** — Initial version. Root cause of "camera opens Windows Explorer" documented. WebRTC split implemented. `useCameraCapture`, `useVideoRecorder`, `CameraCaptureDialog` added. `AddCaptureMenu` / `useAddCaptureHandlers` wired. Locale keys added (el + en).
