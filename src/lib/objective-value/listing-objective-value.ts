/**
 * @fileoverview **Η αντικειμενική αξία μιας δημόσιας αγγελίας** — αντιστοίχιση των πεδίων της αγγελίας στην είσοδο
 * της μηχανής, με **δηλωμένες** υποθέσεις (ADR-898 Φ3).
 * @related `services/market/listing-market-context.service.ts` (ο καλών: υπολογισμός **στον server κατά την ανάγνωση**,
 *   ADR-889 §10.2 — οι τιμές ζωνών αναθεωρούνται, άρα ποτέ αποθήκευση) · `objective-value-bounds.ts` (ποσό ή όρια) ·
 *   `objective-value-prefill.ts` (ο υπολογιστής ανοίγει συμπληρωμένος)
 * @module lib/objective-value/listing-objective-value
 *
 * 🔑 **ΜΙΑ πηγή ανά είσοδο** (ADR-898 §3 · Φ3):
 *
 * | Είσοδος | Πηγή στην αγγελία | Σημείωση |
 * |---|---|---|
 * | έντυπο | `type` → {@link OBJECTIVE_VALUE_FORM_OF_TYPE} | ολικός πίνακας: νέο είδος ⇒ ο μεταγλωττιστής ρωτά |
 * | όροφος · επιφάνεια | `floor` · `areaSqm` (μικτό) · πολυεπίπεδο: `levelAreas` | ένα επίπεδο ανά όροφο (ΠΟΛ.1149/1994 άρθ. 3 §6.β)· χωρίς βάση ⇒ «τι λείπει», ποτέ κατανομή του συνόλου |
 * | θέρμανση | `heatingType` → {@link CENTRAL_HEATING_OF} · αλλιώς **δήλωση** | άρθ. 3 §11: **εγκατάσταση** καλοριφέρ/θερμοσυσσωρευτών/δαπέδου |
 * | ανελκυστήρας | `amenities ∋ 'elevator'` · αλλιώς **δήλωση** | τρεις καταστάσεις: `null` = δεν ρωτήθηκε ⇒ ανοιχτό |
 * | παλαιότητα | **δήλωση** ημερομηνίας άδειας · αλλιώς `constructionYear` | το έτος είναι **προσέγγιση** — δηλωμένη υπόθεση |
 * | μικτά με κοινόχρηστους | **δήλωση** · αλλιώς «όχι» | η κανονική περίπτωση του νόμου — δηλωμένη υπόθεση |
 * | πρόσοψη | `frontage` (ορατό χαρακτηριστικό, δήλωση) | αναπάντητη ⇒ **όρια**, ποτέ μαντεψιά |
 * | μέτωπο | **δήλωση** `zoneFront` → `declaredZonePriceCandidates` | αναπάντητο ή δρόμος εκτός μετώπων ⇒ **όρια** |
 *
 * 🔑 **Ιεραρχία (ADR-898 Φ3β): γενικό χαρακτηριστικό > δήλωση αγγελιοδότη > προσέγγιση/ανοιχτό.** Η δήλωση καλύπτει
 * μόνο το κενό — καμία δεύτερη αλήθεια. Και η **απόκρυψη** κρίνεται **πρώτη**: κρυμμένη ⇒ κανένας υπολογισμός.
 *
 * ⚠️ **Ο ανελκυστήρας από το `amenities`, και όχι από το `building.hasElevator` / `BUILDING_FEATURES.elevator`**: είναι
 * το **μόνο** από τα τρία που φτάνει ήδη στη δημόσια αγγελία, και το **μόνο** με τρίτη κατάσταση «δεν ρωτήθηκε» — που
 * η μηχανή χρειάζεται (`null` = άγνωστο, ποτέ «όχι»).
 */

