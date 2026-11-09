'use client';

/**
 * @fileoverview **Τι προτείνει η μνήμη του προμηθευτή για μια γραμμή χωρίς πεδίο** (ADR-923 §5.5.2 Β5.2), σε παρτίδα που ήδη
 *   διαβάστηκε: η μνήμη **δεν** αποφασίζει μόνη της εδώ (Απόφαση 4) — προτείνει, και ο άνθρωπος αποδέχεται με ένα κλικ.
 * @module components/catalog/imports/MemoryHintNote
 *
 * 🔑 **Σύγκρουση ⇒ ερώτηση με τους μετρητές**, ποτέ «κερδίζει ο συχνότερος» (εκεί διαφέρουμε από το Akeneo): δύο αποφάσεις στο
 *    ιστορικό σημαίνει ότι κάποτε ο άνθρωπος διόρθωσε τη μνήμη. Η επιλογή γίνεται **ανθρώπινη** απόφαση και μαθαίνεται στην έγκριση.
 * 🔑 Απόφαση που δεν εφαρμόζεται εδώ (ιδιότητα εκτός οικογένειας, τιμή χωρίς τιμοκατάλογο) φαίνεται με τον λόγο, χωρίς κουμπί.
 */

import React from 'react';
import { BrainCircuit, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ImportLineDecision } from '@/subapps/catalog/types/catalog-import';
import type { ImportMemoryHint } from '@/subapps/catalog/types/catalog-import-requests';
import { useImportText } from './import-text';
import { useLineDecisionText } from './line-decision-text';

interface MemoryHintNoteProps {
  readonly hint: ImportMemoryHint;
  readonly disabled: boolean;
  readonly onAccept: (decision: ImportLineDecision) => void;
}

export function MemoryHintNote({ hint, disabled, onAccept }: MemoryHintNoteProps) {
  const { t } = useImportText();
  const decisionText = useLineDecisionText();
  const conflict = hint.verdict === 'conflict';
  return (
    <section className="flex flex-col gap-1 rounded-md bg-muted p-2 text-xs" aria-label={t('review.memory.suggests')}>
      <span className="flex items-center gap-1 font-medium">
        <BrainCircuit className="h-3 w-3" aria-hidden />
        {conflict ? t('review.memory.conflict') : t('review.memory.suggests')}
      </span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {hint.options.map((option) => (
          <li key={JSON.stringify(option.decision)} className="flex flex-wrap items-center justify-between gap-2">
            <span>{t('review.memory.option', { decision: decisionText.of(option.decision), count: option.count })}</span>
            {option.usable && decisionText.known(option.decision) ? (
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onAccept(option.decision)}>
                <Check className="mr-1 h-3 w-3" aria-hidden />{t('review.memory.accept')}
              </Button>
            ) : <span className="text-muted-foreground">{t('review.memory.unusable')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
