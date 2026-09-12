import 'server-only';

/**
 * @fileoverview **Η ΓΛΩΣΣΑ ΤΗΣ ΑΡΝΗΣΗΣ** — μία, για κάθε πόρτα του συνόρου API.
 * @related ADR-817 §4.2 · ADR-787 Κ-2 / Ε-5 §4 · lib/auth/middleware.ts
 * @module lib/auth/api-denial
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΔΥΟ ΠΟΡΤΕΣ, ΕΝΑ ΛΕΞΙΛΟΓΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σύνορο API έχει πλέον **δύο** περιτυλίγματα: το `withAuth` *(εταιρικός χώρος,
 * η προεπιλογή)* και το `withPersonalOrOrgAuth` *(ADR-817 — οι **4** δηλωμένες
 * διαδρομές του πολίτη)*. Και τα δύο πρέπει να αρνούνται **με τα ίδια λόγια**:
 * αντιγραφή του `createUnauthorizedResponse` στο δεύτερο θα ήταν **δεύτερο
 * λεξιλόγιο άρνησης**, που αποκλίνει την πρώτη φορά που κάποιος προσθέτει
 * κατάσταση — ADR-749, και μάλιστα σε κείμενο που **φεύγει στο σύρμα**.
 *
 * ⚠️ **Εξήχθη, δεν γράφτηκε** (Boy Scout, N.0.2): ο κώδικας και τα σχόλιά του είναι
 * **ακριβώς** αυτά που έτρεχαν ήδη στο `middleware.ts`.
 */

import { NextResponse } from 'next/server';

// 🔑 ADR-787 §5.3 ζ (όριο 1) — ο κωδικός της σχεδιασμένης κατάστασης ζει στο **σύρμα**,
//    ώστε ο πελάτης να διαβάζει την ίδια λέξη που γράφει εδώ ο διακομιστής.
import { MISSING_TENANT_ERROR_CODE } from '@/lib/workspace/requested-workspace-wire';
import type { PermissionId, GlobalRole } from './types';

/**
 * Standard error response structure.
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  errorCode?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// ERROR RESPONSES
// =============================================================================

/**
 * Create the denial response for an unauthenticated context.
 *
 * ⚠️ **ΔΕΝ είναι πάντα 401** (ADR-787 Κ-2, 2026-08-22). Ένα 401 λέει στον
 * πελάτη *«η ταυτότητά σου δεν ισχύει — ξανασυνδέσου»*. Όταν η αιτία είναι
 * `workspace_unavailable`, η ταυτότητα **ισχύει μια χαρά**: απλώς **δεν
 * μπορέσαμε να ρωτήσουμε** αν είσαι μέλος. Ένα 401 εκεί θα πετούσε τον άνθρωπο
 * έξω από τη συνεδρία του **για μια στιγμιαία αστοχία διακομιστή** — δηλαδή θα
 * μετέφραζε το *«δεν ξέρω»* σε *«δεν είσαι»*, ακριβώς το λάθος που το **N.12**
 * και το **ADR-787 Ε-5 §4 #3** υπάρχουν για να αποτρέψουν.
 *
 * ⛔ ΜΗΝ το ισοπεδώσεις ξανά σε ένα status. Η διάκριση `403` / `503` **είναι**
 *    η διάκριση «όχι» / «δεν ξέρω», μεταφρασμένη στη γλώσσα του HTTP.
 * ⚠️ Το `workspace_forbidden` βγαίνει **403 χωρίς λεπτομέρεια χώρου**: δεν
 *    μαρτυρά αν ο χώρος υπάρχει (Ε-5 §4 #1).
 */
export function createUnauthorizedResponse(reason: string): NextResponse<ErrorResponse> {
  if (reason === 'workspace_unavailable') {
    return NextResponse.json(
      {
        error: 'Workspace membership could not be verified',
        code: 'WORKSPACE_UNAVAILABLE',
        details: { reason },
      },
      { status: 503 },
    );
  }

  // 🔴 Ο ΙΔΙΩΤΙΚΟΣ ΧΩΡΟΣ ΔΕΝ ΕΙΝΑΙ ΑΠΟΤΥΧΙΑ ΤΑΥΤΟΤΗΤΑΣ — ΚΑΙ ΓΙ' ΑΥΤΟ **ΟΧΙ 401**
  //
  // Δύο ανεξάρτητοι λόγοι, και ο δεύτερος είναι μετρημένη μηχανική:
  //  1. **Σημασιολογία**: η ταυτότητα ισχύει μια χαρά. Αυτό που λείπει είναι **εταιρεία**,
  //     και είναι η σχεδιασμένη κατάσταση του ADR-809 — όχι «ξανασυνδέσου».
  //  2. **Ο πελάτης θα κυνηγούσε την ουρά του**: ο `enterprise-api-client` σε **κάθε** 401
  //     ανανεώνει αναγκαστικά το token και **επαναλαμβάνει** το αίτημα. Ένα 401 εδώ θα
  //     διπλασίαζε κάθε αίτημα του ιδιωτικού χώρου, για κατάσταση που **καμία** ανανέωση
  //     token δεν αλλάζει.
  //
  // ⚠️ **403 και όχι 404**: δεν κρύβουμε ύπαρξη ξένου χώρου εδώ — ο άνθρωπος δήλωσε τον
  //    **δικό του** ιδιωτικό χώρο. Δεν υπάρχει τίποτα να συγκαλυφθεί (αντίθετα με το
  //    `workspace_forbidden`, Ε-5 §4 #1).
  if (reason === 'workspace_personal') {
    return NextResponse.json(
      {
        error: 'This route requires an organization workspace',
        code: MISSING_TENANT_ERROR_CODE,
        details: { reason },
      },
      { status: 403 },
    );
  }

  // 🔴 **400: το λάθος είναι ΤΟΥ ΑΙΤΗΜΑΤΟΣ, όχι της ταυτότητας.** Κακοσχηματισμένη δήλωση
  //    χώρου σημαίνει πελάτη που μιλά άλλη γραμματική — και fail-closed σημαίνει ότι το
  //    λέμε, αντί να μαντέψουμε τι εννοούσε (OWASP: ποτέ επιστροφή σε ερώτημα χωρίς
  //    εμβέλεια).
  if (reason === 'workspace_malformed') {
    return NextResponse.json(
      {
        error: 'Malformed workspace declaration',
        code: 'WORKSPACE_MALFORMED',
        details: { reason },
      },
      { status: 400 },
    );
  }

  if (reason === 'workspace_forbidden') {
    return NextResponse.json(
      {
        error: 'Not found',
        code: 'WORKSPACE_FORBIDDEN',
        details: { reason },
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      details: { reason },
    },
    { status: 401 }
  );
}

/**
 * Create 403 Forbidden response.
 */
export function createForbiddenResponse(permission?: PermissionId): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: 'Permission denied',
      code: 'FORBIDDEN',
      details: permission ? { requiredPermission: permission } : undefined,
    },
    { status: 403 }
  );
}

/**
 * Create 403 response for role requirement failure.
 */
export function createRoleRequiredResponse(requiredRoles: GlobalRole[]): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: 'Insufficient role',
      code: 'ROLE_REQUIRED',
      details: { requiredRoles },
    },
    { status: 403 }
  );
}
