/**
 * @fileoverview **«Ποια έκδοση σερβίρεις ΤΩΡΑ;»** — η μία ερώτηση που κρίνει αν μια αποτυχία
 * φόρτωσης κώδικα είναι δίκτυο ή αλλαγή έκδοσης.
 * @related ADR-860 §Ε0 · lib/app-version/deployment-identity.ts
 * @module app/api/build-info/route
 *
 * 🔑 **Καλείται ΜΟΝΟ μετά από αποτυχία** φόρτωσης chunk (που επέζησε της επανάληψης) — όχι σε
 * polling. Ο browser συγκρίνει την απάντηση με τη δική του `getDeploymentId()`.
 *
 * ⛔ **`no-store`, πάντα**: μια απάντηση σε cache θα έλεγε «ίδια έκδοση» μετά από deploy — το
 * ακριβώς αντίθετο από αυτό που ρωτάμε.
 *
 * ⛔ **ΤΙΠΟΤΑ ΑΛΛΟ ΣΤΟ ΣΩΜΑ.** Ένα git SHA ενός δημόσιου προϊόντος δεν είναι μυστικό (το ίδιο
 * φεύγει ήδη μέσα σε κάθε bundle)· εκδόσεις εξαρτήσεων, περιβάλλον ή χρόνοι build **θα ήταν**
 * χάρτης αναγνώρισης. Πρότυπο `api/health/config/route.ts`: ανώνυμα φεύγει μόνο η ετυμηγορία.
 *
 * ⚠️ **Rate limit και εδώ**: ανώνυμο και φθηνό — ίδια απόφαση με το `/api/health/config`.
 */

import { NextResponse } from 'next/server';

import type { BuildInfoResponse } from '@/lib/app-version/build-info-contract';
import { getDeploymentId } from '@/lib/app-version/deployment-identity';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

// Η απάντηση δεν επιτρέπεται να προ-αποδοθεί: θα πάγωνε την έκδοση του build που την απέδωσε.
export const dynamic = 'force-dynamic';

function handler(): NextResponse<BuildInfoResponse> {
  return NextResponse.json(
    { deploymentId: getDeploymentId() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export const GET = withStandardRateLimit(handler);
