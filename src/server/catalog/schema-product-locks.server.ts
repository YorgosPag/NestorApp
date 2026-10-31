import 'server-only';

/**
 * =============================================================================
 * ΤΑ ΚΛΕΙΔΩΜΑΤΑ ΤΟΥ ΣΧΗΜΑΤΟΣ ΟΣΟ ΥΠΑΡΧΟΥΝ ΠΡΟΪΟΝΤΑ (ADR-923 §5.10 Θωράκιση 2–3)
 * =============================================================================
 *
 * Το σχήμα της Φάσης 1 ήταν ελεύθερο επειδή δεν υπήρχαν δεδομένα. Με δεδομένα, μερικές αλλαγές θα άφηναν τιμές
 * **ορφανές** ή **σε λάθος επίπεδο** — δηλαδή προϊόντα που δεν σώζονται πια χωρίς να τα έχει αγγίξει κανείς:
 *
 * | Αλλαγή | Πότε κλειδώνει | Γιατί |
 * |---|---|---|
 * | αφαίρεση/αλλαγή αξόνων ή επιπέδων σχήματος | κάποιο μοντέλο το χρησιμοποιεί | ο συνδυασμός αξόνων **είναι** η ταυτότητα της παραλλαγής |
 * | μετακίνηση ιδιότητας σε άλλο επίπεδο | έχει τιμές στην οικογένεια | αυστηρή κληρονομιά (Δ1): η τιμή θα έμενε σε λάθος φορέα — εργαλείο 2ζ |
 * | αφαίρεση ιδιότητας από την οικογένεια | έχει τιμές στην οικογένεια | ορφανές τιμές ⇒ `attributeUnknown` στην επόμενη αποθήκευση |
 * | `localizable` · `scopable` · `unique` · οικογένεια μέτρησης | η ιδιότητα έχει τιμές | αλλάζει **ποια θέση** διαβάζεται / τι κρατείται |
 * | αφαίρεση επιλογής | κάποιος φορέας τη χρησιμοποιεί | ορφανός κωδικός επιλογής |
 * | είδος καταχώρισης (§22) | η οικογένεια έχει μοντέλα ή προϊόντα | θα άλλαζε τι σημαίνουν υπάρχουσες τιμές και παραγγελίες |
 *
 * Αυστηρότερα όρια (`min/max/pattern/maxLength`) **επιτρέπονται** (Akeneo): οι παλιές τιμές εμφανίζονται ως
 * ευρήματα στην επόμενη επεξεργασία — αυτό δεν είναι ορφάνια, είναι ποιότητα.
 *
 * @module server/catalog/schema-product-locks.server
 */

import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import { listingKindOf, type CatalogFamilyDefinition, type VariantScheme } from '@/subapps/catalog/types/family';
import { attributeOwnerDepth } from '@/subapps/catalog/values/attribute-levels';
import {
  attributeHasValues,
  familyAttributeHasValues,
  familyHasHolders,
  optionInUse,
  variantSchemeInUse,
} from './catalog-usage-reads.server';
import type { CatalogTx } from './catalog-store.server';
import { CatalogWriteError } from './catalog-write-error';

const sameAxes = (a: VariantScheme, b: VariantScheme): boolean =>
  a.levels.length === b.levels.length &&
  a.levels.every((level, index) => level.axisAttributeIds.join('|') === b.levels[index].axisAttributeIds.join('|'));

function movedAttributes(previous: VariantScheme, next: VariantScheme): string[] {
  const ids = new Set([...previous.levels, ...next.levels].flatMap((level) => [...level.axisAttributeIds, ...level.attributeIds]));
  return [...ids].filter((id) => attributeOwnerDepth(previous, id) !== attributeOwnerDepth(next, id));
}

