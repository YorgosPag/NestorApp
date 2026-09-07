'use client';

/**
 * @fileoverview **Η ΠΡΑΞΗ ΤΟΥ ΣΗΜΑΤΟΣ, ΑΠΟ ΤΗΝ ΠΛΕΥΡΑ ΤΟΥ ΑΝΘΡΩΠΟΥ** (ADR-841 §7 Α21, Φάση 2).
 * @related app/api/agency-profile/mark/route · lib/agency/showcase-mark-input ·
 *   components/mandate/ShowcaseMarkField
 * @module hooks/mandate/useShowcaseMark
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΡΙΑ ΒΗΜΑΤΑ ΣΕ ΜΙΑ ΧΕΙΡΟΝΟΜΙΑ — ΚΑΙ Ο ΑΝΘΡΩΠΟΣ ΒΛΕΠΕΙ ΚΑΙ ΤΑ ΤΡΙΑ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * | # | τι γίνεται | γιατί έχει **δικό του** όνομα στην οθόνη |
 * |---|---|---|
 * | 1 | **κρίση διαστάσεων** *(τοπικά)* | γίνεται **πριν** από κάθε byte δικτύου: αρχείο που δεν φτάνει δεν πρέπει να ταξιδέψει |
 * | 2 | **ανέβασμα** στον ιδιωτικό κάδο | το αργό βήμα· ο άνθρωπος βλέπει *«ανεβαίνει»* |
 * | 3 | **δήλωση** στο σύνορο | το γρήγορο· ο άνθρωπος βλέπει *«δημοσιεύεται»* |
 *
 * 🔑 **ΤΟ 2 ΚΑΙ ΤΟ 3 ΔΕΝ ΕΝΩΝΟΝΤΑΙ ΣΕ ΕΝΑ «ΑΠΟΘΗΚΕΥΣΗ…»**, παρότι είναι μία χειρονομία.
 * Το ανέβασμα **έχει ήδη γράψει** στον ιδιωτικό κάδο όταν αρχίζει η δήλωση — αν η δήλωση
 * αποτύχει, το αρχείο **υπάρχει** και ο άνθρωπος πρέπει να ξέρει ότι δεν χάθηκε.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 `rejected` ≠ `failed` — Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ Η ΘΕΡΑΠΕΙΑ (N.12)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Ίδιο ιδίωμα με το `MediaUploadState` του ιδιώτη: *«αυτό το αρχείο δεν το δεχόμαστε»*
 * ⇒ **διάλεξε άλλο**· *«δεν φτάσαμε»* ⇒ **ξαναδοκίμασε το ίδιο**. Ένα κοινό «απέτυχε» θα
 * έστελνε τον άνθρωπο να αλλάξει **σωστή** επιλογή επειδή έπεσε το δίκτυό μας.
 *
 * ⚠️ **ΚΑΝΕΝΑ ΔΙΚΟ ΤΟΥ ΑΝΤΙΓΡΑΦΟ ΤΟΥ ΣΗΜΑΤΟΣ.** Το *«τι σήμα έχω τώρα»* το απαντά η
 * βιτρίνα (`useAgencyShowcase` → Firestore subscription), που ενημερώνεται **μόνη της**
 * μόλις γραφτεί το έγγραφο. Μια τοπική κατάσταση εδώ θα ήταν **δεύτερη αλήθεια** — και
 * θα απέκλινε ακριβώς την ώρα που ο άνθρωπος κοιτά.
 */

