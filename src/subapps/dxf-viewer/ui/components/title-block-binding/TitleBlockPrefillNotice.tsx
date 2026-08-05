'use client';

/**
 * @fileoverview **Τι προσυμπληρώθηκε και τι αξίζει δεύτερη ματιά** (ADR-759 Φ1).
 *
 * 🔴 **Ο λόγος ύπαρξης.** Μια φόρμα που γεμίζει μόνη της από ένα αρχείο και δεν λέει τίποτα
 * εκπαιδεύει τον χρήστη να πατά «Αποθήκευση» χωρίς να διαβάζει — ακριβώς αυτό που το ADR-745
 * §8.1 ονομάζει ακύρωση ολόκληρου του μηχανισμού. Το κείμενο εδώ **δεν είναι διακόσμηση**:
 * είναι το μοναδικό σημείο όπου φαίνονται οι **δύο** αβεβαιότητες που κουβαλά κάθε πινακίδα.
 *
 * **Αβεβαιότητα 1 — η σειρά του ονόματος.** Το «ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ» έχει σήμα (το αρχικό
 * σημαδεύει το σύνορο)· το σκέτο «ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ» **δεν έχει** και η σειρά προκύπτει από
 * έθιμο. Ο Λ2 δεν θα το πιάσει ποτέ: το ταίριασμα ονόματος είναι **ανεξάρτητο σειράς**, άρα μια
 * ανεστραμμένη εγγραφή θα έδινε κανονικότατο `name-exact` — «βρέθηκε» πάνω σε λάθος καρτέλα.
 *
 * **Αβεβαιότητα 2 — τα στοιχεία του γραφείου.** Δες την κεφαλίδα του
 * {@link @/lib/title-block/contact-prefill}.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockPrefillNotice
 */

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { OfficeDetail, TitleBlockContactPrefill } from '@/lib/title-block/contact-prefill';

/**
 * Ένα κλειδί ανά είδος — **ποτέ** `` t(`…${kind}`) ``.
 *
 * Ο generator του shell slice (CHECK 3.34) αρνείται να παράγει σε ανεπίλυτη δυναμική `t()`, και
 * το αποτέλεσμα θα ήταν ωμό κλειδί στην οθόνη **με τη μετάφραση να υπάρχει** — δες
 * {@link ./proposal-labels}, όπου ζει το ίδιο σχόλιο επειδή κόστισε τρεις επαναλήψεις.
 */
const OFFICE_DETAIL_LABEL: Record<OfficeDetail['kind'], string> = {
  phone: 'titleBlockBinding.newContact.detail.phone',
  email: 'titleBlockBinding.newContact.detail.email',
  website: 'titleBlockBinding.newContact.detail.website',
};

interface Props {
  readonly prefill: TitleBlockContactPrefill;
}

export const TitleBlockPrefillNotice: React.FC<Props> = ({ prefill }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  // Μόνο το `convention` μαντεύει. Τα `contraction` και `patronymic-initial` στηρίζονται σε
  // σήμα του **ίδιου** του σχεδίου, και μια προειδοποίηση εκεί θα ήταν θόρυβος — που με τη
  // σειρά του εκπαιδεύει τον χρήστη να αγνοεί και την πραγματική.
  const nameIsGuessed = prefill.nameSignal === 'convention';

  return (
    <aside className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Info className="size-3.5 shrink-0" aria-hidden />
        {t('titleBlockBinding.newContact.noticeTitle')}
      </h3>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {t('titleBlockBinding.newContact.noticeBody')}
      </p>

      {nameIsGuessed ? (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-foreground">
          <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
          {t('titleBlockBinding.newContact.checkNameOrder')}
        </p>
      ) : null}

      {prefill.officeDetails.length > 0 ? (
        <section className="mt-2">
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground">
            <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
            {t('titleBlockBinding.newContact.officeDetails', {
              count: prefill.officeDetails.length,
            })}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {prefill.officeDetails.map((detail) => (
              <li
                key={`${detail.kind}:${detail.value}`}
                className="flex items-baseline gap-1 rounded bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                <span>{t(OFFICE_DETAIL_LABEL[detail.kind])}</span>
                <span className="break-all font-medium text-foreground">{detail.value}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
};
