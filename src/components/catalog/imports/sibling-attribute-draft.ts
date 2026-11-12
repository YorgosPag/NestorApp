/**
 * @fileoverview **Η πρόταση «νέα ιδιότητα όπως η αδελφή»** (ADR-923 §5.5.2 Β3 Γ11): από την ιδιότητα που ο ίδιος πίνακας ήδη γεμίζει
 *   (`ImportPageUnmappedLine.sibling`) βγαίνει ο ορισμός της νέας, το επίπεδό της και τα κανάλια όπου είναι υποχρεωτική. Καθαρό.
 * @module components/catalog/imports/sibling-attribute-draft
 *
 * 🔑 Αντιγράφεται η **ρύθμιση** (τύπος · μέτρηση · μονάδα · δεκαδικά · όρια · ομάδα), όχι η **ταυτότητα**: οι αντιστοιχίσεις σε
 *    πρότυπα (ETIM · IFC · ΑΤΟΕ) περιγράφουν την αδελφή, άρα η νέα ξεκινά χωρίς — λάθος κωδικός ETIM είναι χειρότερος από κανέναν.
 * 🔑 Ετικέτα σε γλώσσα όπου η λέξη δεν αλλάζει με βεβαιότητα **φεύγει**· για την προεπιλεγμένη γλώσσα μπαίνει ό,τι τυπώνει η πηγή.
 */

import type { AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { relabelText, siblingCodeOf } from '@/subapps/catalog/import/line-sibling';
import type { ImportLineSibling, ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportLineAttributeCreate } from '@/subapps/catalog/types/catalog-import-requests';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { ImportLineBindLevel } from '@/subapps/catalog/vocabulary/catalog-import';
import { suggestCatalogCode } from '@/subapps/catalog/vocabulary/suggest-catalog-code';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { attributeDraftOf, NO_MAPPINGS } from '../attributes/attribute-draft';

export interface SiblingProposal {
  readonly line: ImportPageUnmappedLine;
  readonly sibling: AttributeRecord;
  readonly create: ImportLineAttributeCreate;
  /** Από τη θέση της αδελφής στο σχήμα· `null` όταν εκείνη ζει σε ενδιάμεσο επίπεδο, που η εισαγωγή δεν τοποθετεί. */
  readonly level: ImportLineBindLevel | null;
}

/** Πού ζει η αδελφή στο σχήμα της παρτίδας: σε κανένα επίπεδο ⇒ κοινή· στο τελευταίο ⇒ ανά κωδικό· αλλού ⇒ ερώτηση για άνθρωπο. */
export function siblingLevelOf(family: FamilyRecord, schemeCode: string | null, attributeId: string): ImportLineBindLevel | null {
  const scheme = schemeCode === null ? undefined : family.variantSchemes.find((item) => item.code === schemeCode);
  if (!scheme) return 'shared';
  const at = scheme.levels.findIndex((level) => level.attributeIds.includes(attributeId));
  if (at === -1) return 'shared';
  return at === scheme.levels.length - 1 ? 'leaf' : null;
}

function siblingDefinition(sibling: AttributeRecord, line: ImportPageUnmappedLine, word: ImportLineSibling, orderKey: string): CatalogAttributeDefinition {
  const base = attributeDraftOf(sibling);
  const labels = relabelText(base.labels, word);
  const printed = line.identity?.printed ?? line.label;
  const named = labels[DEFAULT_LANGUAGE] ? labels : { ...labels, [DEFAULT_LANGUAGE]: printed };
  const code = siblingCodeOf(sibling.code, word) ?? suggestCatalogCode(named[DEFAULT_LANGUAGE] ?? printed);
  return { ...base, code, labels: named, description: relabelText(base.description, word), mappings: NO_MAPPINGS, orderKey };
}

export interface SiblingLibrary {
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly orderKeyAtEnd: (groupId: string, excludeId: string | null) => string;
}

/** Η πρόταση μιας γραμμής, ή `null` όταν δεν έχει αδελφή που να βρίσκεται στη βιβλιοθήκη και στην οικογένεια. */
export function siblingProposalOf(line: ImportPageUnmappedLine, family: FamilyRecord, schemeCode: string | null, library: SiblingLibrary): SiblingProposal | null {
  const word = line.sibling;
  const sibling = word ? library.attributeById.get(word.attributeId) : undefined;
  const binding = word ? family.attributes.find((item) => item.attributeId === word.attributeId) : undefined;
  if (!word || !sibling || !binding) return null;
  const definition = siblingDefinition(sibling, line, word, library.orderKeyAtEnd(sibling.groupId, null));
  // Ο κωδικός υπάρχει ήδη στη βιβλιοθήκη ⇒ η σωστή πράξη είναι «Αντιστοίχιση», όχι νέα ιδιότητα που θα αρνιόταν ως διπλότυπο.
  const taken = [...library.attributeById.values()].some((attribute) => attribute.code === definition.code);
  if (definition.code === '' || taken) return null;
  return { line, sibling, create: { definition, requiredChannels: binding.requiredChannels }, level: siblingLevelOf(family, schemeCode, sibling.id) };
}

/**
 * Οι προτάσεις πολλών γραμμών μαζί. Δύο γραμμές που θα έδιναν τον **ίδιο** κωδικό δεν προτείνονται: η δεύτερη θα αρνιόταν ως
 * διπλότυπο, και η «μαζική» πράξη θα έμενε μισή.
 */
export function siblingProposalsOf(lines: readonly ImportPageUnmappedLine[], family: FamilyRecord, schemeCode: string | null, library: SiblingLibrary): SiblingProposal[] {
  const proposals = lines.flatMap((line) => siblingProposalOf(line, family, schemeCode, library) ?? []);
  const counts = new Map<string, number>();
  for (const proposal of proposals) counts.set(proposal.create.definition.code, (counts.get(proposal.create.definition.code) ?? 0) + 1);
  return proposals.filter((proposal) => counts.get(proposal.create.definition.code) === 1);
}
