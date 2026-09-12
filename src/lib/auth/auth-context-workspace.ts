/**
 * @fileoverview **Σε ποιον χώρο ενεργεί αυτό το αίτημα;** — η ανάγνωση της δήλωσης και η
 *   κρίση της, χωριστά από το «τι σημαίνει αυτό το token».
 * @module lib/auth/auth-context-workspace
 * @related ADR-787 §5.3 ζ · ADR-787 Κ-2 · ADR-787 Ε-5 §7
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (N.7.1)**: το `auth-context.ts` απαντά *«ποιος είναι ο
 * αιτών;»*. Αυτό εδώ απαντά *«πού ενεργεί;»* — δεύτερη ευθύνη, με **δικό της** κανάλι
 * εισόδου (κεφαλίδες) και **δικό της** κριτή (`decideMembership`). Η εξαγωγή έγινε όταν
 * το αρχείο πέρασε τις 500 γραμμές· δεν άλλαξε **καμία** συμπεριφορά.
 *
 * ⛔ **ΔΕΝ ΕΙΝΑΙ ΔΗΜΟΣΙΑ ΕΠΙΦΑΝΕΙΑ**: μοναδικός καταναλωτής το `auth-context.ts`. Ο λόγος
 * που δεν είναι «utility»: η σειρά ανάγνωσης των δύο κεφαλίδων **είναι συμβόλαιο** (βλ.
 * παρακάτω), και δεύτερος καλών που θα τη διάβαζε αλλιώς θα ήταν δεύτερη αυθεντία.
 */

import 'server-only';

import type { NextRequest } from 'next/server';

import type { CustomClaims } from './types';
// 🎫 ADR-787 Κ-2 — ο ΕΝΑΣ απαντητής του «είναι μέλος;».
// ⚠️ Το `isRoleBypass` δεν ζει εδώ επίτηδες: ο έλεγχος ρόλου έπαψε να είναι *η απόφαση*
//    και έγινε **μία από τις επτά ετυμηγορίες** μέσα στον απαντητή (`platform-bypass`).
import { decideMembership } from '@/lib/auth/workspace-membership';
import {
  isAllowed,
  orgWorkspace,
  type MembershipVerdict,
  type RequestedWorkspace,
} from '@/types/workspace-membership';
// 🔑 ADR-787 §5.3 ζ (όριο 1) — η ΜΙΑ γραμματική του σύρματος, κοινή με τον συγγραφέα του
//    πελάτη. ⛔ ΜΗΝ γράψεις εδώ δικό σου `split(':')`: δύο γραμματικές συμφωνούν μέχρι την
//    πρώτη αλλαγή, και η απόκλιση θα ήταν αόρατη (και οι δύο «δουλεύουν»).
import {
  REQUESTED_WORKSPACE_HEADER,
  parseLegacyCompanyHeader,
  parseRequestedWorkspace,
  type RequestedWorkspaceReading,
} from '@/lib/workspace/requested-workspace-wire';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('auth-context');

/**
 * 🔶 **Η ΠΑΛΙΑ ΚΕΦΑΛΙΔΑ — ΑΠΟΣΥΡΟΜΕΝΗ, ΟΧΙ ΔΙΑΓΡΑΜΜΕΝΗ** (κανάλι `http-header`).
 *
 * Μέχρι τις 2026-09-12 ήταν ο **μόνος** μεταφορέας, και μετέφερε **μόνο εταιρεία** — γι'
 * αυτό ο ιδιωτικός χώρος έφτανε εδώ ταυτόσημος με το «η διεύθυνση δεν ονομάζει χώρο».
 *
 * ⚠️ **Γιατί δεν σβήνει την ίδια μέρα**: μια ανοιχτή καρτέλα κρατά το **παλιό** πακέτο
 * JavaScript μετά το deploy και εξακολουθεί να στέλνει αυτό το όνομα. Η πρακτική των
 * μεγάλων για κεφαλίδα που ήταν προαιρετική είναι **ποτέ** αλλαγή σε μία μέρα: το GitHub
 * διαβάζει την απουσία του `X-GitHub-Api-Version` ως «τελευταία γνωστή έκδοση», το Stripe
 * δέχεται παλιό και νέο μέχρι ρητή αναβάθμιση, και το RFC 8594 (`Sunset`) ονομάζει το
 * **δεύτερο** στάδιο.
 *
 * 🏆 **Και έχει τερματική γραμμή που τη φυλάει μηχανή** — εδώ ξεπερνάμε τους μεγάλους,
 * που δέχονται και τα δύο ονόματα επ' αόριστον: κάθε ανάγνωσή της **καταγράφεται**
 * (`workspace-header-legacy`), ώστε η απόσυρση να αποδεικνύεται με **μέτρηση** και όχι με
 * εντύπωση — πρότυπο GKE, που ενεργοποιεί την επιβολή μόνο μετά από μετρημένο διάστημα
 * μηδενικής χρήσης. ⛔ ΜΗΝ τη σβήσεις όσο ο μετρητής δεν είναι μηδέν (ADR-787 §9, Φάση Γ).
 */
