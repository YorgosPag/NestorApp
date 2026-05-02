# ADR-338 — Parking Floor Schema Simplification (Single Source of Truth)

**Status:** ACCEPTED
**Date:** 2026-05-02
**Author:** Giorgio Pagonis
**Related:** ADR-182 (Parking & Storage Hierarchy Audit), `src/types/parking.ts`, `src/components/shared/FloorSelectField.tsx`

---

## 1. Context

A `ParkingSpot` document had **two fields** for the floor:

| Field | Type | Source of truth for |
|---|---|---|
| `floor` | `string` (e.g. `"0"`, `"-1"`, `"Ισόγειο"`) | display, card badge, formatting |
| `floorId` | `string` (Firestore floor doc reference) | `FloorSelectField` value binding |

This dual-source-of-truth caused a visible bug: the parking card showed `"Ισόγειο"` (read from `floor`) while the detail panel's `FloorSelectField` showed `"—"` (because `floorId` was empty or referenced a floor doc that no longer matched any option in the loaded floors API).

Unlike apartments / units / storages — which need `floorId` to join a floor document for floor-plan rendering, level navigation and BOQ scope — **parking spots only need a label**. The `floorId` foreign key adds referential complexity without buying anything.

## 2. Decision

**Drop `floorId` from the parking schema. Keep only `floor` (string).**

- `floor` is the canonical and only field for the parking's level.
- `FloorSelectField` gains a new `valueMode: 'floorId' | 'floor'` prop (default `'floorId'`, backward-compatible). Parking uses `valueMode='floor'`; storage / property keep the default.
- The Select still pulls floors from the building's API to offer canonical options ("Ισόγειο", "1ος όροφος"…), but persists only the floor's number-string (`"0"`, `"-1"`).

## 3. Scope of change

| File | Change |
|---|---|
| `src/types/parking.ts` | Remove `floorId?: string` from `ParkingSpot`. |
| `src/app/api/parking/[id]/route.ts` | Remove `floorId` from Zod `UpdateParkingSchema` and update logic. |
| `src/lib/firestore-mappers.ts` | `mapParkingDoc` no longer reads `data.floorId`. |
| `src/components/shared/FloorSelectField.tsx` | New `valueMode` prop. When `'floor'`: `SelectItem.value` is the floor number string, `onChange` emits only the floor string (no payload). |
| `src/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab.tsx` | Form state drops `floorId`. `FloorSelectField` invoked with `valueMode='floor'`, `value={form.floor}`. |

## 4. What stays untouched

- `Storage` (`StorageGeneralTab`) — storage may still want `floorId` for future floor-document integration, no migration forced now.
- `Property` / `Unit` — `floorId` is load-bearing (floorplan, BOQ scope, multi-level navigation). Untouched.
- `FloorSelectField` default behaviour — default `valueMode='floorId'` preserves all existing callers.

## 5. Migration

- **No script needed.** Old documents with `floorId` set are now ignored by the mapper; subsequent writes from the parking edit form do not touch `floorId`. The legacy field will linger as dead data on existing docs and can be optionally pruned during the next test-DB wipe.
- **Card display unchanged.** The card already reads only `parking.floor` via `formatFloorString()`.
- **Detail panel fixed.** With `valueMode='floor'`, `FloorSelectField` matches options by floor-number string. If the building has the matching floor in the API, it shows the label; otherwise `fallbackFloor={form.floor}` keeps showing the legacy free-text value.

## 6. Trade-offs

✅ Single source of truth — one field, one meaning, no drift.
✅ Works regardless of whether the linked building has registered floor documents.
✅ Consumers (cards, detail panels, exports) all read the same `floor` string.
⚠️ Cannot join the parking back to a floor document (e.g. "list all parking on floor X" by FK). Acceptable: the `floor` string + `buildingId` is enough to query.

## 7. Google-level checklist (N.7.2)

| # | Q | A |
|---|---|---|
| 1 | Proactive or reactive? | Proactive — fixes the schema, not the symptom. |
| 2 | Race condition? | None — single field, written once. |
| 3 | Idempotent? | Yes — repeated writes converge. |
| 4 | Belt-and-suspenders? | `fallbackFloor` keeps legacy display while migration completes. |
| 5 | SSoT? | Yes — `floor` string is the only floor field on parking. |
| 6 | Fire-and-forget or await? | Awaited (form save). |
| 7 | Lifecycle owner? | `ParkingGeneralTab` form → `/api/parking/[id]` PATCH. |

✅ Google-level: YES — schema simplification, single source of truth, no migration overhead.

## 8. Changelog

- **2026-05-02** — Initial decision and implementation. `floorId` removed from parking type / API / mapper / form. `FloorSelectField` extended with `valueMode`. Card display unchanged. Storage and properties untouched.
