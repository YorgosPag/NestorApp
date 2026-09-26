import 'server-only';

/**
 * @fileoverview **Η ΣΥΝΕΔΡΙΑ ΘΕΑΣΗΣ** — κρίση **μία** φορά ανά επίσκεψη, κουπόνι, ίχνος, μανιφέστο (ADR-884 Κ3β).
 * @related `lib/spatial-tour/tour-view-policy.ts` (ο πίνακας) · `tour-view-grant.ts` (το κουπόνι) ·
 *   `tour-view-trace.ts` (το ίχνος) · `app/api/spatial-tours/[kind]/[subjectId]/view-session`
 * @module server/spatial-tour/tour-view-session
 *
 * 🔑 **Εδώ και ΜΟΝΟ εδώ ρωτιούνται οι κριτές** (`mayManageTour` · `tourAccessStanding` · ενεργός σύνδεσμος) — τα
 * μέσα (`GET …/media/…`) ελέγχουν **μόνο** την υπογραφή του κουπονιού που βγαίνει από εδώ.
 *
 * 🔑 **Ο σύνδεσμος κρίνεται δύο φορές, από δύο πηγές**: η διαδρομή απαιτεί το κουπόνι επίσκεψης του ίδιου του
 * συνδέσμου (ο browser **άνοιξε** το `/shared/[token]` μέσα στα τελευταία 15′)· εδώ ελέγχεται ότι ο σύνδεσμος
 * είναι **ακόμη** ενεργός και δείχνει **αυτή** την περιήγηση. Ανάκληση ⇒ κανένα νέο κουπόνι θέασης.
 *
 * 🔑 **Το μανιφέστο δεν λέει ποτέ κάτι που η πύλη δεν έκρινε**: μόνο λήψεις για το κοινό της αγγελίας, πιο
 * πρόσφατη ανά κόμβο, με **έτοιμο** tileset (`selectViewerCaptures`). Χωρίς tileset ⇒ `ready: false` — η οθόνη
 * λέει «η περιήγηση ετοιμάζεται», ποτέ μαύρη σφαίρα.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { tourAccessRequestFromDocument, tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { mayManageTour, tourAccessStanding, type TourActor } from '@/lib/spatial-tour/tour-authority';
import { selectViewerCaptures } from '@/lib/spatial-tour/tour-capture-invariants';
import { judgeTourView } from '@/lib/spatial-tour/tour-view-policy';
import { isOwnedByCustody } from '@/lib/workspace/custody-scope';
import { normalizeUnifiedShare } from '@/server/sharing/share-token-lookup';
import type { SpatialTour, TourCapture, TourNode, TourSubject } from '@/types/spatial-tour';

import { refuseTourAccess, tourAccessRequestRef, type TourAccessRefused } from './tour-access-shared';
import { locateSpatialTour } from './tour-locate';
import { issueTourViewGrant, type TourViewGrant } from './tour-view-grant';
import { recordTourRequestVisit } from './tour-view-trace';

/** Όσες λήψεις διαβάζει μια συνεδρία — ≥ `MAX_TOUR_NODES` ώστε να χωρά η πιο πρόσφατη κάθε κόμβου. */
const CAPTURE_READ_LIMIT = 500;

export interface TourViewSessionInput {
  readonly subject: TourSubject;
  /** `null` ⇒ ανώνυμος. */
  readonly actor: TourActor | null;
  /** Σύνδεσμος που **ο browser άνοιξε** (κουπόνι επίσκεψης επαληθευμένο στη διαδρομή) — `null` όταν κανένας. */
  readonly openedShareId: string | null;
  /** Ζωντανό κουπόνι θέασης αυτής της περιήγησης που φέρει ήδη ο browser — ίδια επίσκεψη ⇒ καμία μέτρηση. */
  readonly presentedGrant: TourViewGrant | null;
  readonly nowMs: number;
}

/** Μία στάση του θεατή — ό,τι χρειάζεται ο θεατής της Φ1 για να ζητήσει πλακίδια. */
export interface TourManifestStop {
  readonly captureId: string;
  readonly nodeId: string;
  readonly capturedAt: string;
  readonly headingRad: number;
  /** Το περιεχόμενο του tileset — μέρος της διεύθυνσης μέσων, ώστε νέα έκδοση = νέο URL (αμετάβλητη cache). */
  readonly tilesetHash: string;
}

export interface TourManifest {
  readonly tourId: string;
  readonly label: string | null;
  readonly nodes: readonly TourNode[];
  readonly stops: readonly TourManifestStop[];
  /** Υπάρχει τουλάχιστον μία στάση με έτοιμα πλακίδια; */
  readonly ready: boolean;
}

