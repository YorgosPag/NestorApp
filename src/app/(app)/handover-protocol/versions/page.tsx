'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/handover-protocol__versions.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-916 Φ-Γ2 Σ3 — ΟΛΕΣ ΟΙ ΕΚΔΟΣΕΙΣ των ρητρών του Πρωτοκόλλου παράδοσης.
import { LegalVersionsRoute } from '@/components/legal/LegalVersionArchive';

registerRouteSlice(routeSlice);

export default function HandoverProtocolVersionsPage() {
  return <LegalVersionsRoute document="handover-protocol" />;
}
