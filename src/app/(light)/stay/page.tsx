'use client';

/**
 * `/stay` — **η ακτίνα της βραχυχρόνιας μίσθωσης** (ADR-777 §8.82).
 *
 * Ζει στο `(light)` μαζί με τον κόμβο `/` και την ακτίνα `/pro`: επισκέπτης **ανώνυμος**,
 * χωρίς sidebar. Δηλωμένη εκτός χώρου στο `lib/workspace/workspace-scope.ts` (`stay`).
 *
 * ⚠️ **Καμία `useSearchParams` ⇒ κανένα όριο `<Suspense>`** (CHECK 3.55): η σελίδα δεν
 *    διαβάζει ερώτημα — γράφει ένα, στον σύνδεσμο προς την οθόνη 2.
 */

// 🧩 ADR-744 §8 — per-route slice, ΣΤΑΤΙΚΑ, σε εμβέλεια module (όπως `/search/results`):
//    με `import()` τα κλειδιά θα ήταν ωμά για ένα καρέ και κρυμμένα από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/stay.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import { ShortStayLandingContent } from '@/components/short-stay-landing/ShortStayLandingContent';

registerRouteSlice(routeSlice);

export default function ShortStayLandingPage() {
  return <ShortStayLandingContent />;
}
