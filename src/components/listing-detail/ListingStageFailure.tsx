'use client';

/**
 * @fileoverview **Η ΟΝΟΜΑΣΜΕΝΗ ΑΠΟΤΥΧΙΑ ΜΙΑΣ ΣΚΗΝΗΣ** — ένα σώμα για το μοντέλο και το βίντεο της αγγελίας.
 * @related ADR-845 §7.6 (Φ4.3) · ADR-907 §10.6 · ADR-844 §1
 * @module components/listing-detail/ListingStageFailure
 *
 * ⛔ **Ποτέ σιωπηλό κενό**: υλικό που δεν φόρτωσε και **δεν το λέει** διαβάζεται ως *«αυτό το ακίνητο δεν έχει
 * μοντέλο/βίντεο»* — δηλαδή η οθόνη λέει ψέματα για τα δεδομένα. Είναι η ίδια κλάση με το ADR-844 §1, όπου *«κάτι
 * πήγε στραβά»* αντικαταστάθηκε από αιτία.
 *
 * 🔑 **Οι προτάσεις έρχονται ΕΤΟΙΜΕΣ**: κάθε σκηνή λέει τη δική της αιτία με δικό της κυριολεκτικό κλειδί. Ένα κοινό
 * `t(κλειδί)` εδώ θα ήταν δυναμική κλήση που ο τεμαχιστής i18n δεν επιλύει (CHECK 3.34).
 *
 * ⚠️ **Χωρίς παρενέργειες και χωρίς βαριά εισαγωγή** — το ζητά και η πλευρά **πριν** το `dynamic()` του μοντέλου (δες
 * `listing-model-stage-metrics`).
 */

import type { ReactElement } from 'react';

import { Card } from '@/components/ui/card';

/**
 * Η διάταξη του κουτιού μιας σκηνής που **λέει** κάτι αντί να δείχνει υλικό. Η επιφάνεια (όριο · φόντο · ακτίνα) είναι
 * του `Card` (`asChild`, ADR-777 §8.87.10)· το **σχήμα** (αναλογία) το προσθέτει κάθε σκηνή.
 */
export const LISTING_STAGE_NOTICE_BOX = 'flex w-full flex-col items-center justify-center gap-2 p-4 text-center';

export interface ListingStageFailureProps {
  /** Διάταξη + αναλογία της σκηνής που απέτυχε — ίδιο κουτί με την επιτυχία, ώστε να μη μετακινηθεί τίποτα. */
  readonly boxClassName: string;
  readonly message: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}

export function ListingStageFailure({ boxClassName, message, retryLabel, onRetry }: ListingStageFailureProps): ReactElement {
  return (
    <Card asChild className={boxClassName}>
      <section aria-live="polite">
        <p className="text-sm text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          {retryLabel}
        </button>
      </section>
    </Card>
  );
}
