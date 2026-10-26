'use client';

/**
 * @fileoverview **Η λίστα της βιβλιοθήκης μέσων** — μικρογραφία, ρόλος, χρώμα, κατάσταση αποδόσεων και άδειας με μια ματιά
 *   (ADR-923 §5.10.4).
 * @module components/catalog/assets/AssetLibraryList
 *
 * 🔑 **Ό,τι χρειάζεται προσοχή φαίνεται χωρίς άνοιγμα** (Salsify «digital asset health»): χωρίς αρχείο · αποδόσεις που
 *    απέτυχαν · άδεια που έληξε. Τα σήματα έχουν **λέξη**, όχι μόνο χρώμα (CHECK 3.41).
 * ⚠️ Φίλτρο ρόλου «όλοι» = `all`, ποτέ `''` (το Radix το δεσμεύει — CHECK 3.48).
 */

import React, { useMemo, useState } from 'react';

import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import type { CatalogAssetFiles } from '@/hooks/catalog/useCatalogAssetFiles';
import { mediaLicenseStanding } from '@/lib/media-rights/media-license-standing';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import { catalogRenditionsStanding } from '@/subapps/catalog/renditions/catalog-renditions';
import { CATALOG_ASSET_ROLES, type CatalogAssetRole } from '@/subapps/catalog/vocabulary/asset-roles';
import type { FileRecord } from '@/types/file-record';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogListItem, type CatalogListBadge } from '../shared/CatalogList';
import { ASSET_ROLE_ICONS, ASSET_ROLE_KEYS, COLOUR_MODEL_KEYS } from './asset-labels';

const ALL_ROLES = 'all';
type RoleFilter = CatalogAssetRole | typeof ALL_ROLES;
const ROLE_FILTERS: readonly RoleFilter[] = [ALL_ROLES, ...CATALOG_ASSET_ROLES];

function useAssetBadges(): (asset: AssetRecord, file: FileRecord | null) => readonly CatalogListBadge[] {
  const { t } = useCatalogText();
  return (asset, file) => {
    const badges: CatalogListBadge[] = [];
    if (file === null) badges.push({ label: t('assets.list.noFile'), variant: 'warning' });
    if (file?.imageColour?.model === 'cmyk') badges.push({ label: t(COLOUR_MODEL_KEYS.cmyk), variant: 'info' });
    if (file && asset.kind === 'image' && catalogRenditionsStanding(file.catalogRenditions) === 'failed') {
      badges.push({ label: t('assets.list.renditionsFailed'), variant: 'destructive' });
    }
    if (mediaLicenseStanding(asset.rights, Date.now(), false) !== 'active') badges.push({ label: t('assets.list.licenceExpired'), variant: 'warning' });
    return badges;
  };
}

interface AssetLibraryListProps {
  readonly assets: readonly AssetRecord[];
  readonly files: CatalogAssetFiles;
  readonly selectedId: string | null;
  readonly pendingKeys: ReadonlySet<string>;
  readonly onSelect: (id: string) => void;
}

export function AssetLibraryList({ assets, files, selectedId, pendingKeys, onSelect }: AssetLibraryListProps) {
  const { t, text } = useCatalogText();
  const badgesOf = useAssetBadges();
  const [role, setRole] = useState<RoleFilter>(ALL_ROLES);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return assets.filter((asset) => (role === ALL_ROLES || asset.role === role)
      && (needle === '' || asset.code.includes(needle) || text(asset.labels, '').toLocaleLowerCase().includes(needle)));
  }, [assets, role, query, text]);
  return (
    <section className="flex flex-col gap-2">
      <section role="search" className="flex flex-col gap-2 px-2">
        <Input type="search" value={query} placeholder={t('assets.list.search')} aria-label={t('assets.list.search')} onChange={(e) => setQuery(e.target.value)} />
        <EnumSelect id="asset-role-filter" value={role} values={ROLE_FILTERS} onValueChange={setRole}
          getLabel={(value) => (value === ALL_ROLES ? t('assets.list.allRoles') : t(ASSET_ROLE_KEYS[value]))} />
      </section>
      {shown.length === 0 ? <p className="m-0 px-2 text-sm text-muted-foreground">{t('assets.list.none')}</p> : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {shown.map((asset) => {
            const file = asset.fileId ? files.byId.get(asset.fileId) ?? null : null;
            const Icon = ASSET_ROLE_ICONS[asset.role];
            return (
              <li key={asset.id}>
                <CatalogListItem
                  leading={file ? <FileThumbnail file={file} displayName={text(asset.labels, asset.code)} size="xs" /> : <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                  primary={text(asset.labels, asset.code)}
                  secondary={`${asset.code} · ${t(ASSET_ROLE_KEYS[asset.role])}`}
                  badges={badgesOf(asset, file)}
                  selected={asset.id === selectedId}
                  pending={pendingKeys.has(asset.id)}
                  onSelect={() => onSelect(asset.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