import { AmenityCode, type HeatingType } from '@/constants/property-features-enterprise';
import { valueZonePointOf, type ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { AttributeProvenance } from '@/lib/property/attribute-provenance';
import type { PublicListing } from '@/types/public-listing';

import { objectiveValueBounds, type ObjectiveValueBounds } from './objective-value-bounds';
import {
  OBJECTIVE_VALUE_DECLARED_FIELDS,
  type ListingObjectiveValueDeclared,
  type ObjectiveValueDeclaredField,
} from './objective-value-declarations';
import { INITIAL_DRAFT, type LevelDraft, type ObjectiveValueDraft } from './objective-value-draft';
import type { ObjectiveValuePrefill } from './objective-value-prefill';
import { OBJECTIVE_VALUE_FORM_OF_TYPE, objectiveValueFormOf } from './objective-value-form-of-type';
import type { ObjectiveValueForm } from './objective-value-types';
import { declaredZonePriceCandidates, streetFrontPrices } from './objective-value-zone';

/** Επανεξαγωγή: ο πίνακας ζει χωριστά, ώστε η προβολή να μη φέρνει τη μηχανή (ADR-898 Φ3β). */
export { OBJECTIVE_VALUE_FORM_OF_TYPE };

/**
 * **Θέρμανση → «εγκατάσταση κεντρικής θέρμανσης»** (άρθ. 3 §11: «καλοριφέρ, θερμοσυσσωρευτές, θέρμανση δαπέδου»).
 * Ο νόμος κρίνει την **εγκατάσταση**, όχι ποιος έχει τον λέβητα ⇒ η αυτόνομη μετρά. Η αντλία θερμότητας μπορεί να
 * είναι αέρα-νερού (καλοριφέρ/δάπεδο) **ή** split· τα ηλιακά δεν λένε τι ζεσταίνουν ⇒ `null` (ανοιχτό, μπαίνει στα όρια).
 */
export const CENTRAL_HEATING_OF: Readonly<Record<HeatingType, boolean | null>> = {
  central: true,
  autonomous: true,
  'heat-pump': null,
  solar: null,
  none: false,
};

/**
 * **Έτος κατασκευής → ημερομηνία άδειας (προσέγγιση).** Ο νόμος μετρά την παλαιότητα από την άδεια + 2 έτη
 * (άρθ. 2 §20)· το ίδιο διάστημα τεκμαίρει εδώ την άδεια **πριν** την κατασκευή, στο μέσο του έτους.
 */
const PERMIT_BEFORE_CONSTRUCTION_YEARS = 2;
const MID_YEAR = '07-01';

export type ListingObjectiveValueAssumption =
  | { readonly kind: 'ageFromConstructionYear'; readonly year: number; readonly provenance: AttributeProvenance }
  /** Το μικτό εμβαδόν λογίστηκε **χωρίς** κοινόχρηστους (άρθ. 2 §17 — η κανονική περίπτωση· ADR-898 §8). */
  | { readonly kind: 'areaWithoutCommon' }
  /** Ό,τι μπήκε στον υπολογισμό **από δήλωση του αγγελιοδότη** (ADR-898 Φ3β) — η προέλευση φαίνεται. */
  | { readonly kind: 'declaredByLister'; readonly fields: readonly ObjectiveValueDeclaredField[] };

export type ListingObjectiveValue =
  /** Ο αγγελιοδότης επέλεξε απόκρυψη (ADR-898 Φ3β · πρότυπο NAR IDX): **κανένας** υπολογισμός, κανένα ποσό. */
  | { readonly kind: 'hidden' }
  /** Είδος εκτός εντύπων 1/4/5. (Το πολυεπίπεδο **δεν** είναι πια `unsupported` — ADR-898 Φ3β-3β.) */
  | { readonly kind: 'unsupported'; readonly reason: 'type' }
  /** Η θέση δεν έδωσε ζώνη — το λέει ήδη η ενότητα της ζώνης. */
  | { readonly kind: 'no-zone' }
  | {
      readonly kind: 'evaluated';
      readonly bounds: ObjectiveValueBounds;
      /** Από πού ήρθαν τα επίπεδα — `missing` ⇒ η ενότητα εξηγεί γιατί λείπουν όροφος και επιφάνεια. */
      readonly levelBasis: ListingLevelBasis;
      readonly assumptions: readonly ListingObjectiveValueAssumption[];
      readonly prefill: ObjectiveValuePrefill;
    };

/**
 * **Από πού ήρθαν τα επίπεδα του προχείρου** (ADR-898 Φ3β-3β): `single` = όροφος + μικτό της αγγελίας · `perLevel` =
 * `levelAreas` · `missing` = πολυεπίπεδη χωρίς (συνεπή) βάση ανά όροφο — το πρόχειρο έχει κενά επίπεδα και η μηχανή
 * λέει «τι λείπει». Το UI το χρειάζεται για να εξηγήσει **γιατί** λείπουν όροφος και επιφάνεια.
 */
export type ListingLevelBasis =
  | { readonly kind: 'single' }
  | { readonly kind: 'perLevel' }
  | { readonly kind: 'missing'; readonly count: number };

/** Το πρόχειρο της μηχανής **και** ποιες δηλώσεις μπήκαν πράγματι σε αυτό (όχι όσες νίκησε ένα χαρακτηριστικό). */
export interface ListingObjectiveValueResolution {
  readonly draft: ObjectiveValueDraft;
  readonly levelBasis: ListingLevelBasis;
  readonly used: readonly ObjectiveValueDeclaredField[];
  /** Το έτος κατασκευής που έγινε άδεια με προσέγγιση — `null` όταν η άδεια δηλώθηκε ή δεν υπάρχει. */
  readonly approximatedFrom: PublicListing['constructionYear'];
}

function hasElevatorOf(listing: PublicListing): boolean | null {
  return listing.amenities === null ? null : listing.amenities.includes(AmenityCode.ELEVATOR);
}

/** Χαρακτηριστικό > δήλωση > ανοιχτό· καταγράφει τη δήλωση **μόνο** όταν χρησιμοποιήθηκε. */
function preferAttribute<T>(
  attribute: T | null,
  declared: T | null,
  field: ObjectiveValueDeclaredField,
  used: ObjectiveValueDeclaredField[],
): T | null {
  if (attribute !== null) return attribute;
  if (declared !== null) used.push(field);
  return declared;
}

function permitOf(listing: PublicListing, declared: ListingObjectiveValueDeclared, used: ObjectiveValueDeclaredField[]) {
  if (declared.permitDate !== null) {
    used.push('permitDate');
    return { permitDate: declared.permitDate, approximatedFrom: null };
  }
  const year = listing.constructionYear;
  if (year === null) return { permitDate: null, approximatedFrom: null };
  return { permitDate: `${year.value - PERMIT_BEFORE_CONSTRUCTION_YEARS}-${MID_YEAR}`, approximatedFrom: year };
}

/** Τα στοιχεία που έχουν νόημα μόνο στην κατοικία (έντυπο 1). */
function residenceFields(listing: PublicListing, declared: ListingObjectiveValueDeclared, used: ObjectiveValueDeclaredField[]) {
  if (listing.frontage !== null) used.push('frontage');
  if (declared.areaIncludesCommon !== null) used.push('areaIncludesCommon');
  const heating = listing.heatingType === null ? null : CENTRAL_HEATING_OF[listing.heatingType];
  return {
    frontage: listing.frontage,
    areaIncludesCommon: declared.areaIncludesCommon ?? false,
    hasCentralHeating: preferAttribute(heating, declared.hasCentralHeating, 'hasCentralHeating', used),
    hasElevator: preferAttribute(hasElevatorOf(listing), declared.hasElevator, 'hasElevator', used),
  };
}

/**
 * **Τα επίπεδα του προχείρου** — ένα ανά όροφο. Πολυεπίπεδη (`levels > 1`) ⇒ **μόνο** από το `levelAreas` με το ίδιο
 * πλήθος· αλλιώς τόσα **κενά** επίπεδα όσα δηλώνει η αγγελία (η μηχανή ζητά όροφο + επιφάνεια), ποτέ το σύνολο στον
 * όροφο εισόδου ούτε ο κανόνας του Ε9 (ψηλότερος όροφος) — άλλο έντυπο, άλλος νόμος (ADR-898 §15).
 */
function levelsOf(listing: PublicListing, form: ObjectiveValueForm): { readonly levels: readonly LevelDraft[]; readonly levelBasis: ListingLevelBasis } {
  const count = form === 'residence' ? (listing.levels?.value ?? 1) : 1;
  if (count <= 1) return { levels: [{ floor: listing.floor, area: listing.areaSqm }], levelBasis: { kind: 'single' } };
  const areas = listing.levelAreas;
  if (areas !== null && areas.length === count) {
    return { levels: areas.map((level) => ({ floor: level.floor, area: level.grossSqm })), levelBasis: { kind: 'perLevel' } };
  }
  return { levels: Array.from({ length: count }, () => ({ floor: null, area: null })), levelBasis: { kind: 'missing', count } };
}

function resolve(listing: PublicListing, form: ObjectiveValueForm, declared: ListingObjectiveValueDeclared): ListingObjectiveValueResolution {
  const used: ObjectiveValueDeclaredField[] = [];
  const residence = form === 'residence' ? residenceFields(listing, declared, used) : {};
  const { permitDate, approximatedFrom } = permitOf(listing, declared, used);
  const { levels, levelBasis } = levelsOf(listing, form);
  const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, form, levels, area: listing.areaSqm, ...residence, permitDate };
  return { draft, levelBasis, used, approximatedFrom };
}

