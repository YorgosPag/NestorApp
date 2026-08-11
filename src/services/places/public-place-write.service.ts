/**
 * @fileoverview **Η ΜΟΝΗ ΠΟΡΤΑ ΓΡΑΦΗΣ ΤΟΥ ΕΠΙΠΕΔΟΥ Α** — ταυτότητα κατ' απαίτηση.
 * @related ADR-777 · SPEC-777A §13.2 · §13.5 · §14.3 · §14.4 · §14.5 · CLAUDE.md N.6
 * @module services/places/public-place-write.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΚΑΜΙΑ ΑΛΛΗ ΠΟΡΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `firestore.rules` δίνει στις δύο συλλογές `read: if true` · `write: if false` —
 * **για κάθε** πελάτη, χωρίς εξαίρεση. Δεν είναι αυστηρότητα: το §14.4 ανοίγει με τη
 * διαφορά που τα αλλάζει όλα — *«Μέχρι σήμερα ένα λάθος έγραφε σε **έναν** πελάτη. Το
 * επίπεδο Α το βλέπουν **ΟΛΟΙ**»* — και προσθέτει ότι *«μια κακόβουλη εγγραφή γίνεται
 * φορέας επίθεσης προς **κάθε** πελάτη μαζί»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 «ΤΑΥΤΟΤΗΤΑ ΚΑΤ' ΑΠΑΙΤΗΣΗ» — ΚΑΙ ΕΙΝΑΙ ΤΑΥΤΟΧΡΟΝΑ Η ΝΟΜΙΚΗ ΑΜΥΝΑ (§13.4)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε κλήση εδώ αντιστοιχεί σε **μία ανθρώπινη χειρονομία**. Η Ελλάδα έχει
 * εκατομμύρια κτίρια στο OSM και **δεν κατεβαίνει κανένα** μέχρι να το ζητήσει
 * άνθρωπος — που είναι **ακριβώς το αντίθετο** του *«systematic attempt to aggregate
 * all or substantially all Primary Features»* που ενεργοποιεί το share-alike.
 *
 * ⛔ **ΜΗΝ προσθέσεις εδώ μαζική εισαγωγή, προθέρμανση ή εργασία παρασκηνίου** που
 * γεννά ταυτότητες χωρίς αίτημα. Δεν είναι θέμα κόστους — είναι το όριο της άδειας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΚΑΜΙΑ ΤΑΥΤΟΤΗΤΑ ΧΡΗΣΤΗ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πειρασμός ήταν ένα `proposedBy: uid` για έλεγχο. **Απαγορεύεται**: η συλλογή είναι
 * `read: if true`, δηλαδή **κάθε ανώνυμος επισκέπτης** θα διάβαζε ποιος πρότεινε τι.
 * Το §14.4 κανόνας 4 («καμία διαδρομή από το Α προς το Β») και το §21.6 (προσωπικά
 * δεδομένα **αυστηρά** στο Β) το κλείνουν. Ο έλεγχος ζει στα ίχνη του διακομιστή.
 *
 * *(Και γι' αυτό οι δύο συλλογές **δεν** είναι στο `TRACKED_COLLECTION_KEYS` του CHECK
 * 3.17 — επαληθεύτηκε: το `EntityAuditService` γράφει **ταυτότητα δράστη**.)*
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PlaceClaimDefect } from '@/lib/places/place-claim-validation';
import type { PlaceResolveRequest, PlaceTarget } from '@/lib/places/place-claim';
import {
  mergeIntoBuilding,
  mergeIntoLand,
  newPublicBuilding,
  newPublicLand,
  type PlaceMergeField,
  type ResolvedPlaceFacts,
} from '@/lib/places/place-facts';
import { createModuleLogger } from '@/lib/telemetry';
import {
  generatePublicBuildingId,
  generatePublicLandId,
} from '@/services/enterprise-id-convenience';
import type { PlaceRef, PublicBuilding, PublicLand } from '@/types/geo/public-place';
import {
  verifyPlaceClaim,
  type PlaceSourceOutcome,
  type PlaceSourceRejection,
} from './place-source-verification';
import {
  findBuildingByOsmRef,
  findLandByOsmRef,
  findLandContaining,
} from './public-place-lookup';

const logger = createModuleLogger('public-place-write.service');

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ — έξι καταστάσεις, καμία σιωπηλή
// =============================================================================

/** Γιατί δεν μπορέσαμε να **απαντήσουμε** (ποτέ «δεν υπάρχει»). */
export const PLACE_UNAVAILABLE_REASONS = [
  /** Η **πηγή** δεν απάντησε — Overpass ή geocoder. */
  'source',
  /**
   * 🔴 Δεν μπορέσαμε να **αποκλείσουμε διπλότυπο**.
   *
   * Προτιμάται η ρητή άρνηση από τη σιωπηλή γέννηση δεύτερης ταυτότητας: δύο
   * ταυτότητες για ένα φυσικό κτίριο είναι **ακριβώς** η ασθένεια που το επίπεδο Α
   * υπάρχει για να θεραπεύσει (§14.5 · ADR-749). Ο άνθρωπος ξαναδοκιμάζει· ένα
   * διπλότυπο δεν ξαναδοκιμάζεται.
   */
  'duplicate-check',
] as const;

