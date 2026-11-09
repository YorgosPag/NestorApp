/**
 * Firestore Rules — `files_system` (ADR-934 §5.2.2 Μ-β6 · ο χώρος συστήματος των αρχείων)
 *
 * Σχήμα κανόνα: read = `if false` · write = `if false`. Ίδιο σχήμα `FileRecord` με το `files`, αλλά αρχεία που κανένας
 * άνθρωπος δεν διαχειρίζεται (καραντίνα μέσων καταλόγου). Ένας πελάτης που θα τα διάβαζε θα τα έφερνε ξανά στις λίστες
 * του χρήστη· ένας που θα τα έγραφε θα «επανέφερε» ή θα «υιοθετούσε» περιεχόμενο που δεν κρίθηκε ποτέ.
 * @since 2026-11-09 (ADR-934 Μ-β6)
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import {
  defineServerOnlyTenantAnchors,
  defineServerWrittenTenantCell,
  useServerWrittenTenantEmulator,
  type TenantPayload,
} from '../_harness/server-written-tenant-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find((c) => c.collection === 'files_system')!;

const payload: TenantPayload = (companyId) => ({
  companyId,
  cdeReadReach: 'tenant',
  entityType: 'catalog_media_content',
  entityId: '03ab7291bbb7f7e8bb31f13144e107d48293a87e4bcfb2f25e77cdb2f4e183ab',
  domain: 'catalog', category: 'photos', status: 'ready', lifecycleState: 'active', isDeleted: false,
  storagePath: 'companies/c/entities/catalog_media_content/x/domains/catalog/categories/photos/files/file_1.png',
});

describe('files_system.rules — διαβάζει ΚΑΙ γράφει ΜΟΝΟ ο ΔΙΑΚΟΜΙΣΤΗΣ', () => {
  const env = useServerWrittenTenantEmulator();
  for (const cell of COVERAGE.matrix) {
    defineServerWrittenTenantCell(env, cell, COVERAGE.collection, payload);
  }
  defineServerOnlyTenantAnchors(env, COVERAGE.collection, payload);
});
