'use client';

/**
 * @fileoverview **ΤΙ ΛΕΙΠΕΙ — ΟΛΑ ΜΑΖΙ** (Α14 §17.2), για κάθε φόρμα του ADR-777.
 * @related ADR-777 §7 (Α9 · Α14) · lib/forms/draft-validation.ts · CLAUDE.md N.18
 * @module components/shared/forms/FormIssues
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΟΜΑΔΕΣ, ΓΙΑΤΙ ΕΧΟΥΝ ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΘΕΡΑΠΕΙΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ομάδα | Τι λέει στον άνθρωπο |
 * |---|---|
 * | `blockers` | *«λείπει βήμα»* — π.χ. πάτησε «Εντοπισμός». **Δεν είναι άκυρο· δεν είναι ακόμη.** |
 * | `violations` | *«αντιφάσκεις»* — το «έως» πριν το «από», πώληση χωρίς τιμή. **Υπάρχει και είναι λάθος.** |
 * | `malformed` | *«αυτό δεν είναι αριθμός»* — σπάνιο, αλλά δεν σιωπά |
 *
 * Ένα κοινό «η φόρμα δεν είναι έγκυρη» θα τον έστελνε να **ψάξει** — που είναι
 * ακριβώς το φράγμα που η **Α14** δεσμεύτηκε να μη στήσει.
 *
 * ⚠️ **`aria-live="polite"`**: η λίστα αλλάζει καθώς πληκτρολογεί ο άνθρωπος, χωρίς
 * κανένα γεγονός εστίασης. Χωρίς την ανακοίνωση, ο χρήστης αναγνώστη οθόνης θα
 * μάθαινε ότι κάτι λείπει **μόνο** πατώντας ένα κουμπί που δεν αντιδρά.
 *
 * 🔴 **Εξήχθη (ADR-777 Α14, 2026-08-11)**: η φόρμα προσφοράς εμφανίζει τις **ίδιες
 * τρεις** ομάδες με άλλα κλειδιά. Δεύτερη γραφή θα ήταν κλώνος που μπλοκάρει το
 * **CHECK 3.28**, και —χειρότερα— θα απέκλινε στην προσβασιμότητα: η μία λίστα θα
 * ανακοίνωνε και η άλλη όχι, και **και οι δύο θα «δούλευαν»**.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DraftFormValidation } from '@/lib/forms/draft-validation';

const NS = 'search-results';

/**
 * **Οι κωδικοί γίνονται κλειδιά i18n** (N.11) — δεν υπάρχει ωμό κείμενο πουθενά.
 *
 * @param keyBase — η ρίζα του λεξιλογίου, π.χ. `demand` ή `offer`. Από αυτήν
 *                  παράγονται τα `<base>.formBlocker.*` · `<base>.invariant.*` και η
 *                  επικεφαλίδα — **ένα** όρισμα, ώστε να μην μπορούν να αποκλίνουν.
 */
export function FormIssues<TDraft, TBlocker extends string, TViolation extends string>({
  validation,
  keyBase,
}: {
  validation: DraftFormValidation<TDraft, TBlocker, TViolation>;
  keyBase: string;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);

  if (validation.kind === 'ready') return null;

  const messages: readonly string[] = [
    ...validation.blockers.map((blocker) => t(`${NS}:${keyBase}.formBlocker.${blocker}`)),
    ...validation.violations.map((violation) => t(`${NS}:${keyBase}.invariant.${violation}`)),
    // Τα `malformed` είναι **ονόματα πεδίων**, όχι μηνύματα: εμφανίζονται μόνο όταν
    // το σχήμα δεν διαβάζεται καθόλου, κατάσταση που η ίδια η φόρμα κάνει σχεδόν
    // αδύνατη (τα αριθμητικά πεδία είναι `type="number"` και ελεγχόμενα).
    ...validation.malformed.map((field) => field),
  ];

  if (messages.length === 0) return null;

  return (
    <section aria-live="polite" className="rounded-md border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">
        {t(`${NS}:${keyBase}.invariant.heading`)}
      </h2>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}
