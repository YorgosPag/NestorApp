'use client';

/**
 * @fileoverview 🔴 **Ό,τι διαβάστηκε και δεν δέθηκε — ΟΡΑΤΟ** (ADR-762 §5, ADR-745 §8 κανόνας 3).
 *
 * Ο κανόνας 3 του ADR-745 λέει *«τίποτα δεν χάνεται σιωπηλά»*, και **τρία** σχόλια στον κώδικα
 * ονόμαζαν το `unparsed` «ορατό, όχι χαμένο». 🔴 Μετρημένο 2026-08-06 με `rg`: **κανένας
 * καταναλωτής**. Ούτε ο Λ2, ούτε η παλέτα, ούτε πύλη. Γραφόταν και δεν το διάβαζε κανείς — ο
 * κανόνας ήταν σχόλιο, όχι μηχανή. Αυτό το αρχείο είναι η υλοποίησή του.
 *
 * Δύο πράγματα φαίνονται εδώ, και είναι **συμμετρικά**:
 *
 * | τι | ήταν | γιατί μετράει |
 * |---|---|---|
 * | τιμή χωρίς ετικέτα (`unparsed`) | γραφόταν, κανείς δεν το διάβαζε | το κείμενο υπάρχει στο σχέδιο |
 * | ετικέτα χωρίς τιμή (`unmatchedLabels`) | **πεταγόταν** μέσα στο ζευγάρωμα | η πινακίδα **έχει** τυπωμένο το πεδίο |
 *
 * ⚠️ **Καμία ενέργεια, κανένα κουμπί, καμία εγγραφή.** Αυτή η ενότητα **πληροφορεί**. Αν έδινε
 * κουμπί «σύνδεσε το», θα ξαναγεννούσε ακριβώς τον κίνδυνο που ο Λ1 αποφεύγει: να γραφτεί στη
 * βάση κάτι που **δεν διαβάστηκε**, αλλά μαντεύτηκε.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockUnreadSection
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TitleBlockReading } from '@/types/title-block-reading';
import { FIELD_LABEL } from './proposal-labels';

interface Props {
  /** Οι αναγνώσεις του **επιλεγμένου** layer — ένα layer μπορεί να φέρει πάνω από μία πινακίδα. */
  readonly readings: readonly TitleBlockReading[];
}

/**
 * Ταυτότητα γραμμής.
 *
 * 🔴 **Η λαβή ΔΕΝ αρκεί — ένα κελί φέρει περισσότερες από μία ετικέτες.** Το βρήκε ο Giorgio στην
 * οθόνη: `Encountered two children with the same key, l:0:mtext_998`. Το κελί
 * `ΕΡΓΟΔΟΤΗΣ … ΥΠΟΓΡΑΦΗ` της δεξιάς πινακίδας του G753 είναι **ένα** MTEXT με **δύο** ετικέτες
 * (το `title-block-pairing` το τεκμηριώνει ρητά), και όταν καμία δεν βρίσκει τιμή — που είναι η
 * κανονική κατάσταση μιας **κενής φόρμας υπογραφής** — βγαίνουν δύο γραμμές με **ίδιο handle**.
 *
 * Ούτε το `handle + key` αρκεί: η ίδια ετικέτα μπορεί να εμφανιστεί δύο φορές στο ίδιο κελί
 * (`findLabelOccurrences` επιστρέφει **όλες** τις εμφανίσεις). Η μόνη εγγυημένα μοναδική
 * ταυτότητα είναι η **θέση στη ντετερμινιστική έξοδο του Λ1** — και είναι σταθερή, γιατί ο Λ1
 * είναι καθαρή συνάρτηση πάνω σε αμετάβλητη σκηνή. Το `handle` και το `key` μένουν μέσα για
 * αναγνωσιμότητα στα devtools, όχι για μοναδικότητα.
 */
const labelKeyOf = (blockIndex: number, index: number, handle: string, field: string): string =>
  `l:${blockIndex}:${index}:${handle}:${field}`;
const textKeyOf = (blockIndex: number, index: number): string => `t:${blockIndex}:${index}`;

export const TitleBlockUnreadSection: React.FC<Props> = ({ readings }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const missing = readings.flatMap((reading, blockIndex) =>
    reading.unmatchedLabels.map((label, index) => ({ blockIndex, index, label })),
  );
  const leftovers = readings.flatMap((reading, blockIndex) =>
    reading.unparsed.map((text, index) => ({ blockIndex, index, text })),
  );

  // Τίποτα αδιάθετο ⇒ **τίποτα στο DOM**. Μια μονίμως παρούσα κενή ενότητα θα εκπαίδευε το μάτι
  // να την προσπερνά, και τη μέρα που θα είχε περιεχόμενο δεν θα τη διάβαζε κανείς.
  if (missing.length === 0 && leftovers.length === 0) return null;

  return (
    <section className="mt-3 border-t border-border pt-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {t('titleBlockBinding.unreadTitle')}
      </h3>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
        {t('titleBlockBinding.unreadNote')}
      </p>

      <ul className="mt-1.5 flex flex-col gap-1">
        {missing.map(({ blockIndex, index, label }) => (
          <li
            key={labelKeyOf(blockIndex, index, label.labelHandle, label.key)}
            className="text-[11px] leading-snug text-foreground"
          >
            {t('titleBlockBinding.missingValue', { label: t(FIELD_LABEL[label.key]) })}
          </li>
        ))}
        {leftovers.map(({ blockIndex, index, text }) => (
          <li
            key={textKeyOf(blockIndex, index)}
            className="text-[11px] leading-snug text-muted-foreground"
          >
            {t('titleBlockBinding.unparsedItem', { text })}
          </li>
        ))}
      </ul>
    </section>
  );
};
