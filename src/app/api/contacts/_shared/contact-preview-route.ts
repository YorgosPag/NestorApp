/**
 * Ο εκτελεστής των έξι διαδρομών «προεπισκόπηση επίπτωσης» επαφής
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΕΣΣΕΡΙΣ ΑΠΟ ΤΙΣ ΕΞΙ ΗΤΑΝ **ΤΕΛΕΙΩΣ ΑΦΥΛΑΚΤΕΣ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-08-01 (ADR-742 §7octies). Ο πόρος είχε έξι αδελφικές
 * διαδρομές preview — και **δεν** ήταν «σχεδόν ίδιες με μια μικρή απόκλιση»:
 *
 * | διαδρομή | δικαίωμα | φύλακας ιδιοκτησίας |
 * |---|---|---|
 * | `address-impact-preview` | **κανένα** | **κανένας** |
 * | `communication-impact-preview` | **κανένα** | **κανένας** |
 * | `company-identity-impact-preview` | **κανένα** | **κανένας** |
 * | `name-cascade-preview` | **κανένα** | **κανένας** |
 * | `identity-impact-preview` | `crm:contacts:update` | ναι (403) |
 * | `service-identity-impact-preview` | `crm:contacts:update` | ναι (403) |
 *
 * `withAuth` ελέγχει δικαίωμα **μόνο αν του δοθεί** (`middleware.ts:223`), άρα
 * οι τέσσερις πρώτες δέχονταν **οποιονδήποτε συνδεδεμένο χρήστη** με
 * **οποιοδήποτε** `contactId` — και το `_ctx` τους ήταν αχρησιμοποίητο, δηλαδή
 * ο tenant δεν συμμετείχε **καθόλου** στην απάντηση.
 *
 * ⇒ Αυτό **δεν** ήταν μαντείο ύπαρξης (§3.3) αλλά **διαρροή περιεχομένου**:
 * πλήθη ακινήτων, τιμολογίων, συμβολαίων και σχέσεων ξένου πελάτη. Η δεύτερη
 * μισή αιτία ζούσε στη μηχανή (`contact-impact-engine`, βλ. §7octies).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ ΕΙΝΑΙ ΚΑΡΦΩΜΕΝΟ ΕΠΙΤΗΔΕΣ ΚΑΙ ΓΙΑΤΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο **ρυθμιστής ρυθμού** (`STANDARD`) και το **δικαίωμα**
 * (`crm:contacts:update`) δεν παραμετροποιούνται **και δεν μένουν έξω**.
 *
 * Το δικαίωμα δεν «επιλέχθηκε»: είναι αυτό που είχαν **ήδη** οι δύο φυλαγμένες
 * αδελφές, και μετρήθηκε ότι **και οι τέσσερις** αφύλακτες καλούνται
 * αποκλειστικά από το `utils/contactForm/submission-guard-chain.ts` — δηλαδή
 * **κατά την υποβολή φόρμας επεξεργασίας**, όπου ο χρήστης κάνει ούτως ή άλλως
 * `update`. Άρα δεν στενεύει καμία νόμιμη χρήση.
 *
 * Ένας ρυθμιστής που έμενε ρητός στο κάθε `export` θα ήταν **παραλείψιμος** — η
 * επόμενη διαδρομή θα γραφόταν χωρίς αυτόν και τίποτα δεν θα το έδειχνε. Αυτό
 * ακριβώς συνέβη με το **δικαίωμα** στις τέσσερις.
 *
 * 🔴 **Εδώ όλη η απόφαση ιδιοκτησίας κρέμεται από μία μεταβλητή** — το `ctx`
 * που ο εκτελεστής παραδίδει στον φύλακα **και** στη μηχανή. Καρφωμένο
 * `'super_admin'` ή καρφωμένος tenant σε αυτό το σημείο θα άνοιγε **έξι**
 * διαδρομές μαζί, με κάθε άλλο test πράσινο. Γι' αυτό υπάρχει
 * `__tests__/contact-preview-route-ctx.test.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΔΥΟ EXPORTS ΚΑΙ ΟΧΙ ΕΝΑ ΜΕ ΣΗΜΑΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Τέσσερις διαδρομές είναι `GET` χωρίς σώμα, δύο είναι `POST` με σχήμα `zod`.
 * Ένας εκτελεστής με `schema?` θα έκρυβε τη διαφορά πίσω από προαιρετικό πεδίο·
 * δύο ρητές συναρτήσεις πάνω σε **έναν** πυρήνα την αφήνουν ορατή. Ο πυρήνας
 * ({@link runContactPreview}) κρατά ό,τι είναι όντως κοινό: ταυτότητα,
 * δικαίωμα, ρυθμιστής, φόρτωση, φύλακας, `apiSuccess`.
 *
 * 💡 **Δώρο της ενοποίησης**: ο φορτωτής επιστρέφει ήδη το φορτίο, άρα ο τύπος
 * επαφής (`contact.type`) διαβάζεται **από αυτό**. Οι `communication-` και
 * `name-cascade-preview` έκαναν **δεύτερο** `.get()` μόνο γι' αυτό — τώρα η
 * ανάγνωση είναι **μία** ανά αίτημα.
 *
 * @module app/api/contacts/_shared/contact-preview-route
 * @see ./contact-ownership — η ερώτηση + τα εργοστάσια «δεν βρέθηκε»
 * @see ../../projects/_shared/project-preview-route — το πρότυπο (§7.8)
 * @see ADR-742 §7.1, §7.8, §7octies
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import type { Contact, ContactType } from '@/types/contacts';
import { loadOwnedContact } from './contact-owned-doc';

/** Το δικαίωμα και των έξι διαδρομών. Βλ. «τι είναι καρφωμένο επίτηδες». */
const PREVIEW_PERMISSION = 'crm:contacts:update';

