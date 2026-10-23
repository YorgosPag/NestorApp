/**
 * @fileoverview **ΑΠΟ ΠΟΤΕ ΕΙΝΑΙ ΔΙΑΘΕΣΙΜΗ ΜΙΑ ΑΓΓΕΛΙΑ** — ποια πηγή νικά, και τι φτάνει στο κοινό.
 * @related ADR-919 §7 (βήμα 3) · ADR-777 §8.99.4 (Δ1 · Δ4) · ADR-842 Α7 · `lib/listings/availability-window.ts`
 * @module lib/listings/listing-availability
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΚΑΝΟΝΑΣ: ΜΟΝΑΔΑ → ΚΤΙΡΙΟ, ΚΑΙ ΣΕ ΚΑΘΕ ΕΠΙΠΕΔΟ «ΤΟ ΓΕΓΟΝΟΣ ΝΙΚΑ ΤΗΝ ΥΠΟΣΧΕΣΗ»
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * | # | Πηγή | Αποτέλεσμα | Γιατί |
 * |---|---|---|---|
 * | 1 | δήλωση της **μονάδας** («διαθέσιμο από») | `scheduled` | RESO `AvailabilityDate`: γεγονός της μονάδας (π.χ. ενοικιαζόμενο με ένοικο) |
 * | 2 | **γη** | `ready` | το οικόπεδο δεν χτίζεται· είναι διαθέσιμο όπως είναι |
 * | 3 | μονάδα `operationalStatus: ready` | `ready` | δήλωση ανθρώπου για τη **μονάδα** |
 * | 4 | κτίριο αποπερατωμένο / σε χρήση | `ready` | η παράδοση **έγινε**: νικά τη δική του παλιά υπόσχεση |
 * | 5 | δήλωση παράδοσης του **κτιρίου** | `scheduled` | idealista «fecha de entrega» ανά promoción |
 * | 6 | **όχι νεόδμητο** (RESO `NewConstructionYN = false`) | `ready` | η ενεργή μεταπώληση είναι διαθέσιμη (πρακτική αγοράς, ADR-919 §2) |
 * | 7 | αλλιώς | `unknown` | η εταιρεία πουλά και off-plan· η σιωπή είναι τίμια, η μαντεψιά όχι |
 *
 * ⛔ **Α7 (ADR-842)**: δήλωση που **δεν** περνά το `isPubliclyPresentable` (π.χ. πρόβλεψη του χρονοδιαγράμματος
 * χωρίς ανθρώπινη έγκριση) είναι **σαν να μην υπάρχει** — πέφτει στο επόμενο σκαλί. Το ίδιο και η άκυρη
 * (2027-02-30): ποτέ «διορθωμένη».
 *
 * 🔴 **ΤΟ ΣΚΑΛΙ 6 ΡΩΤΑ «ΤΙ ΑΠΟΘΕΜΑ ΕΙΝΑΙ», ΟΧΙ «ΠΟΙΟΣ ΥΠΟΓΡΑΦΕΙ»**: το `authorship` ενός ιδιωτικού ακινήτου με εντολή
 * σε μεσίτη είναι `agency`, όμως το σπίτι **παραμένει υπάρχον**. Γι' αυτό η είσοδος είναι το `isNewConstruction`,
 * που το γράφει **ρητά** ο προβολέας του ιδιώτη. Για την εταιρεία μένει άγνωστο ⇒ σιωπή, όχι υπόθεση.
 *
 * ⚠️ **Χωρίς ρολόι**: ληγμένη υπόσχεση μένει `scheduled`, και τη μηχανή την κρίνει με το τέλος του
 * διαστήματος (`timingBlockers`). Η προειδοποίηση απόκλισης/λήξης είναι δουλειά του βήματος 6/7, όχι του επιλυτή.
 *
 * ⚠️ **Το `Building.completionDate` ΔΕΝ είναι πηγή εδώ**: είναι η εσωτερική ημερομηνία διαχείρισης (planned
 * finish), άλλη έννοια από τη δημόσια υπόσχεση. Δες ADR-919 §7.
 */

import { isLandProperty } from '@/constants/property-classification';
import { isDeliveredBuildingStatus } from '@/constants/building-statuses';
import { normalizeOperationalStatus } from '@/constants/operational-statuses';
import { isPubliclyPresentable, type SourcedAttribute } from '@/lib/property/attribute-provenance';
import { scheduledAvailability } from '@/lib/listings/availability-window';
import {
  AVAILABILITY_PRECISIONS,
  LISTING_AVAILABILITY_READY,
  LISTING_AVAILABILITY_UNKNOWN,
  type AvailabilityDeclaration,
  type AvailabilityPrecision,
  type ListingAvailability,
} from '@/types/listing-availability';

// ============================================================================
// Η ΑΠΟΘΗΚΕΥΜΕΝΗ ΔΗΛΩΣΗ — ωμό έγγραφο → τύπος, ή τίποτα
// ============================================================================

type DeclarationRecord = Readonly<Record<string, unknown>>;

function isRecord(raw: unknown): raw is DeclarationRecord {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function isAvailabilityPrecision(raw: unknown): raw is AvailabilityPrecision {
  return typeof raw === 'string' && (AVAILABILITY_PRECISIONS as readonly string[]).includes(raw);
}

function declarationValueOf(raw: unknown): AvailabilityDeclaration | null {
  if (!isRecord(raw) || !isAvailabilityPrecision(raw.precision) || typeof raw.anchor !== 'string') return null;
  return { precision: raw.precision, anchor: raw.anchor };
}

function isConfidence(raw: unknown): raw is number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 1;
}

