/**
 * **`/o/<χώρος>/listings` — η ρίζα των αγγελιών του γραφείου** (ADR-923 §23.2 K3, ως κλάση).
 *
 * Η κύρια οθόνη του τομέα είναι ο κατάλογος εντολών ({@link MANDATE_CATALOG_ROUTE}, το ίδιο
 * που δείχνει το πλαϊνό μενού). Χωρίς αυτή τη σελίδα η διεύθυνση έδινε **404** — και την
 * παράγει ο επιλογέας εταιρείας, που κρατά μόνο τον **τομέα** της σελίδας (ADR-849 Β1).
 *
 * ⚠️ Μέσα από το σύνορο του διακομιστή (ADR-875 §11).
 *
 * @module app/(app)/o/[workspace]/listings/page
 */

import { MANDATE_CATALOG_ROUTE } from '@/lib/mandate/mandate-routes';
import { redirect } from '@/lib/workspace/server-navigation';

interface ListingsRootPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

export default async function ListingsRootPage({ params }: ListingsRootPageProps) {
  const { workspace } = await params;
  redirect(MANDATE_CATALOG_ROUTE, workspace);
}