export type TourViewSessionOutcome =
  | {
      readonly kind: 'granted';
      readonly grant: TourViewGrant;
      /** `null` ⇒ λείπει το μυστικό **από εμάς** — η διαδρομή απαντά «μη διαθέσιμο». */
      readonly token: string | null;
      readonly manifest: TourManifest;
    }
  | TourAccessRefused;

/** Ενεργός σύνδεσμος **αυτής** της περιήγησης; — ανάγνωση **με id**, κρίση ζωντάνιας και στόχου. */
async function activeTourShareId(db: Firestore, shareId: string | null, tourId: string, nowMs: number): Promise<string | null> {
  if (shareId === null) return null;
  const snap = await db.collection(COLLECTIONS.SHARES).doc(shareId).get();
  const raw = (snap.data() ?? null) as Record<string, unknown> | null;
  if (raw === null || raw.isActive !== true) return null;
  const share = normalizeUnifiedShare(snap.id, raw);
  if (share === null || share.entityType !== 'spatial_tour' || share.entityId !== tourId) return null;
  return Date.parse(share.expiresAt) > nowMs ? share.id : null;
}

async function requestStandingOf(tourRef: DocumentReference, uid: string | null, nowMs: number) {
  if (uid === null) return { standing: 'none' as const, requestId: null, requestRef: null };
  const requestRef = tourAccessRequestRef(tourRef, uid);
  const snap = await requestRef.get();
  const stored = snap.exists ? tourAccessRequestFromDocument(snap.data(), snap.id) : null;
  return stored === null
    ? { standing: 'none' as const, requestId: null, requestRef }
    : { standing: tourAccessStanding(stored, nowMs), requestId: stored.id, requestRef };
}

async function manifestOf(tour: SpatialTour, tourRef: DocumentReference, label: string | null): Promise<TourManifest> {
  // tenant-scope-exempt: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση που μόλις κρίθηκε από την πύλη θέασης (ADR-884 Φ0.9).
  const snap = await tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES).limit(CAPTURE_READ_LIMIT).get();
  const captures = snap.docs.flatMap((doc) => {
    const capture = tourCaptureFromDocument(doc.data(), doc.id);
    return capture === null ? [] : [capture];
  });
  const stops = selectViewerCaptures(captures).flatMap((capture: TourCapture): TourManifestStop[] =>
    capture.tileset.state === 'ready' && capture.tileset.contentHash !== null && capture.nodeId !== null
      ? [{
          captureId: capture.id, nodeId: capture.nodeId, capturedAt: capture.capturedAt,
          headingRad: capture.headingRad, tilesetHash: capture.tileset.contentHash,
        }]
      : []);
  return { tourId: tour.id, label, nodes: tour.nodes, stops, ready: stops.length > 0 };
}

/** **Άνοιξε μια επίσκεψη** — κρίση, κουπόνι, ίχνος (μία φορά ανά επίσκεψη), μανιφέστο. */
export async function openTourViewSession(db: Firestore, input: TourViewSessionInput): Promise<TourViewSessionOutcome> {
  const location = await locateSpatialTour(db, input.subject);
  if (location.kind !== 'found' || location.tour === null) return refuseTourAccess('tour-absent');
  const { tour, tourRef } = location;
  if (!isOwnedByCustody(tour.custody, location.custody)) return refuseTourAccess('tour-custody-mismatch');

  const viewerUid = input.actor?.listing.uid ?? null;
  const isManager = input.actor !== null && mayManageTour(location.record, input.actor) === 'granted';
  const [request, linkShareId] = await Promise.all([
    requestStandingOf(tourRef, viewerUid, input.nowMs),
    activeTourShareId(db, input.openedShareId, tour.id, input.nowMs),
  ]);
  const verdict = judgeTourView({
    lifecycle: tour.lifecycle, visibility: tour.visibility, isManager, viewerUid,
    requestStanding: request.standing, requestId: request.requestId, linkShareId,
  });
  if (verdict.kind === 'refused') return refuseTourAccess(verdict.reason);

  const grant: TourViewGrant = { tourId: tour.id, basis: verdict.basis, basisId: verdict.basisId };
  if (isNewVisit(input.presentedGrant, grant) && verdict.basis === 'request' && request.requestRef !== null) {
    await recordTourRequestVisit(db, request.requestRef);
  }
  const manifest = await manifestOf(tour, tourRef, location.label);
  return { kind: 'granted', grant, token: issueTourViewGrant(grant, input.nowMs), manifest };
}

/** Ίδια επίσκεψη = ζωντανό κουπόνι **της ίδιας βάσης** — αλλαγή βάσης (π.χ. εγκρίθηκε τώρα) μετρά ως νέα. */
function isNewVisit(presented: TourViewGrant | null, next: TourViewGrant): boolean {
  return presented === null || presented.basis !== next.basis || presented.basisId !== next.basisId;
}

