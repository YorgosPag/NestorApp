'use client';

/**
 * @fileoverview **ΤΙ ΑΠΑΝΤΗΣΕ Ο ΔΙΑΚΟΜΙΣΤΗΣ** — ο λόγος, **και η διέξοδος**.
 * @related ADR-834 §8 · components/mandate/mandate-request-form-labels.ts
 * @module components/mandate/MandateRequestOutcomeNotice
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΔΥΟ ΛΟΓΟΙ, ΚΑΙ Ο ΔΕΥΤΕΡΟΣ ΕΙΝΑΙ Ο ΣΟΒΑΡΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. Το `MandateRequestFormContent` ήταν **495 γραμμές** — το όριο N.7.1 είναι 500.
 * 2. 🔑 **ΚΑΙ ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ: ΓΙΝΕΤΑΙ ΑΓΚΥΡΩΣΙΜΟ.** Η υπάρχουσα άγκυρα του Σ1
 *    δηλώνει ρητά όριο — *«το `Π` κρίνει **πηγή**, όχι απόδοση: το
 *    `MandateRequestFormContent` σέρνει `useAuth`, δρομολογητή, ζωντανό Firestore
 *    hook και route slice, και δεν αποδίδεται φθηνά»*. Αυτό εδώ σέρνει **μόνο** τον
 *    μεταφραστή: η υπόσχεση *«η άρνηση φτάνει στην οθόνη με κείμενο και σύνδεσμο»*
 *    γίνεται **συμπεριφορική** άγκυρα αντί για έλεγχο πηγής.
 *
 * ⚠️ **ΔΕΝ κρίνει τίποτα.** Ποιος κωδικός έχει διέξοδο το λέει ο στατικός πίνακας
 * {@link REJECTION_REMEDY}· εδώ γίνεται μόνο η **απόδοση**. Ένα `if (reason === …)`
 * μέσα σε JSX θα ήταν δεύτερη λίστα, αόρατη στον μεταγλωττιστή.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link } from '@/lib/workspace/navigation';
import type { MandateRequestRejection } from '@/services/mandate/mandate-request-vocabulary';

import {
  MANDATE_REQUEST_NS,
  REJECTION_KEYS,
  REJECTION_REMEDY,
  SCREEN_KEYS,
} from './mandate-request-form-labels';

export interface MandateRequestOutcomeNoticeProps {
  /**
   * Η **ονομαστική** άρνηση, ή `null` για *«δεν μάθαμε»*.
   *
   * 🔴 **Το `null` ΔΕΝ είναι «καμία άρνηση»** — αυτή η ειδοποίηση δεν αποδίδεται
   * καθόλου όταν δεν υπάρχει έκβαση. Είναι το **503** (N.12): *«ξαναδοκίμασε, μην
   * αλλάξεις τίποτα»*, που στέλνει τον άνθρωπο σε **αντίθετη** πράξη από κάθε
   * ονομαστική άρνηση.
   */
  readonly reason: MandateRequestRejection | null;
}

export function MandateRequestOutcomeNotice({
  reason,
}: MandateRequestOutcomeNoticeProps): React.JSX.Element {
  const { t } = useTranslation([MANDATE_REQUEST_NS]);
  const remedy = reason === null ? null : REJECTION_REMEDY[reason];

  return (
    // ⚠️ `role="alert"` στο **δοχείο**, ώστε ο σύνδεσμος να ανακοινώνεται μαζί με τον
    //    λόγο. Χωριστές ζώνες θα διάβαζαν τη διέξοδο **πριν** το γιατί.
    <aside
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-border bg-card p-3 text-sm text-foreground"
    >
      <p className="m-0">
        {reason === null ? t(SCREEN_KEYS.unverified) : t(REJECTION_KEYS[reason])}
      </p>

      {/*
        🔑 **ΣΧΗΜΑ P2B ΑΡΘΡΟ 4 — ΛΟΓΟΣ **ΚΑΙ** ΔΥΝΑΤΟΤΗΤΑ ΔΙΟΡΘΩΣΗΣ.** Μια άρνηση που
        λέει *«λείπουν τα στοιχεία σου»* χωρίς να πει **πού**, αφήνει τον άνθρωπο να
        ψάξει μενού — και είναι ακριβώς το αδιέξοδο που το ADR-834 §8 θεραπεύει.
      */}
      {remedy !== null && (
        <Link
          href={remedy.href}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t(remedy.labelKey)}
        </Link>
      )}
    </aside>
  );
}
