/**
 * Ο εκτελεστής των έξι διαδρομών «προεπισκόπηση επίπτωσης» έργου
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΝΑΣ (ADR-742 §7.8 · §7ter.4 · N.0.2 · CHECK 3.28)
 * ─────────────────────────────────────────────────────────────────────────────
 * `impact-preview` · `address-impact-preview` · `broker-terminate-preview` ·
 * `engineer-impact-preview` · `landowners-save-preview` ·
 * `ownership-impact-preview` — **έξι αρχεία, 49–58 γραμμές το καθένα**, με
 * πανομοιότυπο κέλυφος:
 *
 * ```
 * ρυθμιστής ρυθμού → ξετύλιξε params → withAuth(projects:projects:update)
 *   → ανάλυσε σώμα → φόρτωσε έργο → «υπάρχει;» → «δικό μου;» → preview → apiSuccess
 * ```
 *
 * Το `jscpd` τα μετρούσε ως κλώνους **ήδη στο HEAD** — δηλαδή οτιδήποτε άγγιζε
 * κανείς εκεί έκοβε το CHECK 3.28 ούτως ή άλλως.
 *
 * 🔴 **Δεν είναι «λίγος κώδικας που μοιάζει» — είναι η αλυσίδα ασφαλείας.**
 * Αν ένα από τα έξι αντίγραφα ρωτήσει «δικό μου;» **μετά** τον υπολογισμό της
 * προεπισκόπησης, ή ξεχάσει τον ρυθμιστή ρυθμού, η διαφορά **δεν φαίνεται
 * πουθενά**: η διαδρομή απαντά κανονικά, απλώς είναι λιγότερο προστατευμένη
 * από τα αδέλφια της. Ο υπολογισμός της προεπισκόπησης **διαβάζει σχέσεις
 * ολόκληρου του έργου** (κτήρια, ιδιοκτησίες, συμβόλαια) — μια σειρά βημάτων
 * αντεστραμμένη εδώ διαρρέει *περιεχόμενο*, όχι απλώς ύπαρξη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ ΕΙΝΑΙ ΚΑΡΦΩΜΕΝΟ ΕΠΙΤΗΔΕΣ ΚΑΙ ΓΙΑΤΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο **ρυθμιστής ρυθμού** (`STANDARD`) και το **δικαίωμα**
 * (`projects:projects:update`) δεν παραμετροποιούνται **και δεν μένουν έξω**:
 * και οι έξι διαδρομές είχαν **ακριβώς** αυτές τις τιμές. Παράμετρος με μία
 * μόνο τιμή σε όλους τους καλούντες δεν είναι ευελιξία — είναι πρόσκληση να
 * διαφοροποιηθεί κάποιος αθόρυβα (ADR-742 §7.8). Ένας ρυθμιστής που έμενε
 * ρητός στο κάθε `export` θα ήταν **παραλείψιμος**: η επόμενη διαδρομή θα
 * έγραφε `export const POST = projectPreviewRoute({…})` χωρίς αυτόν και τίποτα
 * δεν θα το έδειχνε.
 *
 * Αντίθετα, στο `rfq-id-route` ο ρυθμιστής **έμεινε** ρητός ανά διαδρομή, γιατί
 * εκεί οι πέντε χειριστές χρησιμοποιούσαν **δύο** διαφορετικές κατηγορίες. Ο
 * κανόνας είναι ο ίδιος και στις δύο περιπτώσεις: *ό,τι είναι όντως κοινό
 * μπαίνει μέσα· ό,τι διαφέρει μένει ορατό.*
 *
 * 🔴 **Εδώ όλη η απόφαση ιδιοκτησίας κρέμεται από μία μεταβλητή** — το `ctx`
 * που ο εκτελεστής παραδίδει στον φύλακα. Ένα καρφωμένο `'super_admin'` σε
 * αυτό το σημείο θα άνοιγε το μαντείο ύπαρξης για **έξι** διαδρομές μαζί, με
 * κάθε άλλο test πράσινο. Γι' αυτό υπάρχει
 * `__tests__/project-preview-route-ctx.test.ts`.
 *
 * @module app/api/projects/_shared/project-preview-route
 * @see ./project-ownership — η ερώτηση + το εργοστάσιο «δεν βρέθηκε»
 * @see ADR-742 §7.1, §7.8, §7ter.4
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { safeParseBody } from '@/lib/validation/shared-schemas';
import type { Project } from '@/types/project';
import type { ProjectMutationImpactPreview } from '@/types/project-mutation-impact';
import { loadOwnedProject } from './project-owned-doc';

/** Το δικαίωμα και των έξι διαδρομών. Βλ. «τι είναι καρφωμένο επίτηδες». */
const PREVIEW_PERMISSION = 'projects:projects:update';

