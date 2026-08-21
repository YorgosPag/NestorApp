/**
 * @fileoverview **«ΤΙ ΛΕΙΠΕΙ ΑΠΟ ΑΥΤΟΝ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ;»** — η ερώτηση που δεν είχε τρόπο να ρωτηθεί.
 * @related ADR-777 §8.35 · `config/environment-contract.ts`
 * @module api/admin/environment
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΜΠΗΚΕ ΣΤΟ `/api/health`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `/api/health` απαντά `ok` σε **τρεις γραμμές** και είναι **σωστό**: ρωτά «ζει η
 * διεργασία;» (*liveness*) και δεν οφείλει να ξέρει τίποτε άλλο — μια απάντηση που
 * εξαρτάται από ρυθμίσεις θα σταματούσε το deploy του **ολόκληρου** ιστότοπου επειδή
 * λείπει το μυστικό **μιας** πύλης.
 *
 * Αυτό εδώ είναι **δεύτερο ερώτημα** («είναι ρυθμισμένο ό,τι δηλώσαμε;») και παίρνει
 * δικό του τελικό σημείο. Δύο ερωτήματα, δύο πόρτες — ποτέ ένα endpoint με «ή».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΙΝΑΙ ΠΙΣΩ ΑΠΟ ΔΙΑΧΕΙΡΙΣΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η απάντηση **δεν** περιέχει τιμές, αλλά περιέχει κάτι εξίσου χρήσιμο σε λάθος χέρια:
 * **ποια δυνατότητα είναι σπασμένη αυτή τη στιγμή**. «Η πύλη προμηθευτή δεν επαληθεύει
 * υπογραφές» είναι πληροφορία αναγνώρισης, όχι διάγνωση, όταν τη διαβάζει ξένος.
 *
 * ⚠️ **ΜΗΝ το κάνεις δημόσιο** για ευκολία επαλήθευσης μετά από deploy: η επαλήθευση
 * γίνεται από τον διαχειριστή, ή από τη γραμμή που γράφει το boot στο ημερολόγιο.
 *
 * ⚠️ **ΜΗΝ επιστρέψεις ποτέ τιμές** — ούτε κομμένες, ούτε «τα 4 τελευταία ψηφία». Ένα
 * μυστικό υπογραφής δεν έχει «ακίνδυνο κομμάτι»: κάθε bit που διαρρέει μικραίνει τον
 * χώρο αναζήτησης.
 */

import { NextRequest, NextResponse } from 'next/server';

import { auditEnvironment } from '@/lib/environment/environment-audit';

import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

/**
 * GET /api/admin/environment
 *
 * Απαντά **ρητά** για κάθε δηλωμένη ρύθμιση: ρυθμισμένη ή όχι, και τι σπάει χωρίς
 * αυτήν — **με τον παρονομαστή μέσα** (`declared`), ώστε ένα «0 λείπουν» να μη
 * διαβάζεται ποτέ ως «κανείς δεν κοίταξε».
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const handler = withStandardRateLimit(
    withAuth(
      async (
        _req: NextRequest,
        _ctx: AuthContext,
        _cache: PermissionCache,
      ): Promise<NextResponse> => describeEnvironment(),
      { permissions: 'admin:system:configure' },
    ),
  );

  return handler(request);
}

function describeEnvironment(): NextResponse {
  const audit = auditEnvironment(process.env);

  return NextResponse.json({
    success: true,
    declared: audit.declared,
    configured: audit.configured,
    missing: audit.missingFatal.length + audit.missingFeature.length,
    requirements: audit.verdicts.map((verdict) => ({
      name: verdict.requirement.name,
      status: verdict.status,
      severity: verdict.requirement.severity,
      feature: verdict.requirement.feature,
      // Η συνέπεια ταξιδεύει **μόνο** όταν υπάρχει βλάβη: σε πλήρη ρύθμιση είναι θόρυβος
      // που κρύβει τη μία γραμμή που μετράει.
      ...(verdict.status === 'missing' ? { consequence: verdict.requirement.consequence } : {}),
    })),
  });
}
