'use client';

/**
 * @fileoverview **Το πλαίσιο «Νέες τιμές άξονα»** (ADR-923 §5.5.2 Β7) — τεμπέλικη επιφάνεια `CatalogAxisOptions` (`import-surfaces.tsx`).
 * @module components/catalog/imports/AxisOptionsDialog
 *
 * 🔑 Φορτώνεται **μόνο** όταν ο άνθρωπος το ανοίξει, μαζί με τα κείμενά του (ADR-744 §27): το πρώτο καρέ της σελίδας εισαγωγών δεν
 *    πληρώνει ούτε τη βιβλιοθήκη ιδιοτήτων ούτε τα `review.axis.*` (μετρημένο: αλλιώς route slice 16042 bytes, ταβάνι 14797).
 */

import React, { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { pageTableAddressOf } from '@/subapps/catalog/import/import-keys';
import type { AxisOptionsDialogProps } from './axis-options-props';
import { AxisOptionsForm } from './AxisOptionsForm';
import { useImportText } from './import-text';

/** Ο πρώτος υποψήφιος που είναι **πράγματι** άξονας `select` του σχήματος της πρότασης. */
function axisOf(candidates: readonly string[], axisIds: readonly string[], attributeById: ReadonlyMap<string, AttributeRecord>): AttributeRecord | null {
  const id = candidates.find((candidate) => axisIds.includes(candidate) && attributeById.get(candidate)?.type === 'select');
  return id === undefined ? null : (attributeById.get(id) ?? null);
}

export function AxisOptionsDialog({ proposal, candidates, saving, onClose, onSave, onFailure }: AxisOptionsDialogProps) {
  const { t } = useImportText();
  const library = useCatalogLibrary(onFailure);
  const families = useCatalogCollection('CATALOG_FAMILIES');
  const scheme = families.items.find((item) => item.id === proposal.familyId)?.variantSchemes.find((entry) => entry.code === proposal.variantSchemeCode);
  const axisIds = useMemo(() => scheme?.levels.flatMap((level) => level.axisAttributeIds) ?? [], [scheme]);
  const address = pageTableAddressOf(proposal.groupKey);
  const ready = library.state === 'ready' && families.state === 'ready';
  const attribute = ready ? axisOf(candidates, axisIds, library.attributeById) : null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('review.axis.title')}</DialogTitle>
          <DialogDescription>{t('review.axis.lead')}</DialogDescription>
        </DialogHeader>
        {!ready ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('review.lines.loading')}</p> : null}
        {ready && (attribute === null || address === null) ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('review.axis.notAxis')}</p> : null}
        {attribute !== null && address !== null ? (
          <AxisOptionsForm proposal={proposal} attribute={attribute} attributeById={library.attributeById} saving={saving} onCancel={onClose}
            onSave={async (options) => {
              const done = await onSave({ ...address, attributeId: attribute.id, expectedRevision: attribute.revision, options });
              if (done) onClose();
            }} />
        ) : (
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t('review.lines.cancel')}</Button></DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
