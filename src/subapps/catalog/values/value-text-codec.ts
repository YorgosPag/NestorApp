/**
 * =============================================================================
 * ΚΕΙΜΕΝΟ ⇄ ΤΙΜΗ ΙΔΙΟΤΗΤΑΣ — ένας κωδικοποιητής για πεδίο, πλέγμα και επικόλληση (ADR-923 §5.10.4 Β3/Β4)
 * =============================================================================
 *
 * Τρεις καταναλωτές χρειάζονται την ίδια απάντηση στο «τι τιμή είναι αυτό το κείμενο;»: το πεδίο του επεξεργαστή, η
 * στήλη του πλέγματος παραλλαγών και η επικόλληση από Excel (= εισαγωγή TSV). Ζει εδώ **μία** φορά, καθαρή, ώστε
 * «2,5 kW» να σημαίνει το ίδιο πληκτρολογημένο και επικολλημένο. `format` → `parse` επιστρέφει την ίδια τιμή
 * (round-trip, άγκυρα στο test). Ο πίνακας είναι `Record<AttributeType, …>`: νέος τύπος χωρίς κωδικοποιητή σπάει τη
 * μεταγλώττιση. Αναφορά/πίνακας **δεν** έχουν κειμενική μορφή (θέλουν επιλογέα) ⇒ `null`, και το πλέγμα τα κλειδώνει.
 *
 * Η επικύρωση (όρια, δεκαδικά, μοτίβο…) **δεν** γίνεται εδώ: τη κάνει ο **ίδιος** επικυρωτής με τον διακομιστή
 * (`validateAttributeValue`) πάνω στην τιμή που βγαίνει. Εδώ μόνο η **γραμματική**.
 *
 * @module subapps/catalog/values/value-text-codec
 */

import type { HumanLanguage } from '@/i18n/languages';
import { normalizeSearchText } from '@/lib/search/search';

import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogIssueCode } from '../schema/catalog-issues';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { AttributeValue, AttributeValueOfType } from '../types/product';
import type { AttributeType } from '../vocabulary/attribute-types';
import { parseEnteredAmount } from './decimal-amount';

export interface ValueTextContext {
  readonly registry: MeasurementRegistry;
  readonly language: HumanLanguage;
  /** Μέσα: κωδικός → id και id → κωδικός (κειμενική μορφή μιας τιμής-μέσου = κωδικοί). */
  readonly assetIdByCode: ReadonlyMap<string, string>;
  readonly assetCodeById: ReadonlyMap<string, string>;
  /** Οι λέξεις του ναι/όχι στη γλώσσα της οθόνης (η ανάγνωση δέχεται και τις άλλες). */
  readonly yes: string;
  readonly no: string;
}

/** `value: null` ⇒ **κενό** (η θέση σβήνεται). */
export type ValueParse =
  | { readonly ok: true; readonly value: AttributeValue | null }
  | { readonly ok: false; readonly issue: CatalogIssueCode; readonly params?: Readonly<Record<string, string | number>> };

type Attr<K extends AttributeType> = Extract<CatalogAttributeDefinition, { readonly type: K }>;

interface Codec<K extends AttributeType> {
  readonly format: (attribute: Attr<K>, value: AttributeValueOfType<K>, ctx: ValueTextContext) => string;
  readonly parse: (attribute: Attr<K>, text: string, ctx: ValueTextContext) => ValueParse;
}

const LIST_SEPARATOR = /\s*[;\n]\s*/;
const EMPTY: ValueParse = { ok: true, value: null };
const fail = (issue: CatalogIssueCode, params?: Record<string, string | number>): ValueParse => ({ ok: false, issue, params });
const norm = (text: string) => normalizeSearchText(text.toLowerCase());

function decimalSeparator(language: HumanLanguage): string {
  return new Intl.NumberFormat(language).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';
}

/** Κανονικό ποσό → προβολή στη γλώσσα, **χωρίς** ομαδοποίηση (ξαναδιαβάζεται ίδιο: ένα διαχωριστικό = υποδιαστολή). */
export function displayAmount(amount: string, language: HumanLanguage): string {
  return amount.replace('.', decimalSeparator(language)).replace(/^-/, '−');
}