async function schemeIssues(scope: CatalogTx, familyId: string, previous: VariantScheme, next: VariantScheme | undefined, index: number) {
  if (!(await variantSchemeInUse(scope, familyId, previous.code))) return [];
  const path = `variantSchemes[${index}]`;
  if (!next || !sameAxes(previous, next)) return [{ code: 'variantSchemeLockedInUse', path, params: { code: previous.code } } satisfies CatalogIssue];
  const issues: CatalogIssue[] = [];
  for (const attributeId of movedAttributes(previous, next)) {
    if (await familyAttributeHasValues(scope, familyId, attributeId)) {
      issues.push({ code: 'attributeLevelLockedInUse', path, params: { attributeId } });
    }
  }
  return issues;
}

/** Κρίνει μια αλλαγή οικογένειας απέναντι στα προϊόντα της· ρίχνει `inUse` με τα ευρήματα. */
export async function assertFamilyChangeKeepsProducts(
  scope: CatalogTx,
  familyId: string,
  previous: CatalogFamilyDefinition,
  next: CatalogFamilyDefinition,
): Promise<void> {
  const issues: CatalogIssue[] = [];
  for (const [index, scheme] of previous.variantSchemes.entries()) {
    const nextScheme = next.variantSchemes.find((candidate) => candidate.code === scheme.code);
    issues.push(...(await schemeIssues(scope, familyId, scheme, nextScheme, index)));
  }
  const kept = new Set(next.attributes.map((binding) => binding.attributeId));
  for (const { attributeId } of previous.attributes.filter((binding) => !kept.has(binding.attributeId))) {
    if (await familyAttributeHasValues(scope, familyId, attributeId)) {
      issues.push({ code: 'attributeRemovalLockedInUse', path: 'attributes', params: { attributeId } });
    }
  }
  if (listingKindOf(previous) !== listingKindOf(next) && (await familyHasHolders(scope, familyId))) {
    issues.push({ code: 'listingKindLockedInUse', path: 'listingKind' });
  }
  if (issues.length > 0) throw new CatalogWriteError('inUse', issues);
}

/** Διαγραφή οικογένειας: απαγορεύεται όσο υπάρχουν μοντέλα ή προϊόντα της. */
export async function assertFamilyHasNoProducts(scope: CatalogTx, familyId: string): Promise<void> {
  if (await familyHasHolders(scope, familyId)) throw new CatalogWriteError('inUse');
}

const LOCKED_FLAGS = ['localizable', 'scopable', 'unique'] as const;

function lockedFieldChanges(previous: CatalogAttributeDefinition, next: CatalogAttributeDefinition): string[] {
  const fields: string[] = LOCKED_FLAGS.filter((flag) => previous[flag] !== next[flag]);
  if (previous.type === 'measurement' && next.type === 'measurement' && previous.config.measurementFamilyCode !== next.config.measurementFamilyCode) {
    fields.push('config.measurementFamilyCode');
  }
  return fields;
}

function removedOptions(previous: CatalogAttributeDefinition, next: CatalogAttributeDefinition): string[] {
  const optionsOf = (attribute: CatalogAttributeDefinition): readonly string[] =>
    attribute.type === 'select' || attribute.type === 'multiSelect' ? attribute.config.options.map((option) => option.code) : [];
  const kept = new Set(optionsOf(next));
  return optionsOf(previous).filter((code) => !kept.has(code));
}

/** Κρίνει μια αλλαγή ιδιότητας απέναντι στις **τιμές** της· ρίχνει `inUse` με τα ευρήματα. */
export async function assertAttributeChangeKeepsValues(
  scope: CatalogTx,
  attributeId: string,
  previous: CatalogAttributeDefinition,
  next: CatalogAttributeDefinition,
): Promise<void> {
  const issues: CatalogIssue[] = [];
  const fields = lockedFieldChanges(previous, next);
  if (fields.length > 0 && (await attributeHasValues(scope, attributeId))) {
    fields.forEach((field) => issues.push({ code: 'attributeFlagLockedInUse', path: field }));
  }
  for (const code of removedOptions(previous, next)) {
    if (await optionInUse(scope, attributeId, code)) issues.push({ code: 'optionLockedInUse', path: 'config.options', params: { code } });
  }
  if (issues.length > 0) throw new CatalogWriteError('inUse', issues);
}
