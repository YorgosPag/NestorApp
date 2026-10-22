'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/handover-protocol__verify__protocolId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-916 Φ-Γ2 Σ6 — Ο ΣΥΝΔΕΣΜΟΣ ΤΟΥ QR: η καταχώριση του μητρώου για ΑΥΤΟΝ τον κωδικό, και ο έλεγχος του PDF.
import { HandoverProtocolVerifyRoute } from '@/components/handover-protocol-verify/HandoverProtocolVerifyRoute';

registerRouteSlice(routeSlice);

export default function HandoverProtocolVerifyRecordPage() {
  return <HandoverProtocolVerifyRoute />;
}