/** Ό,τι έχει στα χέρια του ο υπολογισμός της προεπισκόπησης. */
export interface ContactPreviewArgs<TInput> {
  /** Η επαφή, **αφού** ο φύλακας έχει αποφανθεί. */
  readonly contact: Contact;
  /** Ο τύπος της, διαβασμένος από το **ίδιο** φορτίο — χωρίς δεύτερο `get()`. */
  readonly contactType: ContactType;
  /** Ο tenant του καλούντος — **περνιέται στη μηχανή**, δεν είναι διακοσμητικός. */
  readonly companyId: string;
  readonly input: TInput;
  readonly ctx: AuthContext;
  readonly contactId: string;
}

interface PreviewCore<TPayload, TInput> {
  /**
   * Ονομάζει τη διαδρομή στα logs ασφαλείας του φύλακα. Χωρίς αυτό, οι έξι
   * αρνήσεις θα ήταν αδιάκριτες μεταξύ τους στο ίδιο log.
   */
  readonly action: string;
  /**
   * Απαιτούμενος τύπος επαφής, όπου η προεπισκόπηση έχει νόημα μόνο για έναν.
   * **Επιχειρησιακός** έλεγχος, όχι ασφαλείας — γι' αυτό τρέχει **μετά** τον
   * φύλακα: ο τύπος της επαφής είναι ήδη πληροφορία που ο καλών δεν δικαιούται
   * αν δεν του ανήκει.
   */
  readonly requireType?: ContactType;
  /** Το μήνυμα του 400 όταν ο τύπος δεν ταιριάζει. */
  readonly wrongTypeMessage?: string;
  /**
   * Τι υποτίθεται η επαφή όταν το έγγραφο **δεν** φέρει `type`.
   *
   * Δηλώνεται ανά διαδρομή γιατί οι παλιές τιμές **διέφεραν**: το
   * `name-cascade-preview` υπέθετε `'individual'`, όλες οι άλλες `'company'`.
   * Εξομάλυνση σε μία τιμή θα άλλαζε σιωπηλά ποιες εξαρτήσεις μετρώνται.
   */
  readonly fallbackType?: ContactType;
  /** Το επιχειρησιακό βήμα. */
  readonly preview: (args: ContactPreviewArgs<TInput>) => Promise<TPayload>;
}

