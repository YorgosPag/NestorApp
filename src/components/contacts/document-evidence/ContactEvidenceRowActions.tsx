'use client';

/**
 * @fileoverview Η στήλη «Ενέργεια» μιας γραμμής «Το έγγραφο λέει / Η επαφή λέει» (ADR-950 §4.4 · §4.5).
 * @module components/contacts/document-evidence/ContactEvidenceRowActions
 *
 * Κάθε κουμπί εμφανίζεται **μόνο** όταν η πράξη του είναι δυνατή· όταν δεν είναι, λέμε **γιατί** (προβολή αντί για
 * επεξεργασία · πεδίο που διορθώνεται από τη φόρμα). Προβολή + κενό πεδίο ⇒ **«Καταχώριση»** με ένα πάτημα (ADR-950 §9).
 * Η «Αγνόηση» ζητά **αιτία** (GitHub code scanning). Η **«Διόρθωση»** (ADR-950 §10) υπάρχει σε **κάθε** γραμμή: ό,τι
 * διάβασε η μηχανή διορθώνεται επιτόπου — καμία γραμμή-αδιέξοδο.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EVIDENCE_DISMISS_REASONS } from '@/config/contact-document-evidence';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { canAcceptEvidence, canProposeEvidenceSeat, canRegisterEvidence } from '@/lib/contacts/contact-evidence-acceptance';
import { isEvidenceActionable, type EvidenceRow } from '@/lib/contacts/contact-evidence-comparison';

import {
  CONTACT_EVIDENCE_CORRECTION_KEYS as CORRECTION,
  CONTACT_EVIDENCE_KEYS as KEYS,
  CONTACT_EVIDENCE_REASON_KEYS,
} from './contact-evidence-labels';
import type { ContactEvidenceActions } from './use-contact-evidence-actions';

interface ContactEvidenceRowActionsProps {
  readonly row: EvidenceRow;
  readonly canEdit: boolean;
  readonly actions: ContactEvidenceActions;
  /** ADR-950 §10 — ανοίγει τη «Διόρθωση ανάγνωσης» αυτής της γραμμής· `undefined` ⇒ δεν προσφέρεται (αποσυρμένη επαφή). */
  readonly onCorrect?: () => void;
}

/** Γιατί **δεν** υπάρχει κουμπί αποδοχής/καταχώρισης — ή `null` όταν υπάρχει (ή δεν χρειάζεται). */
function acceptBlockedKey(row: EvidenceRow, canEdit: boolean, canRegister: boolean): string | null {
  if (!isEvidenceActionable(row) || row.documentDisplay === null) return null;
  if (row.acceptance === 'compare-only') return KEYS.compareOnly;
  return canEdit || canRegister ? null : KEYS.editToAccept;
}

function DismissMenu({ row, actions }: { readonly row: EvidenceRow; readonly actions: ContactEvidenceActions }) {
  const { t } = useTranslation('contacts-form');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm">{t(KEYS.dismiss)}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t(KEYS.dismissReason)}</DropdownMenuLabel>
        {EVIDENCE_DISMISS_REASONS.map((reason) => (
          <DropdownMenuItem key={reason} onSelect={() => actions.dismiss(row, reason)}>
            {t(CONTACT_EVIDENCE_REASON_KEYS[reason])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ContactEvidenceRowActions({ row, canEdit, actions, onCorrect }: ContactEvidenceRowActionsProps) {
  const { t } = useTranslation('contacts-form');
  // Προβολή: «Καταχώριση» **μόνο** για κενό πεδίο με ελεγμένη τιμή (ADR-950 §9)· ό,τι αντικαθιστά τιμή θέλει επεξεργασία.
  const canRegister = actions.canRegister && canRegisterEvidence(row);
  const blocked = acceptBlockedKey(row, canEdit, canRegister);
  const canAccept = canEdit && canAcceptEvidence(row);
  const canPropose = canEdit && canProposeEvidenceSeat(row);
  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {canRegister && (
        <Button type="button" variant="outline" size="sm" disabled={actions.isRegistering} aria-busy={actions.isRegistering}
          onClick={() => actions.register(row)}>
          {t(KEYS.register)}
        </Button>
      )}
      {canAccept && (
        <Button type="button" variant="outline" size="sm" onClick={() => actions.accept(row)}>
          {t(row.acceptance === 'append-phone' ? KEYS.add : KEYS.accept)}
        </Button>
      )}
      {canPropose && (
        <Button type="button" variant="outline" size="sm" onClick={() => actions.proposeAddress(row)}>
          {t(KEYS.proposeAddress)}
        </Button>
      )}
      {blocked !== null && <span className="text-xs text-muted-foreground">{t(blocked)}</span>}
      {onCorrect !== undefined && (
        <Button type="button" variant="ghost" size="sm" onClick={onCorrect}>{t(CORRECTION.action)}</Button>
      )}
      {isEvidenceActionable(row) && row.documentKey !== null && <DismissMenu row={row} actions={actions} />}
      {row.decision === 'dismissed' && (
        <Button type="button" variant="ghost" size="sm" onClick={() => actions.restore(row)}>
          {t(KEYS.restore)}
        </Button>
      )}
    </span>
  );
}