/**
 * **Η δήλωση όπως κάθεται στο έγγραφο** — ή `null` όταν δεν στέκει.
 *
 * 🔑 Δέχεται **μόνο** `declared` (το έγραψε άνθρωπος) και `inferred` (πρόταση του χρονοδιαγράμματος, με
 * `confidence` και `confirmedAt`). Ένα `measured` ή `public-record` για ημερομηνία παράδοσης **δεν υπάρχει**:
 * κανένα σχέδιο δεν τη μετρά, κανένα μητρώο δεν την κρατά. Όποιο τέτοιο σχήμα εμφανιστεί είναι σφάλμα ⇒ `null`.
 *
 * ⚠️ Για `inferred` το `confirmedAt` **πρέπει να απαντηθεί** (`string | null`) — η απουσία του δεν
 * διαβάζεται ποτέ ως «εγκρίθηκε».
 */
export function readAvailabilityDeclaration(raw: unknown): SourcedAttribute<AvailabilityDeclaration> | null {
  if (!isRecord(raw) || typeof raw.at !== 'string') return null;
  const value = declarationValueOf(raw.value);
  if (value === null) return null;
  if (raw.provenance === 'declared') return { provenance: 'declared', value, at: raw.at };
  if (raw.provenance !== 'inferred' || !isConfidence(raw.confidence)) return null;
  const confirmedAt = raw.confirmedAt;
  if (confirmedAt !== null && typeof confirmedAt !== 'string') return null;
  return { provenance: 'inferred', value, at: raw.at, confidence: raw.confidence, confirmedAt };
}

/**
 * **Η δήλωση που επιτρέπεται να γίνει δημόσια υπόσχεση** — `scheduled`, ή `null` όταν δεν υπάρχει, δεν
 * στέκει, δεν εγκρίθηκε (Α7) ή η άγκυρα δεν είναι πραγματική ημέρα.
 */
export function presentableSchedule(raw: unknown): Extract<ListingAvailability, { kind: 'scheduled' }> | null {
  const declaration = readAvailabilityDeclaration(raw);
  if (declaration === null || !isPubliclyPresentable(declaration)) return null;
  const availability = scheduledAvailability(declaration.value.precision, declaration.value.anchor);
  return availability.kind === 'scheduled' ? availability : null;
}

// ============================================================================
// ΟΙ ΠΗΓΕΣ — ωμές, όπως ήρθαν· τις κρίνει μόνο αυτό το αρχείο
// ============================================================================

/** Ό,τι ξέρουμε για το κτίριο της μονάδας — υπάρχει **μόνο** όταν διαβάστηκε έγγραφο κτιρίου. */
export interface BuildingAvailabilityFacts {
  /** `Building.status` — το κρίνει το `isDeliveredBuildingStatus`. */
  readonly status: unknown;
  /** `Building.completionDeclaration` — η δημόσια υπόσχεση παράδοσης. */
  readonly completionDeclaration: unknown;
}

/** Οι είσοδοι του επιλυτή. Καμία κρίση από τον καλούντα: μεταφέρει ό,τι βρήκε στο έγγραφο. */
export interface ListingAvailabilitySources {
  /** `availabilityDeclaration` της μονάδας («διαθέσιμο από»). */
  readonly unitDeclaration: unknown;
  /** `operationalStatus` της μονάδας. */
  readonly unitOperationalStatus: unknown;
  readonly propertyType: unknown;
  /** `false` = υπάρχον απόθεμα (RESO `NewConstructionYN`). `null`/απόν = δεν το ξέρουμε, **ποτέ** «όχι νεόδμητο». */
  readonly isNewConstruction: boolean | null;
  /** `null` = δεν υπάρχει (ή δεν βρέθηκε) κτίριο επαγγελματία. */
  readonly building: BuildingAvailabilityFacts | null;
}

// ============================================================================
// Ο ΕΠΙΛΥΤΗΣ
// ============================================================================

/** Τα σκαλιά «είναι ήδη έτοιμο;» (2–4 του πίνακα) — γεγονότα του παρόντος, πριν από κάθε υπόσχεση κτιρίου. */
function isReadyNow(sources: ListingAvailabilitySources): boolean {
  if (isLandProperty(sources.propertyType)) return true;
  if (normalizeOperationalStatus(sources.unitOperationalStatus) === 'ready') return true;
  return sources.building !== null && isDeliveredBuildingStatus(sources.building.status);
}

/**
 * **Η διαθεσιμότητα της αγγελίας** — η μόνη τιμή του λεξιλογίου που φτάνει στο κοινό. Δες τον πίνακα
 * της κεφαλίδας για τη σειρά. Καθαρή: ίδια είσοδος, ίδια έξοδος, κανένα ρολόι.
 */
export function resolveListingAvailability(sources: ListingAvailabilitySources): ListingAvailability {
  const unitSchedule = presentableSchedule(sources.unitDeclaration);
  if (unitSchedule !== null) return unitSchedule;
  if (isReadyNow(sources)) return LISTING_AVAILABILITY_READY;

  const buildingSchedule = presentableSchedule(sources.building?.completionDeclaration);
  if (buildingSchedule !== null) return buildingSchedule;

  return sources.isNewConstruction === false ? LISTING_AVAILABILITY_READY : LISTING_AVAILABILITY_UNKNOWN;
}
