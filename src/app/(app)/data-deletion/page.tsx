'use client';

import '@/lib/design-system';
// 🔴 ADR-744 §18 — ΤΟ SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ, ΣΤΑΤΙΚΑ ΚΑΙ ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
// ⚠️ ΠΟΤΕ `import()` (κρύβει το ωμό κλειδί από το CHECK 3.51)· ΠΟΤΕ σε Server Component.
import routeSlice from '@/i18n/generated/routes/data-deletion.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
// 🔴 ADR-816 — η γεωμετρία και η τυπογραφία ανάγνωσης (WCAG 1.4.8) ανήκουν στο κέλυφος.
import { ShellSurface } from '@/core/containers/ShellSurface';
// 🔴 ADR-861 Φ3 — το κείμενο είναι η ΕΚΔΟΣΗ ΣΕ ΙΣΧΥ (παγωμένα bytes), όχι ζωντανά κλειδιά·
// η δομή ζει στο `constants/legal-documents.ts` και η ημερομηνία στο μητρώο εκδόσεων.
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';

registerRouteSlice(routeSlice);

export default function DataDeletionPage() {
  return (
    <ShellSurface measure="prose">
      <LegalDocumentView document="data-deletion" />
    </ShellSurface>
  );
}
