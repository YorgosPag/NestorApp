'use client';

/**
 * **ΤΙ ΛΕΙΠΕΙ — ΟΛΑ ΜΑΖΙ** (Α14 §17.2).
 *
 * @related ADR-777 §7 (Α9 · Α14) · lib/demand/demand-form-validation.ts
 * @module components/demand/form/DemandFormIssues
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΟΜΑΔΕΣ, ΓΙΑΤΙ ΕΧΟΥΝ ΤΡΕΙΣ ΔΙΑΦΟΡΕΤΙΚΕΣ ΘΕΡΑΠΕΙΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ομάδα | Τι λέει στον άνθρωπο |
 * |---|---|
 * | `blockers` | *«λείπει βήμα»* — π.χ. πάτησε «Εντοπισμός». **Δεν είναι άκυρη ζήτηση· δεν είναι ζήτηση ακόμη.** |
 * | `violations` | *«αντιφάσκεις»* — το «έως» πριν το «από». Η ζήτηση **υπάρχει** και είναι λάθος. |
 * | `malformed` | *«αυτό δεν είναι αριθμός»* — σπάνιο, αλλά δεν σιωπά |
 *
 * Ένα κοινό «η φόρμα δεν είναι έγκυρη» θα τον έστελνε να **ψάξει** — που είναι
 * ακριβώς το φράγμα που η Α14 δεσμεύτηκε να μη στήσει.
 *
 * ⚠️ **`aria-live="polite"`**: η λίστα αλλάζει καθώς πληκτρολογεί ο άνθρωπος, χωρίς
 * κανένα γεγονός εστίασης. Χωρίς την ανακοίνωση, ο χρήστης αναγνώστη οθόνης θα
 * μάθαινε ότι κάτι λείπει **μόνο** πατώντας ένα κουμπί που δεν αντιδρά.
 *
 * ⚠️ **Το `range-inverted` δεν ονομάζει ΠΟΙΟ εύρος — δηλωμένο όριο.** Το κλειστό
 * σύνολο `DEMAND_INVARIANTS` έχει **έναν** κωδικό για τα τρία εύρη (ποσό · εμβαδόν ·
 * όροφος), και το μήνυμά του είναι αντίστοιχα γενικό. Δεν «διορθώνεται» εδώ με δεύτερο
 * έλεγχο ποιο εύρος φταίει: θα ήταν **δεύτερος κριτής** για ερώτηση που ήδη απαντά η
 * οντότητα — το σχήμα ADR-749. Η σωστή θεραπεία, όταν χρειαστεί, είναι **τρεις
 * κωδικοί στο μοντέλο**.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DemandFormValidation } from '@/lib/demand/demand-form-validation';

const NS = 'search-results';

export function DemandFormIssues({
  validation,
}: {
  validation: DemandFormValidation;
}): React.ReactElement | null {
  const { t } = useTranslation([NS]);

  if (validation.kind === 'ready') return null;

  const messages: readonly string[] = [
    ...validation.blockers.map((blocker) => t(`${NS}:demand.formBlocker.${blocker}`)),
    ...validation.violations.map((violation) => t(`${NS}:demand.invariant.${violation}`)),
    // Τα `malformed` είναι **ονόματα πεδίων**, όχι μηνύματα: εμφανίζονται μόνο όταν
    // το σχήμα δεν διαβάζεται καθόλου, κατάσταση που η ίδια η φόρμα κάνει σχεδόν
    // αδύνατη (τα αριθμητικά πεδία είναι `type="number"` και ελεγχόμενα).
    ...validation.malformed.map((field) => field),
  ];

  if (messages.length === 0) return null;

  return (
    <section
      aria-live="polite"
      className="rounded-md border border-border bg-card p-4"
    >
      <h2 className="text-sm font-semibold text-foreground">
        {t(`${NS}:demand.invariant.heading`)}
      </h2>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}
