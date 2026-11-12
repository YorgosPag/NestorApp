'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/private-marketing-disclosure__versions.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-864 Φ3 — ΟΛΕΣ ΟΙ ΕΚΔΟΣΕΙΣ της ενημέρωσης κλειστής διάθεσης.
import { LegalVersionsRoute } from '@/components/legal/LegalVersionArchive';

registerRouteSlice(routeSlice);

export default function PrivateMarketingDisclosureVersionsPage() {
  return <LegalVersionsRoute document="private-marketing-disclosure" />;
}