function optionCodeOf(options: readonly { readonly code: string; readonly labels: Readonly<Partial<Record<string, string>>> }[], text: string): string | null {
  const wanted = norm(text);
  const match = options.find((option) => norm(option.code) === wanted || Object.values(option.labels).some((label) => label && norm(label) === wanted));
  return match?.code ?? null;
}

const BOOLEAN_WORDS: ReadonlyArray<readonly [string, boolean]> = [
  ['ναι', true], ['yes', true], ['true', true], ['1', true], ['✓', true], ['x', true],
  ['οχι', false], ['no', false], ['false', false], ['0', false],
];

/** Η «κανονική μορφή» μιας μονάδας: «m³/h» ≡ «m3/h» ≡ «m3_h» (ό,τι γράφει ο προμηθευτής στο Excel). Χαρακτήρας-προς-χαρακτήρα. */
const unitForm = (text: string): string => text.replace(/³/g, '3').replace(/²/g, '2').replace(/_/g, '/').replace(/\s+/g, '');

type UnitDef = { readonly code: string; readonly symbol: string };

/** Η μονάδα στο τέλος του κειμένου: πρώτα **ακριβώς** (το «mW» δεν είναι «MW»), αλλιώς caseless **μόνο αν** είναι μία. */
function unitSuffix(compact: string, units: readonly UnitDef[]): { readonly unit: UnitDef; readonly form: string } | null {
  const forms = units.flatMap((unit) => [unitForm(unit.symbol), unitForm(unit.code)].map((form) => ({ unit, form })))
    .sort((x, y) => y.form.length - x.form.length);
  const exact = forms.find(({ form }) => compact.endsWith(form));
  if (exact) return exact;
  const loose = forms.filter(({ form }) => compact.toLowerCase().endsWith(form.toLowerCase()));
  const distinct = new Set(loose.map(({ unit }) => unit.code));
  return distinct.size === 1 ? loose[0] : null;
}

function measurementParts(attribute: Attr<'measurement'>, text: string, ctx: ValueTextContext): { amountText: string; unitCode: string } | null {
  const compact = unitForm(text.trim());
  if (/^[-−+]?[\d.,]+$/.test(compact)) return { amountText: compact, unitCode: attribute.config.defaultUnitCode };
  const match = unitSuffix(compact, ctx.registry.get(attribute.config.measurementFamilyCode)?.units ?? []);
  return match ? { amountText: compact.slice(0, compact.length - match.form.length), unitCode: match.unit.code } : null;
}

function isoDateOf(text: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text);
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : [];
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const valid = date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
  return valid ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : null;
}

