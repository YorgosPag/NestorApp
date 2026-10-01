/**
 * @fileoverview 🧭 **«ΠΡΟΣ ΤΑ ΠΟΥ ΕΙΝΑΙ Ο ΒΟΡΡΑΣ ΣΕ ΑΥΤΗ ΤΗΝ ΚΑΤΟΨΗ;»** — η μία απάντηση (ADR-897 Φ5.2).
 * @related ADR-897 · lib/listings/photo-capture-spot (τα σημεία λήψης) · lib/geometry/angle (`circularMeanRad`)
 * @module lib/listings/floorplan-north
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΜΟΝΤΕΛΟ REVIT: «ANGLE FROM PROJECT NORTH TO TRUE NORTH» — ΜΙΑ ΓΩΝΙΑ, Η ΚΑΤΟΨΗ ΔΕΝ ΣΤΡΙΒΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **πάνω** της εικόνας κάτοψης είναι ο «Project North» (έτσι τη σχεδίασε/σάρωσε ο άνθρωπος, έτσι τη βλέπει ο
 * επισκέπτης). Ο **πραγματικός** βορράς είναι **μία γωνία** πάνω της — `northRad`, ίδια σύμβαση με το `headingRad`
 * (0 = πάνω, **δεξιόστροφα**, χώρος εικόνας). Η κάτοψη **δεν** περιστρέφεται ποτέ (Revit: *«do not rotate the
 * building»*)· γυρίζει μόνο το βέλος. CubiCasa: ίδιο — ρόδα πυξίδας που στρίβεις ή πληκτρολογείς τιμή.
 *
 * 🔑 **Ανά κάτοψη, όχι ανά αγγελία**: δύο όροφοι μπορεί να σαρώθηκαν/σχεδιάστηκαν με άλλο προσανατολισμό.
 * Αποθήκευση: χάρτης `floorplanFileId → northRad` πάνω στη **ίδια** μηχανή `declared-file-map` με τις άλλες δηλώσεις.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🧮 Η ΣΧΕΣΗ ΠΟΥ ΔΕΝΕΙ ΒΟΡΡΑ, ΠΥΞΙΔΑ ΚΑΙ ΚΑΤΕΥΘΥΝΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *     headingRad (εικόνα) = northRad (εικόνα) + compassRad (από τον βορρά)
 *
 * Άρα η σχέση λύνεται **και προς τις δύο μεριές**:
 * - βορράς γνωστός + πυξίδα ⇒ **πρόταση κατεύθυνσης** ({@link headingFromCompass})·
 * - κατευθύνσεις που ο άνθρωπος **ήδη** έβαλε + πυξίδες ⇒ **πρόταση βορρά** ({@link estimateNorthFromCompass}).
 *   🏆 **Πάνω από CubiCasa/Revit**: ο άνθρωπος δεν χρειάζεται να ξέρει πού είναι ο βορράς — τον βρίσκουν οι
 *   φωτογραφίες του, με **μέτρο συμφωνίας**. Και επειδή βορράς και πρόταση βγαίνουν από την **ίδια** πυξίδα, η
 *   μαγνητική απόκλιση (~5° Α στην Ελλάδα) **αλληλοαναιρείται** — δεν χρειάζεται μοντέλο WMM.
 *
 * ⚠️ **ΠΟΤΕ ΑΥΤΟΜΑΤΗ ΑΠΟΘΗΚΕΥΣΗ**: η πυξίδα κινητού μέσα σε κτίριο (οπλισμός, συσκευές) ξεφεύγει >20° σε ~15% των
 *   μετρήσεων. Όλα εδώ είναι **προτάσεις** που επιβεβαιώνει άνθρωπος («Χρήση»).
 * ⚠️ **Καθαρό module** — κανένα React, κανένα Firestore.
 */

import { z } from 'zod';

import { circularMeanRad, circularSpreadRad, degToRad, normalizeAngleDiff, normalizeAngleRad, TAU } from '@/lib/geometry/angle';

import { readDeclaredFileMap, sameDeclaredFileMap } from './declared-file-map';

// ============================================================================
// 1. Η ΔΗΛΩΣΗ
// ============================================================================

/** `floorplanFileId → northRad` — ο βορράς ανά **δηλωμένη** κάτοψη. */
export type DeclaredFloorplanNorth = ReadonlyMap<string, number>;

export const NO_DECLARED_FLOORPLAN_NORTH: DeclaredFloorplanNorth = new Map();

const northRad = z.number().finite().min(0).lt(TAU);
const fileId = z.string().trim().min(1).max(128);

/** Το σχήμα της **πόρτας** (PATCH γραφείου, φόρμα κατόχου) — αυστηρό. */
export function declaredFloorplanNorthSchema(limit: number) {
  return z
    .record(fileId, northRad)
    .refine((value) => Object.keys(value).length <= limit, { message: `at most ${limit} floorplan norths` });
}