const LEGACY_COMPANY_HEADER = 'x-super-admin-company-id';

/**
 * 🔴 **Η ΔΗΛΩΣΗ ΤΟΥ ΠΕΛΑΤΗ, ΑΠΟ ΤΟ ΣΥΡΜΑ** — νέα κεφαλίδα, μετά η αποσυρόμενη.
 *
 * Η **σειρά είναι συμβόλαιο**: η νέα νικά **πάντα**. Ένας πελάτης που στέλνει και τις δύο
 * (παλιό πακέτο σε μια καρτέλα, νέο σε άλλη) δεν μπορεί να κάνει την παλιά να υπερισχύσει.
 *
 * ⚠️ **Η απουσία ΔΕΝ είναι απάντηση — είναι μέτρηση.** Καταγράφεται με τη διαδρομή, γιατί
 * είναι **ακριβώς** ο κατάλογος δουλειάς της Φάσης Β: τα 66 αρχεία του πελάτη που καλούν
 * ωμό `fetch('/api/…')` και δεν περνούν από τον `enterprise-api-client`, άρα δεν δηλώνουν
 * ποτέ χώρο. Όταν ο μετρητής γίνει μηδέν, η απουσία γίνεται **άρνηση** (Φάση Γ) — και τότε
 * το «απουσία ≠ δήλωση» παύει να είναι κανόνας που θυμάται κανείς και γίνεται **αδύνατη
 * κατάσταση**.
 */
export function readDeclaredWorkspace(request: NextRequest): RequestedWorkspaceReading {
  const declared = parseRequestedWorkspace(request.headers.get(REQUESTED_WORKSPACE_HEADER));
  if (declared.outcome !== 'absent') return declared;

  const legacy = parseLegacyCompanyHeader(request.headers.get(LEGACY_COMPANY_HEADER));
  if (legacy.outcome !== 'absent') {
    logger.info('[AUTH_CONTEXT] workspace-header-legacy — αποσυρόμενη κεφαλίδα χώρου', {
      path: request.nextUrl.pathname,
      outcome: legacy.outcome,
    });
    return legacy;
  }

  logger.info('[AUTH_CONTEXT] workspace-undeclared — αίτημα χωρίς δήλωση χώρου', {
    path: request.nextUrl.pathname,
  });
  return { outcome: 'absent' };
}

/**
 * Το αποτέλεσμα του *«σε ποιον χώρο ενεργεί αυτό το αίτημα;»*.
 *
 * ⚠️ Διακριτή ένωση, **όχι** `{ companyId, overridden }` με «ασφαλή» επιστροφή
 * στον χώρο του token σε περίπτωση άρνησης. Η σιωπηλή επιστροφή θα ήταν
 * ακριβώς η βλάβη που απέρριψε το **ADR-787 Ε-5 §7**: *«δύο καρτέλες μαλώνουν
 * σιωπηλά — αλλάζεις χώρο στη μία, η άλλη αρχίζει να **γράφει αλλού** χωρίς να
 * το πει»*. Σε εργαλείο όπου ανεβαίνουν **παραδόσεις μελετών**, αυτό είναι
 * λάθος φάκελος, και η **αρχή Α4 #3** λέει πού καταλήγει.
 * ⇒ Αίτημα που ονομάζει χώρο όπου δεν επιτρέπεσαι **δεν εξυπηρετείται αλλού·
 *   απορρίπτεται**.
 */
export type WorkspaceResolution =
  | {
      readonly ok: true;
      readonly companyId: string;
      readonly overridden: boolean;
      readonly verdict: MembershipVerdict;
    }
  | { readonly ok: false; readonly reason: 'workspace_forbidden' | 'workspace_unavailable' };

