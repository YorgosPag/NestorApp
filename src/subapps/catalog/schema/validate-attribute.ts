/**
 * Η **σημασιολογική** επικύρωση μιας ιδιότητας (ADR-923 §5.2) — ό,τι δεν εκφράζει το
 * zod schema του σώματος: οικογένεια/μονάδα μέτρησης που υπάρχει, εύρος που δεν είναι
 * ανάποδο, επιλογές με μοναδικούς κωδικούς, στήλη-κλειδί πίνακα, σημαίες που ο τύπος
 * υποστηρίζει. **Ίδια** συνάρτηση σε οθόνη (άμεση ανάδραση) και γραφέα (αυθεντία).
 * @module subapps/catalog/schema/validate-attribute
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import { findUnit } from '../measurement/conversion';
import type {
  CatalogAttributeDefinition,
  NumberAttributeConfig,
  SelectOption,
  TableAttributeConfig,
} from '../types/attribute';
import {
  isLocalizableAttributeType,
  isUniqueCapableAttributeType,
  TABLE_KEY_COLUMN_TYPES,
} from '../vocabulary/attribute-types';
import { CATALOG_LIMITS, isCatalogCode } from '../vocabulary/catalog-limits';
import { IssueCollector, reportDuplicates, type CatalogIssue } from './catalog-issues';

function checkRange(collector: IssueCollector, path: string, min: number | null, max: number | null): void {
  if (min !== null && max !== null && min > max) collector.add('rangeInverted', path);
}

function checkNumber(collector: IssueCollector, config: NumberAttributeConfig): void {
  if (config.decimals < 0 || config.decimals > CATALOG_LIMITS.maxDecimals) {
    collector.add('decimalsOutOfRange', 'config.decimals', { max: CATALOG_LIMITS.maxDecimals });
  }
  checkRange(collector, 'config.min', config.min, config.max);
}

function checkMeasurementRef(
  collector: IssueCollector,
  registry: MeasurementRegistry,
  path: string,
  familyCode: string,
  unitCode: string,
): void {
  const family = registry.get(familyCode);
  if (!family) {
    collector.add('measurementFamilyUnknown', `${path}.measurementFamilyCode`, { code: familyCode });
    return;
  }
  if (!findUnit(family, unitCode)) collector.add('measurementUnitUnknown', `${path}.unitCode`, { code: unitCode });
}

function checkOptions(collector: IssueCollector, path: string, options: readonly SelectOption[]): void {
  if (options.length === 0) collector.add('optionsRequired', path);
  if (options.length > CATALOG_LIMITS.maxSelectOptions) {
    collector.add('tooMany', path, { max: CATALOG_LIMITS.maxSelectOptions });
  }
  options.forEach((option, index) => {
    if (!isCatalogCode(option.code)) collector.add('invalidCode', `${path}[${index}].code`);
    if (!hasAnyLocalizedText(option.labels)) collector.add('labelRequired', `${path}[${index}].labels`);
  });
  reportDuplicates(collector, options.map((option) => option.code), (index) => `${path}[${index}].code`);
}

function checkTable(collector: IssueCollector, registry: MeasurementRegistry, config: TableAttributeConfig): void {
  const { columns } = config;
  if (columns.length < CATALOG_LIMITS.minTableColumns || columns.length > CATALOG_LIMITS.maxTableColumns) {
    collector.add('tableColumnsCount', 'config.columns', {
      min: CATALOG_LIMITS.minTableColumns,
      max: CATALOG_LIMITS.maxTableColumns,
    });
  }
  const key = columns[0];
  if (key && !(TABLE_KEY_COLUMN_TYPES as readonly string[]).includes(key.type)) {
    collector.add('tableKeyColumnType', 'config.columns[0].type');
  }
  columns.forEach((column, index) => {
    const path = `config.columns[${index}]`;
    if (!isCatalogCode(column.code)) collector.add('invalidCode', `${path}.code`);
    if (!hasAnyLocalizedText(column.labels)) collector.add('labelRequired', `${path}.labels`);
    if (column.type === 'measurement') {
      checkMeasurementRef(collector, registry, path, column.measurementFamilyCode, column.unitCode);
    }
    if (column.type === 'select') checkOptions(collector, `${path}.options`, column.options);
  });
  reportDuplicates(collector, columns.map((column) => column.code), (index) => `config.columns[${index}].code`);
}

function checkTypedConfig(
  collector: IssueCollector,
  registry: MeasurementRegistry,
  attribute: CatalogAttributeDefinition,
): void {
  switch (attribute.type) {
    case 'text':
      if (attribute.config.pattern !== null && !compiles(attribute.config.pattern)) {
        collector.add('invalidPattern', 'config.pattern');
      }
      return;
    case 'number':
      return checkNumber(collector, attribute.config);
    case 'measurement':
      checkNumber(collector, attribute.config);
      return checkMeasurementRef(
        collector, registry, 'config', attribute.config.measurementFamilyCode, attribute.config.defaultUnitCode,
      );
    case 'select':
    case 'multiSelect':
      return checkOptions(collector, 'config.options', attribute.config.options);
    case 'date':
      if (attribute.config.min !== null && attribute.config.max !== null && attribute.config.min > attribute.config.max) {
        collector.add('rangeInverted', 'config.min');
      }
      return;
    case 'asset':
      if (attribute.config.assetKinds.length === 0) collector.add('assetKindsRequired', 'config.assetKinds');
      return;
    case 'reference':
      attribute.config.targetFamilyCodes.forEach((code, index) => {
        if (!isCatalogCode(code)) collector.add('invalidCode', `config.targetFamilyCodes[${index}]`);
      });
      return;
    case 'table':
      return checkTable(collector, registry, attribute.config);
    case 'richText':
    case 'boolean':
      return;
  }
}

function compiles(pattern: string): boolean {
  try {
    new RegExp(pattern, 'u');
    return true;
  } catch {
    return false;
  }
}

export function validateAttribute(
  attribute: CatalogAttributeDefinition,
  registry: MeasurementRegistry,
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!isCatalogCode(attribute.code)) collector.add('invalidCode', 'code');
  if (!hasAnyLocalizedText(attribute.labels)) collector.add('labelRequired', 'labels');
  if (attribute.unique && !isUniqueCapableAttributeType(attribute.type)) collector.add('uniqueNotSupported', 'unique');
  // Η κράτηση μοναδικότητας (ADR-923 §5.10 Δ3) είναι ΜΙΑ τιμή ανά προϊόν: «μοναδικό ανά γλώσσα»
  // θα έδινε δύο κωδικούς στο ίδιο SKU και κανένα κλειδί κράτησης (Akeneo: identifier ποτέ localizable).
  if (attribute.unique && (attribute.localizable || attribute.scopable)) collector.add('uniqueLocalizedOrScoped', 'unique');
  if (attribute.localizable && !isLocalizableAttributeType(attribute.type)) {
    collector.add('localizableNotSupported', 'localizable');
  }
  checkTypedConfig(collector, registry, attribute);
  return collector.issues;
}