export type PlaceUnavailableReason = (typeof PLACE_UNAVAILABLE_REASONS)[number];

export type PlaceResolution =
  | {
      readonly kind: 'resolved';
      readonly ref: PlaceRef;
      /** `false` = **επαναχρησιμοποιήθηκε** υπάρχουσα ταυτότητα (idempotent). */
      readonly created: boolean;
      /** Ποια πεδία **νίκησαν** κατά τον κανόνα του §14.3. Κενό = τίποτα, και είναι σωστό. */
      readonly merged: readonly PlaceMergeField[];
    }
  /** Υπάρχει ήδη τόπος που **περιέχει** αυτό το σημείο. Ο **άνθρωπος** αποφασίζει. */
  | { readonly kind: 'duplicate-candidate'; readonly existing: PlaceRef; readonly displayAddress: string | null }
  | { readonly kind: 'malformed'; readonly defect: PlaceClaimDefect }
  | { readonly kind: 'rejected'; readonly reason: PlaceSourceRejection }
  | { readonly kind: 'unavailable'; readonly reason: PlaceUnavailableReason }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * **Άρνηση της πηγής → άρνηση της πράξης.** Μία μετάφραση, δύο είσοδοι.
 *
 * 🔴 **Εξήχθη επειδή το CHECK 3.28 το ζήτησε, μέσα στο ίδιο commit** — και οι δύο
 * διαδρομές ({@link resolvePlace} · {@link attestPlace}) έκαναν την **ίδια** τριάδα
 * ελέγχων. Ο κλώνος δεν ήταν στιλιστικός: μια **τέταρτη** κατάσταση επαλήθευσης θα
 * μαθευόταν από τη μία και θα έλειπε από την άλλη.
 *
 * ⚠️ Καμία περίπτωση `default` — νέα κατάσταση **δεν μεταγλωττίζεται** μέχρι κάποιος
 * να αποφασίσει τι σημαίνει για τη γραφή.
 */
function refusalOf(
  verified: Exclude<PlaceSourceOutcome, { readonly kind: 'verified' }>,
): PlaceResolution {
  switch (verified.kind) {
    case 'malformed':
      return { kind: 'malformed', defect: verified.defect };
    case 'rejected':
      return { kind: 'rejected', reason: verified.reason };
    case 'unavailable':
      return { kind: 'unavailable', reason: 'source' };
  }
}

// =============================================================================
// 2. ΓΕΝΝΗΣΗ — γη και κτίριο σε **ΜΙΑ** ατομική πράξη
// =============================================================================

/**
 * Γράφει τη γη και (προαιρετικά) το κτίριό της **μαζί**.
 *
 * 🔴 **Δέσμη, όχι δύο εγγραφές.** Το `PublicBuilding.landId` είναι **υποχρεωτικό** και
 * η θέση διαβάζεται **από τη γη** (Α1). Ένα κτίριο που προσγειώθηκε χωρίς τη γη του
 * είναι ξένο κλειδί που δείχνει στο πουθενά — **για όλους**, και χωρίς κανέναν να το
 * έχει ζητήσει. Το ενδιάμεσο παράθυρο δεν κλείνει με «θα το θυμηθεί ο καλών».
 *
 * ⚠️ **`create()` και όχι `set()`** (N.6): οι ταυτότητες είναι φρέσκες από το
 * `enterprise-id.service`, οπότε μια σύγκρουση θα σήμαινε **σφάλμα**, όχι ενημέρωση —
 * και το `create()` το κάνει ορατό αντί να το σκεπάσει.
 */
async function bornTogether(
  adminDb: AdminFirestore,
  land: PublicLand,
  building: PublicBuilding | null,
): Promise<void> {
  const batch = adminDb.batch();
  batch.create(adminDb.collection(COLLECTIONS.PUBLIC_LANDS).doc(land.id), land);
  if (building !== null) {
    batch.create(adminDb.collection(COLLECTIONS.PUBLIC_BUILDINGS).doc(building.id), building);
  }
  await batch.commit();
}

function createFresh(
  facts: ResolvedPlaceFacts,
  target: PlaceTarget,
  at: string,
): { readonly land: PublicLand; readonly building: PublicBuilding | null } {
  const land = newPublicLand(generatePublicLandId(), facts, at);
  const building =
    target === 'building' ? newPublicBuilding(generatePublicBuildingId(), land.id, facts, at) : null;
  return { land, building };
}

