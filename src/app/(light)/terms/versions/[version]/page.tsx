'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/terms__versions__version.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-861 Φ3 — ΜΙΑ ΕΚΔΟΣΗ: κείμενο όπως πάγωσε · αποτύπωμα · λήψη bytes · «τι άλλαξε».
import { LegalVersionRoute } from '@/components/legal/LegalVersionDetail';

registerRouteSlice(routeSlice);

export default function TermsOfServiceVersionPage() {
  return <LegalVersionRoute document="terms-of-service" />;
}
