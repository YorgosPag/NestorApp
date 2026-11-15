/**
 * @fileoverview ADR-915 §41.5 — **οι λέξεις της διάταξης** του μητρώου: καρτέλες · ομαδοποίηση · στήλες πίνακα · πλαϊνό πάνελ.
 * @related document-registry-labels.ts (το ιδίωμα) · lib/document-validity/document-registry-view.ts (οι ρίζες)
 * @module components/document-registry/registry-layout-labels
 *
 * 🔑 **`Record<Ρίζα, …>`** (CHECK 3.73): νέα καρτέλα ή άξονας ομαδοποίησης δεν μεταγλωττίζεται χωρίς λέξη.
 * ⚠️ Κυριολεκτικά κλειδιά (template σε σταθερά module): ο γεννήτορας του route slice τα **λύνει** στατικά.
 */

import type { RegistryGrouping, RegistryTab } from '@/lib/document-validity/document-registry-view';

const K = 'document-registry:layout.';

export const LAYOUT_KEYS = {
  tabsLabel: `${K}tabs.label`,
  groupingLabel: `${K}grouping.label`,
  actionEmpty: `${K}action.empty`,
  actionEmptyHint: `${K}action.emptyHint`,
  lateEmpty: `${K}late.empty`,
  lateEmptyHint: `${K}late.emptyHint`,
  blocksNow: `${K}blocks.now`,
  blocksOn: `${K}blocks.on`,
  blocksNo: `${K}blocks.no`,
  blocksUndetermined: `${K}blocks.undetermined`,
  colDocument: `${K}col.document`,
  colProperty: `${K}col.property`,
  colState: `${K}col.state`,
  colExpiry: `${K}col.expiry`,
  colBlocks: `${K}col.blocks`,
  colNextStep: `${K}col.nextStep`,
  tableCaption: `${K}table.caption`,
  decisionsEmpty: `${K}decisions.empty`,
  nextAssign: `${K}next.assign`,
  nextNone: `${K}next.none`,
  nextSince: `${K}next.since`,
  noExpiry: `${K}noExpiry`,
  sheetDescription: `${K}sheet.description`,
  groupNoProperty: `${K}group.noProperty`,
} as const;

export const REGISTRY_TAB_LABEL_KEYS: Readonly<Record<RegistryTab, string>> = {
  action: `${K}tabs.action`,
  late: `${K}tabs.late`,
  all: `${K}tabs.all`,
  decisions: `${K}tabs.decisions`,
};

export const REGISTRY_GROUPING_LABEL_KEYS: Readonly<Record<RegistryGrouping, string>> = {
  state: `${K}grouping.state`,
  property: `${K}grouping.property`,
  kind: `${K}grouping.kind`,
};
