/**
 * =============================================================================
 * Η ΠΛΗΡΟΤΗΤΑ — παράγωγο, ποτέ αλήθεια (ADR-923 §5.10 Δ5 · Δ7)
 * =============================================================================
 *
 * Ανά **κανάλι × γλώσσα του καναλιού** (Akeneo completeness): πόσες από τις **υποχρεωτικές**
 * ιδιότητες της οικογένειας για το κανάλι έχουν τιμή στη θέση που διαβάζει αυτό το κανάλι
 * (`values/value-shape.ts`), πάνω στις **συγχωνευμένες** τιμές (μοντέλο + υπο-μοντέλο + SKU).
 *
 * Ρητή απουσία (ETIM `ReasonNoValue`):
 *   - `notApplicable` ⇒ **πλήρες** (δεν έχει νόημα να ζητηθεί)·
 *   - `unknown` ⇒ **ελλιπές**, αλλά με αιτία `unknown`, ώστε η λίστα εκκρεμοτήτων να ξεχωρίζει
 *     το «δεν το ξέρουμε ακόμη» από το «ξεχάστηκε» (`empty`). Κανένας PIM δεν το κάνει: στο Akeneo
 *     ένα κενό είναι ελλιπές για πάντα, χωρίς τρόπο να πει ο προμηθευτής «δεν υπάρχει».
 *
 * 🔑 **Καθαρή και ντετερμινιστική**: η **ίδια** συνάρτηση τρέχει στον γραφέα (γράφει `derived`),
 * στην εργασία επανυπολογισμού και στην έκδοση (§5.6, από το στιγμιότυπο). Η μπαγιατίλα
 * ανιχνεύεται με το `inputs-hash.ts`, δεν γράφεται.
 *
 * @module subapps/catalog/completeness/compute-completeness
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogSettingsDefinition } from '../types/catalog-settings';
import type { CatalogFamilyDefinition } from '../types/family';
import type { NoValueReason } from '../types/product';
import type { ResolvedValues } from '../values/resolve-inherited';
import { isEmptyAttributeValue, readSlot } from '../values/value-shape';
import { CATALOG_CHANNELS, mapCatalogChannels, type CatalogChannel } from '../vocabulary/channels';

/** Γιατί λείπει μια υποχρεωτική τιμή — δεμένο στη ρίζα των λόγων απουσίας. */
export type CompletenessGapCause = 'empty' | Extract<NoValueReason, 'unknown'>;

export interface CompletenessGap {
  readonly attributeId: string;
  readonly cause: CompletenessGapCause;
}

export interface CompletenessCell {
  readonly required: number;
  readonly filled: number;
  /** Με τη σειρά των ιδιοτήτων της οικογένειας. */
  readonly missing: readonly CompletenessGap[];
}

/** `[κανάλι][γλώσσα]` — μόνο οι γλώσσες που έχει το κανάλι στις ρυθμίσεις. */
export type CompletenessMatrix = Readonly<Record<CatalogChannel, Readonly<Partial<Record<HumanLanguage, CompletenessCell>>>>>;

export interface CompletenessInput {
  readonly family: CatalogFamilyDefinition;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly settings: CatalogSettingsDefinition;
  readonly resolved: ResolvedValues;
}

function gapOf(
  input: CompletenessInput,
  attributeId: string,
  channel: CatalogChannel,
  locale: HumanLanguage,
): CompletenessGap | null {
  const reason = input.resolved.noValueReasons.get(attributeId)?.reason;
  if (reason === 'notApplicable') return null;
  if (reason === 'unknown') return { attributeId, cause: 'unknown' };
  const attribute = input.attributes.get(attributeId);
  const value = attribute ? readSlot(input.resolved.values.get(attributeId)?.slots, attribute, channel, locale) : undefined;
  return value && !isEmptyAttributeValue(value) ? null : { attributeId, cause: 'empty' };
}

function computeCell(input: CompletenessInput, channel: CatalogChannel, locale: HumanLanguage): CompletenessCell {
  const required = input.family.attributes.filter((binding) => binding.requiredChannels.includes(channel));
  const missing = required
    .map((binding) => gapOf(input, binding.attributeId, channel, locale))
    .filter((gap): gap is CompletenessGap => gap !== null);
  return { required: required.length, filled: required.length - missing.length, missing };
}

/** Η πληρότητα ενός SKU (ή απλού προϊόντος) σε κάθε κανάλι × γλώσσα του καναλιού. */
export function computeCompleteness(input: CompletenessInput): CompletenessMatrix {
  return mapCatalogChannels((channel) =>
    Object.fromEntries(input.settings.channelLocales[channel].map((locale) => [locale, computeCell(input, channel, locale)] as const)),
  );
}

/** Ποσοστό 0–100 (ακέραιο, προς τα κάτω: το 99,6% **δεν** είναι 100%). Χωρίς απαιτήσεις = 100. */
export function completenessPercent(cell: CompletenessCell): number {
  return cell.required === 0 ? 100 : Math.floor((cell.filled / cell.required) * 100);
}

/** Τα πλήρη ζεύγη ως κλειδιά `κανάλι:γλώσσα` — το παράγωγο `completeChannels[]` (Δ11) για φίλτρα. */
export function completeChannelKeys(matrix: CompletenessMatrix): readonly string[] {
  return CATALOG_CHANNELS.flatMap((channel) =>
    Object.entries(matrix[channel])
      .filter(([, cell]) => cell !== undefined && cell.missing.length === 0)
      .map(([locale]) => `${channel}:${locale}`),
  );
}

export interface CompletenessSummaryCell {
  readonly complete: number;
  readonly total: number;
}

/** Η περίληψη στο μοντέλο: «πλήρεις 5/7» ανά κανάλι × γλώσσα (Akeneo product model grid). */
export function summarizeCompleteness(
  matrices: readonly CompletenessMatrix[],
  settings: CatalogSettingsDefinition,
): Readonly<Record<CatalogChannel, Readonly<Partial<Record<HumanLanguage, CompletenessSummaryCell>>>>> {
  return mapCatalogChannels((channel) =>
    Object.fromEntries(settings.channelLocales[channel].map((locale) => {
      const complete = matrices.filter((matrix) => matrix[channel][locale]?.missing.length === 0).length;
      return [locale, { complete, total: matrices.length }] as const;
    })),
  );
}
