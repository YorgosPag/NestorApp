'use client';

/**
 * @fileoverview **Διπλασιασμός οικογένειας** — νέα οικογένεια από το σχήμα μιας υπάρχουσας (ADR-923 Φάση 1γ).
 * @module components/catalog/families/FamilyDuplicateDialog
 *
 * 🔑 Αντίγραφο του **αποθηκευμένου** σχήματος (ιδιότητες · παραλλαγές · πίνακας · κανόνες) με νέο κωδικό και ετικέτα,
 *    σε **μία** εγγραφή — ο γραφέας το επικυρώνει ολόκληρο όπως κάθε οικογένεια. «Fan coil επίτοιχο» από «Fan coil»
 *    χωρίς να ξαναστηθεί τίποτα (Akeneo «duplicate family» · Figma «duplicate frame»).
 * 🔑 Ο κωδικός είναι νέα ταυτότητα: προτείνεται από την ετικέτα, ελέγχεται για σύγκρουση **πριν** σταλεί.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import { hasAnyLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import { IssueCollector } from '@/subapps/catalog/schema/catalog-issues';
import { isCatalogCode } from '@/subapps/catalog/vocabulary/catalog-limits';
import { newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogCodeField } from '../shared/CatalogFormFields';
import { LocalizedTextField } from '../shared/LocalizedTextField';
import { familyDraftOf, storedFamilyOf } from './family-draft';

interface FamilyDuplicateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly source: FamilyRecord;
  readonly families: readonly FamilyRecord[];
  readonly ops: CatalogOptimistic<FamilyRecord>;
  readonly onCreated: (id: string) => void;
}

function duplicateIssues(code: string, labels: LocalizedText, families: readonly FamilyRecord[]) {
  const collector = new IssueCollector();
  if (!isCatalogCode(code)) collector.add('invalidCode', 'code');
  if (families.some((family) => family.code === code)) collector.add('duplicateCode', 'code', { code });
  if (!hasAnyLocalizedText(labels)) collector.add('labelRequired', 'labels');
  return collector.issues;
}

export function FamilyDuplicateDialog({ open, onOpenChange, source, families, ops, onCreated }: FamilyDuplicateDialogProps) {
  const { t, text } = useCatalogText();
  const [labels, setLabels] = useState<LocalizedText>({});
  const [code, setCode] = useState('');
  const issues = duplicateIssues(code, labels, families);
  const touched = code.length > 0 || hasAnyLocalizedText(labels);
  const create = () => {
    const definition = { ...familyDraftOf(source), code, labels };
    saveDefinition(ops, {
      kind: 'family',
      existing: null,
      definition,
      optimistic: optimisticWire(storedFamilyOf(definition), null, newEntityKey(code)),
      onSettled: (outcome) => { if (outcome.ok) onCreated(outcome.record.id); },
    });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('families.duplicate.title', { name: text(source.labels, source.code) })}</DialogTitle>
          <DialogDescription>{t('families.duplicate.lead')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (issues.length === 0) create(); }}>
          <LocalizedTextField label={t('common.labels')} value={labels} issues={touched ? issues : []} path="labels" onChange={setLabels} />
          <CatalogCodeField value={code} locked={false} suggestFrom={labels[DEFAULT_LANGUAGE] ?? ''} issues={touched ? issues : []} onChange={setCode} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={issues.length > 0}>{t('families.duplicate.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
