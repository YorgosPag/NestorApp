import 'server-only';

/**
 * @fileoverview **Η διεύθυνση του τόπου ενός ακινήτου** — μία γραμμή, για όποιον πρέπει να πάει εκεί (αυτοψία).
 * @related ADR-915 §45.10 (Π-7: «η ακριβής διεύθυνση μετά την έγκριση») · ADR-167 (πολλαπλές διευθύνσεις)
 * @module server/lib/property-site-address.server
 *
 * 🔑 **Καμία νέα πηγή**: διευθύνσεις του **κτιρίου** (`building.addresses`, ό,τι γράφει η καρτέλα «Διευθύνσεις» του
 *    κτιρίου) → του **έργου** (`project.addresses`) → τα παλιά επίπεδα πεδία (`address`/`city`, ADR-167
 *    `migrateLegacyAddress`). Η κύρια διεύθυνση και η μορφή της από τα `address-helpers` — ποτέ δεύτερος μορφοποιητής.
 * 🔒 Κάθε έγγραφο περνά από `ownedOrNull`: ξένο ≡ ανύπαρκτο (ADR-742).
 * ⚠️ **Αποτυχία ⇒ `null`** («δεν ξέρω»), ποτέ σφάλμα: η όψη που ρωτά ζει χωρίς διεύθυνση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { trimmedStringOrNull } from '@/lib/type-guards';
import { formatFullAddressLine, getPrimaryAddress, migrateLegacyAddress } from '@/types/project/address-helpers';
import type { ProjectAddress } from '@/types/project/addresses';

type DocData = Readonly<Record<string, unknown>>;

const PATH = 'property-site-address';

async function readOwned(db: Firestore, collection: string, id: string | null, companyId: string): Promise<DocData | null> {
  if (id === null) return null;
  const snap = await db.collection(collection).doc(id).get();
  return ownedOrNull(snap.data(), companyId, { resource: collection, resourceId: id, path: PATH });
}

/** Η κύρια διεύθυνση ενός εγγράφου (κτίριο ή έργο): πρώτα ο πίνακας, μετά τα παλιά επίπεδα πεδία. */
function primaryAddressOf(data: DocData | null): ProjectAddress | undefined {
  if (data === null) return undefined;
  const listed = Array.isArray(data.addresses) ? getPrimaryAddress(data.addresses as ProjectAddress[]) : undefined;
  if (listed) return listed;
  const address = trimmedStringOrNull(data.address);
  return address === null ? undefined : getPrimaryAddress(migrateLegacyAddress({ address, city: trimmedStringOrNull(data.city) ?? '' }));
}

/** Η γραμμή διεύθυνσης του ακινήτου — `null` αν δεν είναι του μισθωτή ή δεν δηλώθηκε πουθενά. */
export async function readPropertySiteAddress(db: Firestore, companyId: string, propertyId: string): Promise<string | null> {
  try {
    const property = await readOwned(db, COLLECTIONS.PROPERTIES, propertyId, companyId);
    if (property === null) return null;
    const [building, project] = await Promise.all([
      readOwned(db, COLLECTIONS.BUILDINGS, trimmedStringOrNull(property.buildingId), companyId),
      readOwned(db, COLLECTIONS.PROJECTS, trimmedStringOrNull(property.projectId), companyId),
    ]);
    const primary = primaryAddressOf(building) ?? primaryAddressOf(project);
    return primary ? trimmedStringOrNull(formatFullAddressLine(primary)) : null;
  } catch {
    return null;
  }
}
