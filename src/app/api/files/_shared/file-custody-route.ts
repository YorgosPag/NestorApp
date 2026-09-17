/**
 * =============================================================================
 * Η ΠΟΡΤΑ ΤΩΝ ΔΙΑΔΡΟΜΩΝ ΑΡΧΕΙΩΝ — «ΣΕ ΠΟΙΟ ΔΙΑΜΕΡΙΣΜΑ ΡΩΤΑΣ;» (ADR-866 §2.6.9 Β1)
 * =============================================================================
 *
 * **Το ερώτημα**: *«ο αιτών ζητά αρχείο **εταιρείας** ή **δικό του**; — και ποια ταυτότητα
 * χρειάζεται η καθεμία;»*
 *
 * 🔴 **ΤΙ ΒΡΕΘΗΚΕ**: οι διαδρομές bytes ήταν `withAuth` + ικανότητα εταιρείας. Ο πολίτης χωρίς
 * οργανισμό **δεν περνούσε καν την πόρτα** — το προσωπικό αρχείο ήταν αδύνατο να κατέβει, όσο
 * σωστός κι αν ήταν ο κριτής πίσω της.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΠΟΡΤΕΣ, ΕΝΑΣ ΧΕΙΡΙΣΤΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * | `?custody=` | πόρτα | τι παίρνει ο χειριστής |
 * |---|---|---|
 * | απούσα / `company` | **το ίδιο** `withAuth` με **την ίδια** ικανότητα (ή **καμία**, αν η διαδρομή δήλωνε καμία) — μηδέν αλλαγή | `AuthContext` |
 * | `personal` | `withPersonalOrOrgAuth` (ADR-817) — πολίτης **ή** μέλος εταιρείας | **μόνο** `uid` |
 * | οτιδήποτε άλλο | **400** — ποτέ «μάντεψε εταιρεία» | — |
 *
 * ⚠️ Ταξιδεύει **μόνο το είδος**, ποτέ ο `userId`: ο κάτοχος που ελέγχεται είναι η **δική μας**
 * ταυτότητα. Ίδιο ιδίωμα με το `?ledger=` του ιστορικού (ADR-864 Φ1β) και με το
 * `supportsAllDrives` του Google Drive API — ο καλών **δηλώνει** τον χώρο, ο διακομιστής κρίνει.
 *
 * ⚠️ **Η απουσία ⇒ εταιρεία** είναι το δόγμα του `custodyKindFromParam` για **αναγνώστες**: κάθε
 * υπάρχων καλών συνεχίζει να δουλεύει χωρίς αλλαγή, και κανένα εταιρικό αρχείο δεν γίνεται
 * ορατό σε κάποιον που δεν περνούσε ήδη την εταιρική πόρτα.
 *
 * @module app/api/files/_shared/file-custody-route
 * @see lib/workspace/custody-scope — `custodyKindFromParam`
 * @see lib/auth/personal-scope-middleware — η πόρτα του ανθρώπου
 * @see app/api/files/_shared/owned-file-bytes — ο πρώτος καταναλωτής
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth, type AuthContext, type PermissionCache, type PermissionId } from '@/lib/auth';
import { withPersonalOrOrgAuth, type ApiActor } from '@/lib/auth/personal-scope-middleware';
import { FILE_CUSTODY_PARAM } from '@/lib/files/file-custody';
import { custodyKindFromParam } from '@/lib/workspace/custody-scope';

/**
 * **Ποιος ρωτά, σε ποιο διαμέρισμα** — διακρινόμενη ένωση, ώστε ο μεταγλωττιστής να απαγορεύει
 * να ζητηθεί `companyId` από προσωπικό αίτημα ή ικανότητα από άνθρωπο.
 */
export type FileCustodyCaller =
  | { readonly custody: 'company'; readonly ctx: AuthContext }
  | { readonly custody: 'personal'; readonly uid: string };

export type FileCustodyHandler<R> = (
  request: NextRequest,
  caller: FileCustodyCaller,
  routeContext?: R,
) => Promise<NextResponse>;

/** Ο `uid` του αιτούντος, όποια πόρτα κι αν πέρασε — για logs. */
export function fileCallerUid(caller: FileCustodyCaller): string {
  return caller.custody === 'company' ? caller.ctx.uid : caller.uid;
}

/**
 * Τυλίγει **έναν** χειριστή με την πόρτα του διαμερίσματος που ζητήθηκε.
 *
 * 🔑 Οι δύο πόρτες χτίζονται **μία φορά** (όχι ανά αίτημα)· η επιλογή γίνεται **πριν** την
 * ταυτοποίηση, αφού το είδος είναι δήλωση του αιτήματος — η κρίση ιδιοκτησίας μένει στον κριτή.
 */
export function withFileCustodyAuth<R = unknown>(
  handler: FileCustodyHandler<R>,
  options: { readonly permissions?: PermissionId } = {},
): (request: NextRequest, routeContext?: R) => Promise<Response> {
  const companyHandler = (
    request: NextRequest,
    ctx: AuthContext,
    _cache: PermissionCache,
    routeContext?: R,
  ) => handler(request, { custody: 'company', ctx }, routeContext);

  // 🔑 **Η ΙΚΑΝΟΤΗΤΑ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ** (ADR-866 2β.3β): η `files/[id]/cde`
  //    εξυπηρετεί **πέντε** πράξεις με **πέντε** ικανότητες, και δηλώνει ρητά **καμία** στο
  //    σύνορο — μία στατική δήλωση θα ήταν είτε πολύ χαλαρή (ο μελετητής αποκτά απελευθέρωση)
  //    είτε πολύ σφιχτή (κανείς δεν παραδίδει)· κρίνονται **ανά πράξη** μέσα στον γραφέα
  //    (ADR-801). Η πόρτα **δεν** επιτρέπεται να ακυρώσει αυτή την απόφαση περνώντας κάτι
  //    «για να μη μείνει κενό»: παραλείπεται το `options` **ολόκληρο**, ακριβώς όπως πριν.
  const company =
    options.permissions === undefined
      ? withAuth<unknown, R>(companyHandler)
      : withAuth<unknown, R>(companyHandler, { permissions: options.permissions });

  const personal = withPersonalOrOrgAuth<unknown, R>(
    (request: NextRequest, actor: ApiActor, routeContext?: R) =>
      handler(request, { custody: 'personal', uid: actor.ctx.uid }, routeContext),
  );

  return async (request, routeContext) => {
    const kind = custodyKindFromParam(request.nextUrl.searchParams.get(FILE_CUSTODY_PARAM));
    if (kind === null) {
      return NextResponse.json({ error: `Invalid ${FILE_CUSTODY_PARAM}` }, { status: 400 });
    }
    return kind === 'company' ? company(request, routeContext) : personal(request, routeContext);
  };
}
