'use client';

/**
 * ADR-748 Φάση 3 — Η **ΕΝΕΡΓΗ ΔΟΥΛΕΙΑ** (άξονας 3).
 *
 * ⛔ ΟΝΟΜΑΤΟΛΟΓΙΑ (Ε6.στ, Π-9): `Workspace` = **ΟΡΓΑΝΙΣΜΟΣ** (ADR-032) και ζει
 * στο `contexts/WorkspaceContext.tsx`. **ΔΕΝ το αγγίζουμε** — είναι Φάση 4.
 * Αυτό εδώ είναι η **ΔΟΥΛΕΙΑ**, τελείως άλλος άξονας. Αν ενωθούν, γεννιέται το
 * πέμπτο λεξιλόγιο ρόλων που το ADR-748 ήρθε να θεραπεύσει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΠΟΘΗΚΕΥΕΤΑΙ — **ΕΝΑ** ΠΡΑΓΜΑ (Ε5.β)
 *
 * Μόνο **ποια δουλειά ήταν ενεργή**. Η λίστα των διαθέσιμων **ΔΕΝ**
 * αποθηκεύεται ποτέ: υπολογίζεται ζωντανά σε κάθε render από το
 * `jobs-access.ts` (Ε5.α/Ε5.γ). Αυτό ακριβώς είναι η διαφορά Figma vs Autodesk
 * (§6.9.1): ο ACC **αντιγράφει** το default τη στιγμή της ένταξης και αποκλίνει
 * σιωπηλά για πάντα. Εδώ δεν υπάρχει τι να αποκλίνει.
 *
 * ⚠️ Το δεύτερο πράγμα του Ε5.β — «ποιες δουλειές έκρυψε **ο ίδιος** ο χρήστης»
 * — **δεν** υλοποιείται στη Φάση 3: χρειάζεται το πλήρες χειριστήριο του Ε-6
 * (Φάση 4). Ο δείκτης «Χ κρυμμένα» της Φάσης 3 μετρά **στοιχεία που έκρυψε η
 * ενεργή δουλειά**, όχι δουλειές που έκρυψε ο χρήστης. Δύο διαφορετικά πράγματα.
 * ─────────────────────────────────────────────────────────────────────────────
 * ΠΡΟΕΠΙΛΟΓΗ = `JOB_ALL` — ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ
 *
 * Υπάρχων χρήστης βλέπει **ακριβώς ό,τι έβλεπε χθες** μέχρι να γυρίσει **ο
 * ίδιος** τον διακόπτη. Είναι το σημείο που δούλεψε στη Φάση 2 (προεπιλογή
 * «Όλα» στον διακόπτη ειδικότητας) και ταυτόχρονα η **Α-3**: καμία σιωπηλή
 * απόκρυψη, ποτέ — το μάθημα του Office 2000 (§6.7).
 *
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΕΦΑΡΜΟΖΕΤΑΙ ΤΟ `pickDefaultJob()` ΑΥΤΟΜΑΤΑ: υπάρχει και είναι
 * σωστό (Ε7.δ), αλλά είναι η **πρόταση της πρώτης μέρας** — και η πρώτη μέρα
 * είναι η Φάση 3.5. Αυτόματη εφαρμογή του σήμερα θα άλλαζε την οθόνη κάθε
 * υπάρχοντος χρήστη χωρίς να το ζητήσει κανείς: αυτόματη απόκρυψη = ακριβώς η
 * αποτυχία του Office 2000. Ο ρόλος **προτείνει**, δεν φυλακίζει (Α-1).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §9/Ε-5
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, safeGetItem, safeSetItem } from '@/lib/storage';
import { JOBS, type JobId } from '@/config/jobs-registry';
import { JOB_ALL, type JobSelection } from '@/config/jobs-access';

interface ActiveJobContextValue {
  /** Η ενεργή δουλειά, ή `JOB_ALL` όταν δεν φιλτράρεται τίποτα. */
  readonly activeJob: JobSelection;
  readonly setActiveJob: (job: JobSelection) => void;
  /** Α-3: επαναφορά με **ένα** κλικ, από παντού. */
  readonly resetToAll: () => void;
}

const ActiveJobContext = createContext<ActiveJobContextValue | null>(null);

/** Ο Radix/localStorage δίνει `string` — ποτέ cast, πάντα type guard. */
export function isJobSelection(value: string): value is JobSelection {
  return value === JOB_ALL || Object.prototype.hasOwnProperty.call(JOBS, value);
}

export function ActiveJobProvider({ children }: { children: React.ReactNode }) {
  // Ξεκινά ΠΑΝΤΑ από `JOB_ALL` και διαβάζει το localStorage σε effect: το
  // πρώτο render είναι server-rendered και δεν έχει localStorage — διαφορετική
  // αρχική τιμή ⇒ hydration mismatch.
  const [activeJob, setActiveJobState] = useState<JobSelection>(JOB_ALL);

  useEffect(() => {
    const stored = safeGetItem(STORAGE_KEYS.ACTIVE_JOB, JOB_ALL as string);
    if (isJobSelection(stored)) setActiveJobState(stored);
  }, []);

  const setActiveJob = useCallback((job: JobSelection) => {
    setActiveJobState(job);
    safeSetItem(STORAGE_KEYS.ACTIVE_JOB, job);
  }, []);

  const resetToAll = useCallback(() => setActiveJob(JOB_ALL), [setActiveJob]);

  const value = useMemo<ActiveJobContextValue>(
    () => ({ activeJob, setActiveJob, resetToAll }),
    [activeJob, setActiveJob, resetToAll],
  );

  return <ActiveJobContext.Provider value={value}>{children}</ActiveJobContext.Provider>;
}

/**
 * ⚠️ Επιστρέφει `JOB_ALL` **εκτός** provider αντί να πετάξει σφάλμα.
 *
 * Είναι φίλτρο θορύβου, όχι πύλη ασφαλείας: αν κάποιο δέντρο του UI βρεθεί χωρίς
 * provider, το σωστό είναι να **φανούν τα πάντα** — ποτέ κενή οθόνη (Ε7.ε/Υ-10),
 * ποτέ crash σε πλοήγηση. Η αντίστροφη επιλογή (throw) θα μετέτρεπε ένα λάθος
 * σύνθεσης σε λευκή σελίδα.
 */
export function useActiveJob(): ActiveJobContextValue {
  const context = useContext(ActiveJobContext);
  if (context !== null) return context;
  return FALLBACK_CONTEXT;
}

const NO_OP = (): void => undefined;
const FALLBACK_CONTEXT: ActiveJobContextValue = {
  activeJob: JOB_ALL,
  setActiveJob: NO_OP,
  resetToAll: NO_OP,
};

export type { JobId };
