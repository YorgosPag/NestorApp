'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΑΡΧΕΙΟΥ — και η επιλογή που την κάνει δημόσια** (ADR-841 §7 Α2.7).
 * @related ADR-841 §7 (Α2.1 · Α2.7) · lib/owner-property/owner-media-publication
 * @module components/owner-property/form/OwnerPropertyMediaItem
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΤΡΕΙΣ ΓΡΑΜΜΕΣ ΜΕΣΑ ΣΤΟ ΠΕΔΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η γραμμή απέκτησε **τρεις** αποφάσεις — *δημοσιεύεται;* · *είναι η πρώτη;* ·
 * *μπορεί ακόμη να επιλεγεί;* — δηλαδή έπαψε να είναι «όνομα και ένα κουμπί». Μέσα στο
 * `OwnerPropertyMediaField` θα ήταν λογική **επιλογής** μπλεγμένη με λογική
 * **ανεβάσματος**, και το αρχείο θα περνούσε το όριο των 40 γραμμών ανά συνάρτηση
 * *(N.7.1)* με το πιο επικίνδυνο μπέρδεμα: *«τι ανέβηκε»* ⇄ *«τι φεύγει στον κόσμο»*.
 *
 * ⚠️ **Οι κρίσεις ΔΕΝ γράφονται εδώ.** Το *«είναι η πρώτη;»* και το *«πόσες φεύγουν;»*
 * τα απαντά ο **ίδιος** SSoT που ρωτά και ο γραφέας του ραφιού
 * ({@link module:lib/owner-property/owner-media-publication}) — αλλιώς η οθόνη θα
 * μπορούσε να λέει *«δημοσιεύονται 30»* ενώ ο κόσμος βλέπει **24**, και ο άνθρωπος δεν
 * θα είχε **κανέναν** τρόπο να καταλάβει ποιες έξι λείπουν.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { OwnerPropertyMedia } from '@/types/owner-property';

const NS = 'property-market';
const K = `${NS}:offer.media`;

interface OwnerPropertyMediaItemProps {
  readonly item: OwnerPropertyMedia;
  /** Είναι **η πρώτη που θα δει ο κόσμος**; Κρίση του SSoT, ποτέ «είναι η γραμμή 0;». */
  readonly isLead: boolean;
  /**
   * Μπορεί **ακόμη** να επιλεγεί; `false` όταν το όριο γέμισε **και** αυτή είναι έξω.
   *
   * ⚠️ **Ποτέ δεν κλειδώνει το ΞΕ-διάλεγμα**: η αφαίρεση από τη δημοσίευση είναι
   * επιστροφή στην **ιδιωτικότητα**, και ένα όριο που εμποδίζει κάποιον να κρύψει το
   * αρχείο του θα ήταν το ακριβώς αντίθετο από αυτό που υπόσχεται η οθόνη.
   */
  readonly canPublish: boolean;
  readonly onTogglePublished: (storagePath: string, published: boolean) => void;
  readonly onMakeFirst: (storagePath: string) => void;
  readonly onRemove: (storagePath: string) => void;
}

export function OwnerPropertyMediaItem({
  item,
  isLead,
  canPublish,
  onTogglePublished,
  onMakeFirst,
  onRemove,
}: OwnerPropertyMediaItemProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const published = item.published === true;
  const checkboxId = React.useId();

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 text-sm text-foreground last:border-b-0">
      <span className="min-w-0 flex-1 truncate">{item.fileName}</span>

      <span className="flex items-center gap-1.5">
        <input
          id={checkboxId}
          type="checkbox"
          checked={published}
          disabled={!published && !canPublish}
          onChange={(event) => onTogglePublished(item.storagePath, event.target.checked)}
          className="h-4 w-4 rounded border-border"
        />
        <label htmlFor={checkboxId} className="text-xs text-muted-foreground">
          {t(`${K}.publish`)}
        </label>
      </span>

      {/*
        🔑 **Η «πρώτη» είναι ΠΡΑΞΗ, όχι παραγόμενη από χρόνο** (ADR-841 §7 Α2.1). Και οι
        τρεις μεγάλες πλατφόρμες αφήνουν τον άνθρωπο να τακτοποιήσει· καμία δεν βγάζει
        τη σειρά από τον χρόνο ανεβάσματος — η **Α6.2** απέρριψε ήδη ρητά αυτό το ιδίωμα.

        ⚠️ Το κουμπί εμφανίζεται **μόνο** για δημοσιευμένο αρχείο που **δεν** είναι ήδη
        πρώτο: «κάνε πρώτο κάτι που δεν φεύγει» δεν σημαίνει τίποτα για τον χρήστη.
      */}
      {published && !isLead && (
        <button
          type="button"
          onClick={() => onMakeFirst(item.storagePath)}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground"
        >
          {t(`${K}.makeFirst`)}
        </button>
      )}

      {isLead && (
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
          {t(`${K}.firstBadge`)}
        </span>
      )}

      <button
        type="button"
        onClick={() => onRemove(item.storagePath)}
        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground"
      >
        {t(`${K}.remove`)}
      </button>
    </li>
  );
}
