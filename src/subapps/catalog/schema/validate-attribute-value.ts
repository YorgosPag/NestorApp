/**
 * Η **σημασιολογική** επικύρωση **μίας** τιμής απέναντι στην ιδιότητά της (ADR-923 §5.10 Δ4):
 * τύπος, μήκος, μοτίβο, κανονικό ποσό, δεκαδικά, πρόσημο, όρια (στη **μονάδα προβολής** της
 * ιδιότητας — εκεί δηλώνονται), επιλογές, ημερομηνία, είδος μέσου, στήλες πίνακα. Ίδια
 * συνάρτηση σε οθόνη και γραφέα. Ποτέ εξαίρεση: κάθε αστοχία γίνεται εύρημα με διαδρομή.
 * @module subapps/catalog/schema/validate-attribute-value
 */

import { convertMeasurement, findUnit } from '../measurement/conversion';
import type {
  AssetAttributeConfig,
  CatalogAttributeDefinition,
  CatalogAttributeOfType,
  NumberAttributeConfig,
  SelectOption,
  TableColumn,
} from '../types/attribute';
import type { AttributeValue, AttributeValueOfType, TableCellValue } from '../types/product';
import { amountFromCanonical } from '../values/decimal-amount';
import { checkRichText } from '../values/rich-text';
import { isEmptyAttributeValue } from '../values/value-shape';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { reportDuplicates } from './catalog-issues';
import { referenceTargetKey, type ValueCheck } from './product-validation-context';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function checkLength(check: ValueCheck, text: string, limit: number | null, hardLimit: number, path: string): void {
  const max = Math.min(limit ?? hardLimit, hardLimit);
  if ([...text].length > max) check.collector.add('valueTooLong', path, { max });
}

function matchesWhole(pattern: string, text: string): boolean {
  try {
    return new RegExp(`^(?:${pattern})$`, 'u').test(text);
  } catch {
    // Μη έγκυρο μοτίβο: το αναφέρει ο επικυρωτής της ιδιότητας (`invalidPattern`), όχι κάθε τιμή.
    return true;
  }
}

function checkText(check: ValueCheck, attribute: CatalogAttributeOfType<'text'>, text: string, path: string): void {
  checkLength(check, text, attribute.config.maxLength, CATALOG_LIMITS.maxTextValueLength, path);
  const { pattern } = attribute.config;
  if (pattern !== null && !matchesWhole(pattern, text)) check.collector.add('valuePatternMismatch', path);
}

/**
 * Κοινός έλεγχος ποσού (αριθμός · μέτρηση · κελί πίνακα). `toDisplay` = μετατροπή στη μονάδα
 * όπου δηλώθηκαν τα όρια· `null` ⇒ χωρίς έλεγχο ορίων (π.χ. άγνωστη μονάδα, ήδη αναφερμένη).
 */
function checkAmount(
  check: ValueCheck,
  amount: string,
  config: Pick<NumberAttributeConfig, 'decimals'> & Partial<NumberAttributeConfig>,
  path: string,
  toDisplay: ((value: number) => number) | null,
): void {
  const parsed = amountFromCanonical(amount);
  if (!parsed) {
    check.collector.add('valueNotNumber', path);
    return;
  }
  if (parsed.decimals > config.decimals) check.collector.add('valueTooManyDecimals', path, { max: config.decimals });
  if (!toDisplay) return;
  const display = toDisplay(parsed.value);
  if (display < 0 && config.negativeAllowed === false) {
    // Ένα εύρημα, όχι δύο: το «αρνητικό» εξηγεί ήδη και το «κάτω από το 0».
    check.collector.add('valueNegative', path);
    return;
  }
  const belowMin = config.min !== undefined && config.min !== null && display < config.min;
  const aboveMax = config.max !== undefined && config.max !== null && display > config.max;
  if (belowMin || aboveMax) check.collector.add('valueOutOfRange', path);
}