const refOf = (land: PublicLand, building: PublicBuilding | null): PlaceRef => ({
  landId: land.id,
  buildingId: building?.id ?? null,
});

// =============================================================================
// 3. ΕΠΑΝΑΧΡΗΣΗ ΜΕΣΩ ΦΥΣΙΚΟΥ ΚΛΕΙΔΙΟΥ OSM — η idempotency
// =============================================================================

/**
 * Το ίδιο στοιχείο OSM, ξαναζητημένο: **ίδια ταυτότητα**, και ο κανόνας του §14.3
 * εφαρμοσμένος σε ό,τι έμαθε στο μεταξύ το OSM.
 *
 * 🔑 **Η επαναχρήση ΔΕΝ είναι «μη κάνεις τίποτα».** Το Overpass μόλις ξαναρωτήθηκε,
 * άρα μπορεί να ξέρει **περισσότερα** (κάποιος εθελοντής πρόσθεσε `building:levels`).
 * Το πέρασμα από τον κανόνα είναι ακίνδυνο εξ ορισμού: `osm` **δεν ξεπερνά** `osm`
 * (ισοβαθμία ⇒ όχι), οπότε αλλάζει **μόνο** ό,τι λείπει ή ό,τι έρχεται από
 * ισχυρότερη πηγή.
 */
async function reuseOsmIdentity(
  adminDb: AdminFirestore,
  facts: ResolvedPlaceFacts,
  target: PlaceTarget,
  at: string,
): Promise<PlaceResolution | null> {
  const ref = facts.osmRef;
  if (ref === null) return null;

  const existingBuilding =
    target === 'building'
      ? await findBuildingByOsmRef(adminDb, ref.elementType, ref.elementId)
      : null;
  const existingLand = await findLandByOsmRef(adminDb, ref.elementType, ref.elementId);

  if (existingLand === null) return null;

  const merged: PlaceMergeField[] = [];
  const landMerge = mergeIntoLand(existingLand, facts, at);
  const writes: Promise<unknown>[] = [];

  if (landMerge.changed.length > 0) {
    merged.push(...landMerge.changed);
    writes.push(
      adminDb.collection(COLLECTIONS.PUBLIC_LANDS).doc(existingLand.id).set(landMerge.land),
    );
  }

  // Η γη υπάρχει αλλά το κτίριο **δεν** — ο πρώτος ζήτησε οικόπεδο, ο δεύτερος κτίριο.
  let building = existingBuilding;
  if (target === 'building' && building === null) {
    building = newPublicBuilding(generatePublicBuildingId(), existingLand.id, facts, at);
    writes.push(
      adminDb.collection(COLLECTIONS.PUBLIC_BUILDINGS).doc(building.id).create(building),
    );
  } else if (building !== null) {
    const buildingMerge = mergeIntoBuilding(building, facts, at);
    if (buildingMerge.changed.length > 0) {
      merged.push(...buildingMerge.changed);
      writes.push(
        adminDb.collection(COLLECTIONS.PUBLIC_BUILDINGS).doc(building.id).set(buildingMerge.building),
      );
    }
  }

  await Promise.all(writes);
  return {
    kind: 'resolved',
    ref: { landId: existingLand.id, buildingId: building?.id ?? null },
    created: false,
    merged,
  };
}

// =============================================================================
// 4. Η ΠΡΑΞΗ ΤΟΥ ΕΝΤΟΠΙΣΜΟΥ
// =============================================================================

/**
 * **Χειρονομία ανθρώπου → ταυτότητα τόπου.** Η μία διαδρομή.
 *
 * @param distinctFromNearby ο άνθρωπος **είδε** τον υπάρχοντα τόπο και δήλωσε ότι ο
 *   δικός του είναι **άλλος**. Χωρίς αυτό, μια χειρονομία που πέφτει μέσα σε γνωστό
 *   περίγραμμα γυρίζει `duplicate-candidate` — δηλαδή **ερώτηση**, ποτέ απόφαση (§13.3).
 * @param at ISO στιγμή — **παράμετρος**, ποτέ ανάγνωση ρολογιού (CHECK 3.7)
 */
