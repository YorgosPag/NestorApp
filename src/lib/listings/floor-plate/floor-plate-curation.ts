/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΗΣ ΕΠΙΜΕΛΕΙΑΣ ΟΡΟΦΟΥ** — από τα περιγράμματα ενός ορόφου στις μονάδες που βλέπει το κοινό (ADR-907 §11.6).
 * @related ./floor-plate-outline (`normalizeFloorPlateOutline`) · ./floor-plate-state · types/floorplan-overlays (`OverlayRole`)
 * @module lib/listings/floor-plate/floor-plate-curation
 *
 * Το `public_listings` διαβάζεται από οποιονδήποτε, και η κάτοψη ορόφου δείχνει μονάδες **άλλων**. Γι' αυτό η κρίση
 * είναι **όλα ή τίποτα**: ένα περίγραμμα που δεν μπορεί να εξηγηθεί αρνείται ολόκληρο τον όροφο, **με όνομα** και με
 * την ταυτότητα του περιγράμματος — ώστε ο άνθρωπος που υπέγραψε τη δήλωση να ξέρει τι να διορθώσει.
 *
 * 🔑 **Η ταυτότητα του γείτονα δεν βγαίνει ποτέ από εδώ.** Η έξοδος κρατά μόνο σχήμα, κατάσταση και — όταν ο γείτονας
 * έχει **ήδη** δημόσια αγγελία — την ταυτότητα εκείνης της αγγελίας.
 *
 * ⚠️ **Καθαρό module** — καμία I/O: ο αναγνώστης του διακομιστή φέρνει τα δεδομένα, η κρίση δοκιμάζεται χωρίς βάση.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { OverlayRole } from '@/types/floorplan-overlays';
import type { FloorPlateUnit } from '@/types/public-listing';

import {
  normalizeFloorPlateOutline,
  type FloorPlateFrame,
  type FloorPlateOutlineRefusal,
} from './floor-plate-outline';
import { FLOOR_PLATE_SELF_STATE, floorPlateNeighbourState } from './floor-plate-state';

/**
 * Τι είναι κάθε ρόλος περιγράμματος **για το κοινό**. Εξαντλητικό: νέος ρόλος σπάει τη μεταγλώττιση εδώ μέχρι να
 * απαντηθεί «είναι μονάδα που δείχνουμε, ή σχέδιο εργασίας που δεν βγαίνει ποτέ;».
 *
 * ⛔ Το `footprint` (ίχνος κτιρίου) και οι σημειώσεις **δεν βγαίνουν ποτέ** — δεν είναι μονάδες προς διάθεση.
 */
const ROLE_FOR_PUBLIC: Readonly<Record<OverlayRole, 'unit' | 'never'>> = {
  property: 'unit',
  parking: 'unit',
  storage: 'unit',
  footprint: 'never',
  annotation: 'never',
  auxiliary: 'never',
};

/** Ένα περίγραμμα όπως το διάβασε ο διακομιστής — ό,τι χρειάζεται η κρίση, τίποτε άλλο. */
export interface FloorPlateOutlineCandidate {
  readonly overlayId: string;
  /** Όπως είναι αποθηκευμένο — άγνωστη τιμή αρνείται τον όροφο, δεν αγνοείται. */
  readonly role: string;
  /** `null` όταν το σχήμα δεν είναι πολύγωνο. */
  readonly vertices: readonly PlanarPoint[] | null;
  /** Η μονάδα με την οποία δένει, κατά τον ρόλο του· `null` ⇒ άδετο. */
  readonly unitId: string | null;
}

/** Ό,τι ξέρει ο διακομιστής για μια μονάδα **του ίδιου χώρου**. Μονάδα που λείπει από τον χάρτη είναι ξένη ή ανύπαρκτη. */
export interface FloorPlateUnitFacts {
  readonly commercialStatus: unknown;
  /** Η ταυτότητα της δημόσιας αγγελίας της, **μόνο** αν δημοσιεύεται αυτή τη στιγμή. */
  readonly publicListingId: string | null;
}

/** Γιατί ο όροφος δεν βγαίνει στο κοινό — οι αρνήσεις του περιγράμματος περνούν **αυτούσιες**, με το όνομά τους. */
export type FloorPlateCurationRefusal =
  | FloorPlateOutlineRefusal
  | 'unknown-role'
  | 'not-a-polygon'
  | 'unlinked-outline'
  | 'foreign-unit'
  | 'duplicate-unit'
  | 'coincident-outlines'
  | 'self-missing';

export type FloorPlateCuration =
  | { readonly ok: true; readonly units: readonly FloorPlateUnit[] }
  /** `overlayId`: ποιο περίγραμμα φταίει· `null` όταν η άρνηση αφορά ολόκληρο τον όροφο. */
  | { readonly ok: false; readonly why: FloorPlateCurationRefusal; readonly overlayId: string | null };

