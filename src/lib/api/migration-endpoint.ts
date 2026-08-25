/**
 * =============================================================================
 * ΤΟ ΠΕΡΙΒΛΗΜΑ ΕΝΟΣ MIGRATION ENDPOINT — μία φορά (ADR-439 / ADR-245)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Τι είναι κοινό, εξ ορισμού, σε κάθε endpoint που μεταφέρει
 * καθολικό singleton σε per-tenant έγγραφο;»*
 *
 * Μετρημένο: **τα πάντα εκτός από το σώμα**. Τα `migrate-accounting-profile` και
 * `migrate-accounting-singletons` επαναλάμβαναν, verbatim,
 *
 *   1. την αλυσίδα εξουσιοδότησης (`adminDirectOperation*`),
 *   2. την **προεπισκόπηση** και την **εκτέλεση** ως δύο ρήματα με σταθερή σημασία,
 *   3. το προοίμιο *«ο tenant είναι ο legacy, δώσε μου Admin Firestore»*,
 *   4. **τα ίδια ακριβώς λεκτικά αποτυχίας** — `'Failed to preview migration'` και
 *      `` `Migration failed: …` `` — δηλαδή ένα **συμβόλαιο απάντησης** γραμμένο δύο φορές.
 *
 * ⚠️ **Το (4) είναι το επικίνδυνο**: δύο endpoints που *υπόσχονται* το ίδιο σχήμα
 * σφάλματος χωρίς κανέναν να το επιβάλλει. Αρκεί το ένα να αλλάξει λεκτικό ή status
 * και ο καταναλωτής που τα χειρίζεται ενιαία σπάει **σιωπηλά** — και ο μεταγλωττιστής
 * δεν έχει γνώμη για μια συμβολοσειρά (ίδιο σχήμα με τις δύο λίστες namespace του
 * CHECK 3.34, που είχαν αποκλίνει κατά **63**).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΡΗΜΑΤΑ, ΟΧΙ ΕΝΑ ΜΕ ΣΗΜΑΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * `migrationPreview` = **dry-run**: μηδέν εγγραφές, χωρίς όριο ρυθμού, και η
 * αποτυχία λέει *«δεν μπόρεσα να δω»*.
 * `migrationExecute` = **εκτέλεση**: πίσω από SENSITIVE όριο ρυθμού, και η αποτυχία
 * λέει *«δεν μπόρεσα να μεταφέρω»* — **διαφορετικό μήνυμα επίτηδες**, γιατί οι δύο
 * αποτυχίες σημαίνουν διαφορετικά πράγματα για όποιον τις διαβάζει.
 *
 * ⚠️ **ΤΟ ΣΩΜΑ ΜΕΝΕΙ ΣΤΟ ROUTE.** Εδώ δεν ζει καμία γνώση για λογιστικές συλλογές —
 * ένα περίβλημα που θα ήξερε *τι* μεταφέρεται θα γινόταν δεύτερη αυθεντία δίπλα στο
 * route. Το `run` επιστρέφει `NextResponse` ώστε το route να μπορεί να απαντήσει 404
 * (`NO_SOURCE`) ή 200 (`ALREADY_MIGRATED`) **μόνο του**, χωρίς εξαιρέσεις-ως-ροή.
 *
 * @module lib/api/migration-endpoint
 * @see lib/api/admin-operation-route — ποιος επιτρέπεται (το ταβάνι ρόλου)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { LEGACY_TENANT_COMPANY_ID } from '@/config/tenant';
import { logSystemOperation, extractRequestMetadata } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

import {
  adminDirectOperationRead,
  adminDirectOperationWrite,
} from './admin-operation-route';

const logger = createModuleLogger('MigrationEndpoint');

/** Ό,τι έχει **κάθε** migration handler έτοιμο πριν γράψει την πρώτη του γραμμή. */
export interface MigrationContext {
  readonly req: NextRequest;
  readonly ctx: AuthContext;
  /** Admin Firestore — τα migrations παρακάμπτουν τους κανόνες πελάτη εξ ορισμού. */
  readonly db: ReturnType<typeof getAdminFirestore>;
  /** Ο tenant που μεταφέρεται (ADR-439: ο ένας υπάρχων). */
  readonly companyId: string;
}

type MigrationHandler = (context: MigrationContext) => Promise<NextResponse>;

function buildContext(req: NextRequest, ctx: AuthContext): MigrationContext {
  return { req, ctx, db: getAdminFirestore(), companyId: LEGACY_TENANT_COMPANY_ID };
}

/**
 * **GET** — προεπισκόπηση / dry-run. Μηδέν εγγραφές.
 *
 * @param scope Το όνομα του endpoint στα ίχνη (π.χ. `MigrateAccountingProfile`).
 */
export function migrationPreview(scope: string, run: MigrationHandler) {
  return adminDirectOperationRead(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        return await run(buildContext(req, ctx));
      } catch (error) {
        logger.error(`[${scope}] GET (dry-run) failed`, { error: getErrorMessage(error) });
        return NextResponse.json(
          { success: false, error: 'Failed to preview migration' },
          { status: 500 },
        );
      }
    },
  );
}

/**
 * Καταγράφει το ίχνος ελέγχου μιας μετάβασης — **ΠΟΤΕ μπλοκάροντας**.
 *
 * 🔑 **Η μη-μπλοκάρουσα φύση είναι ΑΠΟΦΑΣΗ, όχι λεπτομέρεια**: η μετάβαση έχει ήδη
 * γράψει στη βάση όταν φτάνει εδώ. Αν η αποτυχία του ίχνους γύριζε 500, ο χειριστής
 * θα διάβαζε *«η μετάβαση απέτυχε»* πάνω σε μετάβαση που **πέτυχε** — και θα την
 * ξανάτρεχε. (Είναι idempotent, άρα ακίνδυνο· το **ψέμα** είναι η ζημιά.)
 *
 * ⚠️ Ήταν αντιγραμμένο **και στα δύο** endpoints με ταυτόσημο `.catch` — δηλαδή μια
 * απόφαση ανθεκτικότητας που ο επόμενος θα μπορούσε να ξεχάσει στο τρίτο.
 */
export async function recordMigrationAudit(
  { req, ctx }: MigrationContext,
  scope: string,
  configId: string,
  details: Record<string, unknown>,
  reason: string,
): Promise<void> {
  const metadata = extractRequestMetadata(req);
  await logSystemOperation(ctx, configId, details, reason).catch((err: unknown) => {
    logger.error(`[${scope}] Audit log failed (non-blocking)`, {
      error: getErrorMessage(err),
      metadata,
    });
  });
}

/**
 * **POST** — εκτέλεση. Πίσω από SENSITIVE όριο ρυθμού· ο handler οφείλει να είναι
 * idempotent (ADR-439: δεύτερη εκτέλεση = no-op).
 *
 * @param scope Το όνομα του endpoint στα ίχνη (π.χ. `MigrateAccountingProfile`).
 */
export function migrationExecute(scope: string, run: MigrationHandler) {
  return adminDirectOperationWrite(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
      try {
        return await run(buildContext(req, ctx));
      } catch (error) {
        logger.error(`[${scope}] POST failed`, { error: getErrorMessage(error) });
        return NextResponse.json(
          { success: false, error: `Migration failed: ${getErrorMessage(error)}` },
          { status: 500 },
        );
      }
    },
  );
}