type SegmentData = { params: Promise<{ contactId: string }> };

/**
 * Ο πυρήνας: ταυτότητα → δικαίωμα → `[contactId]` → **φόρτωση+φύλακας σε μία
 * πράξη** → (τύπος) → προεπισκόπηση.
 *
 * ⚠️ Το «υπάρχει;» και το «δικό μου;» απαντούν με **το ίδιο** σφάλμα, από το
 * ίδιο εργοστάσιο: το `contactNotFound()` του γνήσιου κλάδου είναι η **ίδια
 * κλήση** που κάνει και ο `requireContactAccess` στη μεταμφίεση.
 */
async function runContactPreview<TPayload, TInput>(
  request: NextRequest,
  contactId: string,
  core: PreviewCore<TPayload, TInput>,
  readInput: (req: NextRequest) => Promise<TInput>,
): Promise<NextResponse> {
  const handler = withAuth<ApiSuccessResponse<TPayload>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const input = await readInput(req);

      const { id, data } = await loadOwnedContact({
        contactId,
        caller: ctx,
        action: core.action,
      });

      // Η στένωση γίνεται **εδώ, ρητά**: ο φορτωτής επιστρέφει το ωμό φορτίο
      // επίτηδες, γιατί ο τύπος υπόσχεται πεδία που η βάση δεν εγγυάται (§7.5).
      const contact = { id, ...(data ?? {}) } as Contact;
      const contactType =
        (data?.['type'] as ContactType | undefined) ?? core.fallbackType ?? 'company';

      if (core.requireType !== undefined && contactType !== core.requireType) {
        throw new ApiError(400, core.wrongTypeMessage ?? 'Unsupported contact type');
      }

      return apiSuccess(
        await core.preview({
          contact,
          contactType,
          companyId: ctx.companyId,
          input,
          ctx,
          contactId,
        }),
      );
    },
    { permissions: PREVIEW_PERMISSION },
  );

  return handler(request);
}

/**
 * Οι **τέσσερις `GET`** — καμία είσοδος πέρα από το `[contactId]`.
 *
 * Αυτές είναι που έτρεχαν χωρίς δικαίωμα και χωρίς φύλακα· εδώ και τα δύο
 * μπαίνουν **δομικά**, όχι με προσοχή του επόμενου συντάκτη.
 */
export function contactPreviewRoute<TPayload>(core: PreviewCore<TPayload, void>) {
  return withStandardRateLimit(async function handle(
    request: NextRequest,
    segmentData?: SegmentData,
  ): Promise<NextResponse> {
    const { contactId } = await segmentData!.params;
    return runContactPreview<TPayload, void>(
      request,
      contactId,
      core,
      async () => undefined,
    );
  });
}

export interface ContactPreviewBodyRouteSpec<S extends z.ZodTypeAny, TPayload>
  extends PreviewCore<TPayload, z.infer<S>> {
  /** Το σχήμα του σώματος — **το μόνο** που διαφέρει ουσιωδώς ανά διαδρομή. */
  readonly schema: S;
}

/** Οι **δύο `POST`** — με επικυρωμένο σώμα. */
export function contactPreviewRouteWithBody<S extends z.ZodTypeAny, TPayload>(
  spec: ContactPreviewBodyRouteSpec<S, TPayload>,
) {
  return withStandardRateLimit(async function handle(
    request: NextRequest,
    segmentData?: SegmentData,
  ): Promise<NextResponse> {
    const { contactId } = await segmentData!.params;
    return runContactPreview<TPayload, z.infer<S>>(request, contactId, spec, async (req) => {
      const parsed = spec.schema.safeParse(await req.json());
      if (!parsed.success) {
        throw new ApiError(400, 'Validation failed');
      }
      return parsed.data;
    });
  });
}
