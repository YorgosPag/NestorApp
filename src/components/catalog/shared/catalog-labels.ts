/**
 * @fileoverview **Οι λέξεις του σχήματος καταλόγου** — κάθε χάρτης δεμένος στη ρίζα του λεξιλογίου (ADR-923 Φάση 1γ).
 * @related subapps/catalog/vocabulary/* (οι ρίζες) · schema/catalog-issues.ts · services/catalog/catalog-failure.ts ·
 *   components/document-registry/document-registry-labels.ts (το ιδίωμα)
 * @module components/catalog/shared/catalog-labels
 *
 * 🔑 **`Record<Ρίζα, …>`, ποτέ `Record<string, …>`** (CHECK 3.73): ένας νέος τύπος ιδιότητας, κανάλι, εύρημα ή είδος
 *    κανόνα **δεν μεταγλωττίζεται** μέχρι να αποκτήσει λέξη — και εικονίδιο, ώστε να αναγνωρίζεται χωρίς χρώμα (CHECK 3.41).
 * ⚠️ Κυριολεκτικά κλειδιά (όχι template): οι γεννήτορες i18n (route slice · CHECK 3.8) τα **λύνουν** στατικά.
 */

import {
  Calendar,
  FileImage,
  Hash,
  Link2,
  List,
  ListChecks,
  Ruler,
  Table2,
  ToggleLeft,
  Type,
  TextQuote,
  type LucideIcon,
} from 'lucide-react';

import type { HumanLanguage } from '@/i18n/languages';
import type { CatalogFailureKind } from '@/services/catalog/catalog-failure';
import type {
  CompareOperator,
  ConsistencyRuleKind,
  OrderDirection,
  RuleSeverity,
  TableRowMergeMode,
  FamilyTableRow,
} from '@/subapps/catalog/types/family';
import type { AssetKind, AttributeType, ReferenceRelation } from '@/subapps/catalog/vocabulary/attribute-types';
import type { CatalogChannel } from '@/subapps/catalog/vocabulary/channels';
import type { CatalogListingKind } from '@/subapps/catalog/vocabulary/listing-kinds';

/** Η γλώσσα κάθε πεδίου πολύγλωσσου κειμένου — δεμένη στο `HUMAN_LANGUAGES` (νέα γλώσσα ⇒ νέα λέξη, αλλιώς σπάει). */
export const LANGUAGE_KEYS: Readonly<Record<HumanLanguage, string>> = {
  el: 'language.el',
  en: 'language.en',
};

export const ATTRIBUTE_TYPE_KEYS: Readonly<Record<AttributeType, string>> = {
  text: 'attributeTypes.text',
  richText: 'attributeTypes.richText',
  number: 'attributeTypes.number',
  measurement: 'attributeTypes.measurement',
  boolean: 'attributeTypes.boolean',
  select: 'attributeTypes.select',
  multiSelect: 'attributeTypes.multiSelect',
  date: 'attributeTypes.date',
  asset: 'attributeTypes.asset',
  reference: 'attributeTypes.reference',
  table: 'attributeTypes.table',
};

export const ATTRIBUTE_TYPE_ICONS: Readonly<Record<AttributeType, LucideIcon>> = {
  text: Type,
  richText: TextQuote,
  number: Hash,
  measurement: Ruler,
  boolean: ToggleLeft,
  select: List,
  multiSelect: ListChecks,
  date: Calendar,
  asset: FileImage,
  reference: Link2,
  table: Table2,
};

export const CHANNEL_KEYS: Readonly<Record<CatalogChannel, string>> = {
  print: 'channels.print',
  storefront: 'channels.storefront',
  portal: 'channels.portal',
  quote: 'channels.quote',
};

export const LISTING_KIND_KEYS: Readonly<Record<CatalogListingKind, string>> = {
  product: 'listingKinds.product',
  service: 'listingKinds.service',
  productWithInstallation: 'listingKinds.productWithInstallation',
};

export const ASSET_KIND_KEYS: Readonly<Record<AssetKind, string>> = {
  image: 'assetKinds.image',
  document: 'assetKinds.document',
  bim: 'assetKinds.bim',
  video: 'assetKinds.video',
  font: 'assetKinds.font',
};

export const REFERENCE_RELATION_KEYS: Readonly<Record<ReferenceRelation, string>> = {
  accessory: 'referenceRelations.accessory',
  sparePart: 'referenceRelations.sparePart',
  compatible: 'referenceRelations.compatible',
  replacement: 'referenceRelations.replacement',
  related: 'referenceRelations.related',
};

export const MERGE_MODE_KEYS: Readonly<Record<TableRowMergeMode, string>> = {
  none: 'table.merge.none',
  equalAdjacent: 'table.merge.equalAdjacent',
  all: 'table.merge.all',
};

export const TABLE_ROW_KIND_KEYS: Readonly<Record<FamilyTableRow['kind'], string>> = {
  groupHeader: 'table.rowKinds.groupHeader',
  axis: 'table.rowKinds.axis',
  attribute: 'table.rowKinds.attribute',
};

export const RULE_KIND_KEYS: Readonly<Record<ConsistencyRuleKind, string>> = {
  unique: 'rules.kinds.unique',
  orderAcrossAttributes: 'rules.kinds.orderAcrossAttributes',
  monotonicAlongAxis: 'rules.kinds.monotonicAlongAxis',
  compare: 'rules.kinds.compare',
};

export const RULE_KIND_HINT_KEYS: Readonly<Record<ConsistencyRuleKind, string>> = {
  unique: 'rules.hints.unique',
  orderAcrossAttributes: 'rules.hints.orderAcrossAttributes',
  monotonicAlongAxis: 'rules.hints.monotonicAlongAxis',
  compare: 'rules.hints.compare',
};

export const SEVERITY_KEYS: Readonly<Record<RuleSeverity, string>> = {
  error: 'rules.severity.error',
  warning: 'rules.severity.warning',
};

export const DIRECTION_KEYS: Readonly<Record<OrderDirection, string>> = {
  ascending: 'rules.direction.ascending',
  descending: 'rules.direction.descending',
};

/** Τα σύμβολα είναι μαθηματικά (≥, ≤ …) — δεν μεταφράζονται, όπως τα σύμβολα μονάδων. */
export const OPERATOR_SYMBOLS: Readonly<Record<CompareOperator, string>> = {
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
  eq: '=',
  neq: '≠',
};

export const FAILURE_KEYS: Readonly<Record<CatalogFailureKind, string>> = {
  notFound: 'failure.notFound',
  duplicateCode: 'failure.duplicateCode',
  revisionMismatch: 'failure.revisionMismatch',
  inUse: 'failure.inUse',
  immutable: 'failure.immutable',
  invalid: 'failure.invalid',
  confirmationRequired: 'failure.confirmationRequired',
  forbidden: 'failure.forbidden',
  network: 'failure.network',
  unknown: 'failure.unknown',
};
