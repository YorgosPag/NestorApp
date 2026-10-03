/**
 * @fileoverview **«ΔΕΣ ΑΝ ΚΑΠΟΙΟΣ ΕΝΔΙΑΦΕΡΕΤΑΙ ΓΙΑ ΤΟ ΑΚΙΝΗΤΟ ΣΟΥ»** — η περιγραφή, το συμβόλαιο URL, η προβολή.
 * @related ADR-900 · lib/demand/demand-interest.ts (`discloseInterest`, ο ΕΝΑΣ κριτής) ·
 *   lib/demand/demand-aggregate.ts (`prospective-owner`) · app/api/demand/prospect-interest/route.ts
 * @module lib/demand/prospect-interest
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΜΗΧΑΝΗ — Η ΠΕΡΙΓΡΑΦΗ ΓΙΝΕΤΑΙ «ΑΚΙΝΗΤΟ ΧΩΡΙΣ ΔΙΑΘΕΣΗ» ΚΑΙ ΚΡΙΝΕΤΑΙ ΟΠΩΣ ΚΑΘΕ ΑΛΛΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο επισκέπτης δείχνει **κτίριο** και λέει **τι είναι** το ακίνητο (είδος · εμβαδόν · όροφος). Αυτό
 * είναι ακριβώς ένα ακίνητο ιδιοκτήτη που **δεν έχει δηλώσει διάθεση** — η στάση `dormant` του
 * `demand-interest.ts`, που υπάρχει ήδη, με τη δική της έντιμη εξήγηση («συγκρίναμε μόνο τι είναι
 * και πού βρίσκεται»). Άρα δεν γράφεται δεύτερος κριτής: η περιγραφή γίνεται {@link ProjectableProperty}
 * και περνά από **την ίδια** προβολή και **την ίδια** κρίση με το πάνελ του κατόχου.
 *
 * ⚠️ **Τίποτα δεν γράφεται.** Η προβολή είναι εφήμερη, στη μνήμη του διακομιστή — ίδιο συμβόλαιο
 * με το `place-interest.service.ts` (`projectListingShape`, ποτέ `buildPublicListing`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις· καμία Firestore, κανένα ρολόι.
 */

import { isCanonicalPropertyType, type PropertyTypeCanonical } from '@/constants/property-types';
import { isLandProperty } from '@/constants/property-classification';
import type { ProjectableProperty } from '@/services/listings/public-listing-projection-types';
import type { PlaceRef } from '@/types/geo/public-place';
import { INTEREST_CHECK_ROUTE } from '@/lib/demand/demand-routes';
import { typedHref } from '@/lib/workspace/route-worlds';
import type { FloorRef } from '@/lib/floor/floor-ref';
import { levelBoundKey, parseLevelBoundKey } from '@/lib/floor/floor-level-range';

// =============================================================================
// 1. Η ΠΕΡΙΓΡΑΦΗ
// =============================================================================

/** Τι λέει ο επισκέπτης για το ακίνητο. Ό,τι αφήνει κενό **δεν** γίνεται κριτήριο (`null`). */
export interface ProspectDescription {
  readonly type: PropertyTypeCanonical;
  /** Μικτό εμβαδόν σε m². */
  readonly areaSqm: number | null;
  /**
   * Η **στάθμη** — αριθμός **και** είδος (ADR-903 §9, 2β.3): η πυλωτή δεν είναι «ισόγειο», το ημιυπόγειο δεν
   * είναι «υπόγειο». `kind: null` = μόνο αριθμός (σύνδεσμος πριν την 2β.3) ⇒ το είδος συνάγεται.
   */
  readonly floor: FloorRef | null;
}

/** Το ερώτημα ολόκληρο: **ποιο** κτίριο, **τι** ακίνητο. */
export interface ProspectQuery {
  readonly ref: PlaceRef;
  readonly description: ProspectDescription;
}

/** Τα όρια που κάνουν μια τιμή **περιγραφή**, όχι θόρυβο. */
export const PROSPECT_LIMITS = {
  areaSqmMax: 100_000,
  floorMin: -5,
  floorMax: 200,
} as const;

/** Ο **ένας** κριτής εμβαδού — τον ρωτούν η φόρμα **και** ο parser της διαδρομής. */
function isProspectArea(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= PROSPECT_LIMITS.areaSqmMax;
}

/**
 * Ο **ένας** κριτής ορόφου — κλειδί στάθμης (`0:pilotis`) ή σκέτος ακέραιος (σύνδεσμος πριν την 2β.3), με αριθμό
 * μέσα στα όρια θορύβου. `undefined` = άκυρο· `null` = δεν δόθηκε.
 */
function prospectFloorOf(raw: string | null): FloorRef | null | undefined {
  if (raw === null || raw.trim() === '') return null;
  const level = parseLevelBoundKey(raw);
  if (level === null) return undefined;
  const inBounds = level.number >= PROSPECT_LIMITS.floorMin && level.number <= PROSPECT_LIMITS.floorMax;
  return inBounds ? level : undefined;
}