export interface FloorPlateCurationInput {
  /** Η μονάδα της **ίδιας** της αγγελίας. */
  readonly selfUnitId: string;
  readonly frame: FloorPlateFrame;
  /** Με τη σειρά που γράφτηκαν — η έξοδος την κρατά, ώστε το έγγραφο να μην αλλάζει χωρίς λόγο. */
  readonly outlines: readonly FloorPlateOutlineCandidate[];
  readonly unitFacts: ReadonlyMap<string, FloorPlateUnitFacts>;
}

function refusal(why: FloorPlateCurationRefusal, overlayId: string | null): FloorPlateCuration {
  return { ok: false, why, overlayId };
}

function isOverlayRole(role: string): role is OverlayRole {
  return Object.hasOwn(ROLE_FOR_PUBLIC, role);
}

/** Η μονάδα όπως τη βλέπει το κοινό: «αυτό το ακίνητο», ή γείτονας με κατάσταση και (αν είναι ήδη δημόσιος) σύνδεσμο. */
function toUnit(outline: readonly number[], unitId: string, selfUnitId: string, facts: FloorPlateUnitFacts): FloorPlateUnit {
  if (unitId === selfUnitId) return { outline, state: FLOOR_PLATE_SELF_STATE };
  const state = floorPlateNeighbourState(facts.commercialStatus);
  return facts.publicListingId === null ? { outline, state } : { outline, state, listingId: facts.publicListingId };
}

type OutlineVerdict =
  | { readonly kind: 'skip' }
  | { readonly kind: 'refuse'; readonly why: FloorPlateCurationRefusal }
  | { readonly kind: 'unit'; readonly unitId: string; readonly unit: FloorPlateUnit };

/** Η κρίση **ενός** περιγράμματος, χωρίς γνώση των υπολοίπων. */
function judgeOutline(candidate: FloorPlateOutlineCandidate, input: FloorPlateCurationInput): OutlineVerdict {
  if (!isOverlayRole(candidate.role)) return { kind: 'refuse', why: 'unknown-role' };
  if (ROLE_FOR_PUBLIC[candidate.role] === 'never') return { kind: 'skip' };
  if (candidate.unitId === null) return { kind: 'refuse', why: 'unlinked-outline' };

  const facts = input.unitFacts.get(candidate.unitId);
  if (facts === undefined) return { kind: 'refuse', why: 'foreign-unit' };
  if (candidate.vertices === null) return { kind: 'refuse', why: 'not-a-polygon' };

  const reading = normalizeFloorPlateOutline(candidate.vertices, input.frame);
  if (!reading.ok) return { kind: 'refuse', why: reading.why };

  return { kind: 'unit', unitId: candidate.unitId, unit: toUnit(reading.outline, candidate.unitId, input.selfUnitId, facts) };
}

/**
 * **Βγαίνει αυτός ο όροφος στο κοινό, και με ποιες μονάδες;**
 *
 * 🔴 **Δύο περιγράμματα για την ίδια μονάδα, ή δύο που συμπίπτουν ⇒ άρνηση.** Μετρημένο στα δεδομένα δοκιμής: το
 * εργαλείο έγραψε το ίδιο σχήμα δύο φορές μέσα σε μισό δευτερόλεπτο. Στο κοινό θα φαινόταν μία μονάδα με δύο
 * καταστάσεις, η μία πάνω στην άλλη.
 *
 * ⚠️ Η σύμπτωση κρίνεται στο **κανονικοποιημένο** περίγραμμα (ίδιες κορυφές, ίδια σειρά). Το ίδιο σχήμα με άλλη αρχική
 * κορυφή ή αντίθετη φορά **δεν** πιάνεται εδώ — το πιάνει ο κανόνας της ίδιας μονάδας όταν δένουν στην ίδια.
 */
export function curateFloorPlate(input: FloorPlateCurationInput): FloorPlateCuration {
  const units: FloorPlateUnit[] = [];
  const seenUnits = new Set<string>();
  const seenShapes = new Set<string>();

  for (const candidate of input.outlines) {
    const verdict = judgeOutline(candidate, input);
    if (verdict.kind === 'skip') continue;
    if (verdict.kind === 'refuse') return refusal(verdict.why, candidate.overlayId);

    if (seenUnits.has(verdict.unitId)) return refusal('duplicate-unit', candidate.overlayId);
    const shape = verdict.unit.outline.join(',');
    if (seenShapes.has(shape)) return refusal('coincident-outlines', candidate.overlayId);

    seenUnits.add(verdict.unitId);
    seenShapes.add(shape);
    units.push(verdict.unit);
  }

  return seenUnits.has(input.selfUnitId) ? { ok: true, units } : refusal('self-missing', null);
}
