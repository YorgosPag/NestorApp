/**
 * @fileoverview **ΠΟΙΟΣ ΕΙΣΑΙ** — η διεύθυνση *(αμετάβλητη)* της βιτρίνας.
 * @related ADR-841 §9.13 · §7 Α21.11 · §7 Α23.14 · components/mandate/AgencyShowcaseContent ·
 *   components/mandate/ShowcasePublicIdentitySection
 * @module components/mandate/ShowcaseIdentityFields
 *
 * ⚠️ **ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ `AgencyShowcaseContent.tsx`** *(Α21.11)*: εκείνο το αρχείο
 * έφτασε **ακριβώς** τις 500 γραμμές — το όριο της **N.7.1**.
 *
 * 🔴 **ΤΟ ΠΕΔΙΟ «ΕΠΩΝΥΜΙΑ» ΑΦΑΙΡΕΘΗΚΕ** *(Α23.14)*: από την Α23 (Δ5) το ελεύθερο όνομα **δεν έφευγε στο σύρμα** —
 * ο άνθρωπος πληκτρολογούσε κείμενο που αγνοούνταν σιωπηλά. Το δημόσιο όνομα είναι πλέον **επιλογή** (επωνυμία ή
 * διακριτικός τίτλος του ΓΕΜΗ) στην ενότητα «Τι θα δει ο κόσμος», με το **ακριβές** κείμενο από τον διακομιστή.
 */

'use client';

import React from 'react';

import { HintedField } from '@/components/ui/hinted-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SHOWCASE_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';

/**
 * **Η διεύθυνση της βιτρίνας.**
 *
 * ⚠️ Το ψευδώνυμο είναι `readOnly` **επίτηδες**: το κρίνει ο διακομιστής απέναντι
 * στο `companyId` **της απόδειξης** *(§9.13)*. Επεξεργάσιμο εδώ θα ήταν πεδίο που
 * ο άνθρωπος αλλάζει και **η πόρτα απορρίπτει** — ερώτηση χωρίς έγκυρη απάντηση.
 */
export function ShowcaseIdentityFields({ alias }: { readonly alias: string }): React.ReactElement {
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
    </section>
  );
}
