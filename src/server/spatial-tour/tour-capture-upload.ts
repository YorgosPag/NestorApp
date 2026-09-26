import 'server-only';

/**
 * @fileoverview **ΑΝΕΒΑΣΜΑ ΛΗΨΗΣ 360° — Η ΕΝΑΡΞΗ**: ποιος ανεβάζει, σε ποια περιήγηση, πόσα bytes — και η συνεδρία.
 * @related ADR-884 Φ0.3 · Φ0.5 · Φ0.8 · §4.5 (Κ3α) · `tour-capture-finalize.ts` (η ολοκλήρωση)
 * @module server/spatial-tour/tour-capture-upload
 *
 * 🔑 **Μία πόρτα για υπεύθυνο ΚΑΙ φωτογράφο** (Φ0.8): ο φωτογράφος **δεν** περνά από τους κανόνες του χώρου
 * (δεν είναι μέλος, Φ0.5) — άρα κάθε ανέβασμα περνά από **εδώ**, και ο κριτής είναι ο **ένας**:
 * `mayUploadTourCapture` (υπεύθυνος **ή** ενεργή άδεια λήψης). Ο υπεύθυνος **γεννά** την περιήγηση αν λείπει
 * (`ensureManagedTour`)· ο φωτογράφος ανεβάζει μόνο σε περιήγηση που υπάρχει.
 *
 * Η σειρά είναι «από το φθηνότερο»: δήλωση (τύπος · μέγεθος) → κρίση δράστη → εισιτήριο → συνεδρία. Άκυρη δήλωση
 * δεν κοστίζει ούτε ανάγνωση βάσης· άρνηση δράστη δεν ανοίγει ποτέ συνεδρία.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { refusalOfDeclaredPanorama, type PanoramaRefusal } from '@/lib/spatial-tour/panorama-policy';
import { tourCaptureGrantFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { mayManageTour, mayUploadTourCapture, type TourActor, type TourUploadVerdict } from '@/lib/spatial-tour/tour-authority';
import { openResumableUploadSession } from '@/lib/storage/resumable-upload-session';
import { isOwnedByCustody, type CustodyScope } from '@/lib/workspace/custody-scope';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { TourSubject } from '@/types/spatial-tour';

import { refuseTourAccess, type TourAccessRefusal } from './tour-access-shared';
import { ensureManagedTour } from './tour-genesis';
import { locateSpatialTour } from './tour-locate';
import { TOUR_UPLOAD_TICKET_TTL_MS, issueTourUploadTicket } from './tour-upload-ticket';

/** Ο κριτής αρνήθηκε — με το **δικό του** όνομα (έληξε · ανακλήθηκε · καμία άδεια), ώστε ο φωτογράφος να ξέρει τι ζητά. */
export type TourUploadDenial = Exclude<TourUploadVerdict, 'granted-as-manager' | 'granted-by-capture-grant'>;

/** Κάθε ονομασμένη άρνηση του ανεβάσματος — έναρξη **και** ολοκλήρωση. */
export type TourUploadRefusal =
  | TourAccessRefusal
  | TourUploadDenial
  | PanoramaRefusal
  /** Εισιτήριο πλαστό · αλλοιωμένο · ληγμένο — «ξεκίνα ξανά το ανέβασμα». */
  | 'ticket-invalid'
  /** Εισιτήριο **άλλου** δράστη — κανείς δεν ολοκληρώνει ανέβασμα που δεν ξεκίνησε. */
  | 'ticket-foreign'
  /** Η καραντίνα είναι άδεια — το ανέβασμα δεν έγινε (ή σβήστηκε). */
  | 'upload-missing'
  /** Ανέβηκαν λιγότερα bytes από όσα δηλώθηκαν — το ανέβασμα δεν τελείωσε. */
  | 'upload-incomplete'
  /** Η δήλωση της λήψης (πηγή · ορόσημο · κοινό · δικαιώματα) δεν διαβάζεται. */
  | 'declaration-invalid';

export type TourUploadRefused = { readonly kind: 'refused'; readonly reason: TourUploadRefusal };

/** «Δεν μπόρεσα» — ποτέ «δεν επιτρέπεσαι»: λείπει δικό μας μυστικό ή η υπηρεσία αποθήκευσης αρνήθηκε. */
export type TourUploadUnavailable = { readonly kind: 'unavailable'; readonly reason: 'secret-missing' | 'storage-refused' };

const refuse = (reason: TourUploadRefusal): TourUploadRefused => ({ kind: 'refused', reason });

