import 'server-only';

/**
 * «Ποιος ρωτά;» — **μία φορά**, για Server Components
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ (ADR-787 §5.3 ι)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένα Server Component δεν έχει `NextRequest`, άρα **δεν** μπορεί να καλέσει το
 * `buildRequestContext`. Μέχρι σήμερα η ίδια ~50γραμμη ακολουθία *(διάβασε
 * cookie → επαλήθευσε → βγάλε claims → fail-closed)* ζούσε **δύο** φορές, και
 * μια τρίτη αντιγραφή γεννιόταν με **κάθε** νέο φρουρό σελίδας.
 *
 * 🔑 **Εξήχθη, δεν γράφτηκε** (Boy Scout, N.0.2): ο κώδικας είναι **ο ίδιος** που
 * έτρεχε ήδη στο `require-project-for-page.ts` — μαζί με τα σχόλιά του και τη
 * ρητή απόφαση fail-closed του ADR-657 §3.5.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΠΙΣΤΡΕΦΕΙ ΕΤΥΜΗΓΟΡΙΑ ΚΑΙ ΔΕΝ ΠΕΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι καλούντες **διαφωνούν στο τι σημαίνει αποτυχία**, και αυτό είναι σωστό: ο
 * φρουρός έργου θέλει `403`· ο φρουρός χώρου θέλει **404 που δεν αποκαλύπτει
 * τίποτα** (Ε-5 §4 #1). Ένα `throw` με σταθερό μήνυμα θα ανάγκαζε τον έναν από
 * τους δύο να **μαντεύει** από κείμενο σφάλματος.
 *
 * ⚠️ Οι λόγοι μένουν **διακριτοί** ώστε ο καλών να κρατά τα δικά του μηνύματα
 * αυτούσια — μια ένωσή τους σε ένα «απέτυχε» θα έσβηνε διαγνωστικά που ήδη
 * υπάρχουν.
 *
 * ⛔ **ΔΕΝ ενοποιείται με το `requireAdminForPage`**: εκείνο απαντά **άλλο**
 * ερώτημα *(«είναι διαχειριστής, και έχει MFA;»)* και έχει δικό του
 * περιβαλλοντικό φράγμα. Ένωση θα ήταν το λάθος του ADR-775 — δύο ερωτήματα σε
 * έναν μηχανισμό.
 *
 * @module server/auth/page-identity
 */

import { SESSION_COOKIE_CONFIG } from '@/lib/auth/security-policy';
import { getDevCompanyId } from '@/config/dev-environment';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { verifySessionCookieToken } from '@/server/admin/admin-guards';
import { isValidGlobalRole, type GlobalRole, type AuthContext } from '@/lib/auth/types';
// ADR-801 §2.8 — ο ΕΝΑΣ αναγνώστης του claim `permissions`.
// 🔴 ΓΙΑΤΙ ΕΙΝΑΙ ΕΔΩ: αυτό είναι ο **δεύτερος** παραγωγός `AuthContext` του
// server (ο πρώτος είναι το `buildRequestContext`). Αν μόνο εκείνος διάβαζε το
// claim, οι **σελίδες** θα έκριναν διαφορετικά από τις **διαδρομές API** — η
// ίδια βλάβη που κλείνει αυτή η φάση, έναν όροφο πιο κάτω.
import { readPermissionsClaim } from '@/lib/auth/claim-permissions';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('PageIdentity');

/**
 * Γιατί δεν έχουμε ταυτότητα — **διακριτά**, ποτέ ένα «απέτυχε».
 *
 * 🔴 **ΤΟ `'missing-companyId'` ΕΦΥΓΕ ΑΠΟ ΕΔΩ (ADR-807), ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΜΕΤΟΝΟΜΑΣΙΑ.**
 * Ήταν **κατηγοριακό λάθος**: απαντούσε στο ερώτημα *«σε ποιον χώρο ενεργείς;»*
 * μέσα σε μια ένωση που απαντά *«ποιος είσαι;»*. Ένας άνθρωπος χωρίς γραφείο
 * **έχει** ταυτότητα — απλώς δεν έχει οργανισμό.
 */
export type PageIdentityRejection = 'no-session' | 'invalid-session' | 'invalid-role';

/**
 * Η ταυτότητα ανθρώπου **χωρίς οργανισμό** — ό,τι και το {@link AuthContext},
 * **χωρίς** `companyId` και χωρίς τα δύο πεδία που έχουν νόημα μόνο μέσα σε χώρο.
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟΣ ΤΥΠΟΣ ΚΑΙ ΟΧΙ `companyId: string | null`**: το
 * `AuthContext` το καταναλώνουν οι διαδρομές API, η απομόνωση μισθωτή και τα
 * `firestore.rules` μέσω του `buildRequestContext`. Χαλαρώνοντας **εκείνον** τον
 * τύπο, κάθε σημείο που σήμερα **εγγυάται** μισθωτή θα δεχόταν σιωπηλά `null` —
 * δηλαδή θα πληρώναμε μια διόρθωση προσγείωσης με **διεύρυνση της επιφάνειας
 * ασφαλείας**. Εδώ γίνεται το αντίθετο: ο προσωπικός χώρος **δεν μπορεί δομικά**
 * να περάσει εκεί όπου απαιτείται `companyId` — το απαγορεύει ο μεταγλωττιστής.
 */
