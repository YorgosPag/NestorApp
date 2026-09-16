/**
 * Ο **ένας** στενευτής μιας παγωμένης έκδοσης νομικού εγγράφου: `unknown` → τύπος, **χωρίς `as`**.
 *
 * Τα αρχεία τα γράφει ο γεννήτορας και τα φυλά η CHECK 3.85· εδώ ελέγχεται μόνο **το σχήμα**,
 * ώστε ένα χαλασμένο αρχείο να σπάει **ονομαστικά** στη φόρτωση και όχι ως `undefined` σε οθόνη.
 *
 * ⚠️ Το `operator.record` **δεν** στενεύεται εδώ: η CHECK 3.85 Κ5 εγγυάται ότι είναι ακριβώς
 * `operatorOn(effectiveFrom)`, άρα ο renderer ρωτά **τη ρίζα** του φορέα αντί να ξαναπεριγράψει
 * το σχήμα της (δεύτερη περιγραφή = δεύτερη αυθεντία, ADR-749).
 *
 * @module lib/legal/frozen-legal-document
 * @see ADR-861 §7
 */

import {
  LEGAL_DOCUMENT_IDS,
  LEGAL_DOCUMENT_LOCALES,
  type LegalDocumentId,
  type LegalDocumentLocale,
  type OperatorMailboxRole,
} from '@/constants/legal-documents';
import type { CalendarDay } from '@/constants/platform-operator';

export interface FrozenLegalListItem {
  readonly text: string;
  readonly mailbox?: OperatorMailboxRole;
}

export type FrozenLegalBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly FrozenLegalListItem[] }
  | { readonly kind: 'operator-identity' }
  | { readonly kind: 'clause'; readonly id: string; readonly text: string };

export interface FrozenLegalSection {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly FrozenLegalBlock[];
}

export interface FrozenLegalText {
  readonly title: string;
  readonly sections: readonly FrozenLegalSection[];
}

export type PerLocale<T> = { readonly [L in LegalDocumentLocale]: T };

export interface FrozenLegalDocument {
  readonly document: LegalDocumentId;
  readonly version: number;
  readonly effectiveFrom: CalendarDay;
  readonly material: boolean;
  readonly changeNote: PerLocale<string> | null;
  readonly locales: PerLocale<FrozenLegalText>;
  readonly operatorFingerprint: string | null;
}

export class FrozenLegalDocumentShapeError extends Error {
  constructor(where: string) {
    super(`[legal-documents] χαλασμένη παγωμένη έκδοση: ${where}`);
    this.name = 'FrozenLegalDocumentShapeError';
  }
}

type Fields = { readonly [key: string]: unknown };

const isFields = (value: unknown): value is Fields =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

function fieldsAt(value: unknown, where: string): Fields {
  if (!isFields(value)) throw new FrozenLegalDocumentShapeError(where);
  return value;
}

function stringAt(value: unknown, where: string): string {
  if (!isString(value)) throw new FrozenLegalDocumentShapeError(where);
  return value;
}

function arrayAt(value: unknown, where: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new FrozenLegalDocumentShapeError(where);
  return value;
}

const isMailboxRole = (value: unknown): value is OperatorMailboxRole => value === 'contact' || value === 'privacy';

function listItemFrom(value: unknown, where: string): FrozenLegalListItem {
  const f = fieldsAt(value, where);
  const text = stringAt(f.text, `${where}.text`);
  if (f.mailbox === undefined) return { text };
  if (!isMailboxRole(f.mailbox)) throw new FrozenLegalDocumentShapeError(`${where}.mailbox`);
  return { text, mailbox: f.mailbox };
}

function blockFrom(value: unknown, where: string): FrozenLegalBlock {
  const f = fieldsAt(value, where);
  switch (f.kind) {
    case 'paragraph':
      return { kind: 'paragraph', text: stringAt(f.text, `${where}.text`) };
    case 'list': {
      if (typeof f.ordered !== 'boolean') throw new FrozenLegalDocumentShapeError(`${where}.ordered`);
      const items = arrayAt(f.items, `${where}.items`).map((item, i) => listItemFrom(item, `${where}.items[${i}]`));
      return { kind: 'list', ordered: f.ordered, items };
    }
    case 'operator-identity':
      return { kind: 'operator-identity' };
    case 'clause':
      return { kind: 'clause', id: stringAt(f.id, `${where}.id`), text: stringAt(f.text, `${where}.text`) };
    default:
      throw new FrozenLegalDocumentShapeError(`${where}.kind`);
  }
}

function sectionFrom(value: unknown, where: string): FrozenLegalSection {
  const f = fieldsAt(value, where);
  return {
    id: stringAt(f.id, `${where}.id`),
    heading: stringAt(f.heading, `${where}.heading`),
    blocks: arrayAt(f.blocks, `${where}.blocks`).map((b, i) => blockFrom(b, `${where}.blocks[${i}]`)),
  };
}

function textFrom(value: unknown, where: string): FrozenLegalText {
  const f = fieldsAt(value, where);
  return {
    title: stringAt(f.title, `${where}.title`),
    sections: arrayAt(f.sections, `${where}.sections`).map((s, i) => sectionFrom(s, `${where}.sections[${i}]`)),
  };
}

function perLocale<T>(value: unknown, where: string, read: (v: unknown, w: string) => T): PerLocale<T> {
  const f = fieldsAt(value, where);
  const [el, en] = LEGAL_DOCUMENT_LOCALES.map((locale) => read(f[locale], `${where}.${locale}`));
  return { el, en };
}

const isDocumentId = (value: unknown): value is LegalDocumentId =>
  LEGAL_DOCUMENT_IDS.some((id) => id === value);

function operatorFingerprintFrom(value: unknown, where: string): string | null {
  const f = fieldsAt(value, where);
  if (f.fingerprint === null) return null;
  return stringAt(f.fingerprint, `${where}.fingerprint`);
}

export function frozenLegalDocumentFrom(value: unknown): FrozenLegalDocument {
  const f = fieldsAt(value, 'root');
  if (!isDocumentId(f.document)) throw new FrozenLegalDocumentShapeError('document');
  if (typeof f.version !== 'number' || !Number.isInteger(f.version)) throw new FrozenLegalDocumentShapeError('version');
  if (typeof f.material !== 'boolean') throw new FrozenLegalDocumentShapeError('material');
  const where = `${f.document} v${f.version}`;
  return {
    document: f.document,
    version: f.version,
    effectiveFrom: stringAt(f.effectiveFrom, `${where}.effectiveFrom`),
    material: f.material,
    changeNote: f.changeNote === null ? null : perLocale(f.changeNote, `${where}.changeNote`, stringAt),
    locales: perLocale(f.locales, `${where}.locales`, textFrom),
    operatorFingerprint: operatorFingerprintFrom(f.operator, `${where}.operator`),
  };
}
