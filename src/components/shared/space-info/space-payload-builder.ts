/**
 * space-payload-builder — mutation payloads for space entity forms
 *
 * SSoT for the two payload shapes the Parking and Storage general tabs each
 * hand-rolled:
 *
 * - **PATCH** (edit): send only what actually changed. Built with the `*Changed`
 *   methods, which compare the (trimmed) form value against the entity's current
 *   value and encode the "cleared → explicit `null`" rule the API routes expect.
 * - **POST** (create): send the required fields plus whatever the user filled in.
 *   Built by seeding the required fields and adding the `optional*` methods.
 *
 * Keeping the trim / null-vs-omit rules in one place is the point: they are easy
 * to get subtly wrong per field, and drifted between the two twins before.
 *
 * Framework-free by design — no React, no gateway coupling. The caller owns the
 * field list, because Parking and Storage genuinely have different schemas
 * (ADR-588 deliberately keeps the two forms separate rather than unifying them).
 *
 * @module components/shared/space-info/space-payload-builder
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SpacePayloadBuilder {
  /** Set `key` to the trimmed value when it differs from `currentValue`. */
  textChanged(key: string, formValue: string, currentValue: string | null | undefined): void;
  /** As {@link textChanged}, but a cleared field is sent as `null` (not `''`). */
  nullableTextChanged(key: string, formValue: string, currentValue: string | null | undefined): void;
  /** Set `key` when the (already-typed) value differs — for selects/enums. */
  valueChanged<T>(key: string, formValue: T, currentValue: T): void;
  /** Parse a numeric input; a cleared field is sent as `null`. */
  nullableNumberChanged(key: string, formValue: string, currentValue: number | null | undefined): void;
  /** Include the trimmed value only when non-empty — create mode. */
  optionalText(key: string, formValue: string | null | undefined): void;
  /** Include the parsed number only when the input is non-empty — create mode. */
  optionalNumber(key: string, formValue: string): void;
  /** Fold in a ready-made partial, e.g. `useEntityLink().getPayload()` (ADR-200). */
  merge(partial: Record<string, unknown>): void;
  /** `true` when nothing changed — the caller can skip the request entirely. */
  readonly isEmpty: boolean;
  /** The accumulated payload. */
  readonly payload: Record<string, unknown>;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Compare a trimmed form value against a possibly-absent stored value. */
function isTextChanged(formValue: string, currentValue: string | null | undefined): boolean {
  return formValue.trim() !== (currentValue || '');
}

/** Parse a numeric input; empty or non-numeric → `undefined`. */
function parseOptionalNumber(formValue: string): number | undefined {
  if (!formValue) return undefined;
  const parsed = parseFloat(formValue);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// ============================================================================
// SHARED SPACE FIELDS
// ============================================================================

/** The form fields every space entity has, whatever else its schema adds. */
export interface CommonSpaceFormSlice {
  code: string;
  floor: string;
  /** Raw numeric input. */
  area: string;
  description: string;
  notes: string;
}

/** The stored counterpart of {@link CommonSpaceFormSlice}. */
export interface CommonSpaceEntitySlice {
  code?: string | null;
  floor?: string | null;
  area?: number | null;
  description?: string | null;
  notes?: string | null;
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * @param initial Required fields for a create payload; omit for a patch.
 */
export function createSpacePayload(initial: Record<string, unknown> = {}): SpacePayloadBuilder {
  const payload: Record<string, unknown> = { ...initial };

  return {
    textChanged(key, formValue, currentValue) {
      if (isTextChanged(formValue, currentValue)) payload[key] = formValue.trim();
    },
    nullableTextChanged(key, formValue, currentValue) {
      if (isTextChanged(formValue, currentValue)) payload[key] = formValue.trim() || null;
    },
    valueChanged(key, formValue, currentValue) {
      if (formValue !== currentValue) payload[key] = formValue;
    },
    nullableNumberChanged(key, formValue, currentValue) {
      const parsed = parseOptionalNumber(formValue);
      if (parsed !== currentValue) payload[key] = parsed ?? null;
    },
    optionalText(key, formValue) {
      const trimmed = (formValue ?? '').trim();
      if (trimmed) payload[key] = trimmed;
    },
    optionalNumber(key, formValue) {
      const parsed = parseOptionalNumber(formValue);
      if (parsed !== undefined) payload[key] = parsed;
    },
    merge(partial) {
      Object.assign(payload, partial);
    },
    get isEmpty() {
      return Object.keys(payload).length === 0;
    },
    get payload() {
      return payload;
    },
  };
}

// ============================================================================
// SHARED BUILDERS
// ============================================================================

/**
 * Start a create payload: the entity's required identity fields, plus the
 * optional fields every space shares. The caller adds its own extras.
 *
 * @param required Entity-specific identity, e.g. `{ number, type, status }`.
 */
export function createSpaceDraft(
  required: Record<string, unknown>,
  form: CommonSpaceFormSlice,
  buildingId: string | null,
): SpacePayloadBuilder {
  const draft = createSpacePayload(required);
  draft.optionalText('code', form.code);
  draft.optionalText('buildingId', buildingId);
  draft.optionalText('floor', form.floor);
  draft.optionalNumber('area', form.area);
  draft.optionalText('description', form.description);
  draft.optionalText('notes', form.notes);
  return draft;
}

/**
 * Start a patch payload with the shared fields that changed, plus the building
 * link's own partial (ADR-200). The caller adds its own extras.
 */
export function createSpacePatch(
  form: CommonSpaceFormSlice,
  entity: CommonSpaceEntitySlice,
  linkPayload: Record<string, unknown>,
): SpacePayloadBuilder {
  const patch = createSpacePayload();
  patch.nullableTextChanged('code', form.code, entity.code);
  patch.textChanged('floor', form.floor, entity.floor);
  patch.nullableNumberChanged('area', form.area, entity.area);
  patch.textChanged('description', form.description, entity.description);
  patch.textChanged('notes', form.notes, entity.notes);
  patch.merge(linkPayload);
  return patch;
}

/**
 * The `updates` slice every space entity broadcasts on `RealtimeService` after a
 * successful save — structurally a subset of both `ParkingUpdatedPayload` and
 * `StorageUpdatedPayload`, so each caller only prepends its own name field.
 */
export interface SpaceRealtimeUpdates {
  type?: string;
  status?: string;
  floor?: string;
  area?: number;
  buildingId?: string | null;
}

/** Build the shared {@link SpaceRealtimeUpdates} slice from the form state. */
export function buildSpaceRealtimeUpdates(
  form: CommonSpaceFormSlice & { type: string; status: string },
  buildingId: string | null,
): SpaceRealtimeUpdates {
  return {
    type: form.type,
    status: form.status,
    floor: form.floor.trim() || undefined,
    area: parseOptionalNumber(form.area),
    buildingId,
  };
}
