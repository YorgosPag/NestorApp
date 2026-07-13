'use client';

/**
 * @module ui/panels/block-library/BlockLibraryPanel
 * @description «Τα Blocks μου» — browsable palette των session/imported DXF blocks (Block
 * Library Milestone 1). Κάθε κάρτα δείχνει footprint preview (από `boundsMm`) + το όνομα του
 * block· κλικ → επιλογή στο `block-library-selection-store` + ενεργοποίηση του placement tool
 * (ο καλών περνά `onSelectBlock`). Η επόμενη κλικ στον καμβά τοποθετεί το block.
 *
 * Pattern: FloatingPanel compound (mirror `GuidePanel`). Data source: το in-session registry.
 * Read-only ως προς τη σκηνή — καμία γεωμετρία δεν κλωνοποιείται εδώ (μόνο bounds preview).
 *
 * @see ../guide-panel/GuidePanel.tsx (FloatingPanel template)
 * @see ../../../bim/block-library/block-library-registry.ts (defs SSoT)
 * @see ../../../bim/block-library/block-library-selection-store.ts (επιλογή SSoT)
 */

import React, { useSyncExternalStore } from 'react';
import { Boxes } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import {
  listSessionBlockDefs,
  getSessionBlockDefsVersion,
  subscribeSessionBlockDefs,
} from '../../../bim/block-library/block-library-registry';
import { useSelectedBlockName } from '../../../bim/block-library/block-library-selection-store';
import type {
  BlockBoundsMm,
  InSessionBlockDef,
} from '../../../bim/block-library/block-library-types';

const PANEL_DIMENSIONS = { width: 300, height: 520 } as const;
const SSR_FALLBACK_POSITION = { x: 120, y: 120 };

// ── Stable snapshot (version-keyed cache) ────────────────────────────────────
// `listSessionBlockDefs()` returns a fresh array each call· `useSyncExternalStore` requires a
// STABLE reference between changes, so cache by the monotonic registry version (bump = recompute).
let cachedVersion = -1;
let cachedList: readonly InSessionBlockDef[] = [];
function getListSnapshot(): readonly InSessionBlockDef[] {
  const v = getSessionBlockDefsVersion();
  if (v !== cachedVersion) {
    cachedVersion = v;
    cachedList = listSessionBlockDefs();
  }
  return cachedList;
}

function useSessionBlockDefs(): readonly InSessionBlockDef[] {
  return useSyncExternalStore(subscribeSessionBlockDefs, getListSnapshot, getListSnapshot);
}

// ── Footprint thumbnail (aspect-correct rect από τα bounds) ───────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
interface BlockLibraryPanelProps {
  isVisible: boolean;
  onClose: () => void;
  /** Επιλογή block → set selection + activate placement tool (wiring στον καλούντα). */
  onSelectBlock: (name: string) => void;
}

export const BlockLibraryPanel: React.FC<BlockLibraryPanelProps> = ({
  isVisible,
  onClose,
  onSelectBlock,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const defs = useSessionBlockDefs();
  const selected = useSelectedBlockName();

  if (!isVisible) return null;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={PANEL_DIMENSIONS}
      onClose={onClose}
      isVisible={isVisible}
      className="flex w-[300px] max-h-[520px] flex-col"
    >
      <FloatingPanel.Header title={t('blockLibrary.title')} icon={<Boxes />} />
      <FloatingPanel.Content className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <p className="flex-shrink-0 border-b border-border pb-2 text-xs text-muted-foreground">
          {t('blockLibrary.hint')}
        </p>
        {defs.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {t('blockLibrary.empty')}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 overflow-auto py-2">
            {defs.map((def) => {
              const isActive = def.name === selected;
              return (
                <li key={def.name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelectBlock(def.name)}
                        aria-pressed={isActive}
                        className={`flex w-full flex-col items-stretch gap-1 rounded-md border p-2 text-left transition-colors ${
                          isActive
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        <span className="flex h-16 items-center justify-center rounded bg-muted/40 p-1">
                          <FootprintThumb bounds={def.boundsMm} />
                        </span>
                        <span className="truncate text-xs font-medium">{def.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDimensions(def.boundsMm)}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{def.name}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        )}
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};
