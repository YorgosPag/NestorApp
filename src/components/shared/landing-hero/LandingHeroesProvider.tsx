'use client';

/**
 * @fileoverview **Οι δημοσιευμένοι ήρωες, από τον διακομιστή στον ήρωα** (ADR-881 §4.3).
 * @related services/landing-hero/landing-hero-reader · LandingHero · app/(light)/layout
 * @module components/shared/landing-hero/LandingHeroesProvider
 *
 * 🔑 **Ο ΚΑΤΑΝΑΛΩΤΗΣ ΔΕΝ ΑΛΛΑΖΕΙ**: κάθε σελίδα συνεχίζει να δίνει στον ήρωα την **ενσωματωμένη** της
 *    εικόνα (`LANDING_HERO_IMAGES.x`, που κουβαλά το `page`). Ο ήρωας ρωτά εδώ *«υπάρχει δημοσιευμένη
 *    έκδοση για αυτή τη σελίδα;»* — ναι ⇒ εκείνη· όχι, ή κανένας provider (tests, άλλο layout) ⇒ η
 *    ενσωματωμένη. Μία απόφαση, σε ένα σημείο ({@link useLandingHeroImage}).
 *
 * ⚠️ Τα δεδομένα έρχονται **σειριοποιημένα από τον server** (props του layout) — καμία ανάγνωση
 *    Firestore στον browser, κανένα αναβόσβημα της προεπιλογής.
 */

import React, { createContext, useContext } from 'react';

import type {
  LandingHeroFallback,
  LandingHeroImage,
  LandingHeroSet,
} from '@/lib/landing/landing-hero-vocabulary';

const LandingHeroesContext = createContext<LandingHeroSet | null>(null);

export function LandingHeroesProvider({
  heroes,
  children,
}: {
  readonly heroes: LandingHeroSet;
  readonly children: React.ReactNode;
}) {
  return <LandingHeroesContext.Provider value={heroes}>{children}</LandingHeroesContext.Provider>;
}

/** **Η μία απόφαση**: δημοσιευμένη έκδοση της σελίδας, αλλιώς η ενσωματωμένη. */
export function useLandingHeroImage(fallback: LandingHeroFallback): LandingHeroImage {
  const heroes = useContext(LandingHeroesContext);
  return heroes?.[fallback.page] ?? fallback;
}
