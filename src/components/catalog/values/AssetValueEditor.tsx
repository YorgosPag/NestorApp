'use client';
/**
 * **Επιλογέας μέσων** από τη βιβλιοθήκη (ADR-923 §5.10 Δ9, §5.10.4 Β3).
 *
 * Προσφέρει **μόνο** ό,τι δέχεται ο επικυρωτής: μέσα των ειδών της ιδιότητας (`assetKinds`), ως `maxFiles`. Η σειρά
 * μετρά (η πρώτη είναι η κύρια εικόνα της λίστας) ⇒ μετακίνηση αριστερά. Μικρογραφία από το **κοινό** `FileThumbnail`.
 *
 * @module components/catalog/values/AssetValueEditor
 */

import { ArrowLeft, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { normalizeSearchText } from '@/lib/search/search';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';

import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { ValueEditorProps } from './value-editor-types';

function AssetChip({ asset, props, index, onMove, onRemove }: {
  readonly asset: AssetRecord;
  readonly props: ValueEditorProps<'asset'>;
  readonly index: number;
  readonly onMove: () => void;
  readonly onRemove: () => void;
}) {
  const { t } = useCatalogText();
  const file = asset.fileId ? props.env.files.get(asset.fileId) ?? null : null;
  const name = props.env.text(asset.labels, asset.code);
  return (
    <li className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
      {file ? <FileThumbnail file={file} displayName={name} size="xs" /> : null}
      <span className="text-sm">{name}</span>
      {index > 0 ? <Button type="button" variant="ghost" size="icon" aria-label={t('values.assets.moveFirst', { name })} disabled={props.disabled} onClick={onMove}><ArrowLeft className="h-3 w-3" aria-hidden /></Button> : null}
      <Button type="button" variant="ghost" size="icon" aria-label={t('values.assets.remove', { name })} disabled={props.disabled} onClick={onRemove}><X className="h-3 w-3" aria-hidden /></Button>
    </li>
  );
}

function AssetPicker({ props, selected, onPick }: { readonly props: ValueEditorProps<'asset'>; readonly selected: readonly string[]; readonly onPick: (id: string) => void }) {
  const { t } = useCatalogText();
  const [query, setQuery] = useState('');
  const eligible = useMemo(() => {
    const wanted = normalizeSearchText(query.toLowerCase());
    return props.env.assets.filter((asset) => props.attribute.config.assetKinds.includes(asset.kind) && !selected.includes(asset.id)
      && (wanted === '' || normalizeSearchText(`${asset.code} ${props.env.text(asset.labels, '')}`.toLowerCase()).includes(wanted)));
  }, [props.env, props.attribute.config.assetKinds, selected, query]);
  return (
    <PopoverContent className="grid w-80 gap-2">
      <Input aria-label={t('values.assets.search')} placeholder={t('values.assets.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
      <ul className="m-0 grid max-h-64 list-none gap-1 overflow-auto p-0">
        {eligible.length === 0 ? <li className="text-sm text-muted-foreground">{t('values.assets.none')}</li> : eligible.map((asset) => {
          const file = asset.fileId ? props.env.files.get(asset.fileId) ?? null : null;
          const name = props.env.text(asset.labels, asset.code);
          return (
            <li key={asset.id}>
              <Button type="button" variant="ghost" className="w-full justify-start gap-2" onClick={() => onPick(asset.id)}>
                {file ? <FileThumbnail file={file} displayName={name} size="xs" /> : null}
                <span className="truncate">{name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </PopoverContent>
  );
}

export function AssetValueEditor(props: ValueEditorProps<'asset'>) {
  const { t } = useCatalogText();
  const [open, setOpen] = useState(false);
  const ids = props.value?.assetIds ?? [];
  const write = (next: readonly string[]) => props.onChange(next.length === 0 ? null : { type: 'asset', assetIds: next });
  const full = ids.length >= props.attribute.config.maxFiles;
  return (
    <section id={props.id} aria-label={props.label} aria-describedby={props.describedBy} className="flex flex-wrap items-center gap-2">
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {ids.map((id, index) => {
          const asset = props.env.assetById.get(id);
          return asset ? (
            <AssetChip key={id} asset={asset} props={props} index={index}
              onMove={() => write([id, ...ids.filter((other) => other !== id)])} onRemove={() => write(ids.filter((other) => other !== id))} />
          ) : null;
        })}
      </ul>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={props.disabled || full}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('values.assets.add')}</Button>
        </PopoverTrigger>
        <AssetPicker props={props} selected={ids} onPick={(id) => { write([...ids, id]); setOpen(false); }} />
      </Popover>
    </section>
  );
}
