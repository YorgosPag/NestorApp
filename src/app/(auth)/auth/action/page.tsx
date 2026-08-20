'use client';

/**
 * `/auth/action` — ο χειριστής των συνδέσμων email του Firebase
 * (επαλήθευση email · επαναφορά κωδικού · ανάκτηση email).
 *
 * 🔴 **ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΜΟΝΟ ΕΝΑ ΟΡΙΟ** (ADR-785 / CHECK 3.55).
 *
 * Το περιεχόμενο διαβάζει `useSearchParams()` — δεδομένα **αιτήματος**, που
 * **δεν υπάρχουν** τη στιγμή της προαπόδοσης. Όσο το hook ζούσε εδώ, και επειδή
 * η ομάδα `(auth)` **δεν έχει** `loading.tsx`, δεν υπήρχε **κανένα** όριο
 * `<Suspense>` από πάνω ⇒ το `next build` **σταματούσε σε αυτή τη σελίδα**:
 *
 *     ⨯ useSearchParams() should be wrapped in a suspense boundary
 *       at page "/auth/action" → exiting the build.
 *
 * Συνέπεια: **καμία** έκδοση δεν έφευγε στο Netcup — το `docker-build.yml`
 * (Tier 1) ήταν κόκκινο από **2026-08-11**, οκτώ μέρες, και **καμία** άλλη πύλη
 * δεν ρωτούσε το ερώτημα. Πλέον το ρωτά η **CHECK 3.55**, στο `git add`.
 *
 * ⚠️ **ΜΗΝ** «λύσεις» μελλοντικό κόκκινο με `export const dynamic = 'force-dynamic'`:
 * δεν είναι λάθος, αλλά πετά τη στατική απόδοση **ΟΛΗΣ** της διαδρομής. Το όριο
 * κρατά το κέλυφος στατικό και αφήνει να περιμένει **μόνο** το κομμάτι που όντως
 * εξαρτάται από το αίτημα — αυτό συστήνει και η τεκμηρίωση του Next.
 *
 * Ίδιο ιδίωμα: `(light)/search/results/page.tsx` · `(auth)/oauth/consent/page.tsx`.
 */

import React, { Suspense } from 'react';

import { AuthActionContent } from '@/auth';
import { StaticPageLoading } from '@/core/states';

export default function AuthActionPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <AuthActionContent />
    </Suspense>
  );
}
