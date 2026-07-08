# ADR-596: Multiple-Photos Upload-State SSoT (`use-photo-slot-state` + photo grid primitives)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the two multi-photo grid variants under `src/components/ui/`. `MultiplePhotosCompact` and `MultiplePhotosFull` each re-implemented an identical upload-state layer (canonical tenant fields, stale-closure refs, `usedSlots`/`availableSlots`, `handleMultipleDrop`, and the full `<EnterprisePhotoUpload>` per-slot callbacks — `onFileChange`/`onUploadComplete`/`onPreviewClick`), plus a byte-identical bulk drop zone and a triple-declared `PhotoSlot` type. Collapsed onto a shared **upload-state hook** (`usePhotoSlotState` with a bound `buildCellProps` factory), a shared **drop-zone primitive** (`PhotoMultiDropZone`), a canonical **types module** (`photo-slot-types`), and a compact-only **profile selector** extract. jscpd (min-tokens 50) on the `Compact↔Full` pair: **7 exact clones / 232 dup-lines → 0**. `jscpd:diff` on the staged fileset: **✅ 0 clones**. Public API (exports, prop names, component signatures) is unchanged — internal refactor only.

**Related:**
- **ADR-585** (Domain Card View-Model Hook), **ADR-586** (Meta Webhook Shared Core), **ADR-588** (Space Media Tab Shell), **ADR-590** (Email Template Shared Primitives), **ADR-591** (Impact-Preview Primitives), **ADR-592** (BIM Entity Factory Base), **ADR-593** (Communication Row Primitives), **ADR-595** (Generic Form Renderer Primitives) — same 2026-07-08 de-duplication sweep, same **shared shell/hook/primitive + per-instance binding** archetype across successive buckets («Κουβάδες Α–Η»). This ADR is «Κουβάς Θ».
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.
- **ADR-292** (Canonical upload pipeline) — the `companyId`/`createdBy` tenant resolution the hook centralizes.
- **ADR-595** — most recent instance of the identical **bound-factory + spread** technique used here to keep the per-slot cell out of each variant's JSX.

---

## Context

`src/components/ui/MultiplePhotosUpload` is the public entry point for multi-photo upload (contact forms, showcase, space media). It delegates to one of two presentational variants — `MultiplePhotosCompact` (semantic grid, disabled-mode slot filter, profile-photo selector) and `MultiplePhotosFull` (responsive 3:4 slots, disabled-mode empty-slot placeholders, detailed upload copy). A **real SSoT audit (grep + jscpd, min-tokens 50)** found **no** existing shared upload-state primitive for these two (the adjacent `useMultiplePhotosHandlers` is a *contact-form validation/processing* hook — a different concern) and one large clone family.

### Clone family — Compact ↔ Full
The two files (Compact 445 lines, Full 431 — both near the 500-line ceiling) re-declared, near-identically:
- `PhotoSlot` (also a 3rd copy in `MultiplePhotosUpload`) and the whole props interface (Full = base; Compact = base + 3 profile props).
- The canonical tenant resolution (`useCompanyId`/`useAuth`), the two stale-closure refs, `usedSlots`/`availableSlots`, and the 46-line `handleMultipleDrop`.
- The **74-line `<EnterprisePhotoUpload>` block** with its `onFileChange` / `onUploadComplete` / `onPreviewClick` callbacks and all canonical props.
- The 22-line bulk drop zone (dashed empty-state + drag/drop + hidden file-input `onClick`).

jscpd measured the pair at **7 clones / 232 dup-lines** (top fragments: 74-line render block, 46-line handler, 35/24/23/22/15-line blocks). The genuinely-divergent part is small: **grid layout** (Compact Tailwind semantic grid vs Full inline responsive style), **disabled behaviour** (Compact filters slots out vs Full renders index-stable placeholders), the **drop-zone content** (Plus + short copy vs Upload + drag/sub copy), and the **profile selector** (Compact-only). One dead helper (`getHeaderText`, unused in both) was removed.

Big-player practice for asset-thumbnail upload grids (Figma image fills, Revit family type images, Cinema 4D texture slots) is a **shared upload-state hook + a per-slot cell primitive fed by a bound factory + a per-variant layout wrapper**, not two parallel grid components. The fix generalises that.

