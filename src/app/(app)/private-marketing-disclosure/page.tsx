'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/private-marketing-disclosure.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-864 Φ3 — η ενημέρωση κλειστής διάθεσης, έκδοση σε ισχύ (παγωμένα bytes, ADR-861 Φ3).
import { ShellSurface } from '@/core/containers/ShellSurface';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';

registerRouteSlice(routeSlice);

export default function PrivateMarketingDisclosurePage() {
  return (
    <ShellSurface measure="prose">
      <LegalDocumentView document="private-marketing-disclosure" />
    </ShellSurface>
  );
}
