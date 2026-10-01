/**
 * @fileoverview 📐 **Η ΑΠΟΤΥΠΩΣΗ ΛΗΨΗΣ** — σημεία λήψης **και** βορράς κατόψεων, ως **μία** δήλωση (ADR-897 Φ5.2).
 * @related lib/listings/photo-capture-spot · lib/listings/floorplan-north · hooks/listings/useListingCaptureSpots
 * @module lib/listings/capture-survey
 *
 * 🔴 **ΓΙΑΤΙ ΕΝΑ ΔΟΧΕΙΟ ΚΑΙ ΟΧΙ ΔΥΟ ΔΗΛΩΣΕΙΣ**: ο χώρος εργασίας κρατά **ένα** πρόχειρο και σώζει με **μία** πράξη.
 *   Δύο ανεξάρτητες δηλώσεις θα ήταν δύο εγγραφές — στο γραφείο δύο PATCH, όπου η δεύτερη σκοντάφτει στο κλείδωμα
 *   της πρώτης (`saving`) και **χάνεται σιωπηλά**. Ένα δοχείο ⇒ ένα PATCH με δύο πεδία, μία επαναπροβολή, μία
 *   συμφιλίωση (το αισιόδοξο αποσύρεται μόνο όταν **και τα δύο** πεδία συμφωνήσουν).
 * 🔑 **Η αποθήκευση μένει δύο πεδία** (`…CaptureSpots` · `…FloorplanNorth`): ο βορράς ανήκει στην **κάτοψη**, τα σημεία
 *   στη **φωτογραφία** — δύο χάρτες με άλλο κλειδί. Μόνο ο **κύκλος ζωής** είναι κοινός.
 * ⚠️ **Καθαρό module**.
 */

import { readDeclaredFloorplanNorth, sameDeclaredFloorplanNorth, type DeclaredFloorplanNorth } from './floorplan-north';
import { readDeclaredCaptureSpots, sameDeclaredCaptureSpots, type PhotoCaptureSpot } from './photo-capture-spot';

export interface CaptureSurvey {
  /** `FileRecord.id` φωτογραφίας → σημείο λήψης. */
  readonly spots: ReadonlyMap<string, PhotoCaptureSpot>;
  /** `FileRecord.id` κάτοψης → βορράς (χώρος εικόνας). */
  readonly north: DeclaredFloorplanNorth;
}

/** Η μία ανάγνωση των δύο ωμών πεδίων — ποτέ δεν πετά. */
export function readCaptureSurvey(storedSpots: unknown, storedNorth: unknown): CaptureSurvey {
  return { spots: readDeclaredCaptureSpots(storedSpots), north: readDeclaredFloorplanNorth(storedNorth) };
}

export function sameCaptureSurvey(a: CaptureSurvey, b: CaptureSurvey): boolean {
  return sameDeclaredCaptureSpots(a.spots, b.spots) && sameDeclaredFloorplanNorth(a.north, b.north);
}

/** Τα δύο πεδία σε σύρμα — **πάντα μαζί**, ώστε καμία εγγραφή να μη γράφει το ένα χωρίς το άλλο. */
export function captureSurveyWire(survey: CaptureSurvey): {
  readonly spots: Record<string, PhotoCaptureSpot>;
  readonly north: Record<string, number>;
} {
  return { spots: Object.fromEntries(survey.spots), north: Object.fromEntries(survey.north) };
}
