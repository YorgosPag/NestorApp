'use client';

/**
 * @fileoverview **Η ΚΑΤΑΘΕΣΗ ΤΗΣ ΔΗΛΩΣΗΣ — ΜΟΝΟ Η ΓΡΑΦΗ.**
 * @related ADR-824 §5.3 · §12.14 · ADR-841 §7 Α23 · app/api/companies/capabilities/brokerage/route.ts
 * @module hooks/company/useBrokerageDeclaration
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΔΕΝ ΔΙΑΒΑΖΕΙ ΤΙΠΟΤΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο αναγνώστης της ικανότητας είναι **ΕΝΑΣ** — το
 * {@link useMyOrganizationCapabilities}. Ένας δεύτερος hook που «διάβαζε και έγραφε»
 * θα σήμαινε **δεύτερο `onSnapshot` στο ίδιο έγγραφο**, δηλαδή δύο μονοπάτια που
 * μπορούν να αποκλίνουν: το σχήμα του ADR-749, και ρητή κόκκινη γραμμή του ADR-824
 * §12.8. Εδώ ζει **μόνο** η πράξη· την κατάσταση τη διαβάζει η οθόνη από τον ΕΝΑΝ.
 *
 * 🔑 **Και η ζωντανή συνδρομή κάνει το «reload» περιττό**: μόλις η πόρτα γράψει
 * `pending`, το στιγμιότυπο φτάνει **μόνο του** στον αναγνώστη και η οθόνη αλλάζει.
 * Ένα χειροκίνητο `refetch()` εδώ θα ήταν **δεύτερη αλήθεια** για την ίδια στιγμή —
 * και θα μπορούσε να προλάβει ή να καθυστερήσει το στιγμιότυπο.
 *
 * ⚠️ **Η γραφή περνά από την πόρτα, ποτέ απευθείας στο Firestore.** Το
 * `companies/{id}` δεν είναι εγγράψιμο από τον φυλλομετρητή, και σωστά: η μετάβαση
 * είναι **κλειστό σύνολο** (`ALLOWED_FROM`) που κρίνεται στον διακομιστή. Ένα
 * `updateDoc` εδώ θα παρέκαμπτε τη μηχανή καταστάσεων ολόκληρη.
 */

import { useCallback, useState } from 'react';

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useBrokerageDeclaration');

const ENDPOINT = '/api/companies/capabilities/brokerage' as const;

/**
 * **Τα στοιχεία που μόνο ο άνθρωπος ξέρει** — και τα δύο ταξιδεύουν μαζί.
 *
 * ⚠️ Το σχήμα είναι **αντίγραφο του συμβολαίου της πόρτας**, όχι τυχαίο: ο
 * `declarationSchema` (zod) απαιτεί **και τα δύο** μη κενά.
 *
 * 🔑 **Ο αριθμός ΓΕΜΗ ΔΕΝ είναι εδώ** (ADR-841 §7 Α23): η πόρτα τον διαβάζει από το προφίλ
 * της εταιρείας. Πεδίο στο σώμα θα ήταν δεύτερη αλήθεια — ακριβώς η απόκλιση που βρέθηκε
 * ζωντανά (άλλος αριθμός στη δήλωση, κενό στο προφίλ).
 */
export interface BrokerageDeclarationInput {
  readonly chamberRegistryNumber: string;
  readonly legalRepresentativeName: string;
}

/**
 * **Γιατί δεν έγινε** — κλειστό σύνολο, ποτέ κείμενο (N.11).
 *
 * 🔑 **Ονόματα, όχι κωδικοί HTTP.** Η οθόνη δεν πρέπει να ξέρει ότι το «η κατάσταση
 * άλλαξε στο μεταξύ» είναι 409 — πρέπει να ξέρει **τι να πει**. Ίδιο ιδίωμα με το
 * `ShowcaseFailure` της αδελφής οθόνης, που ξεχωρίζει `alias-not-owned` από
 * `alias-unverified` **επειδή οδηγούν σε διαφορετική πράξη**.
 *
 * ⚠️ Το `conflict` είναι **ιδιαίτερο**: σημαίνει ότι η ζωντανή κατάσταση που βλέπει ο
 * άνθρωπος **προλάβαινε ήδη να αλλάξει** — π.χ. εγκρίθηκε όσο συμπλήρωνε τη φόρμα.
 * Δεν είναι σφάλμα του, και δεν του ζητάμε να ξαναπροσπαθήσει.
 *
 * ⚠️ `profileRegistrationMissing` ≠ `profileUnavailable`: το πρώτο στέλνει τον άνθρωπο στο
 * **προφίλ** να γράψει αριθμό· το δεύτερο του λέει να **περιμένει** — ο αριθμός ίσως υπάρχει.
 */
