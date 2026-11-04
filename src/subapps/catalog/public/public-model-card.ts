/**
 * **Η κάρτα ενός δημόσιου μοντέλου** (ADR-923 §5.13 Σ4): ό,τι χρειάζεται η λίστα, χωρίς το βαρύ έγγραφο.
 *
 * 🔑 Η λίστα κρατά στη μνήμη κάρτες, όχι έγγραφα: ένα έγγραφο φτάνει έως 1 MiB, και 48 τέτοια θα γέμιζαν την κρυφή μνήμη.
 *
 * @module subapps/catalog/public/public-model-card
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { CatalogListingKind } from '../vocabulary/listing-kinds';
import type { PublicCatalogMedia, PublicCatalogModel, PublicModelAddress } from './public-catalog-schema';

export interface PublicModelCard {
  readonly modelId: string;
  readonly title: string;
  readonly code: string;
  readonly familyLabels: LocalizedText;
  readonly listingKind: CatalogListingKind;
  readonly image: PublicCatalogMedia | null;
  readonly variantCount: number;
  /**
   * Τα SKU του δημόσιου εγγράφου (ADR-923 §5.13 Σ6, ανασκόπηση Μ3): η τιμή «από» κρίνει **μόνο** αυτά, όχι όλο το δέντρο.
   * Προαιρετικό: κάρτες στη μνήμη από παλαιότερη ανάπτυξη δεν το έχουν, και τότε η κάρτα μένει «Κατόπιν προσφοράς».
   */
  readonly variantIds?: readonly string[];
}

/** Το όνομα του μοντέλου: η ετικέτα του μοναδικού SKU, αλλιώς ο κωδικός. */
export function publicModelTitle(model: PublicModelAddress): string {
  const [only, ...rest] = model.variants;
  return (rest.length === 0 ? only.label : null) ?? model.code;
}

/** Η πρώτη εικόνα: του μοντέλου, αλλιώς του πρώτου SKU που έχει. */
export function publicModelImage(model: PublicCatalogModel): PublicCatalogMedia | null {
  return model.media[0] ?? model.variants.flatMap((variant) => variant.media)[0] ?? null;
}

export function publicModelCardOf(model: PublicCatalogModel): PublicModelCard {
  return {
    modelId: model.modelId,
    title: publicModelTitle(model),
    code: model.code,
    familyLabels: model.familyLabels,
    listingKind: model.listingKind,
    image: publicModelImage(model),
    variantCount: model.variants.length,
    variantIds: model.variants.map((variant) => variant.variantId),
  };
}