> **i18n note (N.11):** no user-facing literals were introduced. Both variants keep their existing `t('photos.management.*')` / `t('upload.*')` keys (all already present in `common-photos` el+en). Compact's `useTranslation` was narrowed from a 10-namespace array to `'common-photos'` (the only namespace it actually resolved). Zero new baseline entries.

---

## Decision

### New module `photo-slot-types.ts` (types SSoT)
Canonical `PhotoSlot`; `MultiplePhotosBaseProps` (13 shared props); `MultiplePhotosCompactProps = Base + { showProfileSelector, selectedProfilePhotoIndex, onProfilePhotoSelection }`; `MultiplePhotosFullProps = Base`. Plus slot builders `buildSelectedSlot` / `buildClearedSlot` / `buildUploadedSlot` that own the repeated `PhotoSlot` object literals. All three variant files re-export `PhotoSlot` for API stability.

### New module `use-photo-slot-state.ts` (upload-state SSoT)
`usePhotoSlotState(base)` owns the slot lifecycle both variants duplicated:

| Return | Owns |
|---|---|
| `usedSlots` / `availableSlots` | Computed slot counts. |
| `handleMultipleDrop` | Bulk drop → fills next empty slots (ref-based, stale-closure safe). |
| `buildCellProps(photo, index)` | **Bound factory** (ADR-595 pattern) → the full `EnterprisePhotoUploadProps` for a slot, spread at the call-site so no clone migrates to the JSX. Resolves canonical `companyId`/`createdBy` (ADR-292) once. |

The unified `onFileChange` reads `normalizedPhotosRef.current` (Full's stale-closure-safe form — Compact previously read the render-closure snapshot; the ref version is the more-correct Google-level behaviour).

### New primitive `PhotoMultiDropZone.tsx`
Shared dashed drop/click affordance: container styling + `onDrop`/`onDragOver` + hidden file-input `onClick`. Injected `{ onDropFiles, disabled, padding, ariaLabel, children }` — the icon + copy differ per variant via `children`, **not** `if (variant)`. Renders a semantic `<aside role="button">`, unifying Compact's semantic markup with Full's former `<div>` (Boy-Scout fix of N.4 div-soup on the full path).

### Compact-only extract `PhotoProfileSelector.tsx`
The profile-photo selector footer moved out of `MultiplePhotosCompact` (N.7.1 — extract, not trim), bringing the variant to 120 lines. Single consumer; not a dedup target.

### Thin variants + shared prop-forwarding
`MultiplePhotosCompact` (445→**120**) and `MultiplePhotosFull` (431→**152**) keep ONLY their layout wrapper (grid element, slot sizing, disabled handling) + a `{...buildCellProps(photo, index)}` spread. `MultiplePhotosUpload` builds a `sharedProps: MultiplePhotosBaseProps` bag and spreads it into both branches (killed the residual same-file prop-forwarding self-clone).

---

## Verification
- **jscpd** (`Compact↔Full`, min-tokens 50): **7 clones / 232 dup-lines → 0**. `jscpd:diff` on the 7 staged files: **0 clones** (the first pass caught a same-file prop-forwarding self-clone in `MultiplePhotosUpload` → fixed with the shared `sharedProps` spread).
- **Tests** (jest + RTL): `multiple-photos/__tests__/multiple-photos.test.tsx` (7) — per-slot cell count (compact + full), disabled-mode slot filter (compact) / placeholders (full), profile-selector gating, and the shared upload-state wiring (`onUploadComplete` → `buildUploadedSlot` → `onPhotosChange`; `handleUploadComplete` precedence).
- **No behaviour change**: public exports/props/signatures unchanged; the only intentional refinements are the ref-based `onFileChange` in Compact (stale-closure fix), the semantic `<aside>` drop zone on the full path, and removal of the dead `getHeaderText` helper.

---

## Changelog
- **2026-07-08** — Initial version. Created `photo-slot-types.ts` + `use-photo-slot-state.ts` + `PhotoMultiDropZone.tsx` + `PhotoProfileSelector.tsx`; migrated `MultiplePhotosCompact` (445→120) + `MultiplePhotosFull` (431→152) onto them; centralized `PhotoSlot` (3 copies → 1) and the prop-forwarding bag in `MultiplePhotosUpload`; added 1 test suite (7 tests). «Κουβάς Θ» of the 2026-07-08 de-duplication sweep.
