'use client';

/**
 * @fileoverview **Η απόφαση ενός πεδίου** (ADR-923 §5.5.2 Α2–Α4): κατάσταση που διαβάζεται χωρίς χρώμα, και ποιος την πήρε.
 * @module components/catalog/imports/ProposalDecisionCell
 *
 * 🔑 **`SegmentedControl`, όχι ζευγάρι `Button`.** Το `variant="default"` λύνεται στο σκοτεινό θέμα σχεδόν στο `--card`
 *    (μετρημένο `rgb(29,40,58)` πάνω σε `rgb(22,26,34)`): η επιλογή δεν φαινόταν. Ο ρόλος `selectionControl.pressedOn` του
 *    design system το έχει ήδη λύσει, μαζί με σημασιολογία radio και βελάκια (ADR-770 §19).
 * 🔑 **Σχήμα + λέξη, όχι μόνο χρώμα** (WCAG 1.4.1 · CHECK 3.41): ✓ / ✗ / ? με το κείμενό τους.
 * 🔑 **«Εκκρεμεί» δεν είναι επιλογή.** Είναι η απουσία απόφασης: καμία τιμή της ομάδας δεν είναι πατημένη, και το λέει η λέξη.
 * 🔑 **Αναίρεση = επιστροφή στον κανόνα** (§5.5.2 Β9α). Το ξανα-πάτημα της πατημένης τιμής **δεν** αναιρεί: η ομάδα έχει
 *    σημασιολογία radio (WAI-ARIA), και με τα βελάκια θα έσβηνε αποφάσεις κατά λάθος. Ρητό «↺ Αναίρεση» δίπλα στο «δική σας
 *    απόφαση» — ίδιο εικονίδιο και λέξη με την αναίρεση γραμμής (`ProposalDecidedLines`) — στέλνει `null`.
 * 🔑 **Αμετάβλητο ⇒ κανένα κουμπί.** Αποθηκεύεται ως `reject` («τίποτα να εφαρμοστεί»)· ως πατημένη «Απόρριψη» διαβαζόταν
 *    «απορρίφθηκε».
 */

import React from 'react';
import { Check, CircleHelp, Equal, Pencil, Plus, TriangleAlert, Undo2, X, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { decisionSourceOf } from '@/subapps/catalog/import/field-diff';
import type { ImportProposalField } from '@/subapps/catalog/types/catalog-import';
import type { HumanFieldDecision, ImportFieldDecision, ImportFieldStatus } from '@/subapps/catalog/vocabulary/catalog-import';
import { FIELD_STATUS_KEYS, useImportText } from './import-text';

/** Η κατάσταση της διαφοράς: σημασιολογική παραλλαγή **και** εικονίδιο (το `default` ήταν ίδιο με την κάρτα στο σκοτεινό). */
const STATUS_LOOK: Readonly<Record<ImportFieldStatus, { readonly variant: 'info' | 'warning' | 'muted' | 'destructive'; readonly icon: LucideIcon }>> = {
  new: { variant: 'info', icon: Plus },
  changed: { variant: 'warning', icon: Pencil },
  unchanged: { variant: 'muted', icon: Equal },
  conflict: { variant: 'destructive', icon: TriangleAlert },
};

export function FieldStatusBadge({ status }: { readonly status: ImportFieldStatus }) {
  const { t } = useImportText();
  const { variant, icon: Icon } = STATUS_LOOK[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" aria-hidden />
      {t(FIELD_STATUS_KEYS[status])}
    </Badge>
  );
}

interface ProposalDecisionCellProps {
  readonly field: ImportProposalField;
  readonly label: string;
  readonly readOnly: boolean;
  readonly onDecide: (decision: HumanFieldDecision) => void;
}

interface DecisionNoteProps {
  readonly field: ImportProposalField;
  readonly label: string;
  readonly readOnly: boolean;
  readonly onUndo: () => void;
}

function DecisionNote({ field, label, readOnly, onUndo }: DecisionNoteProps) {
  const { t } = useImportText();
  if (field.decision === 'pending') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium">
        <CircleHelp className="h-3 w-3" aria-hidden />
        {t('review.decisionPending')}
      </span>
    );
  }
  if (decisionSourceOf(field) === 'rule') return <span className="text-xs text-muted-foreground">{t('review.decisionAuto')}</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {t('review.decisionHuman')}
      <Button type="button" size="sm" variant="ghost" className="h-6 px-1 text-xs" disabled={readOnly} onClick={onUndo}
        aria-label={t('review.decisionUndoFor', { field: label })}>
        <Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.decisionUndo')}
      </Button>
    </span>
  );
}

export function ProposalDecisionCell({ field, label, readOnly, onDecide }: ProposalDecisionCellProps) {
  const { t } = useImportText();
  if (field.status === 'unchanged') {
    return <td className="p-2 text-xs text-muted-foreground">{t('review.nothingToApply')}</td>;
  }
  return (
    <td className="p-2">
      <span className="flex flex-col items-start gap-1">
        <SegmentedControl<ImportFieldDecision>
          value={field.decision}
          onValueChange={(next) => { if (next !== 'pending' && next !== field.decision) onDecide(next); }}
          disabled={readOnly}
          aria-label={t('review.decisionFor', { field: label })}
        >
          <SegmentedControlItem value="accept" disabled={readOnly || field.incoming === null}>
            <Check className="mr-1 h-3 w-3" aria-hidden />{t('review.accept')}
          </SegmentedControlItem>
          <SegmentedControlItem value="reject" disabled={readOnly}>
            <X className="mr-1 h-3 w-3" aria-hidden />{t('review.reject')}
          </SegmentedControlItem>
        </SegmentedControl>
        <DecisionNote field={field} label={label} readOnly={readOnly} onUndo={() => onDecide(null)} />
      </span>
    </td>
  );
}
