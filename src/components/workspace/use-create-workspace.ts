'use client';

/**
 * «Φτιάξε τον χώρο μου» — η **λογική** της οθόνης (ADR-787 Κ-1)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΔΙΑΚΟΜΙΣΤΗΣ ΕΙΝΑΙ Ο **ΜΟΝΟΣ** ΚΡΙΤΗΣ ΤΗΣ ΜΟΡΦΗΣ — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Εδώ **δεν** κρίνεται αν το ψευδώνυμο είναι έγκυρο. Ο κριτής είναι ο
 * `judgeAliasShape` (`lib/workspace/alias-rules.ts`), και είναι **`server-only`**
 * επειδή στοιβάζεται πάνω στον πίνακα συγχύσεων του UTS #39 — **~80 KB** που ο
 * πελάτης δεν πρέπει να πληρώνει (δηλωμένο στο `lib/unicode/skeleton.ts`).
 *
 * ⛔ **ΜΗΝ ξαναγράψεις εδώ τους κανόνες Ψ2/Ψ3 «για άμεση απόκριση».** Θα ήταν
 *    **δεύτερος κριτής που μπορεί να αποκλίνει** (ADR-749) — και θα απέκλινε
 *    ακριβώς εκεί που έχει σημασία: στο σενάριο γραφής, όπου το `Νestor`
 *    (ελληνικό `Ν` + λατινικά) *φαίνεται* απολύτως έγκυρο.
 *
 * ✅ Ό,τι έρχεται από το SSoT και **δεν είναι κρίση** επιτρέπεται: οι σταθερές
 *    `ALIAS_MIN_LENGTH`/`ALIAS_MAX_LENGTH` (`types/workspace-alias.ts`, καθαρό
 *    από `server-only`) τροφοδοτούν την **υπόδειξη**. Ίδιοι αριθμοί, μία πηγή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⏳ ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΤΑΣΤΑΣΗ `awaiting-claims` — ΤΟ ΠΙΟ ΕΥΚΟΛΟ ΛΑΘΟΣ ΕΔΩ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο διακομιστής απαντά «έτοιμο» **πριν** ο φυλλομετρητής μάθει ότι έχει πλέον
 * χώρο: το `setCustomUserClaims` **δεν σπρώχνει** τίποτα στους συνδεδεμένους
 * πελάτες — το token κρατά τα παλιά claims έως και μία ώρα (ADR-360).
 *
 * ⇒ Μια ανακατεύθυνση **αμέσως μετά** την απάντηση στέλνει τον άνθρωπο στον
 * χώρο του με token που λέει ότι **δεν έχει χώρο**: ο φρουρός τον πετάει έξω,
 * και η πρώτη οθόνη του γραφείου που μόλις έφτιαξε είναι **άρνηση πρόσβασης**.
 *
 * ⚠️ **Καμία νέα μηχανή γι' αυτό.** Ο `useClaimsRefresh` ακούει ήδη το
 * `users/{uid}.claimsUpdatedAt` — που το `setClaimsWithMirror` **ανεβάζει σε
 * κάθε γραφή** — και ανανεώνει **και** το token **και** τη συνεδρία του
 * διακομιστή. Εδώ απλώς **δεν τρέχουμε πιο γρήγορα από αυτόν**: περιμένουμε το
 * `companyId` να εμφανιστεί, και τότε φεύγουμε.
 *
 * ⛔ **ΜΗΝ «λύσεις» την αναμονή με `setTimeout`.** Ένα σταθερό χρονικό είναι
 *    στοίχημα πάνω στην ταχύτητα του δικτύου του άλλου· η άφιξη του claim είναι
 *    **γεγονός**, και το γεγονός είναι ήδη παρατηρήσιμο.
 *
 * @module components/workspace/use-create-workspace
 */

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/auth';
import { useRouter } from '@/lib/workspace/navigation';
import { API_ROUTES } from '@/config/domain-constants';

/** Πού βρίσκεται η πράξη — ρητές καταστάσεις, ποτέ σημαίες. */
export type CreateWorkspacePhase =
  | 'editing'
  /** Το αίτημα ταξιδεύει. */
  | 'submitting'
  /** Ο χώρος **υπάρχει**· περιμένουμε το token να το μάθει. */
  | 'awaiting-claims';

export interface CreateWorkspaceState {
  readonly phase: CreateWorkspacePhase;
  /**
   * Ο **κωδικός** της απόρριψης — ποτέ έτοιμο κείμενο (N.11).
   * Η όψη διαλέγει τη διατύπωση από τα locale αρχεία.
   */
  readonly errorCode: string | null;
  readonly busy: boolean;
  readonly submit: (displayName: string, alias: string) => Promise<void>;
}

interface CreateResponse {
  readonly success?: boolean;
  readonly reason?: string;
  readonly data?: { readonly redirectTo?: string };
}

export function useCreateWorkspace(): CreateWorkspaceState {
  const { user } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<CreateWorkspacePhase>('editing');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);

  // Η ΑΝΑΧΩΡΗΣΗ — μόνο όταν το token ξέρει ότι υπάρχει ο χώρος.
  useEffect(() => {
    if (phase !== 'awaiting-claims' || !destination) return;
    if (!user?.companyId) return;
    router.replace(destination);
  }, [phase, destination, user?.companyId, router]);

  const submit = useCallback(
    async (displayName: string, alias: string) => {
      setPhase('submitting');
      setErrorCode(null);

      const outcome = await postWorkspace(displayName, alias);

      if (!outcome.ok) {
        setErrorCode(outcome.reason);
        setPhase('editing');
        return;
      }

      setDestination(outcome.redirectTo);
      setPhase('awaiting-claims');
    },
    [],
  );

  return {
    phase,
    errorCode,
    busy: phase !== 'editing',
    submit,
  };
}

/**
 * Το αίτημα, με **κάθε** αποτυχία μεταφρασμένη σε κωδικό.
 *
 * ⚠️ Η αποτυχία δικτύου γίνεται `'failed'` — **δεν σιωπά και δεν πετάει**. Ένα
 * ανεπίληπτο σφάλμα εδώ θα άφηνε τη φόρμα κολλημένη στο «αποστολή…» για πάντα,
 * που είναι η χειρότερη εκδοχή: ο άνθρωπος δεν ξέρει αν έγινε ή όχι.
 */
async function postWorkspace(
  displayName: string,
  alias: string,
): Promise<{ ok: true; redirectTo: string } | { ok: false; reason: string }> {
  try {
    const response = await fetch(API_ROUTES.WORKSPACES.MINE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ displayName, alias }),
    });

    const payload = (await response.json().catch(() => null)) as CreateResponse | null;

    if (!response.ok || !payload?.success) {
      return { ok: false, reason: payload?.reason ?? 'failed' };
    }
    // ⚠️ Επιτυχία **χωρίς** προορισμό είναι σπασμένο συμβόλαιο, όχι επιτυχία:
    //    μια ανακατεύθυνση σε `undefined` θα έστελνε τον άνθρωπο στο πουθενά.
    const redirectTo = payload.data?.redirectTo;
    return redirectTo ? { ok: true, redirectTo } : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