export async function resolvePlace(
  adminDb: AdminFirestore,
  request: PlaceResolveRequest & { readonly distinctFromNearby?: boolean },
  at: string,
): Promise<PlaceResolution> {
  const verified = await verifyPlaceClaim(request.claim, at);
  if (verified.kind !== 'verified') return refusalOf(verified);

  const facts = verified.facts;

  try {
    // ── (α) Φυσικό κλειδί: το ίδιο στοιχείο OSM ⇒ η ίδια ταυτότητα ────────────
    const reused = await reuseOsmIdentity(adminDb, facts, request.target, at);
    if (reused !== null) return reused;

    // ── (β) Χωρίς φυσικό κλειδί: ΡΩΤΑΜΕ με περιεκτικότητα, δεν αποφασίζουμε ──
    if (facts.osmRef === null && request.distinctFromNearby !== true) {
      const containing = await findLandContaining(adminDb, facts.point);

      if (containing.kind === 'indeterminate') {
        logger.warn('Ο έλεγχος διπλότυπου δεν ολοκληρώθηκε — άρνηση αντί για σιωπηλή γέννηση');
        return { kind: 'unavailable', reason: 'duplicate-check' };
      }
      if (containing.kind === 'found') {
        return {
          kind: 'duplicate-candidate',
          existing: { landId: containing.land.id, buildingId: null },
          displayAddress: containing.land.displayAddress,
        };
      }
    }

    // ── (γ) Νέα ταυτότητα ────────────────────────────────────────────────────
    const { land, building } = createFresh(facts, request.target, at);
    await bornTogether(adminDb, land, building);

    return { kind: 'resolved', ref: refOf(land, building), created: true, merged: [] };
  } catch (error) {
    return failure('Ο τόπος δεν αποθηκεύτηκε', error);
  }
}

// =============================================================================
// 5. Η ΣΥΓΧΩΝΕΥΣΗ ΩΣ ΠΡΑΞΗ — §14.3, «ο χρήστης ΠΡΟΤΕΙΝΕΙ»
// =============================================================================

/**
 * **Νέα γνώση για τόπο που ήδη ξέρουμε.**
 *
 * 🔑 **Αυτή είναι η «πράξη» που το SPEC-777A §13.7 κατέγραφε ως «ο κανόνας γράφτηκε,
 * η πράξη όχι».** Ο άνθρωπος δεν **αλλάζει** το κοινό — **προτείνει**, και η πρόταση
 * ανεβαίνει *«**μόνο** αν επαληθευτεί από ισχυρότερη πηγή»*. Η επαλήθευση **είναι** ο
 * κανόνας κατάταξης: ένα σχεδιασμένο περίγραμμα (`drawn`) δεν σβήνει ποτέ ένα
 * μετρημένο τοπογραφικό (`survey`), ούτε καν ένα `osm`.
 *
 * ⚠️ **Ισοβαθμία ⇒ καμία αλλαγή, και επιστρέφεται ως ΕΠΙΤΥΧΙΑ με κενό `merged`.** Δύο
 * πηγές ίδιας βαθμίδας που διαφωνούν είναι σύγκρουση προς επίλυση από άνθρωπο, όχι
 * «το τελευταίο νικά» — που σε **κοινό** επίπεδο σημαίνει ότι ο τελευταίος που πάτησε
 * αποθήκευση ξαναγράφει την πραγματικότητα για όλους (§14.4).
 */
export async function attestPlace(
  adminDb: AdminFirestore,
  target: PlaceRef,
  claim: PlaceResolveRequest['claim'],
  at: string,
): Promise<PlaceResolution> {
  const verified = await verifyPlaceClaim(claim, at);
  if (verified.kind !== 'verified') return refusalOf(verified);

  try {
    const landRef = adminDb.collection(COLLECTIONS.PUBLIC_LANDS).doc(target.landId);
    const landDoc = await landRef.get();
    const land = landDoc.data() as PublicLand | undefined;
    if (land === undefined) return { kind: 'failed', message: 'NO_SUCH_LAND' };

    const merged: PlaceMergeField[] = [];
    const landMerge = mergeIntoLand(land, verified.facts, at);
    if (landMerge.changed.length > 0) {
      merged.push(...landMerge.changed);
      await landRef.set(landMerge.land);
    }

    if (target.buildingId !== null) {
      const buildingRef = adminDb
        .collection(COLLECTIONS.PUBLIC_BUILDINGS)
        .doc(target.buildingId);
      const building = (await buildingRef.get()).data() as PublicBuilding | undefined;
      if (building !== undefined) {
        const buildingMerge = mergeIntoBuilding(building, verified.facts, at);
        if (buildingMerge.changed.length > 0) {
          merged.push(...buildingMerge.changed);
          await buildingRef.set(buildingMerge.building);
        }
      }
    }

    return { kind: 'resolved', ref: target, created: false, merged };
  } catch (error) {
    return failure('Η πρόταση για τον τόπο δεν αποθηκεύτηκε', error);
  }
}

// =============================================================================
// 6. ΑΣΤΟΧΙΑ — μία διατύπωση
// =============================================================================

function failure(what: string, error: unknown): { readonly kind: 'failed'; readonly message: string } {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(what, { error: message });
  return { kind: 'failed', message };
}
