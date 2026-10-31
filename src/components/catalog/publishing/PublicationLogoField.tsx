'use client';

/**
 * @fileoverview **Το λογότυπο της έκδοσης** — επιλογή από τη βιβλιοθήκη μέσων (ADR-923 §5.6.1).
 * @related subapps/catalog/publishing/publication-logo.ts (η ίδια κρίση με τον γραφέα) · values/AssetPickerPopover.tsx
 * @module components/catalog/publishing/PublicationLogoField
 *
 * 🔑 Προσφέρεται μόνο ό,τι δέχεται ο γραφέας (`isPublicationLogo`), και το κείμενο βοήθειας λέει τι λείπει όταν η λίστα είναι άδεια.
 * ⚠️ Τα αρχεία έρχονται μαζί με τα μέσα: όσο δεν έχουν φορτώσει, η λίστα είναι άδεια αλλά δεν λέμε ποτέ «δεν υπάρχει πια».
 */

import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useCatalogAssetFiles } from '@/hooks/catalog/useCatalogAssetFiles';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { isPublicationLogo } from '@/subapps/catalog/publishing/publication-logo';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { AssetPickerPopover } from '../values/AssetPickerPopover';
import { withTheme, type PublicationFieldsProps } from './publication-draft';

export function PublicationLogoField({ draft, onChange, issues, disabled }: PublicationFieldsProps) {
  const { t, text } = useCatalogText();
  const assets = useCatalogCollection('CATALOG_ASSETS');
  const files = useCatalogAssetFiles();
  const [open, setOpen] = useState(false);
  const logoId = draft.theme.logoAssetId;
  const eligible = useMemo(
    () => assets.items.filter((asset) => isPublicationLogo(asset, asset.fileId ? files.byId.get(asset.fileId) ?? null : null)),
    [assets.items, files.byId],
  );
  const chosen = logoId === null ? null : assets.items.find((asset) => asset.id === logoId) ?? null;
  const missing = logoId !== null && chosen === null && assets.state === 'ready';
  const file = chosen?.fileId ? files.byId.get(chosen.fileId) ?? null : null;
  const name = chosen ? text(chosen.labels, chosen.code) : '';
  const choose = (logoAssetId: string | null) => { onChange(withTheme(draft, { logoAssetId })); setOpen(false); };
  return (
    <CatalogField label={t('publishing.fields.logo')} issues={issues} path="theme.logoAssetId" hint={t('publishing.logo.hint')}>
      {({ id, describedBy }) => (
        <span className="flex flex-wrap items-center gap-2">
          {file ? <FileThumbnail file={file} displayName={name} size="xs" /> : null}
          {chosen ? <span className="text-sm">{name}</span> : null}
          {missing ? <span className="text-sm text-destructive" role="alert">{t('publishing.logo.missing')}</span> : null}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button id={id} type="button" variant="outline" size="sm" disabled={disabled} aria-label={t('publishing.logo.choose')} aria-describedby={describedBy}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('publishing.logo.choose')}</Button>
            </PopoverTrigger>
            <AssetPickerPopover assets={eligible} files={files.byId} text={text} onPick={choose} />
          </Popover>
          {logoId !== null ? (
            <Button type="button" variant="ghost" size="icon" aria-label={t('publishing.logo.remove')} disabled={disabled} onClick={() => choose(null)}><X className="h-4 w-4" aria-hidden /></Button>
          ) : null}
        </span>
      )}
    </CatalogField>
  );
}