function checkMeasurement(
  check: ValueCheck,
  attribute: CatalogAttributeOfType<'measurement'>,
  value: AttributeValueOfType<'measurement'>,
  path: string,
): void {
  const { config } = attribute;
  const family = check.context.registry.get(config.measurementFamilyCode);
  if (family && !findUnit(family, value.unitCode)) {
    check.collector.add('measurementUnitUnknown', `${path}.unitCode`, { code: value.unitCode });
    return checkAmount(check, value.amount, config, path, null);
  }
  const toDisplay = family
    ? (amount: number) => convertMeasurement(family, amount, value.unitCode, config.defaultUnitCode)
    : null;
  checkAmount(check, value.amount, config, path, toDisplay);
}

function checkOptionCodes(
  check: ValueCheck,
  options: readonly SelectOption[],
  codes: readonly string[],
  path: (index: number) => string,
): void {
  const known = new Set(options.map((option) => option.code));
  codes.forEach((code, index) => {
    if (!known.has(code)) check.collector.add('optionUnknown', path(index), { code });
  });
  reportDuplicates(check.collector, codes, path);
}

function checkMultiSelect(
  check: ValueCheck,
  attribute: CatalogAttributeOfType<'multiSelect'>,
  codes: readonly string[],
  path: string,
): void {
  checkOptionCodes(check, attribute.config.options, codes, (index) => `${path}.optionCodes[${index}]`);
  const max = attribute.config.maxSelections;
  if (max !== null && codes.length > max) check.collector.add('tooMany', `${path}.optionCodes`, { max });
}

