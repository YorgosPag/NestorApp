/**
 * @fileoverview **ΧΩΡΙΚΗ ΠΕΡΙΗΓΗΣΗ** — πανοράματα 360° + BIM σε **ΕΝΑ** χώρο (ADR-884 Φ0.2).
 * @related ADR-884 §8.1 Φ0.1–Φ0.2 · §12 Δ2–Δ6 · ADR-841 Α10/Α11 · ADR-866 §5.6.1
 * @module types/spatial-tour
 *
 * 🔑 **Σημείο ≠ λήψη** (§12 Δ6): ο `TourNode` είναι σταθερός στον χρόνο, η `TourCapture` έχει ημερομηνία.
 * Η αγγελία θέλει **μία** λήψη ανά σημείο, το εργοτάξιο και το βιβλίο του σπιτιού **πολλές** — ο ίδιος
 * γράφος τα σηκώνει όλα.
 *
 * Αποθήκευση (Ε6): `SpatialTour` = έγγραφο στο διαμέρισμα του κατόχου (`SPATIAL_TOUR_COLLECTION`), κόμβοι
 * = **πίνακας** μέσα του (ο γράφος αλλάζει ατομικά), λήψεις = **υποσυλλογή** `tour_captures` (χωρίς όριο,
 * και **κοινό ανά έγγραφο** — οι κανόνες δεν φιλτράρουν πεδία). Ανάγνωση **μόνο** μέσω
 * `lib/spatial-tour/spatial-tour-from-document`.
 *
 * Όλοι οι τύποι τιμών **παράγονται** από τη ρίζα `constants/spatial-tour-vocabulary` — κανένα χειρόγραφο
 * union εδώ.
 */

import type { PlaceSource } from '@/constants/place-sources';
import type {
  FloorPlanRecordState,
  FloorPlanSource,
  SpatialTourLifecycle,
  SpatialTourVisibility,
  TourCaptureAudience,
  TourCaptureProvenance,
  TourCaptureSource,
  TourLinkVia,
  TourMilestone,
  TourTilesetState,
} from '@/constants/spatial-tour-vocabulary';
import type { ModelSignatory } from '@/lib/listings/listing-model-declaration';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import type { MediaRights } from '@/types/media-rights';
import type { ProfessionalAttestation } from '@/types/professional-identity';

/**
 * Σε τι δένεται η περιήγηση: **ρίζα με είδος** (Φ0.1). Το λεξιλόγιο είναι το **υπάρχον** `PlaceSource`
 * — ίδιο id σε άλλη ρίζα είναι άλλο ακίνητο.
 */
export interface TourSubject {
  readonly kind: PlaceSource;
  readonly id: string;
}

/** Όροφος: σταθερό `floorId` (IfcBuildingStorey) — **ποτέ** το εφήμερο `Level.id` της σκηνής. */
export type TourLevelKey =
  | { readonly kind: 'floor'; readonly floorId: string }
  /** Ακίνητο χωρίς BIM (μεταπώληση): σειρά ορόφου. */
  | { readonly kind: 'local'; readonly ordinal: number };

/** Μία κάτοψη στην ιστορία ενός ορόφου — αναβάθμιση **μόνο** με έγκριση, ποτέ σιωπηλή (§12 Δ5). */
export interface FloorPlanRecord {
  readonly source: FloorPlanSource;
  readonly state: FloorPlanRecordState;
  /** `null` **μόνο** για πηγή `none`. */
  readonly fileId: string | null;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
}

export interface TourLevel {
  readonly key: TourLevelKey;
  /** Ιστορία — **ακριβώς ένα** `active` (αναλλοίωτο #4). */
  readonly floorPlans: readonly FloorPlanRecord[];
}

/** Σύνθετη θέση κάτοψης: x = ανατολή, y = βορράς, z = υψόμετρο, σε μέτρα (`planMetresToWorld` στον θεατή). */
export interface TourPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TourLink {
  readonly toNodeId: string;
  readonly via: TourLinkVia;
}

/** Σημείο στον χώρο — σταθερό στον χρόνο. */
export interface TourNode {
  readonly id: string;
  readonly levelKey: TourLevelKey;
  /** `null` όταν ο όροφος δεν έχει κάτοψη (`none`) — περιήγηση με βελάκια, χωρίς χάρτη. */
  readonly position: TourPoint | null;
  readonly links: readonly TourLink[];
}

export interface SpatialTour {
  readonly id: string;
  /** Ο κάτοχος — **παράγεται** από τη ρίζα, δεν επιλέγεται (Φ0.1). */
  readonly custody: CustodyScope;
  readonly subject: TourSubject;
  readonly visibility: SpatialTourVisibility;
  readonly lifecycle: SpatialTourLifecycle;
  readonly levels: readonly TourLevel[];
  /** ≤ `MAX_TOUR_NODES`. */
  readonly nodes: readonly TourNode[];
  /** CAS για ταυτόχρονες επεξεργασίες του γράφου. */
  readonly revision: number;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

/**
 * Ο υπογράφων μιας μελέτης. Το `ModelSignatory` (ADR-841 Α10) φέρει **δηλωμένο** όνομα/ειδικότητα/ημερομηνία
 * αλλά **όχι** αριθμό μητρώου· η απόδειξη ζει στο **υπάρχον** `ProfessionalAttestation` — σύνθεση, όχι
 * δεύτερο σχήμα υπογράφοντα.
 */
export interface TourCaptureSignatory {
  readonly person: ModelSignatory;
  readonly attestation: ProfessionalAttestation;
}

export interface TourCaptureTileset {
  readonly state: TourTilesetState;
  readonly contentHash: string | null;
}

/** Μία λήψη ενός σημείου, σε μία ημερομηνία (υποσυλλογή `tour_captures`). */
export interface TourCapture {
  readonly id: string;
  readonly tourId: string;
  readonly nodeId: string;
  /** Ο άξονας του χρονολογίου. */
  readonly capturedAt: string;
  readonly headingRad: number;
  readonly source: TourCaptureSource;
  readonly provenance: TourCaptureProvenance;
  /** **Υποχρεωτικό** για `virtual-staging`/`design-study`: η `as-built` που «ντύνει» (αναλλοίωτο #1). */
  readonly baseCaptureId: string | null;
  /** **Υποχρεωτικό** για `design-study` (αναλλοίωτο #2). */
  readonly signatory: TourCaptureSignatory | null;
  readonly audience: TourCaptureAudience;
  readonly milestone: TourMilestone | null;
  /** Το `FileRecord` του πρωτότυπου πανοράματος. */
  readonly originalFileId: string;
  readonly rights: MediaRights;
  readonly tileset: TourCaptureTileset;
  /** Ο **δράστης** — όχι ο κάτοχος (φωτογράφος με άδεια λήψης, Φ0.5). */
  readonly uploadedBy: string;
  readonly createdAt: string;
}