export type BrokerageDeclarationFailure =
  | 'invalid'
  | 'forbidden'
  | 'conflict'
  | 'notFound'
  | 'profileRegistrationMissing'
  | 'profileUnavailable'
  | 'failed';

export interface BrokerageDeclarationForm {
  readonly submitting: boolean;
  readonly failure: BrokerageDeclarationFailure | null;
  readonly submit: (declaration: BrokerageDeclarationInput) => Promise<void>;
}

/** Τα ονόματα που γράφει η πόρτα στο σώμα → λόγος αποτυχίας. */
const FAILURE_BY_ERROR: Readonly<Record<string, BrokerageDeclarationFailure>> = {
  NO_ORGANIZATION: 'forbidden',
  ILLEGAL_TRANSITION: 'conflict',
  NOT_FOUND: 'notFound',
  PROFILE_REGISTRATION_MISSING: 'profileRegistrationMissing',
  PROFILE_UNAVAILABLE: 'profileUnavailable',
  WRITE_FAILED: 'failed',
};

/**
 * **Η απάντηση της πόρτας → λόγος αποτυχίας**, ή `null` όταν πέτυχε.
 *
 * ⚠️ Ο έλεγχος γίνεται στο **σώμα**, όχι μόνο στο `response.ok`: η πόρτα απαντά με
 * **ονόματα** (`ILLEGAL_TRANSITION` ≠ `NO_ORGANIZATION`) ακριβώς για να μπορεί η οθόνη
 * να πει το σωστό.
 *
 * 🔑 **Το `422` του `readJsonBody` δεν έχει όνομα στο σώμα** — το παράγει πριν φτάσει ο
 * χειριστής. Γι' αυτό ο κωδικός διαβάζεται **μαζί** με το σώμα: το ένα από τα δύο
 * σιωπά κάθε φορά, και μόνο τα δύο μαζί καλύπτουν όλες τις εκβάσεις.
 */
async function failureOf(response: Response): Promise<BrokerageDeclarationFailure | null> {
  if (response.ok) return null;

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  const named = body?.error !== undefined ? FAILURE_BY_ERROR[body.error] : undefined;
  if (named !== undefined) return named;

  // ⚠️ **Ο κωδικός είναι η δεύτερη πηγή, όχι εικασία**: το 422 του `readJsonBody`
  //    και το 403 του `withAuth` δεν περνούν από τον χειριστή, άρα δεν έχουν όνομα.
  if (response.status === 422 || response.status === 400) return 'invalid';
  if (response.status === 403 || response.status === 401) return 'forbidden';
  return 'failed';
}

/**
 * **Η κατάθεση της δήλωσης** — και **μόνο** αυτή.
 *
 * 🔴 **Η επιτυχία ΔΕΝ δίνει `active`, και δεν πρέπει ποτέ να δώσει** (ADR-824 §5.3): ο
 * Ν. 4072/2012 κάνει τη μεσιτεία **χωρίς εγγραφή** παράνομη, και πλατφόρμα που
 * ενεργοποιεί ρυθμιζόμενη δραστηριότητα με **αυτοδήλωση** αναλαμβάνει το ρίσκο η ίδια.
 * Η πόρτα γράφει `pending`· η οθόνη το μαθαίνει από τον αναγνώστη.
 */
export function useBrokerageDeclaration(): BrokerageDeclarationForm {
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<BrokerageDeclarationFailure | null>(null);

  const submit = useCallback(async (declaration: BrokerageDeclarationInput) => {
    setSubmitting(true);
    // ⚠️ **Η προηγούμενη αποτυχία σβήνεται ΠΡΙΝ**, όχι μετά: αλλιώς ο άνθρωπος βλέπει
    //    το παλιό κόκκινο όσο τρέχει η νέα προσπάθεια και δεν ξέρει ποιο ισχύει.
    setFailure(null);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(declaration),
      });
      const reason = await failureOf(response);
      if (reason !== null) {
        logger.warn('Η δήλωση μεσιτείας δεν έγινε δεκτή', {
          data: { status: response.status, reason },
        });
      }
      setFailure(reason);
    } catch (error) {
      // 🔴 **Το δίκτυο δεν είναι άρνηση.** Ένα «δεν επιτρέπεσαι» εδώ θα έλεγε ψέματα
      //    για ρυθμιστική απόφαση που κανείς δεν πήρε.
      logger.error('Η δήλωση μεσιτείας δεν έφυγε', {
        error: error instanceof Error ? error.message : String(error),
      });
      setFailure('failed');
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submitting, failure, submit };
}
