import 'server-only';

/**
 * =============================================================================
 * SHARE CREATE AUTHORITY — «ποιος μπορεί να δώσει σύνδεσμο για ΑΥΤΟ το είδος;» (ADR-315 · ADR-884 Κ3β)
 * =============================================================================
 *
 * Μέχρι το Κ3β η απάντηση ήταν **μία** για όλα τα είδη: «η οντότητα ανήκει στον μισθωτή σου»
 * (`mayShareEntity`). Για επαφή, αρχείο ή βιτρίνα αυτό αρκεί — ο σύνδεσμος **δείχνει** κάτι.
 *
 * 🔴 **Για περιήγηση ΔΕΝ αρκεί**: ο σύνδεσμος θέασης **δίνει πρόσβαση** σε περιήγηση `on-request` ή
 * `link-only`, και το «ποιος βλέπει» το αποφασίζει ο **υπεύθυνος** της αγγελίας (§12 Δ3) — όχι κάθε μέλος
 * του γραφείου. Άρα το είδος `spatial_tour` ρωτά τον **υπάρχοντα** κριτή (`locateManagedTour` →
 * `mayManageTour` + ίδιος κάτοχος), πάνω στη **ρίζα** που γράφει το ίδιο το έγγραφο της περιήγησης.
 *
 * 🔑 `Record<ResolvableShareKind, …>`: νέο είδος **δεν μεταγλωττίζεται** μέχρι να απαντήσει ποιος το
 * δημιουργεί. Ο κριτής είναι **ένας** ανά είδος και ζει εδώ — ο γραφέας (`createShareOnServer`) τον ρωτά.
 *
 * @module server/sharing/share-create-authority
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isPlaceSource } from '@/constants/place-sources';
import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import type { ResolvableShareKind } from '@/services/sharing/share-resolve-contract';
import { locateManagedTour } from '@/server/spatial-tour/tour-access-shared';
import type { CapabilitySubject } from '@/types/capability-authority';

import { mayShareEntity } from './share-entity-access';

/** Ο καλών — από την επαληθευμένη συνεδρία, ποτέ από το σώμα. */
export interface ShareCreator {
  readonly uid: string;
  readonly companyId: string;
  /**
   * Η όψη ρόλου του καλούντα — τη χρειάζονται μόνο είδη που κρίνουν **δυνατότητα**, όχι σκέτο μισθωτή
   * (`spatial_tour`). Απούσα ⇒ τα είδη αυτά **αρνούνται** (fail-closed).
   */
  readonly capability?: CapabilitySubject;
}

type ShareCreateAuthority = (adminDb: Firestore, creator: ShareCreator, entityId: string) => Promise<boolean>;

/** Ο κριτής των περισσότερων: «ανήκει η οντότητα στον μισθωτή σου;». */
function tenantAuthority(kind: ResolvableShareKind): ShareCreateAuthority {
  return async (adminDb, creator, entityId) => {
    const definition = ShareEntityRegistry.get(kind);
    return definition !== null && mayShareEntity(adminDb, definition, creator.companyId, entityId);
  };
}

/** Περιήγηση: η ρίζα διαβάζεται από το **έγγραφο της περιήγησης**, και κρίνει ο υπεύθυνός της. */
async function tourManagerAuthority(adminDb: Firestore, creator: ShareCreator, tourId: string): Promise<boolean> {
  if (creator.capability === undefined) return false;
  const definition = ShareEntityRegistry.get('spatial_tour');
  if (definition === null) return false;
  const snap = await adminDb.collection(definition.entityCollection).doc(tourId).get();
  const subject = (snap.data() ?? {}).subject as { kind?: unknown; id?: unknown } | undefined;
  if (!isPlaceSource(subject?.kind) || typeof subject?.id !== 'string') return false;
  const managed = await locateManagedTour(adminDb, { kind: subject.kind, id: subject.id }, {
    listing: { uid: creator.uid, companyId: creator.companyId },
    capability: creator.capability,
  });
  // 🔴 Η ρίζα οδηγεί στην **ίδια** περιήγηση — ποτέ σύνδεσμος για id που δεν είναι η περιήγηση της ρίζας.
  return managed.kind === 'managed' && managed.tourRef.id === tourId;
}

const AUTHORITY: Readonly<Record<ResolvableShareKind, ShareCreateAuthority>> = {
  file: tenantAuthority('file'),
  contact: tenantAuthority('contact'),
  property_showcase: tenantAuthority('property_showcase'),
  project_showcase: tenantAuthority('project_showcase'),
  building_showcase: tenantAuthority('building_showcase'),
  storage_showcase: tenantAuthority('storage_showcase'),
  parking_showcase: tenantAuthority('parking_showcase'),
  spatial_tour: tourManagerAuthority,
};

/** **Μπορεί ο καλών να δώσει σύνδεσμο για αυτή την οντότητα;** */
export function mayCreateShare(
  adminDb: Firestore,
  kind: ResolvableShareKind,
  creator: ShareCreator,
  entityId: string,
): Promise<boolean> {
  if (!creator.companyId || !entityId) return Promise.resolve(false);
  return AUTHORITY[kind](adminDb, creator, entityId);
}