/** Το μέτωπο μετρά ως δήλωση **μόνο** αν η ετυμηγορία το αναγνωρίζει ακόμη (αλλιώς η ερώτηση μένει ανοιχτή). */
function zoneFrontUsed(declared: ListingObjectiveValueDeclared, valueZone: ValueZoneVerdict): boolean {
  const { zoneFront } = declared;
  if (zoneFront === null) return false;
  return zoneFront.kind === 'none' || streetFrontPrices(valueZone, zoneFront.street).length > 0;
}

function assumptionsOf(resolution: ListingObjectiveValueResolution, form: ObjectiveValueForm): readonly ListingObjectiveValueAssumption[] {
  const out: ListingObjectiveValueAssumption[] = [];
  const year = resolution.approximatedFrom;
  if (year !== null) out.push({ kind: 'ageFromConstructionYear', year: year.value, provenance: year.provenance });
  if (form === 'residence' && !resolution.used.includes('areaIncludesCommon')) out.push({ kind: 'areaWithoutCommon' });
  // Με τη σειρά της λίστας-πηγής, ανεξάρτητα από τη σειρά επίλυσης.
  const fields = OBJECTIVE_VALUE_DECLARED_FIELDS.filter((field) => resolution.used.includes(field));
  if (fields.length > 0) out.push({ kind: 'declaredByLister', fields });
  return out;
}