import { useCallback, useState } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { PhotoUploadService } from '@/services/photo-upload.service';
import { ENTITY_TYPES, FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import {
  judgeShowcaseMarkInput,
  type ShowcaseMarkInputVerdict,
  type ShowcaseMarkReach,
} from '@/lib/agency/showcase-mark-input';
import type { ShowcaseMarkKind } from '@/lib/agency/showcase-mark-kind';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';

const logger = createModuleLogger('useShowcaseMark');

const ENDPOINT = '/api/agency-profile/mark' as const;

/**
 * **Τι συμβαίνει τώρα με το σήμα** — ρητές καταστάσεις, **ποτέ** `boolean` + `string`.
 *
 * 🔑 Το `warned` είναι **ήσυχη** κατάσταση: το σήμα **μπήκε**, και υπάρχει κάτι να
 * ειπωθεί. Ενωμένο με τα σφάλματα, η οθόνη θα το ζωγράφιζε κόκκινο για μια πράξη που
 * **πέτυχε**.
 */
export type ShowcaseMarkState =
  | { readonly state: 'idle' }
  | { readonly state: 'uploading' }
  | { readonly state: 'publishing' }
  | { readonly state: 'removing' }
  /** Πέτυχε, αλλά η εικόνα δεν φτάνει για κάθε επιφάνεια. */
  | { readonly state: 'warned'; readonly reach: ShowcaseMarkReach }
  /** ⛔ *«Διάλεξε άλλο αρχείο.»* — το αρχείο **δεν** ταξίδεψε ή απορρίφθηκε ονομαστικά. */
  | { readonly state: 'rejected'; readonly verdict: LocalRejection | AgencyProfileRejection }
  /** 🔴 *«Ξαναδοκίμασε το ίδιο.»* — δικό **μας** πρόβλημα, όχι δικό του. */
  | { readonly state: 'failed'; readonly at: 'upload' | 'declare' | 'remove' };

/**
 * Οι αρνήσεις που γεννιούνται **εδώ**, πριν από κάθε δίκτυο.
 *
 * ⚠️ **Χωριστός τύπος από το `AgencyProfileRejection`, στην ίδια ένωση**: εκείνες τις
 * λέει ο **διακομιστής** και έχουν κλειδί στον `SHOWCASE_REJECTION_KEYS`· αυτές δεν
 * φτάνουν ποτέ σε δίκτυο. Ενωμένες σε έναν πίνακα, ο διακομιστής θα φαινόταν να
 * «απαντά» πράγματα που δεν ρωτήθηκε ποτέ.
 */
export type LocalRejection = 'mark-unreadable' | 'mark-too-small';

export interface ShowcaseMark {
  readonly state: ShowcaseMarkState;
  /** Πόσο μικρή ήταν, όταν {@link ShowcaseMarkState} είναι `rejected` με `mark-too-small`. */
  readonly tooSmall: { readonly shortest: number; readonly required: number } | null;
  readonly declare: (file: File, kind: ShowcaseMarkKind) => Promise<void>;
  readonly retract: () => Promise<void>;
}

/**
 * **Οι διαστάσεις της εικόνας, χωρίς να τη ζωγραφίσουμε.**
 *
 * 🔑 `createImageBitmap` και **όχι** `new Image()` + `onload`: αποκωδικοποιεί **εκτός**
 * του κύριου νήματος, δεν αγγίζει το DOM, και **πετά** σε αρχείο που δεν είναι εικόνα
 * αντί να μείνει σιωπηλά σε `onerror` που κάποιος πρέπει να θυμηθεί να συνδέσει.
 *
 * ⚠️ **`close()` σε `finally`**: το bitmap κρατά **αποκωδικοποιημένα** pixel — μια εικόνα
 * 4000×4000 είναι ~64MB. Χωρίς αυτό, πέντε δοκιμές του ίδιου ανθρώπου γεμίζουν τη μνήμη
 * μιας καρτέλας.
 */
async function measure(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

/**
 * **Μέτρησε και κρίνε** — το βήμα 1, ολόκληρο, **έξω από το hook**.
 *
 * 🔑 Επιστρέφει είτε την **έτοιμη κατάσταση άρνησης** είτε το `verdict` που επιβιώνει ως
 * το τέλος *(η προειδοποίηση δεν χάνεται στην επιτυχία)*. Ο καλών δεν ξαναρωτά τίποτα.
 */
async function judgeFile(
  file: File,
): Promise<
  | { readonly rejected: ShowcaseMarkState; readonly tooSmall: ShowcaseMark['tooSmall'] }
  | { readonly verdict: ShowcaseMarkInputVerdict }
> {
  const dimensions = await measure(file);
  if (dimensions === null) {
    return { rejected: { state: 'rejected', verdict: 'mark-unreadable' }, tooSmall: null };
  }

  const verdict = judgeShowcaseMarkInput(dimensions);
  if (verdict.outcome === 'tooSmall') {
    return {
      rejected: { state: 'rejected', verdict: 'mark-too-small' },
      tooSmall: { shortest: verdict.shortest, required: verdict.required },
    };
  }

  return { verdict };
}

/**
 * **Στείλε τη δήλωση στο σύνορο** και μετάφρασε την απάντηση σε κατάσταση.
 *
 * ⚠️ **Η προειδοποίηση περνά ΜΕΣΑ**, δεν προστίθεται μετά: η επιτυχία με `warned` και η
 * επιτυχία σκέτη είναι **δύο** αποτελέσματα της ίδιας κλήσης, και ο καλών δεν πρέπει να
 * θυμάται να τα ενώσει.
 */
async function postMark(
  kind: ShowcaseMarkKind,
  privateStoragePath: string,
  verdict: ShowcaseMarkInputVerdict,
): Promise<ShowcaseMarkState> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, privateStoragePath }),
    });

    const rejection = await rejectionOf(response);
    if (rejection !== null) return { state: 'rejected', verdict: rejection };
    if (!response.ok) return { state: 'failed', at: 'declare' };

    return verdict.outcome === 'warned'
      ? { state: 'warned', reach: verdict.reach }
      : { state: 'idle' };
  } catch {
    // Δίκτυο που δεν απάντησε — **όχι** άρνηση της πόρτας.
    return { state: 'failed', at: 'declare' };
  }
}

