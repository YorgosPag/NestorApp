/**
 * **`/o/<χώρος>/storage` — η ρίζα των αποθηκών** (ADR-923 §23.2 K3, ως κλάση).
 *
 * Το `/storage/:id` είναι μόνο σύνδεσμος βάθους προς την οθόνη των Χώρων· η οθόνη η ίδια
 * ζει στο {@link ENTITY_ROUTES}.spaces.storageList. Χωρίς αυτή τη σελίδα η ρίζα έδινε
 * **404** — και την παράγει ο επιλογέας εταιρείας από κάθε `/storage/:id` (ADR-849 Β1).
 *
 * ⚠️ Μέσα από το σύνορο του διακομιστή (ADR-875 §11).
 *
 * @module app/(app)/o/[workspace]/storage/page
 */

import { ENTITY_ROUTES } from '@/lib/routes';
import { redirect } from '@/lib/workspace/server-navigation';

interface StorageRootPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

export default async function StorageRootPage({ params }: StorageRootPageProps) {
  const { workspace } = await params;
  redirect(ENTITY_ROUTES.spaces.storageList, workspace);
}
