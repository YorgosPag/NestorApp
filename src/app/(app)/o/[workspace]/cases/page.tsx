'use client';

/**
 * **`/o/<γραφείο>/cases` — «Οι υποθέσεις μου», στον χώρο του ΓΡΑΦΕΙΟΥ** (ADR-901 §15 Γ2 · Ε-9 = α).
 *
 * Λεπτό κέλυφος: η ουσία ζει στο {@link MyCasesContent} — **η ίδια** σελίδα-περιεχόμενο με το προσωπικό
 * `(me)/engagements/page.tsx` (Α6: μία λίστα, φίλτρο ο χώρος). Εδώ δηλώνεται **μόνο** το είδος του χώρου.
 *
 * 🔑 Το γραφείο είναι το **δικό του** γραφείο του επαγγελματία — ποτέ ο χώρος του οικοδεσπότη (ADR-862 §9). Την
 *    ιδιότητα μέλους τη φυλά το `o/[workspace]/layout.tsx`· την πρόσβαση σε κάθε υπόθεση ο `decideEngagement`
 *    (`engagement.uid === uid`): διαχειριστής του γραφείου **δεν** βλέπει εδώ υποθέσεις συναδέλφου.
 * ⚠️ Το `<main>` το δίνει το κέλυφος του `(app)` (`MainContentBridge`) — καμία δεύτερη δήλωση εδώ.
 * 🔑 `use client` **για το slice** (ADR-744 §15 · §18): το route slice δένεται με τη **σελίδα**, και η σελίδα-περιεχόμενο
 *    υπηρετεί δύο κελύφη — άρα το καταχωρεί το κέλυφος, όπως το `o/[workspace]/dashboard/page.tsx`. Σε Server
 *    Component η εγγραφή θα έγραφε σε **άλλο** στιγμιότυπο i18next (πράσινη κλήση που δεν κάνει τίποτα).
 *
 * @module app/(app)/o/[workspace]/cases/page
 */

import { MyCasesContent } from '@/components/conveyance/my-cases/MyCasesContent';
import routeSlice from '@/i18n/generated/routes/o__workspace__cases.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export default function OfficeCasesPage() {
  return <MyCasesContent home="org" />;
}
