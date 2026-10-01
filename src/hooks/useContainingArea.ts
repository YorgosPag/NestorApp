'use client';

/**
 * @fileoverview **ΣΕ ΠΟΙΑ ΠΕΡΙΟΧΗ ΠΕΦΤΕΙ ΑΥΤΟ ΤΟ ΣΗΜΕΙΟ — ΜΕΤΡΗΜΕΝΟ, ΜΕ ΟΝΟΜΑ** (ADR-846 §9 #12 · ADR-896 §7.1).
 * @related lib/agency/presence-admin-ids.ts (`containingEntityOfPoint`, η μηχανή) · hooks/useCircleAnchorName.ts ·
 *   components/mandate/CoversHerePrompt.tsx
 * @module hooks/useContainingArea
 *
 * 🔑 **ΕΝΑΣ ΜΗΧΑΝΙΣΜΟΣ, ΔΥΟ ΕΡΩΤΗΣΕΙΣ**: «πώς λέγεται το κέντρο του ερωτήματος;» (`useCircleAnchorName`) και «τι είναι
 * εδώ;» (κλικ σε κενό του χάρτη). Και οι δύο είναι point-in-shape πάνω στα **ίδια** αποτυπώματα Καλλικράτη που
 * χρησιμοποιεί ο κριτής της κάλυψης — άρα η περιοχή που **ονομάζεται** είναι αυτή που **φιλτράρει**.
 *
 * ⚡ Μηδέν νέα bytes: αποτυπώματα και ιεραρχία φορτώνονται **ήδη** στο `/pro` (κριτής κάλυψης, επιλογέας περιοχής).
 *
 * ⚠️ **`null` = «δεν ξέρω»**, ποτέ «πουθενά»: δεν δόθηκε σημείο · δεν φόρτωσαν ακόμη · κανένα κελί δεν το περιέχει
 * **αποδεδειγμένα** (ακτή, θάλασσα) · η ιεραρχία δεν έχει όνομα γι' αυτό. **Ποτέ ωμό `municipality:0701`.**
 *
 * 🔒 Οι εξαρτήσεις του `useMemo` είναι **αληθινές** (μάθημα §6.2): `entries` αλλάζει όταν φτάνουν τα αποτυπώματα,
 * `findById` όταν φτάνει η ιεραρχία — χωρίς αυτό το hook θα πάγωνε στο «δεν ξέρω» σε κάθε κρύο φόρτωμα.
 */

import { useMemo } from 'react';

import { useAdminFootprints } from '@/hooks/useAdminFootprints';
import { lineageIdsOf, useAdministrativeHierarchy } from '@/hooks/useAdministrativeHierarchy';
import { containingEntityOfPoint } from '@/lib/agency/presence-admin-ids';
import type { GeoPoint } from '@/types/geo/coordinates';

/** Η περιοχή που περιέχει αποδεδειγμένα ένα σημείο — ταυτότητα (για φίλτρο) **και** όνομα (για τον άνθρωπο). */
export interface ContainingArea {
  readonly adminId: string;
  readonly name: string;
}

export function useContainingArea(point: GeoPoint | null): ContainingArea | null {
  const { entries } = useAdminFootprints();
  const { findById } = useAdministrativeHierarchy();

  return useMemo(() => {
    if (point === null) return null;
    const adminId = containingEntityOfPoint(point, entries, lineageIdsOf);
    if (adminId === null) return null;
    // Αποτυπώματα και ιεραρχία είναι ΔΥΟ αρχεία — μπορούν να αποκλίνουν κατά μία ανάπτυξη.
    const name = findById(adminId)?.name ?? null;
    return name === null ? null : { adminId, name };
  }, [point, entries, findById]);
}
