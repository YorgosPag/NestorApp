'use client';
/**
 * **Το αναδυόμενο επιλογής μέσου** (ADR-923 §5.10.4 Β3 · §5.6.1): αναζήτηση με κωδικό ή όνομα, μικρογραφία, ένα κλικ.
 * Κοινό για τις τιμές τύπου `asset` και για το λογότυπο της έκδοσης. Τα επιλέξιμα τα κρίνει ο καλών.
 *
 * @module components/catalog/values/AssetPickerPopover
 */

import { useMemo, useState } from 'react';

import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PopoverContent } from '@/components/ui/popover';
import type { LocalizedText } from '@/i18n/localized-text';
import { normalizeSearchText } from '@/lib/search/search';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { FileRecord } from '@/types/file-record';

import { useCatalogText } from '../shared/catalog-ui-hooks';

export interface AssetPickerPopoverProps {
  readonly assets: readonly AssetRecord[];
  readonly files: ReadonlyMap<string, FileRecord>;
  /** Ο αναγνώστης κειμένου του καλούντα: ο επεξεργαστής προϊόντος δείχνει τη γλώσσα που επεξεργάζεται, όχι της οθόνης. */
  readonly text: (value: LocalizedText | undefined, fallback?: string) => string;
  readonly onPick: (id: string) => void;
}

export function AssetPickerPopover({ assets, files, text, onPick }: AssetPickerPopoverProps) {
  const { t } = useCatalogText();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const wanted = normalizeSearchText(query.toLowerCase());
    return wanted === '' ? assets : assets.filter((asset) => normalizeSearchText(`${asset.code} ${text(asset.labels, '')}`.toLowerCase()).includes(wanted));
  }, [assets, query, text]);
  return (
    <PopoverContent className="grid w-80 gap-2">
      <Input aria-label={t('values.assets.search')} placeholder={t('values.assets.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
      <ul className="m-0 grid max-h-64 list-none gap-1 overflow-auto p-0">
        {shown.length === 0 ? <li className="text-sm text-muted-foreground">{t('values.assets.none')}</li> : shown.map((asset) => {
          const file = asset.fileId ? files.get(asset.fileId) ?? null : null;
          const name = text(asset.labels, asset.code);
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