/** Μία τιμή βορρά — κανονικοποιημένη στο `[0, 2π)` (`-π/2` ≡ `3π/2`)· άκυρο ⇒ `null`. Ποτέ δεν πετά. */
export function readNorthRad(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return normalizeAngleRad(value);
}

/** **Η μία ανάγνωση** του ωμού πεδίου — άκυρη γραμμή πέφτει μόνη της. */
export function readDeclaredFloorplanNorth(value: unknown): DeclaredFloorplanNorth {
  return readDeclaredFileMap(value, readNorthRad);
}

export function sameDeclaredFloorplanNorth(a: DeclaredFloorplanNorth, b: DeclaredFloorplanNorth): boolean {
  return sameDeclaredFileMap(a, b, (left, right) => left === right);
}

// ============================================================================
// 2. ΟΙ ΠΡΟΤΑΣΕΙΣ ΑΠΟ ΤΗΝ ΠΥΞΙΔΑ
// ============================================================================

/** Η **πρόταση κατεύθυνσης** μιας φωτογραφίας — `northRad + compassRad`, στο `[0, 2π)`. */
export function headingFromCompass(north: number, compassRad: number): number {
  return normalizeAngleRad(north + compassRad);
}

/** Μια φωτογραφία που **ήδη** έχει κατεύθυνση από άνθρωπο **και** πυξίδα από το EXIF. */
export interface CompassSample {
  readonly headingRad: number;
  readonly compassRad: number;
}

/** Τουλάχιστον δύο: ένα δείγμα δεν έχει μέτρο συμφωνίας, άρα δεν ξέρουμε αν είναι η εξαίρεση. */
export const MIN_NORTH_SAMPLES = 2;
/** Η μέγιστη κυκλική απόκλιση για να **προταθεί** βορράς — πέρα από αυτή οι πυξίδες διαφωνούν. */
export const MAX_NORTH_SPREAD_RAD = degToRad(30);
/** Δείγμα πιο μακριά από αυτό από τον πρώτο μέσο = εξαίρεση (μεταλλικό αντικείμενο δίπλα στο κινητό). */
const OUTLIER_RAD = degToRad(45);

export type NorthEstimate =
  | { readonly kind: 'estimate'; readonly northRad: number; readonly spreadRad: number; readonly used: number; readonly total: number }
  | { readonly kind: 'disagree'; readonly spreadRad: number; readonly total: number };

/**
 * 🧭 **Ο βορράς της κάτοψης, από τις φωτογραφίες που ο άνθρωπος ήδη τοποθέτησε.**
 *
 * Κάθε δείγμα δίνει μια εκτίμηση `headingRad − compassRad`· ο **κυκλικός** μέσος τις ενώνει. Με ≥3 δείγματα, όσα
 * απέχουν >45° από τον πρώτο μέσο πετιούνται **μία** φορά (μία πυξίδα δίπλα σε ψυγείο δεν παρασύρει τις υπόλοιπες).
 *
 * @returns `null` ⇒ λιγότερα από {@link MIN_NORTH_SAMPLES} δείγματα · `disagree` ⇒ υπάρχουν, αλλά δεν συμφωνούν (ποτέ
 *   πρόταση από θόρυβο) · `estimate` ⇒ ο βορράς, με την απόκλιση και πόσα δείγματα μέτρησαν.
 */
export function estimateNorthFromCompass(samples: readonly CompassSample[]): NorthEstimate | null {
  if (samples.length < MIN_NORTH_SAMPLES) return null;
  const all = samples.map((sample) => normalizeAngleRad(sample.headingRad - sample.compassRad));
  const first = circularMeanRad(all);
  if (first === null) return { kind: 'disagree', spreadRad: Math.PI, total: samples.length };
  const kept = all.length >= 3
    ? all.filter((angle) => Math.abs(normalizeAngleDiff(angle - first.meanRad)) <= OUTLIER_RAD)
    : all;
  const mean = kept.length >= MIN_NORTH_SAMPLES ? circularMeanRad(kept) : null;
  const spreadRad = circularSpreadRad((mean ?? first).resultant);
  if (mean === null || spreadRad > MAX_NORTH_SPREAD_RAD) {
    return { kind: 'disagree', spreadRad, total: samples.length };
  }
  return { kind: 'estimate', northRad: mean.meanRad, spreadRad, used: kept.length, total: samples.length };
}

// ============================================================================
// 3. Η ΔΗΜΟΣΙΑ ΜΟΡΦΗ
// ============================================================================

/**
 * **Η μία ανάγνωση του δημόσιου βορρά** (`ListingImage.northRad` μιας κάτοψης) — ποτέ δεν πετά. Το δημόσιο έγγραφο
 * διαβάζεται ρηχά, άρα ο αναγνώστης ξαναελέγχει: σκουπίδι ⇒ `null` ⇒ **κανένα** βέλος (ποτέ βέλος σε λάθος μεριά).
 */
export function readListingNorthRad(value: unknown): number | null {
  const parsed = northRad.safeParse(value);
  return parsed.success ? parsed.data : null;
}
