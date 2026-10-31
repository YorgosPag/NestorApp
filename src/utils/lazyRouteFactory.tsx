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
import type { ComponentType, ReactElement } from 'react';
import { loadNamespace, isSupportedNamespace, type Namespace } from '@/i18n/lazy-config';
import generatedRouteNamespaces from '@/i18n/generated/lazy-route-namespaces.json';
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
  return lazyChunk(importFn, { loading: () => <LoadingComponent />, ssr, namespaces });
}

/**
 * ADR-280 §11.8 Β4.3 — μια εγγραφή μητρώου **ξέρει να προφορτωθεί**: το `preload()` καλεί το ΙΔΙΟ `load` με
 * το `dynamic` (κώδικας + κείμενα, ένα αίτημα). Πρακτική React Router `route.lazy` / Remix `prefetch="intent"` /
 * Closure `ModuleManager.prefetchModule`: το prefetch περνά από τον φορτωτή του μητρώου **με ταυτότητα**, ποτέ
 * από δεύτερο αντίγραφο του specifier (CHECK 3.34 κανόνας Ρ). Ένα prefetch χωρίς κείμενα θα άφηνε το mount να περιμένει.
 */
type LazyChunkComponent = ReturnType<typeof dynamic> & { readonly preload: () => Promise<void> };

/**
 * ADR-280 §11.8 Β4.1 — ο **ένας** πυρήνας κάθε τεμπέλικου chunk (διαδρομής ή επιφάνειας): κώδικας
 * και namespaces ως **ένα** αίτημα. Δεύτερη υλοποίηση του `Promise.all` θα ήταν δεύτερη μηχανή.
 */
function lazyChunk(
  importFn: () => Promise<LazyComponentModule>,
  { loading, ssr, namespaces }: { loading: () => ReactElement | null; ssr: boolean; namespaces: readonly Namespace[] }
): LazyChunkComponent {
  const load = namespaces.length === 0
    ? importFn
    : () => Promise.all([importFn(), ...namespaces.map((ns) => loadNamespace(ns))]).then(([mod]) => mod);
  return Object.assign(dynamic(load, { loading, ssr }), { preload: () => load().then(() => undefined) });
}

/** Ό,τι επιστρέφει το εργοστάσιο — ο τύπος κάθε εγγραφής ενός μητρώου. */
export type LazyRouteComponent = ReturnType<typeof createLazyRoute>;

/** Η δήλωση μιας διαδρομής μέσα στο {@link defineLazyRoutes}: ο φορτωτής και η όψη αναμονής. */
export interface LazyRouteDeclaration extends LazyRouteOptions {
  load: () => Promise<LazyComponentModule>;
}

/**
 * ADR-744 §27.10 #1 · ADR-280 §11.8 — **τι περιμένει** το chunk μιας διαδρομής: η δήλωση **∪** η γραμμή
 * του παραγόμενου χάρτη `lazy-route-namespaces.json` (ίδιο κλειδί = ίδια ταυτότητα, §27.6).
 *
 * 🔴 Μέχρι εδώ ο χάρτης **παραγόταν, υπογραφόταν και κρινόταν** (CHECK 3.34) αλλά **δεν τον διάβαζε κανείς**:
 * μόνο 4 εγγραφές περίμεναν namespace, οι άλλες βασίζονταν στο ότι το `CRITICAL_NAMESPACES` κατεβάζει
 * τα πάντα στην εκκίνηση (1,9 MB στο `el`, ADR-280 §11.7). Χωρίς αυτή τη σύνδεση καμία οικογένεια δεν
 * μπορεί να βγει από την εκκίνηση χωρίς ωμά κλειδιά στο πρώτο καρέ.
 *
 * 🔑 **Ένωση, όχι αντικατάσταση** (ίδια αρχή με `resolveNamespacesToPreload`): η δήλωση είναι πρόθεση.
 * Για ό,τι είναι ήδη φορτωμένο το `loadNamespace` επιλύεται αμέσως (`isBundleComplete`)· για ό,τι
 * φορτώνεται ήδη, ενώνεται με την ίδια λήψη (`singleFlight`) — καμία διπλή λήψη.
 * ⚠️ Διαβάζεται **μέσα** σε συνάρτηση, όχι σε module scope — η αρχή του `resolveLoadingComponent`.
 */
function awaitedNamespaces(key: string, declared: readonly Namespace[]): readonly Namespace[] {
  const generated: Readonly<Record<string, readonly string[] | undefined>> = generatedRouteNamespaces;
  return [...new Set([...declared, ...(generated[key] ?? []).filter(isSupportedNamespace)])];
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
  return defineLazy(declarations, ({ load, loadingType, ssr }, namespaces) =>
    createLazyRoute(load, { loadingType, ssr, namespaces }));
}

/**
 * Η δήλωση μιας **επιφάνειας** (διάλογος, καρτέλα, πάνελ) μέσα στο {@link defineLazySurfaces}.
 * ⚠️ Χωρίς `ssr`: μια επιφάνεια μοντάρεται από ενέργεια χρήστη, άρα είναι πάντα client-only — ο
 * γεννήτορας **αρνείται** το πεδίο, ώστε καμία επιφάνεια να μη χάσει τη γραμμή της στον χάρτη.
 */
export interface LazySurfaceDeclaration {
  load: () => Promise<LazyComponentModule>;
  /** Ό,τι ζωγραφίζεται όσο φτάνουν κώδικας + κείμενα. Προεπιλογή: τίποτα (η επιφάνεια απλώς αργεί ένα καρέ). */
  fallback?: ComponentType | null;
  namespaces?: readonly Namespace[];
}

/**
 * ADR-280 §11.8 Β4.1 — δηλώνει μητρώο τεμπέλικων **επιφανειών**: `{ Κλειδί: { load, fallback? } }`.
 *
 * 🔑 Η ΙΔΙΑ μηχανή με το {@link defineLazyRoutes}: ίδιο `awaitedNamespaces`, ίδιος χάρτης
 * `lazy-route-namespaces.json`, ίδια απογραφή Κ1/Κ2. Το κλειδί είναι μοναδικό σε **όλα** τα μητρώα.
 * Πρακτική Google Closure / Meta fbt («τα κείμενα ταξιδεύουν με το chunk»), σε χρόνο εκτέλεσης.
 * ⚠️ Το αρχείο που το καλεί **οφείλει** να είναι στο `lazyRouteRegistries` — αλλιώς ο γεννήτορας αρνείται.
 */
export function defineLazySurfaces<T extends Record<string, LazySurfaceDeclaration>>(
  declarations: T
): { readonly [K in keyof T]: LazyRouteComponent } {
  return defineLazy(declarations, ({ load, fallback: Fallback = null }, namespaces) =>
    lazyChunk(load, { loading: () => (Fallback ? <Fallback /> : null), ssr: false, namespaces }));
}

/** Ο **ένας** βρόχος των μητρώων: κάθε κλειδί περνά από το `awaitedNamespaces` πριν χτιστεί. */
function defineLazy<D extends { namespaces?: readonly Namespace[] }, T extends Record<string, D>>(
  declarations: T,
  build: (declaration: D, namespaces: readonly Namespace[]) => LazyRouteComponent
): { readonly [K in keyof T]: LazyRouteComponent } {
  const built: Record<string, LazyRouteComponent> = {};
  for (const [key, declaration] of Object.entries(declarations)) {
    built[key] = build(declaration, awaitedNamespaces(key, declaration.namespaces ?? []));
  }
  return built as { readonly [K in keyof T]: LazyRouteComponent };
}
