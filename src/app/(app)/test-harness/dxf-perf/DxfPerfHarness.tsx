'use client';

/**
 * ADR-726 §13.1 — **Α1**: harness που μοντάρει ΟΛΟΚΛΗΡΟ τον `DxfViewerApp`.
 *
 * Γιατί ολόκληρος ο viewer και όχι το υπάρχον `/test-harness/dxf-canvas`:
 * εκείνο μοντάρει **3** καμβάδες· ο viewer έχει **13**, και κανένα από τα overlays
 * της Φ2 δεν υπάρχει εκεί. Το Speedometer 3 (κοινό Chrome + Apple + Mozilla)
 * εγκατέλειψε ρητά το μοτίβο «απομονωμένο component σε στενό βρόχο» υπέρ workload
 * μέσα σε πλήρες UI shell. Γιατί όχι ο πραγματικός `/dxf/viewer`: το `AdminGuard`
 * βάζει auth + Firestore **μέσα** στον βρόχο μέτρησης — ακριβώς ο θόρυβος που το
 * Web Page Replay υπάρχει για να αφαιρέσει (hermeticity).
 *
 * Η τομή των δύο αρχών: πλήρης επιφάνεια εφαρμογής, **μηδέν backend στον βρόχο**.
 *
 * ⚠️ Ο ίδιος ο harness ΔΕΝ τρέχει τίποτα στο παρασκήνιο (ούτε MutationObserver,
 * ούτε interval): ο κώδικας που παρακολουθεί τη σελίδα **είναι** κόστος καρέ μέσα
 * στη σελίδα που μετράμε (ADR-726 §2.2). Το συμβόλαιο ετοιμότητας είναι γι' αυτό
 * **getter κατ' απαίτηση** (`window.__dxfPerfHarness`), τον οποίο το Playwright
 * δημοσκοπεί με `waitForFunction` — ίδιο ιδίωμα με το υπάρχον `window.__dxfTest`
 * (`e2e/dxf-visual-regression.spec.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-726-frame-budget-instrumentation-and-attribution.md §13
 */

import { useCallback, useEffect, type ChangeEvent } from 'react';
import dynamic from 'next/dynamic';
import { EventBus } from '@/subapps/dxf-viewer/systems/events';
// Ίδιος SSoT σύνθεσης κλάσεων με τη διαδρομή παραγωγής (`src/app/dxf/viewer/page.tsx`).
import { cn } from '@/lib/design-system';
// Ίδιο CSS με τη διαδρομή παραγωγής (`src/app/dxf/viewer/layout.tsx`): χωρίς τα ribbon
// design tokens η διάταξη —άρα και το paint— δεν είναι η μετρούμενη διάταξη.
import '@/subapps/dxf-viewer/ui/ribbon/styles/ribbon-tokens.css';

/**
 * Ίδιο module specifier με το `src/app/dxf/viewer/page.tsx` ⇒ ο bundler μοιράζεται
 * το ΙΔΙΟ chunk. Γι' αυτό αυτός ο harness **δεν** χρειάζεται `.prod.ts` stub όπως ο
 * `dxf-canvas`: δεν προσθέτει τίποτα στο bundle παραγωγής που να μην υπάρχει ήδη.
 */
const DxfViewerApp = dynamic(() => import('@/subapps/dxf-viewer/DxfViewerApp'), {
  ssr: false,
});

/** Το συμβόλαιο που διαβάζει το perf spec (Α2). Μόνο getters — μηδέν παρασκήνιο. */
interface DxfPerfHarnessApi {
  /** Πλήθος `<canvas>` που έχουν μονταριστεί. Ο viewer έχει 13 στην πλήρη διάταξη. */
  canvasCount: () => number;
  /**
   * `true` όταν το `DxfViewerContent` έχει μονταριστεί **και** υπάρχει τουλάχιστον
   * ένας καμβάς. Το πρώτο σκέλος διαβάζει τον υπάρχοντα δείκτη παραγωγής
   * `documentElement.dataset.appRoute` (ADR-345), όχι νέο σημάδι για δοκιμές.
   */
  isReady: () => boolean;
}

declare global {
  interface Window {
    __dxfPerfHarness: DxfPerfHarnessApi;
  }
}

const DXF_VIEWER_ROUTE_MARKER = 'dxf-viewer';

/** Ίδια γεωμετρία με το `<main>` της πραγματικής διαδρομής — ο harness δεν αλλάζει διάταξη. */
const FULL_BLEED = 'w-full h-full';

export default function DxfPerfHarness() {
  useEffect(() => {
    window.__dxfPerfHarness = {
      canvasCount: () => document.querySelectorAll('canvas').length,
      isReady: () =>
        document.documentElement.dataset.appRoute === DXF_VIEWER_ROUTE_MARKER &&
        document.querySelectorAll('canvas').length > 0,
    };
  }, []);

  /**
   * Το Playwright ταΐζει αυτό το input με `setInputFiles` (ιδίωμα ήδη σε χρήση στο
   * `FloorplanBackgroundCanvas.e2e.spec.ts`). Το αρχείο ταξιδεύει στο **ΕΝΑ**
   * μονοπάτι εισαγωγής (`handleFileImportWithEncoding`) μέσω του EventBus, επειδή ο
   * harness ζει **έξω** από τη στοίβα providers — δεύτερη υλοποίηση εισαγωγής δεν
   * υπάρχει και δεν πρέπει να υπάρξει (N.0.2 / N.18).
   */
  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // επιτρέπει επανεπιλογή του ίδιου αρχείου
    if (file) EventBus.emit('dxf:import-file', { file });
  }, []);

  return (
    <main data-testid="dxf-perf-harness" className={cn(FULL_BLEED)}>
      <input
        data-testid="dxf-perf-file"
        type="file"
        accept=".dxf,.tek,.txt"
        hidden
        onChange={handleFileChange}
      />
      <DxfViewerApp className={FULL_BLEED} enablePersistence={false} />
    </main>
  );
}
