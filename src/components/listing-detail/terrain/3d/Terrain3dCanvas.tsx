'use client';

/**
 * @fileoverview **Ο ΚΑΜΒΑΣ ΤΟΥ ΕΔΑΦΟΥΣ ΣΕ 3Δ** — φορτώνεται ΜΟΝΟ μέσω `dynamic({ ssr: false })` (ADR-920 §14.5).
 * @related `../TerrainViewStage.tsx` (ο μόνος εισαγωγέας, δυναμικά) · `useTerrain3dEngine.ts` · `terrain-3d-engine.ts`
 * @module components/listing-detail/terrain/3d/Terrain3dCanvas
 *
 * ⛔ **Ποτέ στατικό `import` αυτού του αρχείου**: θα έσερνε το `three` στο αρχικό πακέτο κάθε σελίδας αγγελίας.
 * 🔑 **Η κάθετη υπερβολή φαίνεται ΠΑΝΩ ΣΤΗ ΣΚΗΝΗ**, όχι μόνο στο κουμπί: ένα στιγμιότυπο οθόνης με 3× χωρίς ένδειξη θα
 *   έκανε έναν ήπιο λόφο να μοιάζει γκρεμός.
 * ♿ Ο καμβάς παίρνει εστίαση (βέλη = μετακίνηση) και ετικέτα· η `figcaption` λέει στον αναγνώστη οθόνης τι βλέπει, και
 *   το κουμπί «Αρχική όψη» κάνει με το πληκτρολόγιο ό,τι το σπίτι του κύβου με το ποντίκι.
 * 🔍 **Επιθεώρηση (ADR-920 §14.10 Ε2)**: η ΙΔΙΑ κάρτα με την κάτοψη, πάνω αριστερά (ο κύβος πιάνει πάνω δεξιά)· όταν ο δείκτης
 *   είναι εκεί, κατεβαίνει αριστερά πάνω από την ένδειξη υπερβολής. Esc καθαρίζει. Τα βέλη μένουν της τροχιάς.
 */

import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ViewCubeOptions } from '@/lib/three/view-cube/view-cube';
import type { ListingTerrain3dExaggeration } from '@/lib/terrain/publication/listing-terrain-config';
import { buildTerrain3dGeometry, type Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';

import { TerrainInspectAnnouncer, TerrainInspectCard, type TerrainCardCorner } from '../TerrainInspectCard';
import { useTerrainInspectStore } from '../TerrainInspectContext';
import { clearInspectOnEscape } from '../terrain-inspect-escape';
import type { TerrainInspectStore } from '../terrain-inspect-store';
import type { Terrain3dCanvasProps } from '../terrain-surface-props';
import { useTerrain3dEngine } from './useTerrain3dEngine';
import { useTerrain3dPointer, type Terrain3dPointerApi } from './useTerrain3dPointer';

const NS = 'listing-detail:terrain.view';

type T = ReturnType<typeof useTranslation>['t'];

function cubeLabelsOf(t: T): ViewCubeOptions['labels'] {
  return {
    faces: {
      top: t(`${NS}.cube.faces.top`), bottom: t(`${NS}.cube.faces.bottom`),
      front: t(`${NS}.cube.faces.front`), back: t(`${NS}.cube.faces.back`),
      left: t(`${NS}.cube.faces.left`), right: t(`${NS}.cube.faces.right`),
    },
    compass: {
      n: t(`${NS}.cube.compass.n`), e: t(`${NS}.cube.compass.e`),
      s: t(`${NS}.cube.compass.s`), w: t(`${NS}.cube.compass.w`),
    },
  };
}

export default function Terrain3dCanvas({ snapshot, exaggeration, onFailed }: Terrain3dCanvasProps) {
  const { t } = useTranslation(['listing-detail']);
  const built = useMemo(() => buildTerrain3dGeometry(snapshot, { verticalExaggeration: exaggeration }), [snapshot, exaggeration]);
  useEffect(() => {
    if (!built.ok) onFailed();
  }, [built, onFailed]);
  if (!built.ok) return null;
  return <Terrain3dFigure geometry={built.geometry} exaggeration={exaggeration} onFailed={onFailed} t={t} />;
}

interface Terrain3dFigureProps {
  readonly geometry: Terrain3dGeometry;
  readonly exaggeration: ListingTerrain3dExaggeration;
  readonly onFailed: () => void;
  readonly t: T;
}

/** Η κάρτα του σημείου στο 3Δ: πάνω αριστερά, ή χαμηλά αριστερά όταν ο δείκτης βρίσκεται πάνω αριστερά. */
function Terrain3dInspect({ pointer }: { readonly pointer: Terrain3dPointerApi }) {
  const cornerOf = useCallback(
    (): TerrainCardCorner => (pointer.quadrant() === 'top-left' ? 'bottom-left-raised' : 'top-left'),
    [pointer],
  );
  return (
    <>
      <TerrainInspectCard cornerOf={cornerOf} />
      <TerrainInspectAnnouncer />
    </>
  );
}

/** Esc = καθάρισμα της επιθεώρησης, από το ΕΝΑ σημείο (`terrain-inspect-escape.ts`)· τα βέλη ανήκουν στην τροχιά. */
function clearOnEscape(store: TerrainInspectStore) {
  return (e: KeyboardEvent<HTMLCanvasElement>): void => {
    clearInspectOnEscape(store, e);
  };
}

function Terrain3dFigure({ geometry, exaggeration, onFailed, t }: Terrain3dFigureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cubeHostRef = useRef<HTMLDivElement>(null);
  const cubeLabels = useMemo(() => cubeLabelsOf(t), [t]);
  const store = useTerrainInspectStore();
  const { home, getEngine } = useTerrain3dEngine({ canvasRef, cubeHostRef, geometry, cubeLabels, onContextLost: onFailed, inspect: store });
  const pointer = useTerrain3dPointer({ getEngine, store });
  return (
    <figure className="relative m-0 h-full w-full" data-terrain-3d="">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={t(`${NS}.threeD.canvasLabel`)}
        className="block h-full w-full cursor-grab touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        {...(store ? { ...pointer.handlers, onKeyDown: clearOnEscape(store) } : {})}
      />
      {/* Ο κύβος προσθέτει εδώ το επίπεδο αφής του (απόλυτη θέση, πάνω δεξιά)· το δοχείο δεν πιάνει δείκτη. */}
      <div ref={cubeHostRef} className="pointer-events-none absolute inset-0" />
      {exaggeration !== 1 && (
        <p className="absolute bottom-2 left-2 m-0 max-w-[70%] rounded-md bg-background/85 px-2 py-1 text-xs text-foreground" data-terrain-exaggeration-badge="">
          {t(`${NS}.exaggeration.badge`, { value: exaggeration })}
        </p>
      )}
      <Button type="button" variant="secondary" size="sm" className="absolute bottom-2 right-2" onClick={home}>
        {t(`${NS}.threeD.home`)}
      </Button>
      {store && <Terrain3dInspect pointer={pointer} />}
      <figcaption className="sr-only">{t(`${NS}.threeD.description`)}</figcaption>
    </figure>
  );
}
