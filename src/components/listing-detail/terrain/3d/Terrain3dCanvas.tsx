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
 */

import { useEffect, useMemo, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ViewCubeOptions } from '@/lib/three/view-cube/view-cube';
import type { ListingTerrain3dExaggeration } from '@/lib/terrain/publication/listing-terrain-config';
import { buildTerrain3dGeometry, type Terrain3dGeometry } from '@/lib/terrain/publication/terrain-3d-geometry';

import type { Terrain3dCanvasProps } from '../terrain-surface-props';
import { useTerrain3dEngine } from './useTerrain3dEngine';

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

function Terrain3dFigure({ geometry, exaggeration, onFailed, t }: Terrain3dFigureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cubeHostRef = useRef<HTMLDivElement>(null);
  const cubeLabels = useMemo(() => cubeLabelsOf(t), [t]);
  const { home } = useTerrain3dEngine({ canvasRef, cubeHostRef, geometry, cubeLabels, onContextLost: onFailed });
  return (
    <figure className="relative m-0 h-full w-full" data-terrain-3d="">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label={t(`${NS}.threeD.canvasLabel`)}
        className="block h-full w-full cursor-grab touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
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
      <figcaption className="sr-only">{t(`${NS}.threeD.description`)}</figcaption>
    </figure>
  );
}