/** Η άρνηση του διακομιστή, ονομαστικά — ή `null` όταν πέτυχε. */
async function rejectionOf(response: Response): Promise<AgencyProfileRejection | null> {
  if (response.ok) return null;

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    reason?: AgencyProfileRejection;
  } | null;

  // ⚠️ **Ο έλεγχος γίνεται στο σώμα**, όχι μόνο στο `response.ok`: η πόρτα απαντά με
  //    **ονόματα** ακριβώς για να μπορεί η οθόνη να πει το σωστό. Ένα σκέτο «απέτυχε» θα
  //    πετούσε αυτή την πληροφορία — και θα την πετούσε **σιωπηλά**.
  return body?.error === 'INVALID_MARK' && body.reason !== undefined ? body.reason : null;
}

/**
 * **Ανεβάζει στον κανονικό ιδιωτικό αγωγό** και επιστρέφει το μονοπάτι.
 *
 * ════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΟΧΙ ΤΟ `useEnterpriseFileUpload` — **ΜΕΤΡΗΘΗΚΕ, ΔΕΝ ΠΡΟΤΙΜΗΘΗΚΕ**
 * ════════════════════════════════════════════════════════════════════════
 *
 * Δεν είναι δεύτερος αγωγός: είναι **ο ίδιος** (`PhotoUploadService.uploadPhoto`,
 * ADR-293), χωρίς το περιτύλιγμα οθόνης που αυτή η οθόνη **δεν χρησιμοποιεί**. Το
 * hook προσφέρει toasts *(τα σβήνουμε)*, κατάσταση *(κρατάμε δική μας, με ρητά
 * ονόματα)* και επικύρωση *(κάνουμε **άλλη** — διαστάσεις, όχι MIME)*.
 *
 * 🔴 **ΚΑΙ Η ΕΙΣΑΓΩΓΗ ΤΟΥ ΕΙΧΕ ΜΕΤΡΗΣΙΜΟ ΚΟΣΤΟΣ**, που το βρήκε **η πύλη**: ο
 * γεννήτορας του route slice (ADR-744 / CHECK 3.34) **ΑΡΝΗΘΗΚΕ** να εκπέμψει τρεις
 * διαδρομές — *«20 κλειδιά χωρίς namespace: Φωτογραφία · Λογότυπο · Έγγραφο»*. Το
 * hook καλεί `t('upload.toast.…')` **χωρίς πρόθεμα** και διαβάζει ετικέτες από το
 * `PURPOSE_CONFIG`, που είναι **σκληροκωδικωμένα ελληνικά** *(N.11, υπάρχον χρέος)*.
 * Δηλαδή η οθόνη του σήματος θα έσερνε εκείνο το χρέος **μέσα στο κέλυφος** — και θα
 * μπλόκαρε το commit για κώδικα που δεν έγραψε.
 *
 * 🔑 Ίδια απόφαση, ίδια λέξη, με το `useOwnerPropertyMedia`: *«δεν γράφτηκε δεύτερος
 * αγωγός — επαναχρησιμοποιείται ό,τι είναι ανεξάρτητο»*. Εκεί το εμπόδιο ήταν η
 * **απουσία μισθωτή**· εδώ είναι το **λεξιλόγιο**. Και στις δύο περιπτώσεις ο
 * **κανονικός** αγωγός μένει ο ίδιος.
 *
 * ⚠️ **`enableCompression: false` — Η ΓΡΑΜΜΗ ΠΟΥ ΣΩΖΕΙ ΤΗ ΔΙΑΦΑΝΕΙΑ.** Ο συμπιεστής
 * του περιηγητή παράγει **πάντα JPEG** (`canvas.toBlob(…, 'image/jpeg', …)`), που
 * **δεν έχει κανάλι alpha**: λογότυπο PNG με διαφάνεια θα έβγαινε με **μαύρο** φόντο,
 * ενώ το ράφι υπόσχεται ρητά *«η διαφάνεια ΜΕΝΕΙ»*. Ο σωστός συμπιεστής είναι ο
 * **διακομιστής** — `sharp`, WebP lossless, `preset: icon`.
 *
 * ⚠️ **Και το `purpose` μένει `'logo'` για ΚΑΙ ΤΑ ΔΥΟ είδη**: το χρησιμοποιεί μόνο το
 * `FileNamingService`, και το `'avatar'` θα έγραφε *«φωτογραφία προφίλ»* πάνω σε
 * λογότυπο εταιρείας.
 */