/** Ό,τι κρατά η φόρμα της σελίδας. `''` = δεν διάλεξε ακόμη είδος / στάθμη. */
export interface ProspectFormValues {
  readonly type: PropertyTypeCanonical | '';
  readonly areaSqm: number | null;
  /** Το κλειδί στάθμης του `DeclaredFloorSelectField` (ίδιο με τη δήλωση ιδιοκτήτη), `''` = δεν δόθηκε. */
  readonly floorLevel: string;
}

export const EMPTY_PROSPECT_FORM: ProspectFormValues = { type: '', areaSqm: null, floorLevel: '' };

/**
 * **Τόπος + φόρμα → ερώτημα**, ή `null` όσο λείπει κτίριο ή είδος (το κουμπί μένει ανενεργό).
 *
 * ⚠️ **Η γη δεν έχει όροφο** (ADR-777 §8.32) — ο όροφος πέφτει εδώ, στη μετάφραση, όπως στο
 * `ownerPropertyDraftFrom`: η φόρμα κρύβει το πεδίο, αλλά η τιμή επιβιώνει στη μνήμη της.
 */
export function prospectQueryFrom(ref: PlaceRef | null, values: ProspectFormValues): ProspectQuery | null {
  if (ref === null || values.type === '') return null;
  if (values.areaSqm !== null && !isProspectArea(values.areaSqm)) return null;
  const floor = isLandProperty(values.type) ? null : prospectFloorOf(values.floorLevel);
  if (floor === undefined) return null;
  return { ref, description: { type: values.type, areaSqm: values.areaSqm, floor } };
}

// =============================================================================
// 2. ΤΟ ΣΥΜΒΟΛΑΙΟ URL — γραμμένο ΜΙΑ φορά, για τον πελάτη ΚΑΙ τη διαδρομή
// =============================================================================

/** Η διαδρομή του API. */
export const PROSPECT_INTEREST_API = '/api/demand/prospect-interest' as const;

/** Τα ονόματα των παραμέτρων. Δύο αντίγραφα (hook + route) θα απέκλιναν στην πρώτη μετονομασία. */
const PARAM = {
  landId: 'landId',
  buildingId: 'buildingId',
  type: 'type',
  areaSqm: 'areaSqm',
  floor: 'floor',
  /**
   * Η διεύθυνση που έγραψε ο άνθρωπος **σε άλλη πόρτα** (αρχική) — ταξιδεύει ως **κείμενο**, ποτέ ως
   * σημείο: ο γεωκωδικοποιητής τρέχει στη σελίδα, όπου ο άνθρωπος βλέπει **τι** βρέθηκε. Δεν είναι μέρος
   * του {@link ProspectQuery} — το API κρίνει **κτίριο**, όχι κείμενο.
   */
  address: 'address',
} as const;

/** Το όνομα της παραμέτρου διεύθυνσης — το χρειάζεται το `name=` της φόρμας GET (λειτουργεί και χωρίς JS). */
export const PROSPECT_ADDRESS_PARAM = PARAM.address;

/** Πάνω από αυτό δεν είναι διεύθυνση, είναι φορτίο (ίδιο σκεπτικό με το `MAX_RETURN_PATH_LENGTH`). */
export const PROSPECT_ADDRESS_MAX_LENGTH = 200;

/** **Κείμενο → διεύθυνση**, ή `null` αν είναι κενό. Ο **ένας** κριτής για τον σύνδεσμο **και** τη σελίδα. */
function normalizedAddress(raw: string | null | undefined): string | null {
  const address = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, PROSPECT_ADDRESS_MAX_LENGTH);
  return address === '' ? null : address;
}

/** **URL → διεύθυνση** για την αρχική τιμή του πεδίου, ή `null`. */
export function prospectAddressOf(params: URLSearchParams): string | null {
  return normalizedAddress(params.get(PARAM.address));
}

/**
 * **Η πόρτα προς τον έλεγχο ενδιαφέροντος**, με ή χωρίς διεύθυνση. Τη ζητούν η αρχική και ο κατάλογος
 * ακινήτων — ποτέ χειρόγραφο `?address=`.
 */
export function interestCheckHref(address?: string | null) {
  const value = normalizedAddress(address);
  if (value === null) return typedHref(INTEREST_CHECK_ROUTE);
  return typedHref(`${INTEREST_CHECK_ROUTE}?${new URLSearchParams({ [PARAM.address]: value }).toString()}`);
}

/**
 * **Ερώτημα → παράμετροι.** Ό,τι είναι `null` **λείπει** — δεν γράφεται ως «null». Τις διαβάζει ο
 * {@link parseProspectQuery}, είτε στη διαδρομή του API είτε στο `/offers/new` (προσυμπλήρωση).
 */
