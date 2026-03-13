/**
 * =============================================================================
 * FIRESTORE FIELD EXTRACTORS — Single Source of Truth
 * =============================================================================
 *
 * Type-safe field extractors for Firestore document data.
 * Replaces 18+ local definitions across 7 files.
 *
 * @module lib/firestore/field-extractors
 * @see ADR-219: Field Extractor Centralization
 */

type DataRecord = Record<string, unknown> | null | undefined;

// =============================================================================
// getString — overloaded
// =============================================================================

export function getString(data: DataRecord, field: string): string | undefined;
export function getString(data: DataRecord, field: string, defaultValue: string): string;
export function getString(
  data: DataRecord,
  field: string,
  defaultValue?: string
): string | undefined {
  const value = data?.[field];
  if (typeof value === 'string') return value;
  return defaultValue;
}

// =============================================================================
// getNumber — overloaded
// =============================================================================

export function getNumber(data: DataRecord, field: string): number | undefined;
export function getNumber(data: DataRecord, field: string, defaultValue: number): number;
export function getNumber(
  data: DataRecord,
  field: string,
  defaultValue?: number
): number | undefined {
  const value = data?.[field];
  if (typeof value === 'number') return value;
  return defaultValue;
}

// =============================================================================
// getBoolean
// =============================================================================

export function getBoolean(data: DataRecord, field: string): boolean | undefined {
  const value = data?.[field];
  return typeof value === 'boolean' ? value : undefined;
}

// =============================================================================
// getArray — overloaded
// =============================================================================

export function getArray<T>(data: DataRecord, field: string): T[] | undefined;
export function getArray<T>(data: DataRecord, field: string, defaultValue: T[]): T[];
export function getArray<T>(
  data: DataRecord,
  field: string,
  defaultValue?: T[]
): T[] | undefined {
  const value = data?.[field];
  if (Array.isArray(value)) return value as T[];
  return defaultValue;
}

// =============================================================================
// getStringArray — validated (ensures each element is string)
// =============================================================================

export function getStringArray(data: DataRecord, field: string): string[] | undefined {
  const value = data?.[field];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value as string[];
  }
  return undefined;
}

// =============================================================================
// getObject — overloaded
// =============================================================================

export function getObject<T extends Record<string, unknown>>(
  data: DataRecord,
  field: string
): T | undefined;
export function getObject<T extends Record<string, unknown>>(
  data: DataRecord,
  field: string,
  defaultValue: T
): T;
export function getObject<T extends Record<string, unknown>>(
  data: DataRecord,
  field: string,
  defaultValue?: T
): T | undefined {
  const value = data?.[field];
  if (typeof value === 'object' && value !== null) return value as T;
  return defaultValue;
}

// =============================================================================
// getStringOrNumber — for IDs that could be string or number
// =============================================================================

export function getStringOrNumber(data: DataRecord, field: string): string | undefined {
  const value = data?.[field];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}
