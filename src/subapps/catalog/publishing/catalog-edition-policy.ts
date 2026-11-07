/**
 * =============================================================================
 * ΔΗΜΟΣΙΕΥΜΕΝΕΣ ΕΚΔΟΣΕΙΣ — ο ΕΝΑΣ κριτής (ADR-923 §5.15)
 * =============================================================================
 *
 * | Ερώτηση | Συνάρτηση |
 * |---|---|
 * | Δημοσιεύεται αυτή η έκδοση του εκδότη; | `publishabilityOf` |
 * | Ποια ισχύουσα έκδοση αντικαθιστά; | `supersededBy` |
 * | Τη βλέπει αυτός ο θεατής; | `editionVisibleTo` |
 * | Τι μαθαίνει ο θεατής γι' αυτήν; | `catalogEditionViewOf` |
 *
 * 🔑 **Το κλειδί κοινού είναι το `audienceIdentity` των τιμών**, όχι δεύτερη σειριοποίηση: το κοινό του εντύπου είναι υποσύνολο
 *    του `PriceAudience`, άρα «ανώνυμοι» και «ομάδα Χ» λέγονται με τον ίδιο τρόπο παντού.
 * 🔒 **Κρυφό ≡ ανύπαρκτο (Η3)**: ό,τι δεν βλέπει ο θεατής δεν εμφανίζεται ούτε ως «αντικαταστάθηκε». Η αποσυρμένη δεν τη βλέπει κανείς.
 * 🔒 **Θ4**: έκδοση με τιμές δεν δημοσιεύεται, όποιο κι αν είναι το κοινό της. Η άρση του φράγματος είναι απόφαση Giorgio μετά από
 *    ανεξάρτητη ανασκόπηση ασφαλείας, και θα αλλάξει **μόνο** αυτή τη συνάρτηση.
 * ⚠️ Καθαρό: κανένα ρολόι, καμία βάση.
 *
 * @module subapps/catalog/publishing/catalog-edition-policy
 */

import { audienceIdentity } from '../pricing/price-audience';
import type { PriceAudience, PricingViewer } from '../types/price-list';
import type { PublicationArtifact, PublicationRunDefinition } from '../types/publication';
import {
  CATALOG_EDITION_AUDIENCE_KINDS,
  type CatalogEditionAudience,
  type CatalogEditionDefinition,
  type CatalogEditionView,
} from '../types/catalog-edition';

export const CATALOG_EDITION_REFUSALS = ['notReady', 'disposed', 'priced', 'noScreenFile'] as const;
export type CatalogEditionRefusal = (typeof CATALOG_EDITION_REFUSALS)[number];

export type CatalogEditionPublishability =
  | { readonly ok: true; readonly artifact: PublicationArtifact }
  | { readonly ok: false; readonly refusal: CatalogEditionRefusal };

type RunFacts = Pick<PublicationRunDefinition, 'status' | 'priced' | 'retention' | 'artifacts'>;

const EDITION_AUDIENCE_KINDS: ReadonlySet<string> = new Set(CATALOG_EDITION_AUDIENCE_KINDS);

/** Δέχεται έντυπο αυτό το κοινό τιμών; Ο φρουρός πάνω στον οποίο στενεύει το σχήμα zod (ένα σχήμα κοινού, όχι δεύτερο). */
export function isCatalogEditionAudience(audience: PriceAudience): audience is CatalogEditionAudience {
  return EDITION_AUDIENCE_KINDS.has(audience.kind);
}

/** Το κλειδί του κοινού, ίδιο με των τιμών και των εκδόσεων του εκδότη. */
export function editionAudienceKey(audience: CatalogEditionAudience): string {
  return audienceIdentity(audience);
}

/** Δημοσιεύεται; Μόνο έτοιμη, με αρχείο, χωρίς τιμές (Θ4), και μόνο το PDF οθόνης. */
export function publishabilityOf(run: RunFacts): CatalogEditionPublishability {
  if (run.status !== 'ready') return { ok: false, refusal: 'notReady' };
  if (run.retention.disposal !== null) return { ok: false, refusal: 'disposed' };
  if (run.priced) return { ok: false, refusal: 'priced' };
  const artifact = run.artifacts.find((candidate) => candidate.profile === 'screen');
  return artifact ? { ok: true, artifact } : { ok: false, refusal: 'noScreenFile' };
}

type EditionFacts = Pick<CatalogEditionDefinition, 'shelfKey' | 'audience' | 'status'>;

/** Οι ισχύουσες εκδόσεις που αντικαθιστά μια νέα δημοσίευση: ίδιο ράφι, ίδιο κοινό. Κανονικά μία· το δίχτυ τις πιάνει όλες. */
export function supersededBy<T extends EditionFacts & { readonly id: string }>(
  existing: readonly T[],
  next: Pick<CatalogEditionDefinition, 'shelfKey' | 'audience'>,
): readonly T[] {
  const key = editionAudienceKey(next.audience);
  return existing.filter(
    (edition) => edition.status === 'published' && edition.shelfKey === next.shelfKey && editionAudienceKey(edition.audience) === key,
  );
}

/** Τη βλέπει ο θεατής; Ο ανώνυμος βλέπει μόνο ανώνυμες· ο αγοραστής και τις ανώνυμες και της ομάδας του. */
export function editionVisibleTo(edition: Pick<CatalogEditionDefinition, 'audience' | 'status'>, viewer: PricingViewer): boolean {
  if (edition.status === 'withdrawn') return false;
  switch (edition.audience.kind) {
    case 'anonymous':
      return true;
    case 'customerGroup':
      return viewer.kind === 'signedIn' && viewer.customerGroupId === edition.audience.customerGroupId;
  }
}

/**
 * Ό,τι μαθαίνει ο θεατής, πεδίο προς πεδίο (κλειστό σχήμα, όπως το `ShowcasePrice`). Το `supersededBy` δείχνει μόνο σε έκδοση
 * που **βλέπει** κι αυτή ο θεατής· αλλιώς σιωπά, ώστε το «αντικαταστάθηκε» να μη μαρτυρά ύπαρξη κρυφής έκδοσης.
 */
export function catalogEditionViewOf(
  id: string,
  edition: CatalogEditionDefinition,
  visibleIds: ReadonlySet<string>,
): CatalogEditionView | null {
  if (edition.status === 'withdrawn') return null;
  const successor = edition.supersededBy !== null && visibleIds.has(edition.supersededBy) ? edition.supersededBy : null;
  return {
    id,
    title: edition.title,
    language: edition.language,
    pageCount: edition.file.pageCount,
    sizeBytes: edition.file.sizeBytes,
    publishedAt: edition.publishedAt,
    status: edition.status,
    supersededBy: successor,
  };
}
