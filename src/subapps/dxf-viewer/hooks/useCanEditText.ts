'use client';

/**
 * ADR-344 Q8 · **ADR-801 Φάση 3** — οι ικανότητες κειμένου του DXF viewer.
 *
 * 🔴 **ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ, ΟΧΙ ΚΑΘΑΡΙΟΤΗΤΑ.**
 * Μέχρι 2026-08-25 αυτό διάβαζε `useUserRole().user?.role` — τιμή με **τρεις**
 * μόνο δυνατές καταστάσεις (`'admin'`·`'authenticated'`·`'public'`) που
 * παράγεται από **λίστα email μέσα στο bundle του φυλλομετρητή**. Κάθε
 * πραγματικός `company_admin` / `super_admin` κατέληγε `'authenticated'` ⇒
 * **μηδέν** δικαιώματα κειμένου.
 *
 * Πλέον η πηγή είναι το `useAuth().user` — **επαληθευμένα custom claims** — και
 * ο κριτής είναι ο **ΕΝΑΣ** (`lib/auth/authority.ts`), μέσω του PEP
 * `useCapabilities`.
 *
 * ⚠️ **ΑΣΦΑΛΕΣΤΕΡΟ, ΟΧΙ ΑΠΛΩΣ ΔΙΑΦΟΡΕΤΙΚΟ**: ο `UserRoleProvider` καλεί ο ίδιος
 * `useAuth()`, άρα ο `AuthProvider` είναι **υποχρεωτικά** πάνω του — όπου
 * δούλευε το `useUserRole`, δουλεύει και αυτό.
 *
 * ⚠️ **ΜΗΝ ξαναφέρεις `capabilitiesForRole(role)`.** Ήταν `switch` σε 13 ρόλους
 * με **10 κλάδους που δεν μπορούσαν να πυροδοτήσουν** — και **11 πράσινα
 * tests** από πάνω, επειδή τον καλούσαν με τιμές που κανείς δεν παράγει.
 */

import { useMemo } from 'react';

import { useCapabilities } from '@/auth/hooks/useCapability';
import {
  capabilitiesFromDecisions,
  TEXT_EDIT_PERMISSIONS,
  type TextEditCapabilities,
} from './text-edit-capabilities';

// ⚠️ ΜΟΝΟ ο τύπος επανεξάγεται — τον καταναλωνει το `TextTemplateList`. Ό,τι
//    άλλο εισάγεται απευθείας από το `text-edit-capabilities`: επανεξαγωγή που
//    δεν ζητά κανείς είναι νεκρό σύμβολο (CHECK 3.30).
export type { TextEditCapabilities } from './text-edit-capabilities';

export function useCanEditText(): TextEditCapabilities {
  const gates = useCapabilities(TEXT_EDIT_PERMISSIONS);
  return useMemo(() => capabilitiesFromDecisions(gates), [gates]);
}
