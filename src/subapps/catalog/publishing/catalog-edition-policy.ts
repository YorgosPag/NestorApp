/**
 * =============================================================================
 * ΔΗΜΟΣΙΕΥΜΕΝΕΣ ΕΚΔΟΣΕΙΣ — ο ΕΝΑΣ κριτής (ADR-923 §5.15)
 * =============================================================================
 *
 * | Ερώτηση | Συνάρτηση |
 * |---|---|
 * | Δημοσιεύεται αυτή η έκδοση του εκδότη; | `publishabilityOf` |
 * | Ποια ισχύουσα έκδοση αντικαθιστά; | `supersededBy` |
 * | Ποια ξαναγίνεται ισχύουσα όταν αποσυρθεί η ισχύουσα; | `restoredOnWithdrawal` |
 * | Τη βλέπει αυτός ο θεατής; | `editionVisibleTo` |
 * | Ποιο είναι το ισχύον έντυπο ενός ραφιού γι' αυτόν; | `latestVisibleEdition` |
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

export const CATALOG_EDITION_REFUSALS = ['notReady', 'disposed', 'disposalDue', 'priced', 'noScreenFile'] as const;
export type CatalogEditionRefusal = (typeof CATALOG_EDITION_REFUSALS)[number];

export type CatalogEditionPublishability =
  | { readonly ok: true; readonly artifact: PublicationArtifact }
  | { readonly ok: false; readonly refusal: CatalogEditionRefusal };

type RunFacts = Pick<PublicationRunDefinition, 'status' | 'priced' | 'retention' | 'artifacts' | 'dispositionDueAt'>;

/**
 * Πόσο πριν από την προθεσμία διάθεσης παύει να δημοσιεύεται μια έκδοση. 🔒 Κλείνει τον αγώνα με τη σάρωση διατήρησης χωρίς νέο
 * πεδίο: η σάρωση πιάνει **μόνο** όσες έχουν `dispositionDueAt <= now`, άρα ό,τι δημοσιεύεται δεν βρίσκεται ποτέ στο ερώτημά
 * της. Το περιθώριο καλύπτει απόκλιση ρολογιών και τη διάρκεια ενός περάσματος.
 */
export const PUBLICATION_DISPOSAL_MARGIN_MS = 15 * 60 * 1000;

const disposalIsDue = (dueAt: string | null, nowISO: string): boolean =>
  dueAt !== null && Date.parse(dueAt) <= Date.parse(nowISO) + PUBLICATION_DISPOSAL_MARGIN_MS;

const EDITION_AUDIENCE_KINDS: ReadonlySet<string> = new Set(CATALOG_EDITION_AUDIENCE_KINDS);

/** Δέχεται έντυπο αυτό το κοινό τιμών; Ο φρουρός πάνω στον οποίο στενεύει το σχήμα zod (ένα σχήμα κοινού, όχι δεύτερο). */
export function isCatalogEditionAudience(audience: PriceAudience): audience is CatalogEditionAudience {
  return EDITION_AUDIENCE_KINDS.has(audience.kind);
}

/** Το κλειδί του κοινού, ίδιο με των τιμών και των εκδόσεων του εκδότη. */
export function editionAudienceKey(audience: CatalogEditionAudience): string {
  return audienceIdentity(audience);
}

/** Δημοσιεύεται; Μόνο έτοιμη, με αρχείο που δεν πρόκειται να σβηστεί, χωρίς τιμές (Θ4), και μόνο το PDF οθόνης. */
export function publishabilityOf(run: RunFacts, nowISO: string): CatalogEditionPublishability {
  if (run.status !== 'ready') return { ok: false, refusal: 'notReady' };
  if (run.retention.disposal !== null) return { ok: false, refusal: 'disposed' };
  if (disposalIsDue(run.dispositionDueAt, nowISO)) return { ok: false, refusal: 'disposalDue' };
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

/**
 * Ποια έκδοση **ξαναγίνεται ισχύουσα** όταν αποσύρεται η ισχύουσα: ο νεότερος προκάτοχος που αντικατέστησε (ίδιο ράφι, ίδιο
 * κοινό). Έτσι η απόσυρση μιας λανθασμένης νέας έκδοσης δεν αφήνει το κοινό χωρίς έντυπο, και ο σύνδεσμος του ραφιού δείχνει
 * πάλι την τελευταία δημόσια (πρότυπο «group URL» της Publitas). Αποσυρμένη που ήταν ήδη παλαιότερη ⇒ καμία επαναφορά.
 */
export function restoredOnWithdrawal<T extends EditionFacts & Pick<CatalogEditionDefinition, 'supersededBy' | 'publishedAt'> & { readonly id: string }>(
  predecessors: readonly T[],
  withdrawn: EditionFacts & { readonly id: string },
): T | null {
  if (withdrawn.status !== 'published') return null;
  const key = editionAudienceKey(withdrawn.audience);
  const candidates = predecessors.filter(
    (edition) => edition.status === 'superseded' && edition.supersededBy === withdrawn.id && edition.shelfKey === withdrawn.shelfKey && editionAudienceKey(edition.audience) === key,
  );
  return [...candidates].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] ?? null;
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

/** Πόσο ειδικό είναι ένα κοινό: ο θεατής παίρνει το έντυπο του πιο ειδικού κοινού που τον καλύπτει, όπως και την τιμή του. */
const AUDIENCE_SPECIFICITY: Readonly<Record<CatalogEditionAudience['kind'], number>> = { anonymous: 0, customerGroup: 1 };

/**
 * Το **ισχύον** έντυπο ενός ραφιού για αυτόν τον θεατή — ο στόχος του σταθερού συνδέσμου ραφιού (και του QR του εντύπου, Θ.4):
 * το πιο ειδικό κοινό που τον καλύπτει, και μέσα σε αυτό το νεότερο. `null` ⇒ τίποτα ορατό, ίδιο με το ανύπαρκτο.
 */
export function latestVisibleEdition<T extends Pick<CatalogEditionDefinition, 'audience' | 'status' | 'publishedAt'>>(
  shelf: readonly T[],
  viewer: PricingViewer,
): T | null {
  const current = shelf.filter((edition) => edition.status === 'published' && editionVisibleTo(edition, viewer));
  const rank = (edition: T) => AUDIENCE_SPECIFICITY[edition.audience.kind];
  return [...current].sort((a, b) => rank(b) - rank(a) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] ?? null;
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
