'use client';

/**
 * @fileoverview **ΤΟ ΕΡΓΑΛΕΙΟ ΤΟΥ ΧΑΡΤΗ** — «Σημείο | Προφίλ», κοινό για Κάτοψη ΚΑΙ 3Δ (ADR-920 §14.10 Ε3).
 * @related ./terrain-inspect-store (`TERRAIN_INSPECT_TOOLS` — το ΕΝΑ λεξιλόγιο) · ./TerrainViewStage (η θέση του: δίπλα στις
 *   καρτέλες, ώστε το εργαλείο να μένει ίδιο όταν αλλάζεις όψη — όπως η εργαλειοθήκη του Figma)
 * @module components/listing-detail/terrain/TerrainInspectToolbar
 *
 * ♿ Ο κοινός `SegmentedControl` (radio group, βελάκια). Στο «Προφίλ» λέει με λόγια πώς ορίζεται η τομή· όταν υπάρχει,
 *   δίνει και «Καθαρισμός τομής».
 */

import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import type { useTranslation } from '@/i18n/hooks/useTranslation';

import { useTerrainInspect, useTerrainInspectStore } from './TerrainInspectContext';
import { TERRAIN_INSPECT_TOOLS, type TerrainInspectState, type TerrainInspectTool } from './terrain-inspect-store';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map.profile';
const TOOL_LABEL: Readonly<Record<TerrainInspectTool, string>> = { inspect: `${NS}.toolInspect`, profile: `${NS}.toolProfile` };

const selectTool = (s: TerrainInspectState): TerrainInspectTool => s.tool;
const selectHasLine = (s: TerrainInspectState): boolean => s.profileLine !== null;

export function TerrainInspectToolbar({ t }: { readonly t: T }) {
  const store = useTerrainInspectStore();
  const tool = useTerrainInspect(selectTool);
  const hasLine = useTerrainInspect(selectHasLine);
  if (store === null) return null;
  const onValueChange = (next: string): void => {
    const picked = TERRAIN_INSPECT_TOOLS.find((option) => option === next);
    if (picked !== undefined) store.setTool(picked);
  };
  return (
    <section className="flex flex-wrap items-center gap-2" data-terrain-inspect-toolbar="" aria-label={t(`${NS}.toolLabel`)}>
      <SegmentedControl value={tool} onValueChange={onValueChange} aria-label={t(`${NS}.toolLabel`)}>
        {TERRAIN_INSPECT_TOOLS.map((option) => (
          <SegmentedControlItem key={option} value={option}>{t(TOOL_LABEL[option])}</SegmentedControlItem>
        ))}
      </SegmentedControl>
      {tool === 'profile' && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}.hint`)}</p>}
      {hasLine && (
        <Button type="button" variant="outline" size="sm" onClick={store.clearProfile}>{t(`${NS}.clear`)}</Button>
      )}
    </section>
  );
}