/** Ό,τι έχει στα χέρια του ο υπολογισμός της προεπισκόπησης. */
export interface ProjectPreviewArgs<TInput> {
  /** Το έργο, **αφού** ο φύλακας έχει αποφανθεί. */
  readonly project: Project;
  /** Το σώμα του αιτήματος, ήδη επικυρωμένο από το σχήμα της διαδρομής. */
  readonly input: TInput;
  readonly ctx: AuthContext;
  readonly projectId: string;
}

export interface ProjectPreviewRouteSpec<S extends z.ZodTypeAny> {
  /** Το σχήμα του σώματος — **το μόνο** που διαφέρει ουσιωδώς ανά διαδρομή. */
  readonly schema: S;
  /**
   * Ονομάζει τη διαδρομή στα logs ασφαλείας του φύλακα. Χωρίς αυτό, οι έξι
   * αρνήσεις θα ήταν αδιάκριτες μεταξύ τους στο ίδιο log.
   */
  readonly action: string;
  /** Το επιχειρησιακό βήμα. */
  readonly preview: (
    args: ProjectPreviewArgs<z.infer<S>>,
  ) => Promise<ProjectMutationImpactPreview>;
}

type SegmentData = { params: Promise<{ projectId: string }> };

/**
 * Συνδέει ταυτότητα + δικαίωμα + `[projectId]` + φύλακα + προεπισκόπηση, μία
 * φορά για έξι διαδρομές.
 *
 * ⚠️ Το «υπάρχει;» και το «δικό μου;» απαντούν με **το ίδιο** σφάλμα, από το
 * ίδιο εργοστάσιο: το `projectNotFound()` του γνήσιου κλάδου είναι η **ίδια
 * κλήση** που κάνει και ο `requireProjectAccess` στη μεταμφίεση.
 */
export function projectPreviewRoute<S extends z.ZodTypeAny>(
  spec: ProjectPreviewRouteSpec<S>,
) {
  return withStandardRateLimit(async function handle(
    request: NextRequest,
    segmentData?: SegmentData,
  ): Promise<NextResponse> {
    const { projectId } = await segmentData!.params;

    const handler = withAuth<ApiSuccessResponse<ProjectMutationImpactPreview>>(
      async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
        const parsed = safeParseBody(spec.schema, await req.json());
        if (parsed.error) {
          throw new ApiError(400, 'Validation failed');
        }

        // «υπάρχει;» + «δικό μου;» σε **μία** κλήση, από τον κοινό φορτωτή.
        // Και τα δύο «όχι» βγαίνουν από το ίδιο εργοστάσιο (ADR-742 §7.1).
        const { id, data } = await loadOwnedProject({
          projectId,
          caller: ctx,
          action: spec.action,
        });

        // Η στένωση γίνεται **εδώ, ρητά**: ο φορτωτής επιστρέφει το ωμό φορτίο
        // επίτηδες, γιατί ο τύπος υπόσχεται πεδία που η βάση δεν εγγυάται (§7.5).
        const project = { id, ...(data ?? {}) } as Project;

        return apiSuccess(
          await spec.preview({ project, input: parsed.data, ctx, projectId }),
        );
      },
      { permissions: PREVIEW_PERMISSION },
    );

    return handler(request);
  });
}