/** **Η διαδρομή της καραντίνας** — κάτω από την περιήγηση, ώστε ο κανόνας κύκλου ζωής να την καθαρίζει ολόκληρη. */
export function tourIngestPath(tourId: string, uploadId: string): string {
  return `tour-ingest/${tourId}/${uploadId}`;
}

/** Ο δράστης **μπορεί** να ανεβάσει σε αυτή την περιήγηση — και πού ζει. */
export interface UploaderStanding {
  readonly tourRef: DocumentReference;
  readonly custody: CustodyScope;
  /** Πώς λέγεται το ακίνητο — ετικέτα του `FileRecord` του πανοράματος (Κ3β). `null` αν λείπει. */
  readonly label: string | null;
}

/**
 * **Κρίνει τον δράστη ανεβάσματος.** `allowGenesis` ⇒ ο υπεύθυνος γεννά την περιήγηση αν λείπει (έναρξη)· στην
 * ολοκλήρωση **όχι** — η περιήγηση υπάρχει ήδη από την έναρξη, και αν λείπει κάτι χάλασε.
 */
export async function judgeUploader(
  db: Firestore,
  subject: TourSubject,
  actor: TourActor,
  allowGenesis: boolean,
): Promise<UploaderStanding | TourUploadRefused> {
  const location = await locateSpatialTour(db, subject);
  if (location.kind !== 'found') return refuseTourAccess('tour-absent');
  if (allowGenesis && mayManageTour(location.record, actor) === 'granted') {
    const ensured = await ensureManagedTour(db, subject, actor);
    return ensured.kind === 'refused' ? ensured : { tourRef: ensured.tourRef, custody: ensured.custody, label: location.label };
  }
  if (location.tour === null) return refuseTourAccess('tour-absent');
  if (!isOwnedByCustody(location.tour.custody, location.custody)) return refuseTourAccess('tour-custody-mismatch');

  const grantSnap = await location.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS).doc(actor.listing.uid).get();
  const grant = grantSnap.exists ? tourCaptureGrantFromDocument(grantSnap.data(), actor.listing.uid) : null;
  const verdict = mayUploadTourCapture(location.record, actor, grant, Date.now());
  if (verdict === 'granted-as-manager' || verdict === 'granted-by-capture-grant') {
    return { tourRef: location.tourRef, custody: location.custody, label: location.label };
  }
  return refuse(verdict);
}

export interface StartTourCaptureUploadInput {
  readonly subject: TourSubject;
  readonly actor: TourActor;
  readonly contentType: string;
  readonly contentLength: number;
  /** Το origin του φυλλομετρητή — η συνεδρία δένεται σε αυτό (CORS, ADR-351). */
  readonly origin: string;
}

export type StartTourCaptureUploadOutcome =
  | {
      readonly kind: 'started';
      readonly uploadId: string;
      /** Το υπογεγραμμένο εισιτήριο — ο πελάτης το επιστρέφει στην ολοκλήρωση. */
      readonly ticket: string;
      /** ⛔ Κλειδί εγγραφής — μόνο στην απάντηση, **ποτέ** σε log. */
      readonly sessionUri: string;
      readonly expiresAt: string;
    }
  | TourUploadRefused
  | TourUploadUnavailable;

/** **Ξεκίνα ανέβασμα λήψης.** */
export async function startTourCaptureUpload(
  db: Firestore,
  input: StartTourCaptureUploadInput,
): Promise<StartTourCaptureUploadOutcome> {
  const declared = refusalOfDeclaredPanorama({ contentType: input.contentType, byteLength: input.contentLength });
  if (declared !== null) return refuse(declared);

  const standing = await judgeUploader(db, input.subject, input.actor, true);
  if ('kind' in standing) return standing;

  const uploadId = enterpriseIdService.generateTourUploadId();
  const expiresAtMs = Date.now() + TOUR_UPLOAD_TICKET_TTL_MS;
  const ticket = issueTourUploadTicket({
    uploadId, subject: input.subject, uploaderUid: input.actor.listing.uid,
    custody: standing.custody, contentLength: input.contentLength, expiresAtMs,
  });
  if (ticket === null) return { kind: 'unavailable', reason: 'secret-missing' };

  const session = await openResumableUploadSession({
    storagePath: tourIngestPath(standing.tourRef.id, uploadId),
    contentType: input.contentType,
    contentLength: input.contentLength,
    origin: input.origin,
  });
  if (session.outcome !== 'opened') return { kind: 'unavailable', reason: 'storage-refused' };
  return { kind: 'started', uploadId, ticket, sessionUri: session.sessionUri, expiresAt: new Date(expiresAtMs).toISOString() };
}
