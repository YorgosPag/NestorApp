'use client';

/**
 * **`/o/<γραφείο>/cases/[engagementId]` — μία υπόθεση, στον χώρο του ΓΡΑΦΕΙΟΥ** (ADR-901 §15 Γ2).
 *
 * Λεπτό κέλυφος του {@link EngagedCaseContent} — η ίδια σελίδα-περιεχόμενο με το προσωπικό
 * `(me)/engagements/[engagementId]/page.tsx`.
 *
 * 🔑 Η διεύθυνση φέρει τη **συμμετοχή** (`eng_…`), όχι την υπόθεση: το δικαίωμα το κρίνει ο server
 *    (`decideEngagement`, ανά αίτημα). Υπόθεση που **δεν** ενεργεί για αυτό το γραφείο ⇒ ο server απαντά πού ζει και
 *    η σελίδα πηγαίνει εκεί — ποτέ 404 για δική του υπόθεση, ποτέ άνοιγμα κάτω από ξένο πρόθεμα.
 * ⚠️ `params` = `Promise` (Next 15) — διαβάζεται με `use()`. Το `workspace` **δεν** διαβάζεται εδώ: ο χώρος κρίνεται
 *    στο layout (CHECK 3.58).
 * 🔑 `use client` **για το slice** (ADR-744 §15 · §18): το καταχωρεί το κέλυφος, γιατί η σελίδα-περιεχόμενο υπηρετεί
 *    δύο διαδρομές. Σε Server Component η εγγραφή θα έγραφε σε **άλλο** στιγμιότυπο i18next.
 *
 * @module app/(app)/o/[workspace]/cases/[engagementId]/page
 */

import { use } from 'react';

import { EngagedCaseContent } from '@/components/conveyance/my-cases/EngagedCaseContent';
import routeSlice from '@/i18n/generated/routes/o__workspace__cases__engagementId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

interface OfficeEngagedCasePageProps {
  readonly params: Promise<{ readonly engagementId: string }>;
}

export default function OfficeEngagedCasePage({ params }: OfficeEngagedCasePageProps) {
  const { engagementId } = use(params);

  return <EngagedCaseContent engagementId={engagementId} home="org" />;
}