/**
 * Όροφος/επιφάνεια/επίπεδα για τον υπολογιστή. Πολυεπίπεδη χωρίς βάση ⇒ **τίποτα**: αλλιώς ο υπολογιστής θα άνοιγε με
 * όλο το εμβαδόν στον όροφο εισόδου — ακριβώς η εικασία που απαγορεύεται (ADR-898 Φ3β-3β).
 */
function prefillLevelsOf(listing: PublicListing, resolution: ListingObjectiveValueResolution) {
  switch (resolution.levelBasis.kind) {
    case 'single':
      return { floor: listing.floor, area: listing.areaSqm, levels: null };
    case 'perLevel':
      return { floor: null, area: null, levels: resolution.draft.levels };
    case 'missing':
      return { floor: null, area: null, levels: null };
  }
}

function prefillOf(listing: PublicListing, resolution: ListingObjectiveValueResolution): ObjectiveValuePrefill {
  const { draft, used } = resolution;
  return {
    point: valueZonePointOf(listing.position),
    form: draft.form,
    ...prefillLevelsOf(listing, resolution),
    hasCentralHeating: draft.hasCentralHeating,
    hasElevator: draft.hasElevator,
    frontage: draft.frontage,
    // Η προσέγγιση από το έτος ΔΕΝ προσυμπληρώνεται: ο υπολογιστής ζητά τη νόμιμη ημερομηνία (ADR-898 §11.2).
    permitDate: used.includes('permitDate') ? draft.permitDate : null,
    areaIncludesCommon: used.includes('areaIncludesCommon') ? draft.areaIncludesCommon : null,
  };
}