export type PersonalIdentityContext = Omit<
  AuthContext,
  'companyId' | 'superAdminOverride' | 'membershipVerdict'
>;

/**
 * **ΤΡΕΙΣ ΡΗΤΕΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΠΟΤΕ BOOLEAN** — και η μεσαία είναι όλο το ADR-807.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ: «ΔΕΝ ΕΧΕΙΣ ΕΤΑΙΡΕΙΑ» ΔΙΑΒΑΖΟΤΑΝ ΩΣ «ΔΕΝ ΥΠΑΡΧΕΙΣ»
 *
 * Μέχρι 2026-08-25 η απουσία `companyId` επέστρεφε `{ ok: false }`. Ο μόνος
 * καταναλωτής που είχε γνώμη γι' αυτό — το δίχτυ `(app)/[...unprefixed]` —
 * έκανε `if (!identity.ok) redirect(login)`. Αποτέλεσμα, μετρημένο ζωντανά:
 * **ατέρμονος βρόχος** `/dashboard → /login → /dashboard`, για κάθε άνθρωπο
 * χωρίς γραφείο. Ο αυτόνομος επαγγελματίας **δεν έφτανε ποτέ σε καμία οθόνη**.
 *
 * ⚠️ **ΚΑΙ Η ΘΕΡΑΠΕΙΑ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΗ, ΤΡΕΙΣ ΦΟΡΕΣ** — και οι τρεις
 * **δομικά ανέφικτες** εξαιτίας αυτής της μίας γραμμής (αδρανείς φρουροί,
 * ADR-749 §5):
 *   1. `lib/routes/landing.ts` — στέλνει τον άνθρωπο χωρίς οργανισμό στον
 *      **δικό του** χώρο·
 *   2. `(app)/[...unprefixed]/page.tsx:84` — `PERSONAL_WORKSPACE_ALIAS`, κλάδος
 *      που **δεν μπορούσε να εκτελεστεί**: το `ok:true` συνεπαγόταν
 *      `companyId.length > 0`, άρα το `hasOrganization()` ήταν **πάντα** αληθές·
 *   3. `lib/auth/workspace-from-path.ts:113` — λύνει τον προσωπικό χώρο με
 *      **μηδέν** αναγνώσεις βάσης.
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ — ΟΜΟΦΩΝΗ, ΚΑΙ ΤΗΝ ΞΕΠΕΡΝΑΜΕ ΣΕ ΔΥΟ ΣΗΜΕΙΑ
 *
 * • **OIDC / Auth0 Organizations**: το `org_id` είναι **προαιρετικό** claim. Η
 *   απουσία του σημαίνει «προσωπικό context», **ΠΟΤΕ** αποτυχία αυθεντικοποίησης.
 * • **GitHub**: **ένας** ενιαίος χώρος ονομάτων· ο κάτοχος μιας διεύθυνσης είναι
 *   *είτε* πρόσωπο *είτε* οργανισμός — **ίδιου είδους**. Ακριβώς το `/o/<alias>/`.
 * • **Confluence**: personal space με **δεσμευμένο** πρόθεμα `~username`.
 * • **Figma**: αν δεν υπάρχει ομάδα, **κατασκευάζει** free Starter team.
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ:**
 *   (α) Το **Figma επιβάλλει οργανισμό** που ο άνθρωπος δεν ζήτησε — φτιάχνει
 *       οντότητα για να μη χρειαστεί να μοντελοποιήσει τον μόνο άνθρωπο. Εδώ ο
 *       ιδιωτικός χώρος είναι **πρώτης τάξεως κατάσταση**, χωρίς πλασματική
 *       εταιρεία και χωρίς μία εγγραφή στη βάση.
 *   (β) Το **Confluence έδεσε το κλειδί στο μεταβλητό username** και το πλήρωσε:
 *       η μετονομασία έσπαγε τον χώρο, και **υποχώρησε σε τυχαίο κλειδί**. Εδώ
 *       το `PERSONAL_WORKSPACE_ALIAS` είναι **σταθερή δεσμευμένη λέξη** — η λύση
 *       στην οποία **κατέληξαν μετά το περιστατικό**, εδώ εξ αρχής.
 *   (γ) Το **Auth0 αφήνει το `org_id` απλώς απόν** και ελπίζει ότι η εφαρμογή θα
 *       το ελέγξει. Ακριβώς αυτή η σιωπηλή απουσία είναι που διαβάστηκε λάθος
 *       εδώ. Πλέον είναι **ονομασμένη κατάσταση σε discriminated union**: ο
 *       μεταγλωττιστής **δεν επιτρέπει** σε κανέναν καταναλωτή να την αγνοήσει.
 *       Η απουσία έπαψε να είναι κάτι που θυμάσαι να ελέγξεις.
 *
 * ⛔ **ΜΗΝ ξαναφέρεις λόγο απόρριψης για την απουσία οργανισμού.** Θα ξαναγεννούσε
 *    τον βρόχο, και τώρα με τρεις φρουρούς να δείχνουν ότι δεν έπρεπε.
 */
