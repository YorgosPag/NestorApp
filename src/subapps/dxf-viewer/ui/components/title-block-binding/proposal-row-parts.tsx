'use client';

/**
 * @fileoverview Τα μέρη μιας γραμμής πρότασης (ADR-745 Φ3β, Δ2).
 *
 * Χωρισμένα από το {@link ./TitleBlockProposalRow} γιατί η γραμμή απέκτησε **τρεις** ανεξάρτητες
 * ζώνες — μαρτυρία, επιλογή, ποσοστό — και καθεμία έχει δικούς της κανόνες ορατότητας.
 * **Εξαγωγή, ποτέ trim** (N.7.1).
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/proposal-row-parts
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import type { BindingEvidence } from '@/types/title-block-binding';
import { EVIDENCE_LABEL, EVIDENCE_SHOWS_VALUE } from './proposal-labels';

interface EvidenceProps {
  readonly evidence: readonly BindingEvidence[];
  /**
   * Αποδίδεται ήδη το όνομα της επαφής ακριβώς από πάνω (γραμμή «→ …»);
   *
   * Καθορίζει **μόνο** τις μαρτυρίες ονόματος: το `value` τους είναι το ίδιο το `displayName`.
   * Δες το σκεπτικό στο {@link EVIDENCE_SHOWS_VALUE}.
   */
  readonly nameValueRedundant: boolean;
}

/**
 * **Το «γιατί»**, όχι ποσοστό βεβαιότητας: «ταιριάζει το τηλέφωνο», «το όνομα ταιριάζει σε
 * συντομογραφία». Εκεί ξεπερνάμε τα εμπορικά CAD — κανένα δεν εξηγεί την πρόταση που κάνει.
 *
 * 🔴 **Και ΠΟΙΟ ταίριαξε.** Το `value` υπήρχε στον τύπο και χρησιμοποιούνταν **μόνο** ως React
 * `key` — ποτέ δεν εμφανιζόταν. Με δύο τηλέφωνα γραφείου η οθόνη έγραφε δύο φορές «ταιριάζει το
 * τηλέφωνο»: σωστό, αλλά **μη διακρίσιμο**. Μια μαρτυρία που δεν λέει σε τι στηρίζεται είναι
 * ισχυρισμός, όχι απόδειξη.
 */
export const ProposalEvidence: React.FC<EvidenceProps> = ({ evidence, nameValueRedundant }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  if (evidence.length === 0) return null;

  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {evidence.map((item) => (
        <li
          key={`${item.kind}:${item.value}`}
          className="flex items-baseline gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          <span>{t(EVIDENCE_LABEL[item.kind])}</span>
          {EVIDENCE_SHOWS_VALUE[item.kind] || !nameValueRedundant ? (
            <span className="break-all font-medium text-foreground">{item.value}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

interface PercentProps {
  readonly fieldId: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
}

/**
 * Το ποσοστό ιδιοκτησίας — **η πινακίδα δεν το δηλώνει ποτέ** (Γ6).
 *
 * 🔑 Το `statusNote` δεν είναι διακοσμητικό: ο οικοπεδούχος καταχωρείται ως `prospective`, και ο
 * χρήστης πρέπει να ξέρει ότι μια πινακίδα **δεν αποδεικνύει υπογραφή**. Χωρίς αυτό, η καρτέλα
 * του έργου δείχνει «ιδιοκτήτη» με αυθεντία που κανείς δεν του έδωσε.
 */
export const LandownerPercentField: React.FC<PercentProps> = ({ fieldId, value, onChange }) => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <section className="mt-2">
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-muted-foreground" htmlFor={fieldId}>
          {t('titleBlockBinding.landowner.percentLabel')}
        </label>
        <Input
          id={fieldId}
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-20 text-sm"
        />
        <span className="text-[11px] text-muted-foreground">%</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {t('titleBlockBinding.landowner.percentHint')}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {t('titleBlockBinding.landowner.statusNote')}
      </p>
    </section>
  );
};
