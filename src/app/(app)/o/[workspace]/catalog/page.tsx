/**
 * **`/o/<χώρος>/catalog` — η ρίζα του καταλόγου** (ADR-923 §23.2 K3).
 *
 * Ο κατάλογος δεν έχει δική του αρχική· η κύρια οθόνη του είναι το πλέγμα προϊόντων
 * ({@link CATALOG_PAGES}.products, όπως στο Akeneo). Χωρίς αυτή τη σελίδα, η διεύθυνση
 * έδινε **404** — και την παράγει ο επιλογέας εταιρείας, που κρατά μόνο τον **τομέα**
 * της σελίδας (`/catalog/attributes` ⇒ `/catalog`, ADR-849 Β1).
 *
 * ⚠️ Μέσα από το σύνορο του διακομιστή: ωμό `/catalog/products` θα έπεφτε στο δίχτυ και
 * θα πήγαινε στον χώρο **του θεατή**, όχι σε αυτόν της διεύθυνσης (ADR-875 §11).
 *
 * @module app/(app)/o/[workspace]/catalog/page
 */

import { CATALOG_PAGES } from '@/subapps/catalog/catalog-routes';
import { redirect } from '@/lib/workspace/server-navigation';

interface CatalogRootPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

export default async function CatalogRootPage({ params }: CatalogRootPageProps) {
  const { workspace } = await params;
  redirect(CATALOG_PAGES.products, workspace);
}
