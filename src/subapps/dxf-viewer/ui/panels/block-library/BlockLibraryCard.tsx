'use client';

/**
 * ADR-652 M2/M3 — μία κάρτα του palette των block.
 *
 * Δείχνει footprint preview (από τα `boundsMm` — καμία γεωμετρία δεν κατεβαίνει/κλωνοποιείται
 * για μια κάρτα) + όνομα + διαστάσεις, το **σε ποια βιβλιοθήκη ανήκει** (badge scope) και τις
 * ενέργειες που ΕΠΙΤΡΕΠΟΝΤΑΙ σε αυτό το αντικείμενο:
 *  - 💾 μόνο της συνεδρίας → «Αποθήκευση στη βιβλιοθήκη» (M2),
 *  - 🌐 δικό μου & ιδιωτικό → «Δημοσίευση» στην εταιρεία/έργο (M3, νομικό gate),
 *  - 🗑 δικό μου → διαγραφή (M3). Το seeded/partner περιεχόμενο (`builtin`) είναι read-only.
 *
 * Καθαρά presentational: κάθε ενέργεια ανεβαίνει στον γονέα (panel), και το ΤΙ επιτρέπεται
 * το κρίνουν οι pure κανόνες του `block-palette-entries` — όχι η κάρτα.
 */

import React from 'react';
import { Cloud, Loader2, Save, Share2, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import type { BlockPaletteEntry } from '../../../bim/block-library/block-palette-entries';
import type { BlockBoundsMm } from '../../../bim/block-library/block-library-types';

/** Aspect-correct ορθογώνιο από τα bounds — το «αποτύπωμα» του block. */
const FootprintThumb: React.FC<{ bounds: BlockBoundsMm | null }> = ({ bounds }) => {
  if (!bounds) return <span className="text-xs text-muted-foreground">—</span>;
  const w = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const h = Math.max(bounds.maxY - bounds.minY, 1e-6);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full text-muted-foreground"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

function formatDimensions(bounds: BlockBoundsMm | null): string {
  if (!bounds) return '';
  const w = Math.round(bounds.maxX - bounds.minX);
  const h = Math.round(bounds.maxY - bounds.minY);
  return `${w} × ${h}`;
}

export interface BlockLibraryCardProps {
  readonly entry: BlockPaletteEntry;
  /** Το εμφανιζόμενο όνομα (μεταφρασμένη ετικέτα για seeded, αλλιώς raw block name). */
  readonly displayName: string;
  readonly isActive: boolean;
  readonly isBusy: boolean;
  readonly canSaveToLibrary: boolean;
  readonly canPromote: boolean;
  readonly canDelete: boolean;
  readonly onSelect: (entry: BlockPaletteEntry) => void;
  readonly onSave: (entry: BlockPaletteEntry) => void;
  readonly onPromote: (entry: BlockPaletteEntry) => void;
  readonly onDelete: (entry: BlockPaletteEntry) => void;
}

/** Ένα εικονίδιο-ενέργεια της κάρτας — ίδιο κέλυφος για save/promote/delete (όχι 3 clones). */
const CardAction: React.FC<{
  readonly label: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly danger?: boolean;
}> = ({ label, disabled, onClick, children, danger }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          'rounded p-1 text-muted-foreground transition-colors disabled:opacity-60',
          danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-background hover:text-foreground',
        ].join(' ')}
      >
        {children}
        <span className="sr-only">{label}</span>
      </button>
    </TooltipTrigger>
    <TooltipContent side="left">{label}</TooltipContent>
  </Tooltip>
);

export const BlockLibraryCard: React.FC<BlockLibraryCardProps> = ({
  entry,
  displayName,
  isActive,
  isBusy,
  canSaveToLibrary,
  canPromote,
  canDelete,
  onSelect,
  onSave,
  onPromote,
  onDelete,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const license = entry.item?.license;

  return (
    <article
      className={`relative flex flex-col rounded-md border transition-colors ${
        isActive ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
      }`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(entry)}
            disabled={isBusy}
            aria-pressed={isActive}
            className="flex w-full flex-col items-stretch gap-1 p-2 text-left disabled:opacity-60"
          >
            <span className="flex h-16 items-center justify-center rounded bg-muted/40 p-1">
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <FootprintThumb bounds={entry.boundsMm} />
              )}
            </span>
            <span className="truncate text-xs font-medium">{displayName}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatDimensions(entry.boundsMm)}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {license
            ? `${displayName} · ${t(`blockLibrary.licenses.${license.type}`)}`
            : displayName}
        </TooltipContent>
      </Tooltip>

      <footer className="absolute right-1 top-1 flex items-center gap-0.5">
        {entry.source === 'cloud' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="rounded bg-background/80 p-0.5 text-[9px] uppercase text-muted-foreground">
                {entry.scope === 'system' ? (
                  t('blockLibrary.badges.system')
                ) : (
                  <Cloud className="h-3 w-3" aria-hidden="true" />
                )}
                <span className="sr-only">{t(`blockLibrary.scopes.${entry.scope}`)}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">{t(`blockLibrary.scopes.${entry.scope}`)}</TooltipContent>
          </Tooltip>
        )}

        {entry.canSave && canSaveToLibrary && (
          <CardAction
            label={t('blockLibrary.save.action')}
            disabled={isBusy}
            onClick={() => onSave(entry)}
          >
            <Save className="h-3 w-3" aria-hidden="true" />
          </CardAction>
        )}

        {canPromote && (
          <CardAction
            label={t('blockLibrary.promote.action')}
            disabled={isBusy}
            onClick={() => onPromote(entry)}
          >
            <Share2 className="h-3 w-3" aria-hidden="true" />
          </CardAction>
        )}

        {canDelete && (
          <CardAction
            label={t('blockLibrary.delete.action')}
            disabled={isBusy}
            danger
            onClick={() => onDelete(entry)}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
          </CardAction>
        )}
      </footer>
    </article>
  );
};
