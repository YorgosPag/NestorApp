'use client';

/**
 * =============================================================================
 * LAZY ROUTE FACTORY — ΤΟ PRIMITIVE, ΕΠΙΠΕΔΟ 1 (ADR-858 §6α.2)
 * =============================================================================
 *
 * Η εργοστασιακή συνάρτηση από την οποία χτίζονται **όλα** τα registries διαδρομών.
 * Δεν εισάγει κανένα registry — και αυτός ακριβώς είναι ο λόγος ύπαρξής του.
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ.** Μέχρι τις 2026-09-12 το `createLazyRoute` ζούσε μέσα
 * στο `lazyRoutes.tsx`, που κάνει top-level `...lazyRoutesAdr294`, ενώ το
 * `lazyRoutesAdr294.tsx` εισήγαγε πίσω το `createLazyRoute` ⇒ **αμοιβαίος κύκλος**.
 * Ο κίνδυνος ήταν **ασύμμετρος**, και εκεί κρύβεται όλο το νόημα:
 *
 * | σκέλος                                | δήλωση          | ανυψώνεται; | σκάει; |
 * |---------------------------------------|-----------------|-------------|--------|
 * | `lazyRoutesAdr294` → `createLazyRoute` | `export function` | ΝΑΙ       | όχι    |
 * | `lazyRoutes` → `lazyRoutesAdr294`      | `export const`    | **ΟΧΙ (TDZ)** | **ΝΑΙ** |
 *
 * Δηλαδή: `Cannot access 'lazyRoutesAdr294' before initialization` **αν ο bundler
 * αξιολογήσει πρώτο το `lazyRoutesAdr294`** — απόφαση που αλλάζει ανά build (το
 * tree-shaking αναδιατάσσει), γι' αυτό «δουλεύει τοπικά, σκάει στην παραγωγή».
 * Ακριβώς το σχήμα που έριξε το `/o/<χώρος>/sales/available-properties`.
 *
 * 🔑 **Η ΑΡΧΗ (levelization — Lakos): ένα primitive δεν εισάγει ΠΟΤΕ αυτόν που το
 * καταναλώνει.** Με το `createLazyRoute` εδώ, ο γράφος γίνεται DAG:
 *
 *     lazyRouteSkeletons → lazyRouteFactory → lazyRoutesAdr294 → lazyRoutes
 *
 * Ο κύκλος δεν «μειώνεται»: γίνεται **δομικά αδύνατος**. Το ίδιο φάρμακο με τη Φ.Β
 * του ADR-858 (`storage-utils`).
 *
 * ⚠️ **ΜΗΝ** μετακινήσεις εδώ εγγραφές διαδρομών, και **ΜΗΝ** εισαγάγεις registry:
 * η μονή κατεύθυνση είναι η εγγύηση. Φύλακας: **CHECK 3.80** (`npm run test:module-init`).
 *
 * @module utils/lazyRouteFactory
 * @enterprise ADR-294 (dynamic imports) · ADR-858 (αρχή αξιολόγησης modules)
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { loadNamespace, type Namespace } from '@/i18n/lazy-config';
import {
  PageLoadingSpinner,
  DashboardLoadingSkeleton,
  FormLoadingSkeleton,
  ListLoadingSkeleton,
} from './lazyRouteSkeletons';

/** Το λεξιλόγιο των fallback όψεων — **μία** δήλωση, εδώ. */
export type LoadingType = 'spinner' | 'dashboard' | 'form' | 'list';

/** Επιλογές μιας τεμπέλικης διαδρομής. */
export interface LazyRouteOptions {
  loadingType?: LoadingType;
  /** Προεπιλογή `false`: οι σελίδες-περιεχόμενο είναι client-only. SEO ⇒ `true`. */
  ssr?: boolean;
  /**
   * Namespaces που το chunk **περιμένει** πριν αποδώσει (ADR-884 §9.1 Α4).
   *
   * 🔑 Μια σελίδα `ssr: false` είναι **εκτός** route slice (ADR-744: η κλειστότητα κόβεται στο
   * δυναμικό όριο — μετρημένο: `/shared/[token]` = 0 ns). Chunk και namespace είναι δύο
   * ανεξάρτητα αιτήματα· αν φτάσει πρώτο το chunk, ένα καρέ δείχνει ωμά κλειδιά. Εδώ το
   * fallback του `dynamic` μένει ώσπου να φτάσουν **και τα δύο** — χωρίς φραγμό
   * `isNamespaceReady` μέσα στη σελίδα (CHECK 3.25: κενό καρέ σε κάθε επαναφόρτωση).
   */
  namespaces?: readonly Namespace[];
}

