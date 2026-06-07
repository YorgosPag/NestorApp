'use client';

/**
 * ADR-376 Phase B.1 — Renumber Openings dialog host.
 *
 * Listens to `bim:opening-renumber-requested` EventBus event (emitted από το
 * contextual / annotate ribbon), αρπάζει openings rows + floor.number map από
 * Firestore, και mount-άρει το `RenumberOpeningsDialog`. On confirm →
 * dispatches `RenumberOpeningsCommand` σε CommandHistory (undoable).
 *
 * ADR-040: hosted στο shell layer (DxfViewerContent), δεν διαβάζει high-freq
 * stores. Lazy-loads rows μόνο όταν το dialog ζητηθεί.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { collection, doc, getDoc, getDocs, query, where, type Timestamp } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useAuth } from '@/auth/hooks/useAuth';
import { EventBus } from '../../../systems/events/EventBus';
import { useLevels } from '../../../systems/levels';
import { LevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../../core/commands';
import { RenumberOpeningsCommand } from '../../../core/commands/entity-commands/RenumberOpeningsCommand';
import type { OpeningKind, OpeningParams } from '../../../bim/types/opening-types';
import type { RenumberOpeningRow, RenumberResult } from '../../../bim/services/opening-renumber-service';
import { RenumberOpeningsDialog } from './RenumberOpeningsDialog';

interface OpeningRawDoc {
  readonly kind?: OpeningKind;
  readonly floorId?: string;
  readonly params?: OpeningParams;
  readonly createdAt?: Timestamp | { toMillis?: () => number };
}

function toMillis(value: OpeningRawDoc['createdAt']): number {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    try { return (value as Timestamp).toMillis(); } catch { return 0; }
  }
  return 0;
}

export interface RenumberOpeningsHostProps {
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
}

export function RenumberOpeningsHost(props: RenumberOpeningsHostProps): React.ReactElement | null {
  const { projectId, floorplanId } = props;
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-shell']);
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const levels = useLevels();
  const levelsRef = React.useRef(levels);
  levelsRef.current = levels;
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ReadonlyArray<RenumberOpeningRow>>([]);
  const [floorMap, setFloorMap] = React.useState<ReadonlyMap<string, number>>(new Map());

  // Subscribe to ribbon event — opens dialog + lazy-loads rows.
  React.useEffect(() => {
    const cleanup = EventBus.on('bim:opening-renumber-requested', () => {
      if (!companyId || !projectId || !floorplanId) return;
      void loadRows(companyId, projectId, floorplanId).then(({ rows: loaded, floorIds }) => {
        setRows(loaded);
        // Belt-and-suspenders: also include floor IDs from the level list so
        // currentFloor resolves even when no openings exist yet on that floor.
        const allFloorIds = new Set(floorIds);
        for (const lvl of levelsRef.current.levels) {
          if (lvl.floorId) allFloorIds.add(lvl.floorId);
        }
        void loadFloorMap(Array.from(allFloorIds)).then(setFloorMap);
        setOpen(true);
      });
    });
    return () => cleanup();
  }, [companyId, projectId, floorplanId]);

  const currentLevel = levels.levels.find((l) => l.id === levels.currentLevelId) ?? null;
  const currentFloorId = currentLevel?.floorId ?? null;
  const currentFloorNumber = currentFloorId ? floorMap.get(currentFloorId) : undefined;

  const currentFloor = React.useMemo(
    () => (currentFloorId && typeof currentFloorNumber === 'number'
      ? { floorId: currentFloorId, floorNumber: currentFloorNumber }
      : null),
    [currentFloorId, currentFloorNumber],
  );

  const kindPrefixes: Record<OpeningKind, string> = React.useMemo(() => ({
    door: t('dxf-viewer:opening.tag.prefix.door'),
    'double-door': t('dxf-viewer:opening.tag.prefix.double-door'),
    'sliding-door': t('dxf-viewer:opening.tag.prefix.sliding-door'),
    'double-sliding-door': t('dxf-viewer:opening.tag.prefix.double-sliding-door'),
    'pocket-door': t('dxf-viewer:opening.tag.prefix.pocket-door'),
    'bifold-door': t('dxf-viewer:opening.tag.prefix.bifold-door'),
    'overhead-door': t('dxf-viewer:opening.tag.prefix.overhead-door'),
    'revolving-door': t('dxf-viewer:opening.tag.prefix.revolving-door'),
    'french-door': t('dxf-viewer:opening.tag.prefix.french-door'),
    window: t('dxf-viewer:opening.tag.prefix.window'),
    fixed: t('dxf-viewer:opening.tag.prefix.fixed'),
    'double-hung-window': t('dxf-viewer:opening.tag.prefix.double-hung-window'),
    'sliding-window': t('dxf-viewer:opening.tag.prefix.sliding-window'),
    'awning-window': t('dxf-viewer:opening.tag.prefix.awning-window'),
    'hopper-window': t('dxf-viewer:opening.tag.prefix.hopper-window'),
    'tilt-turn-window': t('dxf-viewer:opening.tag.prefix.tilt-turn-window'),
    'bay-window': t('dxf-viewer:opening.tag.prefix.bay-window'),
  }), [t]);
  const basementPrefix = t('dxf-viewer:opening.tag.basementPrefix');

  const handleConfirm = React.useCallback((result: RenumberResult) => {
    if (!levels.currentLevelId || !user?.uid) return;
    if (result.updates.length === 0) return;
    const sceneManager = new LevelSceneManagerAdapter(
      levels.getLevelScene,
      levels.setLevelScene,
      levels.currentLevelId,
    );
    getGlobalCommandHistory().execute(
      new RenumberOpeningsCommand(result.updates, sceneManager, user.uid),
    );
  }, [levels, user?.uid]);

  if (!companyId || !projectId || !floorplanId) return null;

  return (
    <RenumberOpeningsDialog
      open={open}
      onOpenChange={setOpen}
      rows={rows}
      currentFloor={currentFloor}
      floorNumberByFloorId={floorMap}
      kindPrefixes={kindPrefixes}
      basementPrefix={basementPrefix}
      onConfirm={handleConfirm}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

async function loadRows(
  companyId: string,
  projectId: string,
  floorplanId: string,
): Promise<{ rows: RenumberOpeningRow[]; floorIds: string[] }> {
  const q = query(
    collection(db, COLLECTIONS.FLOORPLAN_OPENINGS),
    where('companyId', '==', companyId),
    where('projectId', '==', projectId),
    where('floorplanId', '==', floorplanId),
  );
  const snap = await getDocs(q);
  const rows: RenumberOpeningRow[] = [];
  const floorIds = new Set<string>();
  snap.forEach((d) => {
    const data = d.data() as OpeningRawDoc;
    if (!data.kind || !data.params) return;
    rows.push({
      id: d.id,
      kind: data.kind,
      floorId: data.floorId,
      params: data.params,
      createdAtMillis: toMillis(data.createdAt),
    });
    if (data.floorId) floorIds.add(data.floorId);
  });
  return { rows, floorIds: Array.from(floorIds) };
}

async function loadFloorMap(floorIds: ReadonlyArray<string>): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const snaps = await Promise.all(
    floorIds.map((id) => getDoc(doc(db, COLLECTIONS.FLOORS, id)).catch(() => null)),
  );
  for (let i = 0; i < floorIds.length; i += 1) {
    const s = snaps[i];
    if (!s || !s.exists()) continue;
    const data = s.data() as { number?: number };
    if (typeof data.number === 'number') result.set(floorIds[i]!, data.number);
  }
  return result;
}
