/**
 * @fileoverview **ΠΟΙΟΣ ΕΙΣΑΙ** — η διεύθυνση *(αμετάβλητη)* και η επωνυμία.
 * @related ADR-841 §9.13 · §7 Α21.11 · components/mandate/AgencyShowcaseContent ·
 *   components/mandate/ShowcasePublicDoor
 * @module components/mandate/ShowcaseIdentityFields
 *
 * ⚠️ **ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ `AgencyShowcaseContent.tsx`** *(Α21.11)*: εκείνο το αρχείο
 * έφτασε **ακριβώς** τις 500 γραμμές — το όριο της **N.7.1**. Η πόρτα προς τη δημόσια
 * όψη χρειαζόταν δύο γραμμές εκεί, και δεν υπήρχαν. ⇒ Το όριο **αποκάλυψε** την τομή
 * αντί να τη δημιουργήσει: αυτό εδώ απαντά *«ποιος είσαι;»*, εκείνο ορχηστρώνει.
 *
 * 🔑 **Καμία αλλαγή συμπεριφοράς** — μηχανική μετακίνηση. Η ίδια η μετακίνηση δεν
 * χρειάζεται νέα άγκυρα: το `agency-showcase-*.test` αποδίδει την **οθόνη**, οπότε αν
 * το πεδίο χανόταν, θα κοκκίνιζε ήδη.
 */

'use client';

import React from 'react';

import { HintedField } from '@/components/ui/hinted-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SHOWCASE_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';

/**
 * **Ποιος είσαι** — η διεύθυνση *(αμετάβλητη)* και η επωνυμία.
 *
 * ⚠️ Το ψευδώνυμο είναι `readOnly` **επίτηδες**: το κρίνει ο διακομιστής απέναντι
 * στο `companyId` **της απόδειξης** *(§9.13)*. Επεξεργάσιμο εδώ θα ήταν πεδίο που
 * ο άνθρωπος αλλάζει και **η πόρτα απορρίπτει** — ερώτηση χωρίς έγκυρη απάντηση.
 */
export function ShowcaseIdentityFields({
  alias,
  displayName,
  onName,
}: {
  readonly alias: string;
  readonly displayName: string;
  readonly onName: (value: string) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);

  return (
    <section className="flex flex-col gap-4">
      <HintedField
        id="showcase-alias"
        label={t(SHOWCASE_KEYS.aliasLabel)}
        hint={t(SHOWCASE_KEYS.aliasHint)}
        value={alias}
        readOnly
      />
      <HintedField
        id="showcase-name"
        label={t(SHOWCASE_KEYS.nameLabel)}
        hint={t(SHOWCASE_KEYS.nameHint)}
        placeholder={t(SHOWCASE_KEYS.namePlaceholder)}
        value={displayName}
        onChange={onName}
      />
    </section>
  );
}
