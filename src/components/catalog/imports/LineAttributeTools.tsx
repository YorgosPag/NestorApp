'use client';

/**
 * @fileoverview **Τα εργαλεία μιας γραμμής χωρίς πεδίο** (ADR-923 §5.5.2 Β3 Γ7–Γ8): αντιστοίχιση σε ιδιότητα της οικογένειας, ή νέα
 *   ιδιότητα από τη γραμμή. Μπαίνει στην οθόνη **μόνο** όταν ανοίξει ενέργεια· τότε φορτώνει βιβλιοθήκη και οικογένειες.
 * @module components/catalog/imports/LineAttributeTools
 *
 * 🔑 Ο επιλογέας δείχνει **πρώτα** όσες ιδιότητες μετρούν το μέγεθος που τυπώνει η γραμμή (ίδια οικογένεια μέτρησης) και
 *    προειδοποιεί όταν η ιδιότητα έχει ήδη τιμές από άλλη γραμμή του πίνακα.
 * 🔑 Νέα ιδιότητα: ίδια φόρμα με την καρτέλα της οικογένειας, προσυμπληρωμένη· το **επίπεδο** το βλέπει και το αλλάζει ο άνθρωπος,
 *    και το δέσιμο στην οικογένεια το κάνει ο διακομιστής μέσω της μηχανής σχήματος.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { suggestAttributeFromLine, type LineAttributeSuggestion } from '@/subapps/catalog/import/suggest-attribute-from-line';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_LINE_BIND_LEVELS, type ImportLineBindLevel } from '@/subapps/catalog/vocabulary/catalog-import';
import { AttributePicker } from '../families/AttributePicker';
import { familyAttributes } from '../families/family-draft';
import { NewAttributeDialog } from '../families/NewAttributeDialog';
import { useCatalogCanManage, useCatalogFailureNotice } from '../shared/catalog-ui-hooks';
import { LINE_LEVEL_HINT_KEYS, LINE_LEVEL_KEYS, useImportText } from './import-text';
import { lineAttributeDraft } from './line-attribute-draft';
import type { LineAttributeToolsProps } from './line-tool-props';

const measurementFamilyOf = (attribute: AttributeRecord): string | null => (attribute.type === 'measurement' ? attribute.config.measurementFamilyCode : null);

/** Πρώτα όσες μετρούν το ίδιο μέγεθος· μετά οι υπόλοιπες, στη σειρά της οικογένειας. */
function rankedOptions(attributes: readonly AttributeRecord[], suggestion: LineAttributeSuggestion): AttributeRecord[] {
  const family = suggestion.measurement?.familyCode ?? null;
  const fits = (attribute: AttributeRecord) => family !== null && measurementFamilyOf(attribute) === family;
  return [...attributes.filter(fits), ...attributes.filter((attribute) => !fits(attribute))];
}

/** Ιδιότητες που η πρόταση ήδη γεμίζει από άλλη γραμμή του πίνακα. */
const usedAttributeIds = (proposal: ImportProposalWire): ReadonlySet<string> =>
  new Set(proposal.rows.flatMap((row) => row.fields.flatMap((field) => (field.target.kind === 'attribute' ? [field.target.attributeId] : []))));

interface MapProps {
  readonly line: ImportPageUnmappedLine;
  readonly options: readonly AttributeRecord[];
  readonly used: ReadonlySet<string>;
  readonly onClose: () => void;
  readonly onPick: (attributeId: string) => void;
}

function MapLineDialog({ line, options, used, onClose, onPick }: MapProps) {
  const { t } = useImportText();
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('review.lines.mapTitle')}</DialogTitle>
          <DialogDescription>{t('review.lines.mapLead', { label: line.label, values: line.values.join(' · ') })}</DialogDescription>
        </DialogHeader>
        <AttributePicker value={chosen} options={options} onChange={setChosen} placeholder={t('review.lines.mapPick')} ariaLabel={t('review.lines.mapPick')} />
        {chosen !== null && used.has(chosen) ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('review.lines.mapUsed')}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('review.lines.cancel')}</Button>
          <Button type="button" disabled={chosen === null} onClick={() => { if (chosen !== null) { onPick(chosen); onClose(); } }}>{t('review.lines.mapConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LevelChoice({ level, suggested, onLevel }: { readonly level: ImportLineBindLevel; readonly suggested: ImportLineBindLevel; readonly onLevel: (level: ImportLineBindLevel) => void }) {
  const { t } = useImportText();
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="text-sm font-medium">{t('review.lines.levelLabel')}</legend>
      <SegmentedControl<ImportLineBindLevel> value={level} onValueChange={onLevel} aria-label={t('review.lines.levelLabel')}>
        {IMPORT_LINE_BIND_LEVELS.map((key) => <SegmentedControlItem key={key} value={key}>{t(LINE_LEVEL_KEYS[key])}</SegmentedControlItem>)}
      </SegmentedControl>
      <p className="m-0 text-xs text-muted-foreground">{t(LINE_LEVEL_HINT_KEYS[suggested])}</p>
    </fieldset>
  );
}

function LoadingDialog({ onClose }: { readonly onClose: () => void }) {
  const { t } = useImportText();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="sm">
        <DialogHeader><DialogTitle>{t('review.lines.loading')}</DialogTitle></DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export function LineAttributeTools({ proposal, line, mode, onClose, onDecide }: LineAttributeToolsProps) {
  const notify = useCatalogFailureNotice();
  const canManage = useCatalogCanManage();
  const library = useCatalogLibrary(notify);
  const families = useCatalogCollection('CATALOG_FAMILIES');
  const family = families.items.find((item) => item.id === proposal.familyId) ?? null;
  const suggestion = useMemo(() => suggestAttributeFromLine(line, library.registry), [line, library.registry]);
  const [level, setLevel] = useState<ImportLineBindLevel | null>(null);
  const prefill = useCallback((blank: CatalogAttributeDefinition) => lineAttributeDraft(blank, suggestion), [suggestion]);
  if (library.state !== 'ready' || families.state !== 'ready' || family === null) return <LoadingDialog onClose={onClose} />;
  if (mode === 'map') {
    const options = rankedOptions(familyAttributes(family, library.attributeById), suggestion);
    return <MapLineDialog line={line} options={options} used={usedAttributeIds(proposal)} onClose={onClose} onPick={(attributeId) => onDecide(attributeId, null)} />;
  }
  const chosenLevel = level ?? suggestion.level;
  const lead = proposal.variantSchemeCode !== null ? <LevelChoice level={chosenLevel} suggested={suggestion.level} onLevel={setLevel} /> : null;
  return (
    <NewAttributeDialog open onOpenChange={(open) => { if (!open) onClose(); }} library={library} families={families.items} canManage={canManage}
      prefill={prefill} lead={lead} onCreated={(created) => { onDecide(created.id, chosenLevel); onClose(); }} />
  );
}