/**
 * 🔴 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ Ο ΔΙΑΚΟΜΙΣΤΗΣ ΑΠΟΦΑΣΙΖΕΙ (ADR-787 Κ-2 · Ε-5)
 *
 * Μέχρι 2026-08-22 αυτή η συνάρτηση ρωτούσε **τον ρόλο** (`isRoleBypass`) και
 * μετά δεχόταν **οποιαδήποτε** τιμή κεφαλίδας — δηλαδή *«ο πελάτης ζητά → ο
 * διακομιστής **επικυρώνει τον ρόλο**»*, όχι *«→ αποφασίζει»*. Ο έλεγχος
 * *«είναι μέλος;»* **δεν υπήρχε πουθενά στην πλατφόρμα** (ADR-787 §5.1 α #3).
 *
 * Πλέον ρωτά τον **έναν** απαντητή. Είναι το **μοναδικό** σημείο επέμβασης:
 * ζει μέσα στο `buildRequestContext`, που ζει μέσα στο `withAuth`, που
 * χρησιμοποιούν **352 αρχεία διαδρομών**.
 *
 * ⚠️ Η κεφαλίδα **δεν γενικεύεται** εδώ σε όλους τους ρόλους: το **Ε-5 §5**
 * αποφάσισε ότι ο μεταφορέας γίνεται η **διεύθυνση** (Φάση 3) — μια κεφαλίδα
 * είναι αόρατη, δεν στέλνεται σε σύνδεσμο, και δεν ξεχωρίζει δύο καρτέλες.
 * Άλλαξε **ποιος απαντά** πίσω της, όχι ποιος επιτρέπεται να ρωτήσει.
 *
 * ⚠️ **ΔΕΧΕΤΑΙ ΤΗ ΔΗΛΩΣΗ ΩΣ ΟΡΙΣΜΑ, ΔΕΝ ΔΙΑΒΑΖΕΙ ΚΕΦΑΛΙΔΑ** *(2026-09-12)*: την
 * κεφαλίδα τη διαβάζει **ένα** σημείο ({@link readDeclaredWorkspace}), αλλιώς η
 * αποσυρόμενη θα ήθελε δεύτερο κλάδο **εδώ μέσα**, δηλαδή δύο αναγνώστες του ίδιου
 * καναλιού στο ίδιο αρχείο — και ο ένας θα ξεχνιόταν στην επόμενη διόρθωση.
 *
 * 🔴 **ΤΟ `personal` ΔΕΝ ΚΡΙΝΕΤΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: αυτή η συνάρτηση απαντά
 * *«ποια εταιρεία;»*, και ο ιδιωτικός χώρος **δεν είναι εταιρεία**. Ταξιδεύει ως
 * **δεδομένο** μέχρι την πόρτα που ξέρει τι να κάνει μαζί του — την εταιρική
 * (`buildRequestContext`), που αρνείται fail-closed. Η πόρτα του **πολίτη**
 * (`withPersonalOrOrgAuth`) τον αγνοεί σκόπιμα· ο λόγος είναι γραμμένος εκεί.
 */
export async function resolveEffectiveWorkspace(
  requested: RequestedWorkspace,
  claims: CustomClaims,
  uid: string,
): Promise<WorkspaceResolution> {
  const requestedId = requested.kind === 'org' ? requested.companyId : null;

  // Κανένα αίτημα για άλλον χώρο ⇒ ο χώρος του υπογεγραμμένου token.
  // ⚡ **Μηδέν αναγνώσεις** — η συνήθης περίπτωση κάθε αιτήματος (Ε-5 §2).
  if (!requestedId || requestedId === claims.companyId) {
    return { ok: true, companyId: claims.companyId, overridden: false, verdict: 'home' };
  }

  const decision = await decideMembership({
    uid,
    claimCompanyId: claims.companyId,
    globalRole: claims.globalRole,
    requested: orgWorkspace(requestedId),
  });

  if (isAllowed(decision.verdict)) {
    logger.info('[AUTH_CONTEXT] Ενεργός χώρος διαφορετικός από το token — επιτράπηκε', {
      uid, original: claims.companyId, requested: requestedId, verdict: decision.verdict,
    });
    return { ok: true, companyId: requestedId, overridden: true, verdict: decision.verdict };
  }

  // ⚠️ Η αιτία κρατιέται **στα ίχνη ακέραιη** (`not-a-member` vs `suspended` vs
  //    `unknown`)· προς τα **έξω** φεύγει μόνο η αδιάκριτη μορφή της.
  logger.warn('[AUTH_CONTEXT] Ενεργός χώρος διαφορετικός από το token — απορρίφθηκε', {
    uid, original: claims.companyId, requested: requestedId, verdict: decision.verdict,
  });

  return {
    ok: false,
    reason: decision.verdict === 'unknown' ? 'workspace_unavailable' : 'workspace_forbidden',
  };
}