/** Οι δηλώσεις της αγγελίας· `null` = ο αγγελιοδότης επέλεξε απόκρυψη. */
function declarationsOf(listing: PublicListing): ListingObjectiveValueDeclared | null {
  const declarations = listing.objectiveValueDeclarations;
  return declarations.display === 'hidden' ? null : declarations.declared;
}

/**
 * **Η βάση του υπολογισμού** — ό,τι βλέπει η μηχανή για την αγγελία, πριν από τα όρια: το πρόχειρο, ποιες δηλώσεις
 * μπήκαν, και οι τιμές ζώνης που μπορεί να ισχύουν. Ή γιατί δεν υπάρχει βάση.
 *
 * 🔑 **Μία αντιστοίχιση για όλους** (ADR-898 Φ3β-2): την καλούν η αγγελία ({@link listingObjectiveValue}) **και** η
 * οθόνη «Βελτίωσε την αγγελία σου» (`objective-value-improve.ts`) — ποτέ δεύτερο χτίσιμο πρόχειρου.
 */
export type ListingObjectiveValueBasis =
  | Exclude<ListingObjectiveValue, { readonly kind: 'evaluated' }>
  | {
      readonly kind: 'ready';
      readonly form: ObjectiveValueForm;
      readonly resolution: ListingObjectiveValueResolution;
      readonly zonePrices: readonly number[];
    };

export function listingObjectiveValueBasis(listing: PublicListing, valueZone: ValueZoneVerdict): ListingObjectiveValueBasis {
  const declared = declarationsOf(listing);
  if (declared === null) return { kind: 'hidden' };
  const form = objectiveValueFormOf(listing.type);
  if (form === null) return { kind: 'unsupported', reason: 'type' };
  const zonePrices = declaredZonePriceCandidates(valueZone, declared.zoneFront);
  if (zonePrices.length === 0) return { kind: 'no-zone' };
  const base = resolve(listing, form, declared);
  const resolution = zoneFrontUsed(declared, valueZone) ? { ...base, used: [...base.used, 'zoneFront' as const] } : base;
  return { kind: 'ready', form, resolution, zonePrices };
}

/**
 * **Η αντικειμενική αξία της αγγελίας**, ή γιατί δεν βγαίνει. `today` = ημέρα αγοράς (`YYYY-MM-DD`), η ημερομηνία
 * αποτίμησης για την παλαιότητα.
 */
export function listingObjectiveValue(listing: PublicListing, valueZone: ValueZoneVerdict, today: string): ListingObjectiveValue {
  const basis = listingObjectiveValueBasis(listing, valueZone);
  if (basis.kind !== 'ready') return basis;
  const { form, resolution, zonePrices } = basis;
  return {
    kind: 'evaluated',
    bounds: objectiveValueBounds(resolution.draft, today, zonePrices),
    levelBasis: resolution.levelBasis,
    assumptions: assumptionsOf(resolution, form),
    prefill: prefillOf(listing, resolution),
  };
}
