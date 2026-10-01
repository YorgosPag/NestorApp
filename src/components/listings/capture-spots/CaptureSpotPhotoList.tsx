'use client';

/**
 * @fileoverview **Η ΤΑΙΝΙΑ ΤΩΝ ΦΩΤΟΓΡΑΦΙΩΝ** — σε τέσσερις ομάδες, η δουλειά που μένει πρώτη (ADR-897 Φ3).
 * @related lib/listings/photo-capture-spot-edit (`groupCaptureSpots`) · CaptureSpotWorkspaceDialog.tsx
 * @module components/listings/capture-spots/CaptureSpotPhotoList
 *
 * 🏆 **Η ομάδα «η κάτοψή τους αποσύρθηκε»** δεν υπάρχει σε κανέναν από τους μεγάλους: σημείο σε κάτοψη που ο άνθρωπος
 *   ξεδήλωσε **δεν** φαίνεται στο κοινό (ADR-897 §3.2) — και αν η οθόνη το έκρυβε, θα πίστευε ότι είναι εκεί.
 * ♿ Κάθε φωτογραφία είναι κουμπί με `aria-pressed` (επιλεγμένη) — η επιλογή δεν είναι μόνο χρώμα (CHECK 3.41).
 */

import { ImageIcon } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CaptureSpotGroups } from '@/lib/listings/photo-capture-spot-edit';
import { cn } from '@/lib/utils';

const K = 'property-market:photoCaptureSpots';

import type { CaptureSpotPhoto } from './capture-spot-types';

interface CaptureSpotPhotoListProps {
  readonly photos: readonly CaptureSpotPhoto[];
  readonly groups: CaptureSpotGroups;
  readonly selectedPhotoId: string | null;
  readonly onSelect: (photoId: string) => void;
}

type GroupKey = keyof CaptureSpotGroups;

const GROUP_ORDER: readonly GroupKey[] = ['unplaced', 'orphaned', 'here', 'elsewhere'];

/** ⚠️ Κάθε κλειδί **ρητό** (ποτέ `t(πίνακας[κλειδί])`): ο αναλυτής του route slice (CHECK 3.34) πρέπει να το δει. */
function useGroupTitles(groups: CaptureSpotGroups): Readonly<Record<GroupKey, string>> {
  const { t } = useTranslation(['property-market']);
  return {
    unplaced: t(`${K}.groupUnplaced`, { count: groups.unplaced.length }),
    orphaned: t(`${K}.groupOrphaned`, { count: groups.orphaned.length }),
    here: t(`${K}.groupHere`, { count: groups.here.length }),
    elsewhere: t(`${K}.groupElsewhere`, { count: groups.elsewhere.length }),
  };
}

function PhotoButton({ photo, selected, onSelect }: { photo: CaptureSpotPhoto; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={() => onSelect(photo.id)}
      className={cn('flex w-full items-center gap-2 rounded-md border p-1.5 text-left text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary bg-accent font-medium text-accent-foreground' : 'border-transparent hover:bg-muted')}>
      {photo.thumbnailUrl === null ? (
        <ImageIcon aria-hidden className="h-10 w-14 shrink-0 rounded bg-muted p-2 text-muted-foreground" />
      ) : (
        <img src={photo.thumbnailUrl} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
      )}
      <span className="min-w-0 truncate">{photo.name}</span>
    </button>
  );
}

export function CaptureSpotPhotoList({ photos, groups, selectedPhotoId, onSelect }: CaptureSpotPhotoListProps) {
  const { t } = useTranslation(['property-market']);
  const titles = useGroupTitles(groups);
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  return (
    <nav aria-label={t(`${K}.photosAria`)} className="flex flex-col gap-3">
      {GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => (
        <section key={key} aria-labelledby={`capture-spot-group-${key}`} className="flex flex-col gap-1">
          <h4 id={`capture-spot-group-${key}`} className="m-0 text-xs font-semibold uppercase text-muted-foreground">
            {titles[key]}
          </h4>
          {key === 'orphaned' && <p className="m-0 text-xs text-destructive">{t(`${K}.orphanedHint`)}</p>}
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {groups[key].flatMap((id) => {
              const photo = byId.get(id);
              return photo === undefined ? [] : [(
                <li key={id}><PhotoButton photo={photo} selected={id === selectedPhotoId} onSelect={onSelect} /></li>
              )];
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