/** Πραγματική ημερομηνία του ημερολογίου (όχι 2026-02-30). */
function isRealIsoDate(date: string): boolean {
  const match = ISO_DATE.exec(date);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function checkDate(check: ValueCheck, attribute: CatalogAttributeOfType<'date'>, date: string, path: string): void {
  if (!isRealIsoDate(date)) {
    check.collector.add('invalidDate', path);
    return;
  }
  const { min, max } = attribute.config;
  if ((min !== null && date < min) || (max !== null && date > max)) check.collector.add('valueOutOfRange', path);
}

function checkAssets(check: ValueCheck, config: AssetAttributeConfig, assetIds: readonly string[], path: string): void {
  if (assetIds.length > config.maxFiles) check.collector.add('tooMany', `${path}.assetIds`, { max: config.maxFiles });
  assetIds.forEach((assetId, index) => {
    const asset = check.context.assets.get(assetId);
    const itemPath = `${path}.assetIds[${index}]`;
    if (!asset) check.collector.add('unknownReference', itemPath);
    else if (!config.assetKinds.includes(asset.kind)) check.collector.add('assetKindNotAllowed', itemPath, { kind: asset.kind });
  });
  reportDuplicates(check.collector, assetIds, (index) => `${path}.assetIds[${index}]`);
}

function checkReferences(
  check: ValueCheck,
  attribute: CatalogAttributeOfType<'reference'>,
  value: AttributeValueOfType<'reference'>,
  path: string,
): void {
  const max = attribute.config.maxReferences;
  if (max !== null && value.targets.length > max) check.collector.add('tooMany', `${path}.targets`, { max });
  // Ύπαρξη + οικογένεια: ο γραφέας διαβάζει τους στόχους στη συναλλαγή (2β) και τους δίνει στο πλαίσιο.
  const allowed = attribute.config.targetFamilyCodes;
  value.targets.forEach((target, index) => {
    const found = check.context.references.get(referenceTargetKey(target));
    const itemPath = `${path}.targets[${index}]`;
    if (!found) check.collector.add('unknownReference', itemPath);
    else if (allowed.length > 0 && !allowed.includes(found.familyCode)) {
      check.collector.add('referenceFamilyNotAllowed', itemPath, { family: found.familyCode });
    }
  });
  reportDuplicates(
    check.collector,
    value.targets.map((target) => `${target.kind}:${target.id}`),
    (index) => `${path}.targets[${index}]`,
  );
}

function checkTableCell(check: ValueCheck, column: TableColumn, cell: TableCellValue, path: string): void {
  if (column.type === 'boolean') {
    if (typeof cell !== 'boolean') check.collector.add('valueTypeMismatch', path, { expected: column.type });
    return;
  }
  if (typeof cell !== 'string') {
    check.collector.add('valueTypeMismatch', path, { expected: column.type });
    return;
  }
  if (column.type === 'number' || column.type === 'measurement') checkAmount(check, cell, column, path, null);
  else if (column.type === 'select') checkOptionCodes(check, column.options, [cell], () => path);
  else checkLength(check, cell, null, CATALOG_LIMITS.maxTextValueLength, path);
}

function checkTable(
  check: ValueCheck,
  attribute: CatalogAttributeOfType<'table'>,
  value: AttributeValueOfType<'table'>,
  path: string,
): void {
  const { columns } = attribute.config;
  const byCode = new Map(columns.map((column) => [column.code, column]));
  const keyColumn = columns[0];
  if (value.rows.length > CATALOG_LIMITS.maxTableValueRows) {
    check.collector.add('tooMany', `${path}.rows`, { max: CATALOG_LIMITS.maxTableValueRows });
  }
  value.rows.forEach((row, index) => {
    const rowPath = `${path}.rows[${index}]`;
    if (keyColumn && row[keyColumn.code] === undefined) check.collector.add('tableKeyMissing', rowPath);
    for (const [code, cell] of Object.entries(row)) {
      const column = byCode.get(code);
      if (!column) check.collector.add('tableColumnUnknown', `${rowPath}.${code}`, { code });
      else checkTableCell(check, column, cell, `${rowPath}.${code}`);
    }
  });
  if (keyColumn) {
    const keys = value.rows.map((row) => String(row[keyColumn.code] ?? ''));
    reportDuplicates(check.collector, keys, (index) => `${path}.rows[${index}].${keyColumn.code}`);
  }
}

/** Μήκος **και** γραμματική (ADR-923 §5.10.2): εκτός γλώσσας ⇒ εύρημα, ποτέ σιωπηλό καθάρισμα. */
function checkRichTextValue(check: ValueCheck, maxLength: number | null, html: string, path: string): void {
  checkLength(check, html, maxLength, CATALOG_LIMITS.maxRichTextValueLength, path);
  const verdict = checkRichText(html);
  if (!verdict.ok) check.collector.add('richTextUnsafe', path, { offset: verdict.offset });
}

/** Ο έλεγχος ανά τύπο — `attribute.type === value.type` έχει ήδη επαληθευτεί. */
function checkTyped(check: ValueCheck, attribute: CatalogAttributeDefinition, value: AttributeValue, path: string): void {
  switch (attribute.type) {
    case 'text':
      return value.type === 'text' ? checkText(check, attribute, value.text, path) : undefined;
    case 'richText':
      return value.type === 'richText' ? checkRichTextValue(check, attribute.config.maxLength, value.html, path) : undefined;
    case 'number':
      return value.type === 'number' ? checkAmount(check, value.amount, attribute.config, path, (n) => n) : undefined;
    case 'measurement':
      return value.type === 'measurement' ? checkMeasurement(check, attribute, value, path) : undefined;
    case 'select':
      return value.type === 'select'
        ? checkOptionCodes(check, attribute.config.options, [value.optionCode], () => `${path}.optionCode`)
        : undefined;
    case 'multiSelect':
      return value.type === 'multiSelect' ? checkMultiSelect(check, attribute, value.optionCodes, path) : undefined;
    case 'date':
      return value.type === 'date' ? checkDate(check, attribute, value.date, path) : undefined;
    case 'asset':
      return value.type === 'asset' ? checkAssets(check, attribute.config, value.assetIds, path) : undefined;
    case 'reference':
      return value.type === 'reference' ? checkReferences(check, attribute, value, path) : undefined;
    case 'table':
      return value.type === 'table' ? checkTable(check, attribute, value, path) : undefined;
    case 'boolean':
      return undefined;
  }
}

/** Επικυρώνει μία τιμή της ιδιότητας στη διαδρομή `path` (π.χ. `values.cooling_h.*.*`). */
export function validateAttributeValue(
  check: ValueCheck,
  attribute: CatalogAttributeDefinition,
  value: AttributeValue,
  path: string,
): void {
  if (value.type !== attribute.type) {
    check.collector.add('valueTypeMismatch', path, { expected: attribute.type });
    return;
  }
  if (isEmptyAttributeValue(value)) {
    check.collector.add('valueEmpty', path);
    return;
  }
  checkTyped(check, attribute, value, path);
}
