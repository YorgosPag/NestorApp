/**
 * ADR-683 Φ3.1γ (A1) — Imported-mesh param read/patch SSoT (pure, immutable).
 *
 * Mirror of `bim/railings/railing-param-access.ts` (ADR-407 Φ9): the ONE place that maps a
 * `commandKey` → the current `ImportedMeshParams` value (`readImportedMeshField`) and applies a
 * change back into a fresh `ImportedMeshParams` (`patchImportedMeshField`). Any future ribbon
 * bridge AND the Properties-palette dispatcher would share this single read/write path, so the two
 * surfaces can never drift (the ADR-449 bug class the stair keys file warns about).
 *
 * `patchImportedMeshField` returns a NEW params object (or the SAME reference for a read-only key
 * / non-finite numeric input / unknown key) — the caller feeds it to
 * `UpdateImportedMeshParamsCommand`, which atomically recomputes geometry + validation. No
 * mutation, no geometry call, no Firestore here.
 *
 * @see ./imported-mesh-param-keys.ts — the `commandKey` SSoT + guards + the ADR-683 wiring caveat
 * @see ../../../core/commands/entity-commands/UpdateImportedMeshParamsCommand.ts — the ONE command
 *      that applies a patch produced here (also used by `imported-mesh-grips.ts`)
 * @see ./imported-mesh-boq.ts — `withImportedMeshIdentity` (the BOQ identity's own write path —
 *      deliberately NOT duplicated here; the BOQ keys below are read-only display of that value)
 */

import type { ImportedMeshParams } from './imported-mesh-types';
import {
  IMPORTED_MESH_NUMBER_KEYS,
  IMPORTED_MESH_READONLY_KEYS,
  IMPORTED_MESH_STRING_KEYS,
  isImportedMeshRibbonKey,
  isAnyImportedMeshRibbonKey,
} from './imported-mesh-param-keys';

const K = { ...IMPORTED_MESH_NUMBER_KEYS, ...IMPORTED_MESH_READONLY_KEYS, ...IMPORTED_MESH_STRING_KEYS };

/** mm → display string, rounded (measured dimensions are shown, never fractional-mm precise). */
function formatMm(mm: number): string {
  return String(Math.round(mm));
}

// ─── READ: commandKey → current value string (`null` = unknown key / absent optional field) ────

/**
 * Reads the current value of a single imported-mesh field as a display string.
 *
 * Read-only optional fields (`level`, `currentMaterial`, `materialSlots`, the three `boq*` keys)
 * return `null` when the underlying param is absent — never an empty string standing in for "no
 * value" (mirrors `ImportedMeshRow`'s `null`-means-unassigned contract in `imported-mesh-panel-rows.ts`).
 */
export function readImportedMeshField(key: string, p: ImportedMeshParams): string | null {
  switch (key) {
    case K.posX: return String(p.position.x);
    case K.posY: return String(p.position.y);
    case K.elevation: return String(p.mountingElevationMm);
    case K.rotation: return String(p.rotationDeg);
    case K.name: return p.nodeName;
    // ADR-683 Φ3.1γ (follow-up) — the editable display identity; falls back to the immutable
    // `nodeName` so a never-renamed mesh still shows something meaningful in the palette.
    case K.displayName: return p.label ?? p.nodeName;
    case K.width: return formatMm(p.measuredWidthMm);
    case K.depth: return formatMm(p.measuredDepthMm);
    case K.height: return formatMm(p.measuredHeightMm);
    case K.level: return p.storeyId ?? null;
    case K.currentMaterial: return p.sourceMaterialName ?? null;
    case K.materialSlots: return p.materialSlots && p.materialSlots.length > 0 ? p.materialSlots.join(', ') : null;
    case K.boqCategoryCode: return p.importedMeshIdentity?.categoryCode ?? null;
    case K.boqTitle: return p.importedMeshIdentity?.titleEL ?? null;
    case K.boqUnit: return p.importedMeshIdentity?.unit ?? null;
    default: return null;
  }
}

// ─── WRITE: commandKey + value → fresh ImportedMeshParams (writable keys ONLY) ──────────────────

/** Numeric (mm/deg) field writes. Non-finite input is ignored (returns prev), mirror railing. */
function patchNumberField(key: string, p: ImportedMeshParams, mm: number): ImportedMeshParams {
  if (!Number.isFinite(mm)) return p;
  switch (key) {
    case K.posX: return { ...p, position: { ...p.position, x: mm } };
    case K.posY: return { ...p, position: { ...p.position, y: mm } };
    case K.elevation: return { ...p, mountingElevationMm: mm };
    case K.rotation: return { ...p, rotationDeg: mm };
    default: return p;
  }
}

/**
 * `displayName` write — the one mutable string field (ADR-683 Φ3.1γ follow-up). Trimmed; empty
 * input CLEARS the field rather than storing `''` (mirrors the `null`-means-absent contract this
 * SSoT uses everywhere else). The clear branch deliberately DROPS the key instead of setting
 * `label: undefined` — Firestore's web SDK rejects a literal `undefined` field value on
 * `setDoc`/`updateDoc` (no `ignoreUndefinedProperties` configured, `@/lib/firebase`), and `params`
 * is persisted **wholesale** (`imported-mesh-firestore-service.ts`) — an `undefined` here would
 * throw on the very next autosave, not just fail to clear the label. Same idiom as
 * `withImportedMeshIdentity`'s destructure-drop (`imported-mesh-boq.ts`).
 */
function patchStringField(key: string, p: ImportedMeshParams, value: string): ImportedMeshParams {
  if (key !== K.displayName) return p;
  const trimmed = value.trim();
  if (trimmed === '') {
    if (p.label === undefined) return p;
    const { label: _drop, ...rest } = p;
    return rest;
  }
  if (trimmed === p.label) return p;
  return { ...p, label: trimmed };
}

/**
 * Applies a single field change to the imported-mesh params. Returns a fresh params object for one
 * of the four writable numeric keys (`posX`/`posY`/`elevation`/`rotation`) or for `displayName`;
 * returns the SAME reference (no-op) for every read-only key (`name`/`width`/`depth`/`height`/
 * `level`/`currentMaterial`/`materialSlots`/`boq*`), an unknown key, or non-finite numeric input.
 *
 * Read-only keys are a deliberate no-op rather than a throw: this mirrors `patchRailingField`'s
 * `default: return p` fall-through, so a caller that (incorrectly) forwards a read-only key from a
 * generic dispatcher degrades to "nothing happened" instead of a runtime crash. Callers that must
 * distinguish "rejected" from "applied" should gate on `isImportedMeshRibbonKey` /
 * `isAnyImportedMeshRibbonKey` themselves before calling (exactly as `use-ribbon-railing-bridge.ts`
 * gates on `isRailingRibbonKey` / `isRailingRibbonStringKey` before calling `patchRailingField`).
 */
export function patchImportedMeshField(
  key: string,
  p: ImportedMeshParams,
  value: string,
): ImportedMeshParams {
  if (!isAnyImportedMeshRibbonKey(key)) return p;
  if (isImportedMeshRibbonKey(key)) return patchNumberField(key, p, Number.parseFloat(value));
  return patchStringField(key, p, value);
}
