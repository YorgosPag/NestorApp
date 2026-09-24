'use client';

/**
 * `/admin/landing-heroes` — οι εικόνες ήρωα των `/` · `/pro` · `/stay` (ADR-881).
 * Εργαλείο του παρόχου, πάνω από όλους τους χώρους (`workspace-scope.ts` → `admin`).
 */

import { LazyRoutes } from '@/utils/lazyRoutes';

export default function LandingHeroesPage() {
  const LandingHeroes = LazyRoutes.AdminLandingHeroes;
  return <LandingHeroes />;
}
