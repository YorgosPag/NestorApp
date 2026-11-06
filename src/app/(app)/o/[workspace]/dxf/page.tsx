/**
 * **`/o/<χώρος>/dxf` — η ρίζα του DXF** (ADR-923 §23.2 K3, ως κλάση).
 *
 * Ο τομέας έχει μία οθόνη, τον viewer ({@link DXF_VIEWER_ROUTE}). Χωρίς αυτή τη σελίδα η
 * διεύθυνση έδινε **404** — και την παράγει ο επιλογέας εταιρείας, που κρατά μόνο τον
 * **τομέα** της σελίδας (ADR-849 Β1).
 *
 * ⚠️ Το ερώτημα `?lvl=` του viewer **πέφτει επίτηδες**: ονομάζει επίπεδο της **παλιάς**
 * εταιρείας, όπως οι ταυτότητες στο `sectionOf` του επιλογέα.
 *
 * ⚠️ Μέσα από το σύνορο του διακομιστή (ADR-875 §11).
 *
 * @module app/(app)/o/[workspace]/dxf/page
 */

import { DXF_VIEWER_ROUTE } from '@/lib/dxf-viewer/dxf-viewer-routes';
import { redirect } from '@/lib/workspace/server-navigation';

interface DxfRootPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

export default async function DxfRootPage({ params }: DxfRootPageProps) {
  const { workspace } = await params;
  redirect(DXF_VIEWER_ROUTE, workspace);
}
