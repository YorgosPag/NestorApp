/**
 * **`/o/<χώρος>/construction` — η ρίζα της κατασκευής** (ADR-923 §23.2 K3, ως κλάση).
 *
 * Η κατασκευή δεν έχει δική της αρχική· η κύρια οθόνη της είναι το χαρτοφυλάκιο έργων
 * ({@link APP_ROUTES}.constructionPortfolio, το ίδιο που δείχνει το πλαϊνό μενού). Χωρίς
 * αυτή τη σελίδα η διεύθυνση έδινε **404** — και την παράγει ο επιλογέας εταιρείας, που
 * κρατά μόνο τον **τομέα** της σελίδας (ADR-849 Β1).
 *
 * ⚠️ Μέσα από το σύνορο του διακομιστή: ωμό `redirect` θα έπεφτε στο δίχτυ και θα πήγαινε
 * στον χώρο **του θεατή**, όχι σε αυτόν της διεύθυνσης (ADR-875 §11).
 *
 * @module app/(app)/o/[workspace]/construction/page
 */

import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { redirect } from '@/lib/workspace/server-navigation';

interface ConstructionRootPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

export default async function ConstructionRootPage({ params }: ConstructionRootPageProps) {
  const { workspace } = await params;
  redirect(APP_ROUTES.constructionPortfolio, workspace);
}
