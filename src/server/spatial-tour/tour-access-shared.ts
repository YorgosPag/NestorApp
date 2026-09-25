import 'server-only';

/**
 * @fileoverview Τα κοινά του αιτήματος θέασης — αρνήσεις, διεύθυνση εγγράφου, η πόρτα του υπευθύνου.
 * @related ADR-884 Φ0.13 · Φ0.3
 * @module server/spatial-tour/tour-access-shared
 *
 * Ένα σημείο για ό,τι μοιράζονται ο **αιτών** (`tour-access-request`) και ο **υπεύθυνος**
 * (`tour-access-decision`) — ώστε η διεύθυνση του εγγράφου και η κρίση «διαχειρίζεσαι;» να μην γράφονται δύο φορές.
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { mayManageTour, type TourActor } from '@/lib/spatial-tour/tour-authority';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { SpatialTour, TourSubject } from '@/types/spatial-tour';

import { locateSpatialTour } from './tour-locate';

/** Ονομασμένες αρνήσεις — κάθε μία έχει **άλλη** θεραπεία για τον άνθρωπο (ADR-853). */
export type TourAccessRefusal =
  | 'tour-absent'
  | 'not-requestable'
  | 'not-manager'
  | 'expiry-required'
  | 'expiry-past'
  | 'expiry-too-far'
  | 'request-absent'
  | 'not-pending'
  | 'not-active'
  /** Πρόσκληση φωτογράφου χωρίς λόγο — ο φωτογράφος και το ίχνος πρέπει να ξέρουν **γιατί** (Φ0.5). */
  | 'reason-required'
  /** Ανάκληση άδειας λήψης που δεν υπάρχει (ή δεν διαβάζεται). */
  | 'grant-absent';

export type TourAccessRefused = { readonly kind: 'refused'; readonly reason: TourAccessRefusal };

export const refuseTourAccess = (reason: TourAccessRefusal): TourAccessRefused => ({ kind: 'refused', reason });

/**
 * Ο μακρύτερος ορίζοντας κάθε άδειας πάνω σε περιήγηση (θέαση **και** λήψη) — ένα έτος· πέρα από αυτό δεν
 * είναι «άδεια», είναι κοινοποίηση.
 */
export const TOUR_ACCESS_MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

type ExpiryCheck = { readonly ok: true; readonly expiresAt: string } | { readonly ok: false; readonly reason: TourAccessRefusal };

/**
 * **Η λήξη μιας άδειας** (έγκριση αιτήματος θέασης · πρόσκληση φωτογράφου): ρητή, μελλοντική, εντός ορίζοντα —
 * αλλιώς ονομασμένη άρνηση. 🔑 **Ποτέ προεπιλογή εδώ**· ένας έλεγχος για όλες τις άδειες, όχι ένας ανά ροή.
 */
export function checkTourGrantExpiry(expiresAt: string | null, nowMs: number): ExpiryCheck {
  const ms = expiresAt === null ? Number.NaN : Date.parse(expiresAt);
  if (!Number.isFinite(ms)) return { ok: false, reason: 'expiry-required' };
  if (ms <= nowMs) return { ok: false, reason: 'expiry-past' };
  if (ms - nowMs > TOUR_ACCESS_MAX_DAYS * DAY_MS) return { ok: false, reason: 'expiry-too-far' };
  return { ok: true, expiresAt: new Date(ms).toISOString() };
}

/** Το έγγραφο του αιτήματος — **ντετερμινιστικό** ανά (περιήγηση, άνθρωπο) (`tacr`, Φ0.7). */
export function tourAccessRequestRef(tourRef: DocumentReference, uid: string): DocumentReference {
  const id = enterpriseIdService.generateDeterministicTourAccessRequestId(tourRef.id, uid);
  return tourRef.collection(SUBCOLLECTIONS.TOUR_ACCESS_REQUESTS).doc(id);
}

/** Η περιήγηση μιας αγγελίας **που υπάρχει** — αλλιώς `tour-absent` (ρίζα χωρίς περιήγηση = τίποτα να δεις). */
export async function locateExistingTour(
  db: Firestore,
  subject: TourSubject,
): Promise<{ readonly kind: 'found'; readonly tour: SpatialTour; readonly tourRef: DocumentReference } | TourAccessRefused> {
  const location = await locateSpatialTour(db, subject);
  if (location.kind !== 'found' || location.tour === null) return refuseTourAccess('tour-absent');
  return { kind: 'found', tour: location.tour, tourRef: location.tourRef };
}

/**
 * **Η πόρτα του υπευθύνου** — η περιήγηση υπάρχει **και** ο δράστης τη διαχειρίζεται (`mayManageTour`).
 * Κοινή για απόφαση, ανάκληση, λίστα: **ένα** σημείο κρίσης, όχι τρία.
 */
export async function locateManagedTour(
  db: Firestore,
  subject: TourSubject,
  actor: TourActor,
): Promise<{ readonly kind: 'managed'; readonly tourRef: DocumentReference; readonly custody: CustodyScope } | TourAccessRefused> {
  const location = await locateSpatialTour(db, subject);
  if (location.kind !== 'found' || location.tour === null) return refuseTourAccess('tour-absent');
  if (mayManageTour(location.record, actor) !== 'granted') return refuseTourAccess('not-manager');
  return { kind: 'managed', tourRef: location.tourRef, custody: location.custody };
}