export type PageIdentity =
  | { readonly ok: true; readonly scope: 'organization'; readonly ctx: AuthContext }
  | { readonly ok: true; readonly scope: 'personal'; readonly ctx: PersonalIdentityContext }
  | { readonly ok: false; readonly reason: PageIdentityRejection };

/**
 * Η ταυτότητα του αιτούντος, από το cookie συνεδρίας.
 *
 * ⚠️ **FAIL-CLOSED, και είναι απόφαση με ιστορία** (ADR-657 §3.5): cookie χωρίς
 * claims RFC-v6 **απορρίπτεται** — δεν προάγεται σιωπηλά σε προεπιλεγμένο
 * μισθωτή με ρόλο `company_admin`. Ούτε fallback από μεταβλητή περιβάλλοντος.
 */
export async function readPageIdentity(): Promise<PageIdentity> {
  const environment = getCurrentRuntimeEnvironment();
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_CONFIG.NAME)?.value;

  if (!sessionCookie && environment === 'development') {
    logger.info('[PAGE_IDENTITY] Dev bypass — no session cookie');
    return {
      ok: true,
      // Το dev bypass **κατασκευάζει** companyId, άρα είναι εξ ορισμού εταιρικό.
      scope: 'organization',
      ctx: {
        uid: 'dev-user',
        email: 'dev@localhost',
        companyId: await getDevCompanyId(),
        globalRole: 'company_admin',
        mfaEnrolled: false,
        isAuthenticated: true,
      },
    };
  }

  if (!sessionCookie) return { ok: false, reason: 'no-session' };

  const decoded = await verifySessionCookieToken(sessionCookie);
  if (!decoded) return { ok: false, reason: 'invalid-session' };

  // ⚠️ **Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΥΦΟΣ** (ADR-807): ο ρόλος κρίνεται **ΠΡΙΝ**
  //    τον χώρο. Ο ρόλος είναι ιδιότητα της **ταυτότητας** — άκυρος ρόλος σημαίνει
  //    cookie που δεν εμπιστευόμαστε, και **πρέπει** να απορριφθεί ανεξάρτητα από το
  //    αν ο άνθρωπος έχει γραφείο. Με την παλιά σειρά, ένα cookie με **άκυρο ρόλο**
  //    και **χωρίς** companyId θα έβγαινε πλέον `personal` — δηλαδή η διόρθωση της
  //    προσγείωσης θα είχε **χαλαρώσει την ασφάλεια**, σιωπηλά.
  const globalRoleRaw = decoded.globalRole as string | undefined;
  if (typeof globalRoleRaw !== 'string' || !isValidGlobalRole(globalRoleRaw)) {
    return { ok: false, reason: 'invalid-role' };
  }
  const globalRole: GlobalRole = globalRoleRaw;

  const base = {
    uid: decoded.uid,
    email: decoded.email || '',
    globalRole,
    mfaEnrolled: decoded.mfaEnrolled === true,
    isAuthenticated: true as const,
    permissions: readPermissionsClaim(decoded.permissions),
  };

  // ── Ο ΧΩΡΟΣ: ΔΥΟ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΜΙΑ ΑΠΟΤΥΧΙΑ ──────────────────────────────
  // ⚠️ Η **κενή συμβολοσειρά μετρά ως απουσία**, και δεν είναι λεπτομέρεια: το
  //    `extractCustomClaims` την απορρίπτει fail-closed ως «δεν είναι ταυτότητα
  //    που μπορούμε να εξουσιοδοτήσουμε», και το `hasOrganization` κρίνει με τον
  //    **ίδιο** κανόνα. Τρίτη ερμηνεία εδώ θα έστελνε στον εταιρικό χώρο κάποιον
  //    που ο διακομιστής θεωρεί χωρίς οργανισμό (`landing.ts`).
  const companyId = decoded.companyId as string | undefined;
  if (typeof companyId !== 'string' || companyId.length === 0) {
    return { ok: true, scope: 'personal', ctx: base };
  }

  return { ok: true, scope: 'organization', ctx: { ...base, companyId } };
}
