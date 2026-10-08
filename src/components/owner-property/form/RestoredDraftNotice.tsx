'use client';

/**
 * **«Επαναφέραμε το προσχέδιό σου»** — η επαναφορά λέγεται, δεν συμβαίνει σιωπηλά.
 *
 * @related ADR-660 §5.10 · lib/owner-property/owner-property-draft-memory.ts
 * @module components/owner-property/form/RestoredDraftNotice
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΡΗΤΗ ΚΑΙ ΟΧΙ ΣΙΩΠΗΛΗ — ΔΥΟ ΛΟΓΟΙ, ΚΑΙ ΟΙ ΔΥΟ ΠΡΑΓΜΑΤΙΚΟΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Το προσχέδιο ΔΕΝ είναι ανά χρήστη** — δεν μπορεί να είναι, γράφεται πριν
 *    υπάρξει `uid` (δηλωμένο όριο #2 του leaf module). Σε **κοινό μηχάνημα** ο
 *    επόμενος άνθρωπος θα έβρισκε τα στοιχεία ενός ξένου ακινήτου μέσα στη φόρμα του,
 *    να μοιάζουν με **δικά του**. Σιωπηλή επαναφορά εκεί δεν είναι ευκολία, είναι
 *    παραπλάνηση.
 * 2. **Η αναίρεση πρέπει να είναι φθηνή.** Ο άνθρωπος που ήρθε να καταχωρήσει
 *    **άλλο** ακίνητο πρέπει να μπορεί να καθαρίσει με **ένα** πάτημα — αλλιώς θα
 *    σβήνει πεδίο-πεδίο ό,τι δεν έγραψε ποτέ.
 *
 * ⚠️ **Δύο κουμπιά, όχι ένα «×».** Ένα σκέτο κλείσιμο αφήνει αναπάντητο το *«και το
 * περιεχόμενο;»*: έμεινε; έφυγε; Οι δύο πράξεις είναι **διαφορετικές** — «κράτα το»
 * κρύβει μόνο την ειδοποίηση, «ξεκίνα από την αρχή» **σβήνει** — και δύο πράξεις με
 * διαφορετικό αποτέλεσμα δεν επιτρέπεται να μοιράζονται ένα χειριστήριο.
 *
 * 🔑 **Δεν είναι toast.** Ένα toast φεύγει μόνο του· αυτή η πληροφορία πρέπει να είναι
 * διαθέσιμη όσο ο άνθρωπος κοιτάζει τα πεδία και αναρωτιέται από πού ήρθαν.
 */

import React from 'react';

import { SectionFrame } from '@/components/ui/section-frame';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const NS = 'property-market';
const K = `${NS}:offer.draftMemory`;

export function RestoredDraftNotice({
  onKeep,
  onDiscard,
}: {
  readonly onKeep: () => void;
  readonly onDiscard: () => void;
}): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    <SectionFrame title={t(`${K}.title`)} headingLevel="h2" titleSize="sm" gap={2} aria-live="polite">
      <p className="text-sm text-muted-foreground">{t(`${K}.help`)}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground"
        >
          {t(`${K}.keep`)}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground"
        >
          {t(`${K}.discard`)}
        </button>
      </div>
    </SectionFrame>
  );
}
