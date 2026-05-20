'use client';

/**
 * ADR-363 Phase 3.7b+ — Dialog για multi-storey slab-opening stack.
 *
 * Εμφανίζει checkbox list με τους διαθέσιμους ορόφους. Για κάθε floor:
 *   - Enabled + checked-by-default: αν υπάρχει slab στο ίδιο XY footprint
 *   - Disabled (⚠): αν δεν υπάρχει host slab στο floor
 * Footer: Cancel | "Αντιγραφή" (disabled αν 0 selected).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Phase 3.7b+
 */

import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Level } from '../../../systems/levels/config';
import type { SlabOpeningEntity } from '../../../bim/types/slab-opening-types';
import type { SceneModel } from '../../../types/scene-types';
import { findHostSlabForLevel } from '../../../bim/slab-openings/slab-opening-stack';

export interface SlabOpeningStackDialogProps {
  readonly open: boolean;
  readonly opening: SlabOpeningEntity | null;
  readonly levels: Level[];
  readonly currentLevelId: string | null;
  readonly getLevelScene: (levelId: string) => SceneModel | null;
  readonly onConfirm: (selectedLevelIds: string[]) => void;
  readonly onCancel: () => void;
}

interface LevelRow {
  level: Level;
  hasHostSlab: boolean;
}

export function SlabOpeningStackDialog({
  open,
  opening,
  levels,
  currentLevelId,
  getLevelScene,
  onConfirm,
  onCancel,
}: SlabOpeningStackDialogProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');

  // Compute which other floors have a compatible host slab.
  const levelRows = useMemo((): LevelRow[] => {
    if (!opening) return [];
    return levels
      .filter((l) => l.id !== currentLevelId)
      .sort((a, b) => a.order - b.order)
      .map((level) => {
        const scene = getLevelScene(level.id);
        const hasHostSlab = scene != null
          ? findHostSlabForLevel(opening.params.outline, scene) != null
          : false;
        return { level, hasHostSlab };
      });
  }, [opening, levels, currentLevelId, getLevelScene]);

  // Default: all rows with a slab pre-selected.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelected(new Set(levelRows.filter((r) => r.hasHostSlab).map((r) => r.level.id)));
    }
  }, [open, levelRows]);

  const toggleLevel = (levelId: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  };

  const handleConfirm = (): void => {
    onConfirm([...selected]);
  };

  if (!opening) return null;

  // Subtitle: kind + bbox dimensions in mm.
  const bbox = opening.geometry?.bbox;
  const widthMm = bbox ? Math.round(bbox.max.x - bbox.min.x) : 0;
  const depthMm = bbox ? Math.round(bbox.max.y - bbox.min.y) : 0;
  const subtitle = `${opening.kind} · ${widthMm} × ${depthMm} mm`;

  const canConfirm = selected.size > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('slabOpeningStack.dialog.title')}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </DialogHeader>

        <div className="flex flex-col gap-1 py-2 max-h-64 overflow-y-auto">
          {levelRows.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">
              {t('slabOpeningStack.dialog.noOtherFloors')}
            </p>
          )}
          {levelRows.map(({ level, hasHostSlab }) => (
            <label
              key={level.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent/50 ${!hasHostSlab ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Checkbox
                checked={selected.has(level.id)}
                disabled={!hasHostSlab}
                onCheckedChange={() => toggleLevel(level.id)}
                aria-label={level.name}
              />
              <span className="flex-1 text-sm">{level.name}</span>
              {!hasHostSlab && (
                <span className="flex items-center gap-1 text-xs text-warning-foreground">
                  <AlertTriangle size={12} />
                  {t('slabOpeningStack.dialog.noSlab')}
                </span>
              )}
            </label>
          ))}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            {t('slabOpeningStack.dialog.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy size={13} />
            {t('slabOpeningStack.dialog.confirm')} ({selected.size})
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