async function uploadMarkToPrivate(
  file: File,
  companyId: string | null,
  createdBy: string | null,
): Promise<string | null> {
  if (companyId === null || createdBy === null) return null;

  const result = await PhotoUploadService.uploadPhoto(file, {
    purpose: 'logo',
    enableCompression: false,
    // 🔑 **Ο οργανισμός είναι ΚΑΙ ο μισθωτής ΚΑΙ η οντότητα**: το σήμα δεν ανήκει σε
    //    επαφή ή ακίνητο — ανήκει στην **ίδια την εταιρεία**. Το μονοπάτι που παράγεται
    //    (`companies/{cid}/entities/company/{cid}/…`) περνά **αυτούσιο** τον φρουρό
    //    κατοχής του διακομιστή, που ρωτά ακριβώς `parseStoragePath(…).companyId`.
    entityType: ENTITY_TYPES.COMPANY,
    entityId: companyId,
    domain: FILE_DOMAINS.ADMIN,
    category: FILE_CATEGORIES.PHOTOS,
    companyId,
    createdBy,
  });

  return result.storagePath;
}

/**
 * **Ζήτησε την απόσυρση** και μετάφρασε την απάντηση σε κατάσταση.
 *
 * 🔑 **Χωρίς σώμα**: η ταυτότητα έρχεται από τα claims και το αντικείμενο είναι μοναδικό
 * — **ένα** σήμα ανά επαγγελματία. Ένα σώμα εδώ θα ρωτούσε *«ποιο;»* σε ερώτηση που έχει
 * μία απάντηση.
 */
async function deleteMark(): Promise<ShowcaseMarkState> {
  try {
    const response = await fetch(ENDPOINT, { method: 'DELETE' });
    const rejection = await rejectionOf(response);

    if (rejection !== null) return { state: 'rejected', verdict: rejection };
    return response.ok ? { state: 'idle' } : { state: 'failed', at: 'remove' };
  } catch {
    return { state: 'failed', at: 'remove' };
  }
}

export function useShowcaseMark(): ShowcaseMark {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const createdBy = user?.uid ?? null;

  const [state, setState] = useState<ShowcaseMarkState>({ state: 'idle' });
  const [tooSmall, setTooSmall] = useState<ShowcaseMark['tooSmall']>(null);

  const uploadToPrivate = useCallback(
    (file: File) => uploadMarkToPrivate(file, companyId, createdBy),
    [companyId, createdBy],
  );

  const declare = useCallback(
    async (file: File, kind: ShowcaseMarkKind): Promise<void> => {
      setTooSmall(null);

      // ── 1 · Η κρίση, ΠΡΙΝ από κάθε byte ────────────────────────────────
      const judged = await judgeFile(file);
      if ('rejected' in judged) {
        setTooSmall(judged.tooSmall);
        setState(judged.rejected);
        return;
      }

      // ── 2 · Το ανέβασμα ────────────────────────────────────────────────
      setState({ state: 'uploading' });
      const storagePath = await uploadToPrivate(file).catch(() => null);

      // ⚠️ **Η αποτυχία ΟΝΟΜΑΖΕΤΑΙ**, ποτέ δεν υποτίθεται: ένας σιωπηλός `?? ''` θα
      //    έστελνε **κενό μονοπάτι** στο σύνορο, και ο φρουρός κατοχής θα απαντούσε
      //    *«ξένο αρχείο»* για βλάβη **δική μας** — άρνηση που στέλνει τον άνθρωπο να
      //    ψάξει λάθος πράγμα.
      if (storagePath === null) {
        logger.error('[MARK] Το ανέβασμα δεν επέστρεψε μονοπάτι', { companyId });
        setState({ state: 'failed', at: 'upload' });
        return;
      }

      // ── 3 · Η δήλωση ───────────────────────────────────────────────────
      setState({ state: 'publishing' });
      setState(await postMark(kind, storagePath, judged.verdict));
    },
    [uploadToPrivate, companyId],
  );

  const retract = useCallback(async (): Promise<void> => {
    setTooSmall(null);
    setState({ state: 'removing' });
    setState(await deleteMark());
  }, []);

  return { state, tooSmall, declare, retract };
}
