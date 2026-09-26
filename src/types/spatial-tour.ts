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
  TourAccessRequestState,
  TourCaptureSource,
  TourGrantScope,
  TourLinkVia,
  TourMilestone,
  TourTilesetState,
} from '@/constants/spatial-tour-vocabulary';
import type { ScopedGrant } from '@/lib/auth/scoped-grant';
import type { ModelSignatory } from '@/lib/listings/listing-model-declaration';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import type { InvitationRecordCore } from '@/types/invitation-core';
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
  /**
   * Ο κόμβος του γράφου — `null` ⇒ **ατοποθέτητη** («εισερχόμενα»): ανέβηκε, δεν τοποθετήθηκε ακόμη στην κάτοψη
   * (πρότυπο Matterport «Unplaced 360° Views», ADR-884 §4.5). Η τοποθέτηση είναι πράξη του υπευθύνου (Φ2)·
   * ο γράφος **δεν** γεμίζει με κόμβους που δεν αποφάσισε κανείς.
   */
  readonly nodeId: string | null;
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

// =============================================================================
// ΠΡΟΣΒΑΣΗ — περιορισμένες άδειες πάνω σε ΜΙΑ περιήγηση (Φ0.5 · Φ0.13)
// =============================================================================

/**
 * **Αίτημα θέασης** (υποσυλλογή `tour_access_requests`, id `tacr` ντετερμινιστικό ανά (περιήγηση, άνθρωπο)).
 *
 * 🔑 **Ένα εγκεκριμένο αίτημα ΕΙΝΑΙ άδεια** `tour:view`: `expiresAt` (υποχρεωτικό στην έγκριση) + `revokedAt`.
 * Το «ισχύει ακόμη;» το απαντά **μόνο** το `evaluateScopedGrant` — βλ. `tourAccessStanding`. Η έγκριση δένεται
 * στον **λογαριασμό** (`requesterUid`), όχι σε σύνδεσμο (πρότυπο Google Drive, Φ0.13).
 */
export interface TourAccessRequest {
  readonly id: string;
  readonly tourId: string;
  readonly requesterUid: string;
  /** Το προαιρετικό μήνυμα του αιτούντος προς τον υπεύθυνο. */
  readonly message: string | null;
  readonly state: TourAccessRequestState;
  /** Η **τελευταία** υποβολή — ξανα-αίτημα μετά από απόρριψη/απόσυρση/λήξη ανανεώνει το ίδιο έγγραφο. */
  readonly requestedAt: string;
  /** Πόσες φορές υποβλήθηκε — σήμα για τον υπεύθυνο, όχι όριο (το όριο είναι του ρυθμού, Κ3). */
  readonly requestCount: number;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
  /** `null` μέχρι την έγκριση· **μετά** υποχρεωτικό. */
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
}

/**
 * **Άδεια λήψης φωτογράφου** (υποσυλλογή `tour_capture_grants/{granteeUid}`, Φ0.5) — όχι ρόλος, όχι μέλος χώρου.
 * Τη **γεννά** η αποδοχή πρόσκλησης (Κ2β)· κρίνεται **μόνο** με `evaluateScopedGrant`.
 */
export interface TourCaptureGrant extends ScopedGrant<TourGrantScope> {
  readonly granteeUid: string;
  readonly tourId: string;
  readonly scopes: readonly TourGrantScope[];
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  /** Ποιος την ανακάλεσε — ο υπεύθυνος (`revokeTourCaptureGrant`)· `null` όσο δεν ανακλήθηκε. */
  readonly revokedBy: string | null;
  readonly createdAt: string;
  /** Ο **προσκαλών** υπεύθυνος — όχι ο φωτογράφος που δέχτηκε (ίδιο δόγμα με ADR-853 Ε4). */
  readonly createdBy: string;
  readonly reason: string;
  /** Η πρόσκληση που τη γέννησε — `null` αν δόθηκε απευθείας από τον υπεύθυνο. */
  readonly invitationId: string | null;
}

/**
 * **Πρόσκληση φωτογράφου** (υποσυλλογή `tour_capture_invitations`, id `tcin`, Φ0.5 · Κ2β) — πάνω στον
 * **κοινό πυρήνα** πρόσκλησης (ADR-853 §20): token με μόνο `sha256(nonce)` στη βάση, ονομασμένες αρνήσεις,
 * δέσμευση παραλήπτη, supersede ανά (περιήγηση, email). Η αποδοχή **γεννά** την {@link TourCaptureGrant}
 * στην ίδια συναλλαγή.
 *
 * 🔑 Κουβαλά τους **όρους της άδειας** (λήξη · λόγος) — ο υπεύθυνος τους ορίζει στην έκδοση, ο φωτογράφος
 * τους δέχεται ή όχι· η αποδοχή δεν διαπραγματεύεται τίποτα.
 * 🔴 Κουβαλά και τον **κάτοχο της περιήγησης τη στιγμή της έκδοσης** (`companyId` **ή** `userId`, επίπεδα όπως
 * στην περιήγηση): αν η αγγελία αλλάξει κάτοχο, η περιήγηση μένει στην **ίδια** διαδρομή (ντετερμινιστικό id)
 * — χωρίς αυτό, η πρόσκληση του παλιού υπευθύνου θα έδινε άδεια λήψης στον χώρο του **νέου**.
 */
/**
 * **Η όψη μιας πρόσκλησης φωτογράφου πριν την απόφαση** (Κ3α) — ό,τι βλέπει όποιος κρατά τον σύνδεσμο, **πριν**
 * από κάθε σύνδεση. Ίδιο δόγμα με το `WorkspaceInvitationPreview` (ADR-853 §5 #4): **κανένα** προσωπικό δεδομένο —
 * ούτε το email του παραλήπτη, ούτε id. Τα κενά (`null`) τα ονομάζει η οθόνη από τα locales (N.11).
 */
export interface TourCaptureInvitationPreview {
  /** Το ακίνητο (τίτλος αγγελίας · όνομα μονάδας) — `null` αν δεν έχει δηλωθεί. */
  readonly propertyLabel: string | null;
  /** Το γραφείο που προσκαλεί — `null` για αγγελία **ιδιώτη** (η οθόνη λέει «ιδιοκτήτης»). */
  readonly hostName: string | null;
  /** Ο λόγος που έγραψε ο υπεύθυνος — ο φωτογράφος ξέρει **για ποια δουλειά** καλείται. */
  readonly reason: string;
  /** Ως πότε θα μπορεί να ανεβάζει, αν δεχτεί. */
  readonly grantExpiresAt: string;
  /** Ως πότε ισχύει ο σύνδεσμος. */
  readonly expiresAt: string;
  /** «Δηλωμένη, όχι επαληθευμένη» ταυτότητα του προσκαλούντος — ίδιο πεδίο με την όψη χώρου. */
  readonly identityAssurance: 'declared';
}

export type TourCaptureInvitation = InvitationRecordCore & CustodyScope & {
  readonly tourId: string;
  /** Η ρίζα — από εδώ ξαναβρίσκεται η περιήγηση στην αποδοχή, ποτέ από `tourId` του πελάτη. */
  readonly subject: TourSubject;
  /** Η λήξη της άδειας που θα γεννηθεί — **υποχρεωτική** (Φ0.5)· η πρόσκληση λήγει το αργότερο τότε. */
  readonly grantExpiresAt: string;
  readonly reason: string;
};
