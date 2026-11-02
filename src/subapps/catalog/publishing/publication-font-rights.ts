/**
 * **Μπαίνει αυτή η γραμματοσειρά σε έκδοση;** (ADR-923 §5.6.1): καθαρή κρίση, κοινή σε διακομιστή, επιλογέα και γραφέα.
 *
 * 🔑 Το `fsType` του πίνακα `OS/2` λέει τι επιτρέπει ο δημιουργός: η εφαρμογή **δεν** ενσωματώνει ό,τι απαγορεύεται (OpenType,
 *    όπως κάνουν το InDesign και το Canva). Το Typst ενσωματώνει πάντα υποσύνολο, άρα και το «χωρίς subsetting» είναι άρνηση.
 * ⚠️ Το `fsType` δεν είναι άδεια. Είναι σημαία. Γι' αυτό ο άνθρωπος δηλώνει στη συνταγή ότι έχει άδεια ενσωμάτωσης, και η δήλωση μένει
 *    στο ιστορικό της.
 * @module subapps/catalog/publishing/publication-font-rights
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { CatalogIssueCode } from '../schema/catalog-issues';
import type { CatalogAssetDefinition, CatalogFontEmbedding } from '../types/asset';

const FS_EMBEDDING_LEVEL_MASK = 0x000f;
const FS_PREVIEW_PRINT = 0x0004;
const FS_EDITABLE = 0x0008;
const FS_NO_SUBSETTING = 0x0100;
const FS_BITMAP_ONLY = 0x0200;
/** Το βάρος Regular του OpenType (`usWeightClass`). Το Book (350) και το Medium (500) μετρούν κι αυτά ως βασική όψη. */
const REGULAR_WEIGHT_MIN = 350;
const REGULAR_WEIGHT_MAX = 500;

/**
 * `null` ⇒ η ενσωμάτωση απαγορεύεται. Τα bits 0–3 αποκλείονται στις νεότερες εκδόσεις του πίνακα· σε παλιά αρχεία μπορεί να
 * είναι πολλά μαζί, και τότε ισχύει το λιγότερο περιοριστικό. Το Restricted (0x0002) μόνο του δεν δίνει επίπεδο, άρα απαγορεύεται.
 */
export function fontEmbeddingOf(fsType: number): CatalogFontEmbedding | null {
  if ((fsType & FS_NO_SUBSETTING) !== 0 || (fsType & FS_BITMAP_ONLY) !== 0) return null;
  const level = fsType & FS_EMBEDDING_LEVEL_MASK;
  if (level === 0) return 'installable';
  return (level & FS_EDITABLE) !== 0 ? 'editable' : (level & FS_PREVIEW_PRINT) !== 0 ? 'previewPrint' : null;
}

export type PublicationFontCandidate = Pick<CatalogAssetDefinition, 'role' | 'fileId' | 'font'>;
type EligibleFont = PublicationFontCandidate & { readonly font: NonNullable<PublicationFontCandidate['font']> };

export function isPublicationFont(asset: PublicationFontCandidate): asset is EligibleFont {
  return asset.role === 'font' && asset.fileId !== null && asset.font !== undefined;
}

/** Οι οικογένειες που προσφέρει ο επιλογέας, με σταθερή σειρά. */
export function publicationFontFamilies<T extends PublicationFontCandidate>(assets: readonly T[]): ReadonlyMap<string, readonly T[]> {
  const families = new Map<string, T[]>();
  for (const asset of assets.filter(isPublicationFont)) families.set(asset.font.family, [...(families.get(asset.font.family) ?? []), asset]);
  return new Map([...families.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

const isRegularFace = (asset: EligibleFont): boolean =>
  !asset.font.italic && asset.font.weight >= REGULAR_WEIGHT_MIN && asset.font.weight <= REGULAR_WEIGHT_MAX;

/** Οι όψεις μιας συνταγής: ίδια οικογένεια, με βασική όψη, και το κείμενο της γλώσσας να υπάρχει. `null` = περνά. */
export function publicationFontRefusal(assets: readonly PublicationFontCandidate[], language: HumanLanguage): CatalogIssueCode | null {
  const eligible = assets.filter(isPublicationFont);
  if (eligible.length === 0 || eligible.length !== assets.length) return 'publicationFontFamilyInvalid';
  const regular = eligible.find(isRegularFace);
  if (!regular || new Set(eligible.map((asset) => asset.font.family)).size > 1) return 'publicationFontFamilyInvalid';
  return language === 'el' && !regular.font.coversGreek ? 'publicationFontNoGreek' : null;
}