export function prospectQueryParams(query: ProspectQuery): URLSearchParams {
  const params = new URLSearchParams({ [PARAM.landId]: query.ref.landId, [PARAM.type]: query.description.type });
  if (query.ref.buildingId !== null) params.set(PARAM.buildingId, query.ref.buildingId);
  if (query.description.areaSqm !== null) params.set(PARAM.areaSqm, String(query.description.areaSqm));
  // ADR-903 §9 — το κλειδί στάθμης (`0:pilotis`)· στάθμη χωρίς είδος γράφεται σκέτος ακέραιος, όπως πριν.
  const floor = query.description.floor;
  if (floor !== null && floor.number !== null) {
    params.set(PARAM.floor, levelBoundKey({ number: floor.number, kind: floor.kind }));
  }
  return params;
}

/** **Ερώτημα → URL του API.** */
export function prospectInterestUrl(query: ProspectQuery): string {
  return `${PROSPECT_INTEREST_API}?${prospectQueryParams(query).toString()}`;
}

/** Γιατί απορρίφθηκε ένα ερώτημα. Κλειστό σύνολο. */
export const PROSPECT_QUERY_DEFECTS = ['missing-land', 'bad-type', 'bad-area', 'bad-floor'] as const;

export type ProspectQueryDefect = (typeof PROSPECT_QUERY_DEFECTS)[number];

export type ProspectQueryParse =
  | { readonly kind: 'ok'; readonly query: ProspectQuery }
  | { readonly kind: 'invalid'; readonly defect: ProspectQueryDefect };

/** Αριθμός ή `null` αν λείπει· `undefined` αν υπάρχει αλλά **δεν** είναι αριθμός. */
function optionalNumber(raw: string | null): number | null | undefined {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function areaOf(raw: string | null): number | null | undefined {
  const value = optionalNumber(raw);
  if (value === null || value === undefined) return value;
  return isProspectArea(value) ? value : undefined;
}

/**
 * **URL → ερώτημα**, ή ο **πρώτος** ονομασμένος λόγος απόρριψης.
 *
 * ⚠️ Οι ταυτότητες τόπου ελέγχονται εδώ **μόνο** για παρουσία· το «είναι τόπος και υπάρχει;» το
 * απαντά ο **ένας** κριτής του διακομιστή (`verifyPlaceRef`), ποτέ δεύτερο regex.
 */
export function parseProspectQuery(params: URLSearchParams): ProspectQueryParse {
  const landId = params.get(PARAM.landId)?.trim() ?? '';
  if (landId === '') return { kind: 'invalid', defect: 'missing-land' };

  const type = params.get(PARAM.type);
  if (!isCanonicalPropertyType(type)) return { kind: 'invalid', defect: 'bad-type' };

  const areaSqm = areaOf(params.get(PARAM.areaSqm));
  if (areaSqm === undefined) return { kind: 'invalid', defect: 'bad-area' };

  const floor = prospectFloorOf(params.get(PARAM.floor));
  if (floor === undefined) return { kind: 'invalid', defect: 'bad-floor' };

  const buildingId = params.get(PARAM.buildingId)?.trim() || null;
  return { kind: 'ok', query: { ref: { landId, buildingId }, description: { type, areaSqm, floor } } };
}

// =============================================================================
// 3. Η ΠΡΟΒΟΛΗ — περιγραφή → «ακίνητο χωρίς διάθεση»
// =============================================================================

/** Η ταυτότητα της εφήμερης προβολής. Δεν γράφεται πουθενά — υπάρχει επειδή το σχήμα τη ζητά. */
export const PROSPECT_LISTING_ID = 'prospect';

/**
 * **Περιγραφή → ακίνητο που ΔΕΝ διατίθεται.**
 *
 * 🔑 Καμία διάθεση, καμία τιμή ⇒ η στάση βγαίνει `dormant` από τον **υπάρχοντα** κριτή
 * (`stanceOfListing`), και η κρίση συγχωρεί **ονομαστικά** είδος συμφωνίας και τιμή. Ποτέ
 * εφευρημένη διάθεση «για να ταιριάξει κάτι»: θα έλεγε σε κάποιον ότι τον ζητούν αγοραστές για
 * ακίνητο που δεν πουλά — ο ισχυρισμός θα ήταν ψευδής, και θα φαινόταν γενναιόδωρος.
 */
export function prospectProjectable(description: ProspectDescription): ProjectableProperty {
  return {
    id: PROSPECT_LISTING_ID,
    type: description.type,
    commercialStatus: 'unavailable',
    offerKinds: [],
    commercial: null,
    areas: { gross: description.areaSqm },
    // ADR-903 §8.1 — το ίδιο ζεύγος με κάθε προβολή (πυλωτή ≠ ισόγειο στην κρίση).
    floor: description.floor?.number ?? null,
    floorKind: description.floor?.kind ?? null,
  };
}
