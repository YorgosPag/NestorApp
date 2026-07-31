/**
 * Ο εκτελεστής των διαδρομών `api/rfqs/[id]/**`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΝΑΣ (ADR-742 §7.8 · N.0.2 · CHECK 3.28)
 * ─────────────────────────────────────────────────────────────────────────────
 * Πέντε χειριστές (`GET`/`PATCH`/`DELETE` + `cancel` + `reopen`) έγραφαν το
 * **ίδιο** κέλυφος: ξετύλιξε το `params` → `withAuth` → `try` → χαρτογράφησε
 * το σφάλμα. Το `jscpd` το μετρούσε ως κλώνο **ήδη στο HEAD** (5 κλώνοι στα
 * τρία αρχεία), οπότε οτιδήποτε άγγιζε κανείς εκεί έκοβε το CHECK 3.28.
 *
 * 🔴 **Δεν είναι «λίγος κώδικας που μοιάζει» — είναι η αλυσίδα ασφαλείας.**
 * Αν ένα αντίγραφο τυλίξει το `try` λίγο πιο μέσα ή ξεχάσει να περάσει τον
 * καλούντα στη χαρτογράφηση, η διαφορά **δεν φαίνεται πουθενά**: το endpoint
 * απαντά κανονικά, απλώς είναι λιγότερο προστατευμένο από τα αδέλφια του.
 *
 * 🔴 **Εδώ όλη η απόφαση αποκάλυψης κρέμεται από μία μεταβλητή** — το
 * `ctx.globalRole` που παραδίδεται στη χαρτογράφηση. Ένα καρφωμένο
 * `'super_admin'` σε αυτό το σημείο θα άνοιγε ξανά το μαντείο ύπαρξης για
 * **όλη** την οικογένεια, με κάθε άλλο test πράσινο. Γι' αυτό υπάρχει
 * ξεχωριστό test που αποδεικνύει ότι φτάνει ο **σωστός** καλών, όχι ένας ρόλος.
 *
 * ⚠️ **Αλλαγή που δηλώνεται**: το `GET` δεν είχε `try/catch` — τώρα το έχει,
 * μέσω του κοινού κελύφους. Είναι υπερσύνολο (τα σφάλματα χαρτογραφούνται
 * αντί να ανεβαίνουν ωμά), και στην πράξη αδρανές: το `getRfq` δίνει `null`
 * αντί να ρίξει.
 *
 * @module app/api/rfqs/_shared/rfq-id-route
 * @see ./rfq-error-response · ADR-742 §3.4, §7.8
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { rfqErrorResponse } from './rfq-error-response';

export interface RfqIdRouteArgs {
  readonly req: NextRequest;
  readonly ctx: AuthContext;
  /** Το `[id]` του path, ήδη ξετυλιγμένο. */
  readonly id: string;
}

export interface RfqIdRouteSpec {
  /** Το επιχειρησιακό βήμα — επιστρέφει το φάκελο επιτυχίας της διαδρομής. */
  readonly run: (args: RfqIdRouteArgs) => Promise<NextResponse>;
  /** Μόνο το `reopen` εκθέτει `code` (`PO_EXISTS`). Προεπιλογή: όχι. */
  readonly exposeCode?: boolean;
}

type SegmentData = { params: Promise<{ id: string }> };

/**
 * Συνδέει ταυτότητα + `[id]` + χαρτογράφηση σφαλμάτων, μία φορά.
 *
 * Ο ρυθμιστής ρυθμού **δεν** μπαίνει εδώ επίτηδες: οι πέντε διαδρομές δεν
 * χρησιμοποιούν την ίδια κατηγορία (`standard` για `GET`, `sensitive` για τις
 * μεταβολές), οπότε παραμένει ρητός στο κάθε `export` — ορατή επιλογή, όχι
 * παράμετρος που κάποιος θα αλλάξει αθόρυβα.
 */
export function rfqIdRoute(spec: RfqIdRouteSpec) {
  return async function handle(
    request: NextRequest,
    segmentData?: SegmentData,
  ): Promise<NextResponse> {
    const { id } = await segmentData!.params;
    const handler = withAuth(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache): Promise<NextResponse> => {
        try {
          return await spec.run({ req, ctx, id });
        } catch (error) {
          return rfqErrorResponse(error, {
            callerGlobalRole: ctx.globalRole,
            exposeCode: spec.exposeCode,
          });
        }
      },
    );
    return handler(request);
  };
}
