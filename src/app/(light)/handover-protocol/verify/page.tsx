'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/handover-protocol__verify.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-916 Φ-Γ2 Σ6 — Η ΔΗΜΟΣΙΑ ΠΟΡΤΑ ΕΠΑΛΗΘΕΥΣΗΣ: το PDF ελέγχεται στη συσκευή, στο μητρώο φτάνει μόνο το αποτύπωμα.
import { HandoverProtocolVerifyRoute } from '@/components/handover-protocol-verify/HandoverProtocolVerifyRoute';

registerRouteSlice(routeSlice);

export default function HandoverProtocolVerifyPage() {
  return <HandoverProtocolVerifyRoute />;
}
