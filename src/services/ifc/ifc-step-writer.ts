/**
 * STEP21 Text Writer (ADR-369 §Q8.3)
 *
 * Serializes an `IfcGraph` into the IFC4 STEP-Part-21 text format mandated
 * by ISO 16739-1. The output is a UTF-8 `Uint8Array` ready for download or
 * upload (Mailgun/Storage/back-end consumers).
 *
 * Encoding rules implemented:
 *  - String escaping per ISO 10303-21:2016 (`'` → `''`, non-ASCII → `\X2\NNNN\X0\`).
 *  - Real values forced to use a decimal point (`1` → `1.`).
 *  - Refs prefixed with `#`; null → `$`; derived → `*`.
 *  - Lists wrapped in `( ... )`.
 *
 * The writer is intentionally schema-agnostic — every record is emitted by
 * its `type` string. Schema validity is the caller's responsibility.
 */

import { nowISO } from '@/lib/date-local';
import type { IfcEntityRecord, IfcGraph, IfcValue } from './ifc-entity-graph';

// ─── Header metadata ────────────────────────────────────────────────────────

export interface IfcStepHeader {
  readonly fileName: string;
  readonly timeStampISO: string;
  readonly authors: readonly string[];
  readonly organizations: readonly string[];
  readonly authoringTool: string;
}

const DEFAULT_HEADER: IfcStepHeader = {
  fileName: 'export.ifc',
  timeStampISO: nowISO(),
  authors: ['Nestor'],
  organizations: ['Nestor'],
  authoringTool: 'Nestor BIM IFC4 STEP21 Writer 1.0',
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Serializes the entity graph into IFC4 STEP21 text and returns it as a
 * UTF-8 byte buffer. The header block is filled from `header` with sensible
 * defaults for any missing field.
 */
export function writeStepIfc(
  graph: IfcGraph,
  header: Partial<IfcStepHeader> = {},
): Uint8Array {
  const merged = { ...DEFAULT_HEADER, ...header };
  const parts: string[] = [];
  parts.push('ISO-10303-21;');
  parts.push('HEADER;');
  parts.push(
    `FILE_DESCRIPTION((${ifcString('ViewDefinition [CoordinationView]')}),${ifcString(
      '2;1',
    )});`,
  );
  parts.push(
    `FILE_NAME(${ifcString(merged.fileName)},${ifcString(merged.timeStampISO)},${listOfStrings(
      merged.authors,
    )},${listOfStrings(merged.organizations)},${ifcString(merged.authoringTool)},${ifcString(
      '',
    )},${ifcString('')});`,
  );
  parts.push(`FILE_SCHEMA((${ifcString('IFC4')}));`);
  parts.push('ENDSEC;');
  parts.push('DATA;');
  for (const record of graph.records()) {
    parts.push(serializeRecord(record));
  }
  parts.push('ENDSEC;');
  parts.push('END-ISO-10303-21;');
  parts.push('');
  const text = parts.join('\n');
  return new TextEncoder().encode(text);
}

// ─── Record / value serialization ───────────────────────────────────────────

function serializeRecord(record: IfcEntityRecord): string {
  const argText = record.args.map(serializeValue).join(',');
  return `#${record.id}=${record.type}(${argText});`;
}

function serializeValue(value: IfcValue): string {
  if (value === null) return '$';
  if (value === '*') return '*';
  if (Array.isArray(value)) {
    return `(${value.map(serializeValue).join(',')})`;
  }
  // Discriminated union — narrow on `kind`.
  const v = value as Exclude<IfcValue, null | '*' | readonly IfcValue[]>;
  switch (v.kind) {
    case 'label':
      return ifcString(v.value);
    case 'real':
      return formatReal(v.value);
    case 'integer':
      return Math.trunc(v.value).toString(10);
    case 'enum':
      return `.${v.value}.`;
    case 'bool':
      return v.value ? '.T.' : '.F.';
    case 'ref':
      return `#${v.id}`;
  }
}

// ─── Primitive helpers ──────────────────────────────────────────────────────

/**
 * Formats a JS number as an IFC `IfcReal` literal — required to carry an
 * explicit decimal point. `Number.toString()` already does the right thing
 * for fractional values; integer-valued reals need `.` appended.
 */
function formatReal(n: number): string {
  if (!Number.isFinite(n)) {
    // IFC has no notation for infinity — coerce to 0 to keep the file valid.
    return '0.';
  }
  const text = n.toString(10);
  // STEP21 requires an explicit decimal point on every real, including the
  // mantissa of scientific-notation literals (`1E-5` is invalid, `1.E-5` ok).
  const expIdx = text.search(/[eE]/);
  if (expIdx === -1) {
    return text.includes('.') ? text : `${text}.`;
  }
  const mantissa = text.slice(0, expIdx);
  const exponent = text.slice(expIdx).toUpperCase();
  return `${mantissa.includes('.') ? mantissa : `${mantissa}.`}${exponent}`;
}

/**
 * Encodes a JS string as an IFC `IfcLabel`/`IfcText` literal: single-quoted,
 * embedded apostrophes doubled, non-printable / non-ASCII characters wrapped
 * with the ISO 10303-21 `\X2\...\X0\` escape (one or more UTF-16 code units).
 */
function ifcString(value: string): string {
  let escaped = '';
  let inX2 = false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const ch = value.charAt(i);
    if (code >= 0x20 && code <= 0x7e) {
      if (inX2) {
        escaped += '\\X0\\';
        inX2 = false;
      }
      escaped += ch === "'" ? "''" : ch === '\\' ? '\\\\' : ch;
    } else {
      if (!inX2) {
        escaped += '\\X2\\';
        inX2 = true;
      }
      escaped += code.toString(16).toUpperCase().padStart(4, '0');
    }
  }
  if (inX2) escaped += '\\X0\\';
  return `'${escaped}'`;
}

function listOfStrings(values: readonly string[]): string {
  if (values.length === 0) return `(${ifcString('')})`;
  return `(${values.map(ifcString).join(',')})`;
}