const CODECS: { readonly [K in AttributeType]: Codec<K> | null } = {
  text: { format: (_a, value) => value.text, parse: (_a, text) => (text.trim() === '' ? EMPTY : { ok: true, value: { type: 'text', text: text.trim() } }) },
  richText: { format: (_a, value) => value.html, parse: (_a, text) => (text.trim() === '' ? EMPTY : { ok: true, value: { type: 'richText', html: text.trim() } }) },
  number: {
    format: (_a, value, ctx) => displayAmount(value.amount, ctx.language),
    parse: (_a, text) => {
      if (text.trim() === '') return EMPTY;
      const parsed = parseEnteredAmount(text);
      return parsed ? { ok: true, value: { type: 'number', amount: parsed.amount } } : fail('valueNotNumber');
    },
  },
  measurement: {
    format: (attribute, value, ctx) => {
      const unit = ctx.registry.get(attribute.config.measurementFamilyCode)?.units.find((candidate) => candidate.code === value.unitCode);
      return `${displayAmount(value.amount, ctx.language)} ${unit?.symbol ?? value.unitCode}`;
    },
    parse: (attribute, text, ctx) => {
      if (text.trim() === '') return EMPTY;
      const parts = measurementParts(attribute, text, ctx);
      if (!parts) return fail('measurementUnitUnknown', { unit: text.trim() });
      const parsed = parseEnteredAmount(parts.amountText);
      return parsed ? { ok: true, value: { type: 'measurement', amount: parsed.amount, unitCode: parts.unitCode } } : fail('valueNotNumber');
    },
  },
  boolean: {
    format: (_a, value, ctx) => (value.value ? ctx.yes : ctx.no),
    parse: (_a, text, ctx) => {
      if (text.trim() === '') return EMPTY;
      const wanted = norm(text);
      const words = [...BOOLEAN_WORDS, [norm(ctx.yes), true] as const, [norm(ctx.no), false] as const];
      const match = words.find(([word]) => word === wanted);
      return match ? { ok: true, value: { type: 'boolean', value: match[1] } } : fail('valueTypeMismatch', { expected: 'boolean' });
    },
  },
  select: {
    format: (attribute, value, ctx) => attribute.config.options.find((option) => option.code === value.optionCode)?.labels[ctx.language] ?? value.optionCode,
    parse: (attribute, text) => {
      if (text.trim() === '') return EMPTY;
      const code = optionCodeOf(attribute.config.options, text);
      return code ? { ok: true, value: { type: 'select', optionCode: code } } : fail('optionUnknown', { option: text.trim() });
    },
  },
  multiSelect: {
    format: (attribute, value, ctx) => value.optionCodes
      .map((code) => attribute.config.options.find((option) => option.code === code)?.labels[ctx.language] ?? code).join('; '),
    parse: (attribute, text) => {
      const parts = text.split(LIST_SEPARATOR).filter((part) => part !== '');
      if (parts.length === 0) return EMPTY;
      const codes = parts.map((part) => optionCodeOf(attribute.config.options, part));
      const unknown = parts.find((_part, index) => codes[index] === null);
      if (unknown !== undefined) return fail('optionUnknown', { option: unknown });
      return { ok: true, value: { type: 'multiSelect', optionCodes: [...new Set(codes as string[])] } };
    },
  },
  date: {
    format: (_a, value) => value.date,
    parse: (_a, text) => {
      if (text.trim() === '') return EMPTY;
      const date = isoDateOf(text.trim());
      return date ? { ok: true, value: { type: 'date', date } } : fail('invalidDate');
    },
  },
  asset: {
    format: (_a, value, ctx) => value.assetIds.map((id) => ctx.assetCodeById.get(id) ?? id).join('; '),
    parse: (_a, text, ctx) => {
      const codes = text.split(LIST_SEPARATOR).filter((part) => part !== '');
      if (codes.length === 0) return EMPTY;
      const ids = codes.map((code) => ctx.assetIdByCode.get(code.toLowerCase()) ?? null);
      const unknown = codes.find((_code, index) => ids[index] === null);
      return unknown === undefined ? { ok: true, value: { type: 'asset', assetIds: ids as string[] } } : fail('unknownReference', { code: unknown });
    },
  },
  reference: null,
  table: null,
};

/** Έχει ο τύπος κειμενική μορφή; (αλλιώς το πλέγμα κλειδώνει το κελί: «επιλογή μέσω επεξεργαστή») */
export function hasTextForm(type: AttributeType): boolean {
  return CODECS[type] !== null;
}

/** Η τιμή ως κείμενο — ό,τι δείχνει το κελί και ό,τι αντιγράφεται. Απούσα ⇒ `''`. */
export function formatAttributeValue(attribute: CatalogAttributeDefinition, value: AttributeValue | undefined, ctx: ValueTextContext): string {
  if (!value || value.type !== attribute.type) return '';
  const codec = CODECS[attribute.type] as Codec<AttributeType> | null;
  return codec ? codec.format(attribute as Attr<AttributeType>, value as AttributeValueOfType<AttributeType>, ctx) : '';
}

/** Κείμενο → τιμή. Τύπος χωρίς κειμενική μορφή ⇒ αποτυχία `valueTypeMismatch`. */
export function parseAttributeText(attribute: CatalogAttributeDefinition, text: string, ctx: ValueTextContext): ValueParse {
  const codec = CODECS[attribute.type] as Codec<AttributeType> | null;
  return codec ? codec.parse(attribute as Attr<AttributeType>, text, ctx) : fail('valueTypeMismatch', { expected: attribute.type });
}