/** Module σχήματος `{ default }` — επιτρεπτικό, ώστε να δέχεται named **και** default exports. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyComponentModule = { default: ComponentType<any> };

/**
 * ⚠️ Ο χάρτης ζει **μέσα** στη συνάρτηση, όχι σε module scope — επίτηδες.
 * Ένα top-level `const` που διαβάζει τα εισαγόμενα skeletons θα ήταν *ανάγνωση
 * εισαγόμενου binding σε χρόνο αξιολόγησης module*: ακριβώς το συστατικό που κάνει
 * έναν κύκλο θανάσιμο (ADR-858 §6α). Εδώ ο κύκλος είναι ήδη αδύνατος — αλλά η αρχή
 * δεν χαλαρώνει επειδή σήμερα τυχαίνει να είμαστε ασφαλείς.
 *
 * Το `satisfies` δίνει **εξαντλητικότητα**: νέος `LoadingType` χωρίς skeleton δεν
 * μεταγλωττίζεται, αντί να πέσει σιωπηλά σε `undefined` και να ζωγραφίσει `<undefined />`.
 */
function resolveLoadingComponent(loadingType: LoadingType): ComponentType {
  const byType = {
    spinner: PageLoadingSpinner,
    dashboard: DashboardLoadingSkeleton,
    form: FormLoadingSkeleton,
    list: ListLoadingSkeleton,
  } satisfies Record<LoadingType, ComponentType>;

  return byType[loadingType];
}

/**
 * Δημιουργεί τεμπέλικη διαδρομή με fallback όψη.
 *
 * ⚠️ **`export function` και όχι `export const … = () => …` — επίτηδες.** Η δήλωση
 * συνάρτησης ανυψώνεται ολόκληρη στην κορυφή του module scope, άρα είναι διαθέσιμη
 * πριν εκτελεστεί οποιαδήποτε γραμμή. Ένα `const` εδώ θα είχε TDZ και θα ξαναέφερνε
 * τη δυνατότητα του `ReferenceError` που αυτό το αρχείο υπάρχει για να αποκλείσει.
 */
export function createLazyRoute(
  importFn: () => Promise<LazyComponentModule>,
  options: LazyRouteOptions = {}
) {
  const { loadingType = 'spinner', ssr = false, namespaces = [] } = options;
  const LoadingComponent = resolveLoadingComponent(loadingType);
  const load = namespaces.length === 0
    ? importFn
    : () => Promise.all([importFn(), ...namespaces.map((ns) => loadNamespace(ns))]).then(([mod]) => mod);

  return dynamic(load, {
    loading: () => <LoadingComponent />,
    ssr,
  });
}

/** Ό,τι επιστρέφει το εργοστάσιο — ο τύπος κάθε εγγραφής ενός μητρώου. */
export type LazyRouteComponent = ReturnType<typeof createLazyRoute>;

/** Η δήλωση μιας διαδρομής μέσα στο {@link defineLazyRoutes}: ο φορτωτής και η όψη αναμονής. */
export interface LazyRouteDeclaration extends LazyRouteOptions {
  load: () => Promise<LazyComponentModule>;
}

/**
 * Δηλώνει ένα **μητρώο** τεμπέλικων διαδρομών: `{ Κλειδί: { load, loadingType, ssr } }`.
 *
 * 🔑 **ΤΟ ΚΛΕΙΔΙ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ (ADR-744 §27).** Με το `Κλειδί: createLazyRoute(…)` το
 * εργοστάσιο δεν μάθαινε ποτέ **ποια** διαδρομή χτίζει, άρα ό,τι αφορούσε τη διαδρομή
 * έπρεπε να ξαναγραφτεί με το χέρι δίπλα της. Εδώ το όνομα της ιδιότητας **είναι** η
 * ταυτότητα — και το ίδιο όνομα διαβάζει ο γεννήτορας του `lazy-route-namespaces.json`
 * (`scripts/lib/i18n-shell-slice/lazy-routes.js`, που ψάχνει αυτή ακριβώς την κλήση).
 *
 * ⚠️ `export function`, όχι `const` — ο ίδιος λόγος με το `createLazyRoute`: τα μητρώα
 * το καλούν σε **χρόνο αξιολόγησης module**, και μια δήλωση συνάρτησης δεν έχει TDZ.
 */
export function defineLazyRoutes<T extends Record<string, LazyRouteDeclaration>>(
  declarations: T
): { readonly [K in keyof T]: LazyRouteComponent } {
  const routes: Record<string, LazyRouteComponent> = {};
  for (const [key, { load, ...options }] of Object.entries(declarations)) {
    routes[key] = createLazyRoute(load, options);
  }
  return routes as { readonly [K in keyof T]: LazyRouteComponent };
}
