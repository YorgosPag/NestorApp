'use client';

/**
 * @fileoverview **Η γραμμή τιμής ενός πίνακα PDF** (ADR-923 §5.5.2 Β4 Δ2 · Δ7): ο διάλογος «αυτή η γραμμή είναι η τιμή» με τη μονάδα
 *   της, και η σημείωση πάνω στην πρόταση τιμών που λέει από πού ήρθε, με αναίρεση.
 * @module components/catalog/imports/PriceLineControls
 *
 * 🔑 Η μονάδα **δηλώνεται**, ποτέ δεν μαντεύεται: ο πίνακας του καταλόγου δεν τυπώνει μονάδα τιμής, και η νέα γραμμή τιμοκαταλόγου
 *    τη χρειάζεται. Προεπιλογή η προεπιλογή του μητρώου (`DEFAULT_UOM`), ορατή και αλλάξιμη.
 * ⚠️ Τεμπέλικη **επιφάνεια** (`import-surfaces.tsx`): ο επιλογέας μονάδας φέρνει το namespace `uom`, που δεν ανήκει στο πρώτο καρέ.
 */

import React, { useState } from 'react';
import { Undo2 } from 'lucide-react';

import { UomSelect } from '@/components/shared/UomSelect';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useUomLabel } from '@/hooks/useUomLabel';
import { DEFAULT_UOM, UOM_CODES } from '@/lib/uom/uom-registry';
import { useImportText } from './import-text';
import type { PriceLineDialogProps, PriceLineNoteProps, PriceLineToolsProps } from './line-tool-props';

/** Η είσοδος της επιφάνειας `CatalogPriceLineTools`. */
export function PriceLineTools(props: PriceLineToolsProps) {
  return props.kind === 'dialog' ? <PriceLineDialog {...props} /> : <PriceLineNote {...props} />;
}

function PriceLineDialog({ line, onClose, onDecide }: PriceLineDialogProps) {
  const { t } = useImportText();
  const [unitCode, setUnitCode] = useState<string>(DEFAULT_UOM);
  const unitId = `price-unit-${line.page}-${line.table}-${line.line}`;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('review.priceLine.title')}</DialogTitle>
          <DialogDescription>{t('review.priceLine.lead', { label: line.label, values: line.values.join(' · ') })}</DialogDescription>
        </DialogHeader>
        <p className="m-0 flex flex-col gap-1">
          <Label htmlFor={unitId}>{t('review.priceLine.unit')}</Label>
          <UomSelect id={unitId} value={unitCode} onValueChange={setUnitCode} units={UOM_CODES} />
        </p>
        <p className="m-0 text-xs text-muted-foreground">{t('review.priceLine.hint')}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('review.lines.cancel')}</Button>
          <Button type="button" onClick={() => { onDecide(unitCode); onClose(); }}>{t('review.priceLine.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PriceLineNote({ line, unitCode, disabled, onUndo }: PriceLineNoteProps) {
  const { t } = useImportText();
  const uomLabel = useUomLabel();
  return (
    <p className="m-0 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" role="status">
      <span>{t('review.priceLine.source', { line: line + 1, unit: uomLabel(unitCode, 'name') })}</span>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onUndo}><Undo2 className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.undo')}</Button>
    </p>
  );
}
