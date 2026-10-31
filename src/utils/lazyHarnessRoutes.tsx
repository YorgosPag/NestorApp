'use client';

/**
 * =============================================================================
 * LAZY HARNESS ROUTES — το μητρώο των σελίδων δοκιμών (ADR-280 §11.8 Β4.3)
 * =============================================================================
 *
 * Οι σελίδες `test-harness/*` σέρνουν το δέντρο DXF/BIM στη **στατική** τους κλειστότητα· μόλις το
 * `dxf-viewer` βγει από την εκκίνηση (Β5) θα ζωγράφιζαν ωμά κλειδιά. Εδώ το chunk τους **περιμένει**
 * τη γραμμή του `lazy-route-namespaces.json` — η ΙΔΙΑ μηχανή με το `LazyRoutes` (`lazyRouteFactory`).
 *
 * Χωριστό αρχείο από το `lazyRoutes.tsx` επίτηδες: το μητρώο προϊόντος δεν γνωρίζει σελίδες δοκιμών.
 *
 * ⚠️ **STUBS ΠΑΡΑΓΩΓΗΣ** (`next.config.js`, `harnessStubs`): το alias έχει κλειδί το **απόλυτο** `*.tsx`
 * του harness και το webpack το εφαρμόζει στο στάδιο `file` (μετά τη λύση του `@/…`) — άρα το `import()`
 * εδώ πέφτει στο `*.prod.ts` όπως το στατικό import πριν. Άγκυρα: `__tests__/lazyHarnessRoutes.test.ts`.
 *
 * ⚠️ Επίπεδο 2 (CHECK 3.80): εισάγει **μόνο** το factory.
 *
 * @module utils/lazyHarnessRoutes
 * @enterprise ADR-280 §11.8 · ADR-744 §33.4
 */

import { defineLazyRoutes, defineLazySurfaces } from './lazyRouteFactory';

export const LazyHarnessRoutes = defineLazyRoutes({
  HarnessContactMutation: {
    load: () => import('@/components/contacts/testing/ContactMutationHarness').then(mod => ({ default: mod.ContactMutationHarness })),
    loadingType: 'spinner', ssr: false,
  },
  HarnessBim3D: {
    load: () => import('@/app/(app)/test-harness/bim-3d/Bim3DHarness'),
    loadingType: 'spinner', ssr: false,
  },
  HarnessDxfCanvas: {
    load: () => import('@/app/(bare)/test-harness/dxf-canvas/DxfCanvasHarness'),
    loadingType: 'spinner', ssr: false,
  },
});

export const LazyHarnessSurfaces = defineLazySurfaces({
  HarnessCursorSettingsPanel: {
    load: () => import('@/subapps/dxf-viewer/ui/CursorSettingsPanel'),
  },
});
