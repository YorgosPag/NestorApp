/**
 * 🅿️ Parking API — κοινοί αναγνώστες Firestore + τύποι απόκρισης.
 *
 * Βγήκαν από το `route.ts` όταν ο καθαρισμός της νεκρής δικλείδας 503 (ADR-245)
 * το έσπρωξε πάνω από το όριο των 300 γραμμών του CHECK 4. **Δεν είναι μηχανικό
 * κόψιμο**: και οι τρεις αναγνώστες ήταν ήδη γραμμένοι δύο φορές μέσα στο route
 * (ανά κτήριο / ανά έργο, και οι δύο κλάδοι super-admin). Ο αποκλεισμός των
 * soft-deleted (ADR-281) και το φίλτρο `companyId` (ADR-232) ζουν πλέον σε ΕΝΑ
 * σημείο, ώστε μια μελλοντική διαδρομή φίλτρου να μην μπορεί να τα ξεχάσει.
 */
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { requireAdminFirestore } from '@/lib/api/admin-db';
import { mapParkingDoc } from '@/lib/firestore-mappers';
import type { ParkingSpot as CanonicalParkingSpot } from '@/types/parking';

export interface ParkingData {
  parkingSpots: CanonicalParkingSpot[];
  count: number;
  cached: boolean;
  buildingId?: string;
  projectId?: string;
}

export interface ParkingAPIResponse {
  success: boolean;
  data?: ParkingData;
  error?: string;
  details?: string;
}

/**
 * Δομικός τύπος αντί για `QueryDocumentSnapshot` — ο mapper χρειάζεται μόνο
 * `id` + `data()`, οπότε το module δεν σέρνει εξάρτηση από το firebase-admin.
 */
interface ParkingDocLike {
  readonly id: string;
  data(): unknown;
}

/** ADR-281 — τα soft-deleted δεν εμφανίζονται ΠΟΤΕ σε λίστα. Ένα σημείο, τρεις καλούντες. */
function mapActiveParkingSpots(docs: readonly ParkingDocLike[]): CanonicalParkingSpot[] {
  return docs
    .map(doc => mapParkingDoc(doc.id, doc.data() as Record<string, unknown>))
    .filter(spot => spot.status !== 'deleted');
}

/**
 * ADR-232 — ο super admin βλέπει ολόκληρη τη συλλογή, ο απλός χρήστης μόνο την
 * εταιρεία του. Το ίδιο τριαδικό ήταν αντιγραμμένο σε κτήρια + θέσεις στάθμευσης.
 */
async function fetchCompanyScopedDocs(
  collectionName: string,
  isSuperAdmin: boolean,
  companyId: string,
): Promise<ParkingDocLike[]> {
  const collection = requireAdminFirestore().collection(collectionName);
  const snapshot = await (isSuperAdmin
    ? collection.get()
    : collection.where(FIELDS.COMPANY_ID, '==', companyId).get());
  return snapshot.docs;
}

/** Ανάκτηση θέσεων με φίλτρο ισότητας (ανά κτήριο ή ανά έργο). */
export async function fetchParkingSpotsWhere(
  field: string,
  value: string,
): Promise<CanonicalParkingSpot[]> {
  const snapshot = await requireAdminFirestore()
    .collection(COLLECTIONS.PARKING_SPACES)
    .where(field, '==', value)
    .get();

  return mapActiveParkingSpots(snapshot.docs);
}

/** Τα κτήρια που «βλέπει» ο καλών — ο έλεγχος πρόσβασης της χωρίς φίλτρα διαδρομής. */
export async function fetchAuthorizedBuildingIds(
  isSuperAdmin: boolean,
  companyId: string,
): Promise<Set<string>> {
  const docs = await fetchCompanyScopedDocs(COLLECTIONS.BUILDINGS, isSuperAdmin, companyId);
  return new Set(docs.map(doc => doc.id));
}

/** Όλες οι ενεργές θέσεις της εταιρείας (κτήρια + ανοιχτοί χώροι). */
export async function fetchCompanyParkingSpots(
  isSuperAdmin: boolean,
  companyId: string,
): Promise<CanonicalParkingSpot[]> {
  const docs = await fetchCompanyScopedDocs(COLLECTIONS.PARKING_SPACES, isSuperAdmin, companyId);
  return mapActiveParkingSpots(docs);
}
