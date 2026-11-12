'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/handover-protocol__versions__version.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-916 Φ-Γ2 Σ3 — ΜΙΑ ΕΚΔΟΣΗ: κείμενο · αποτύπωμα · λήψη bytes — εκεί που παραπέμπει το σφραγισμένο PDF.
import { LegalVersionRoute } from '@/components/legal/LegalVersionDetail';

registerRouteSlice(routeSlice);

export default function HandoverProtocolVersionPage() {
  return <LegalVersionRoute document="handover-protocol" />;
}
