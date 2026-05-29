/**
 * IFC4 Entity Graph (ADR-369 §Q8.3)
 *
 * Backend-agnostic representation of an IFC4 file as a discriminated-union
 * list of entity records. Builders (`ifc-units.ts`, `ifc-spatial-hierarchy.ts`,
 * future serializers) append records via `IfcGraph.add()`; the serializer
 * (`ifc-step-writer.ts`) walks the list and emits STEP21 text or — when
 * web-ifc is wired in Q8.6 — feeds it to `IfcAPI.WriteLine()`.
 *
 * Schema reference: buildingSMART IFC4 Add 2 TC1 (ISO 16739-1:2018).
 */

// ─── IFC literal helpers ────────────────────────────────────────────────────

/** Marks a string as an IFC `IfcLabel` / `IfcText` (quoted, escaped). */
export type IfcStringValue = { readonly kind: 'label'; readonly value: string };

/** Marks a number as an IFC `IfcReal` / `IfcLengthMeasure`. */
export type IfcRealValue = { readonly kind: 'real'; readonly value: number };

/** Marks an integer as an IFC `IfcInteger`. */
export type IfcIntegerValue = { readonly kind: 'integer'; readonly value: number };

/** Marks an enumeration token (e.g. `.METRE.`, `.LENGTHUNIT.`). */
export type IfcEnumValue = { readonly kind: 'enum'; readonly value: string };

/** Marks a boolean (`.T.` / `.F.`). */
export type IfcBoolValue = { readonly kind: 'bool'; readonly value: boolean };

/** Reference to another entity record by id. */
export type IfcRefValue = { readonly kind: 'ref'; readonly id: number };

/**
 * Inline typed (defined-type) value, e.g. `IFCTHERMALCONDUCTIVITYMEASURE(0.031)`.
 * Needed for SELECT slots such as `IfcPropertySingleValue.NominalValue` where a
 * bare literal is invalid — STEP requires the wrapping defined-type name.
 */
export type IfcTypedValue = {
  readonly kind: 'typed';
  readonly typeName: string;
  readonly inner: IfcValue;
};

export const lbl = (value: string): IfcStringValue => ({ kind: 'label', value });
export const real = (value: number): IfcRealValue => ({ kind: 'real', value });
export const integer = (value: number): IfcIntegerValue => ({ kind: 'integer', value });
export const enumValue = (value: string): IfcEnumValue => ({ kind: 'enum', value });
export const bool = (value: boolean): IfcBoolValue => ({ kind: 'bool', value });
export const ref = (id: number): IfcRefValue => ({ kind: 'ref', id });
export const typed = (typeName: string, inner: IfcValue): IfcTypedValue => ({
  kind: 'typed',
  typeName: typeName.toUpperCase(),
  inner,
});

/**
 * Any value that may appear inside an IFC entity attribute slot.
 *  - `null`       → `$`  (omitted/undefined attribute)
 *  - `'*'`        → `*`  (derived attribute)
 *  - arrays       → parenthesised list (recursive)
 */
export type IfcValue =
  | null
  | '*'
  | IfcStringValue
  | IfcRealValue
  | IfcIntegerValue
  | IfcEnumValue
  | IfcBoolValue
  | IfcRefValue
  | IfcTypedValue
  | readonly IfcValue[];

// ─── Entity record ──────────────────────────────────────────────────────────

/**
 * One STEP21 line: `#<id>=<TYPE>(<arg>,<arg>,...);`
 *
 * Each builder is responsible for honouring the IFC4 schema's attribute order
 * and cardinality for the given `type`. There is intentionally *no* generated
 * per-class TS interface — the writer treats every entity uniformly.
 */
export interface IfcEntityRecord {
  readonly id: number;
  /** IFC4 entity type, uppercase (e.g. `'IFCWALL'`, `'IFCRELAGGREGATES'`). */
  readonly type: string;
  readonly args: readonly IfcValue[];
}

// ─── Graph ──────────────────────────────────────────────────────────────────

/**
 * Append-only entity store. IDs are issued sequentially from 1; each builder
 * uses the returned id to reference the entity from later attribute slots.
 */
export class IfcGraph {
  private readonly entries: IfcEntityRecord[] = [];
  private nextId = 1;

  /** Append a new entity, returning its assigned id. */
  add(type: string, args: readonly IfcValue[]): number {
    const id = this.nextId++;
    this.entries.push({ id, type: type.toUpperCase(), args });
    return id;
  }

  /** Read-only snapshot of all entities in insertion order. */
  records(): readonly IfcEntityRecord[] {
    return this.entries;
  }

  /** Highest assigned id (0 if empty). */
  lastId(): number {
    return this.nextId - 1;
  }
}
