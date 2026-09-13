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
  const { loadingType = 'spinner', ssr = false } = options;
  const LoadingComponent = resolveLoadingComponent(loadingType);

  return dynamic(importFn, {
    loading: () => <LoadingComponent />,
    ssr,
  });
}
