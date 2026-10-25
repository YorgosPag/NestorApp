'use client';

/**
 * @fileoverview **Νέα ιδιότητα επί τόπου** — από τον επεξεργαστή οικογένειας, χωρίς έξοδο από τη σελίδα
 *   (ADR-923 Φάση 1γ). Ο ίδιος `AttributeEditor` με τη σελίδα «Ιδιότητες» — μία φόρμα, δύο σπίτια.
 * @module components/catalog/families/NewAttributeDialog
 *
 * 🔑 Η νέα ιδιότητα μπαίνει στη **βιβλιοθήκη** (όχι «τοπικά» στην οικογένεια) και δένεται αμέσως στην οικογένεια που
 *    επεξεργάζεται ο άνθρωπος — η βιβλιοθήκη μένει μία (Akeneo: «create attribute» από τη family).
 */

import React, { useMemo } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';
import { emptyAttributeDraft } from '../attributes/attribute-draft';
import { AttributeEditor } from '../attributes/AttributeEditor';
import { useOrderKeyAtEnd } from '../attributes/use-attribute-order';
import { useCatalogText } from '../shared/catalog-ui-hooks';

interface NewAttributeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly library: CatalogLibrary;
  readonly families: readonly FamilyRecord[];
  readonly canManage: boolean;
  readonly onCreated: (attribute: AttributeRecord) => void;
}

export function NewAttributeDialog({ open, onOpenChange, library, families, canManage, onCreated }: NewAttributeDialogProps) {
  const { t } = useCatalogText();
  const orderKeyAtEnd = useOrderKeyAtEnd(library.attributes);
  const firstGroup = library.groups[0]?.id ?? '';
  const blank = useMemo(() => emptyAttributeDraft(firstGroup, orderKeyAtEnd(firstGroup, null), library.registry), [firstGroup, orderKeyAtEnd, library.registry]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>{t('families.attributes.newTitle')}</DialogTitle>
          <DialogDescription>{t('families.attributes.newLead')}</DialogDescription>
        </DialogHeader>
        {library.groups.length === 0 ? (
          <p className="m-0 px-4 pb-4 text-sm text-muted-foreground">{t('attributes.needGroup')}</p>
        ) : (
          <AttributeEditor
            record={null}
            blank={blank}
            groups={library.groups}
            families={families}
            registry={library.registry}
            ops={library.ops.attributes}
            canManage={canManage}
            orderKeyAtEnd={orderKeyAtEnd}
            onCreated={(created) => { onCreated(created); onOpenChange(false); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
