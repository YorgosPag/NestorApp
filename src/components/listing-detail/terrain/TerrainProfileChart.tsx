'use client';

/**
 * @fileoverview **Η ΥΨΟΜΕΤΡΙΚΗ ΤΟΜΗ Α → Β** — διάγραμμα, σύνοψη, κλάσεις κλίσης κατά μήκος· hover / βέλη στην τομή ⇒ το ΙΔΙΟ
 *   σημείο στον χάρτη ΚΑΙ στο 3Δ (ADR-920 §14.10 Ε3 — μοτίβο CalTopo / ArcGIS ElevationProfile).
 * @related `@/lib/terrain/inspect/terrain-profile-chart` (τι ζωγραφίζεται — εδώ μόνο ΠΩΣ) · ./terrain-inspect-store
 *   (`hoverProfile`) · ./terrain-map-palette (`TERRAIN_PROFILE_CLASS`)
 * @module components/listing-detail/terrain/TerrainProfileChart
 *
 * 🔑 **Πέρα από τους μεγάλους**: (1) σταθμός σε ΚΑΘΕ ακμή τριγώνου — η τομή είναι ακριβής, όχι δειγματοληψία· (2) η κάθετη
 *   υπερβολή της τομής **δηλώνεται** («κάθετη κλίμακα 6× της οριζόντιας»)· (3) κενά και παρεμβολή φαίνονται, ποτέ δεν κρύβονται·
 *   (4) η λωρίδα κλίσεων έχει τις ΙΔΙΕΣ κλάσεις με τον χάρτη.
 * ♿ Το SVG παίρνει εστίαση: ← → μετακινούν το σημείο (Shift ×10), Home / End στα άκρα· η ανάγνωση του σημείου είναι κείμενο.
 *   Κανένα inline style (N.3): θέσεις σε γνωρίσματα SVG.
 */

import { useCallback, useMemo, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import {
  PROFILE_CHART_HEIGHT, PROFILE_CHART_STRIP_HEIGHT, PROFILE_CHART_WIDTH, profileChartModelOf, profileChartS, profileChartX,
  profileChartY, type ProfileChartModel,
} from '@/lib/terrain/inspect/terrain-profile-chart';
import { profilePointAt, type TerrainProfile } from '@/lib/terrain/inspect/terrain-profile';

import { useTerrainInspect, useTerrainInspectStore } from './TerrainInspectContext';
import type { TerrainInspectState } from './terrain-inspect-store';
import { distanceLabel, elevationLabel, gradeLabel } from './terrain-inspect-words';
import { TERRAIN_PROFILE_CLASS as INK, terrainSlopeFillClass } from './terrain-map-palette';
import { NON_SCALING } from './terrain-map-symbols';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map.profile';
const ELEVATION = 'listing-detail:terrain.map.elevation';
const KEY_STEP_SHARE = 0.01;
const KEY_FAST_FACTOR = 10;

const selectProfile = (s: TerrainInspectState) => s.profile;
const selectHoverS = (s: TerrainInspectState) => s.profileHoverS;

function summaryOf(t: T, profile: TerrainProfile): string {
  return t(`${NS}.summary`, {
    length: distanceLabel(t, profile.lengthM), gain: distanceLabel(t, profile.gainM),
    loss: distanceLabel(t, profile.lossM), grade: gradeLabel(profile.maxGradePct),
  });
}

function pointWords(t: T, profile: TerrainProfile, s: number): string {
  const point = profilePointAt(profile, s);
  const distance = distanceLabel(t, point.s);
  if (point.z === null) return t(`${NS}.noGround`, { distance });
  const piece = profile.pieces.find((p) => p.fromS <= point.s && point.s <= p.toS);
  return t(`${NS}.point`, { distance, elevation: elevationLabel(t, point.z), grade: gradeLabel(piece?.gradePct ?? 0) });
}

/** Φύλλο: η κάθετη γραμμή και η κουκκίδα στο σημείο που δείχνεται. */
function HoverMark({ profile, model }: { readonly profile: TerrainProfile; readonly model: ProfileChartModel }) {
  const s = useTerrainInspect(selectHoverS);
  if (s === null) return null;
  const point = profilePointAt(profile, s);
  const x = profileChartX(profile, point.s);
  return (
    <g data-terrain-profile-hover="" pointerEvents="none">
      <line x1={x} x2={x} y1={0} y2={PROFILE_CHART_HEIGHT} className={INK.hover} strokeWidth={1} {...NON_SCALING} />
      {point.z !== null && (
        <circle cx={x} cy={profileChartY(model, point.z)} r={4} className={INK.hoverDot} strokeWidth={1.5} {...NON_SCALING} />
      )}
    </g>
  );
}

/** Φύλλο: η ανάγνωση του σημείου σε κείμενο. */
function HoverReadout({ profile, t }: { readonly profile: TerrainProfile; readonly t: T }) {
  const s = useTerrainInspect(selectHoverS);
  return <p className="m-0 min-h-4 text-xs tabular-nums text-foreground" data-terrain-profile-readout="">{s === null ? '' : pointWords(t, profile, s)}</p>;
}

function ChartBody({ model }: { readonly model: ProfileChartModel }) {
  return (
    <>
      {model.areaPaths.map((d, i) => <path key={`area-${i}`} d={d} className={INK.area} />)}
      {model.linePaths.map((line, i) => (
        <path key={`line-${i}`} d={line.d} className={line.sparse ? INK.sparseLine : INK.line} strokeWidth={2} strokeLinejoin="round" {...NON_SCALING} />
      ))}
      {model.strip.map((piece, i) => (
        <rect key={`strip-${i}`} x={piece.x} y={model.stripTop} width={Math.max(piece.width, 0.5)} height={PROFILE_CHART_STRIP_HEIGHT}
          className={terrainSlopeFillClass(piece.classIndex)} strokeWidth={0.5} {...NON_SCALING} />
      ))}
    </>
  );
}

/** Δείκτης και πληκτρολόγιο πάνω στην τομή → `hoverProfile` (το ίδιο σημείο σε χάρτη και 3Δ). */
function useProfileHover(profile: TerrainProfile) {
  const store = useTerrainInspectStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const onPointerMove = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix || !store) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    store.hoverProfile(profileChartS(profile, p.x));
  }, [profile, store]);
  const onPointerLeave = useCallback(() => store?.hoverProfile(null), [store]);
  const onKeyDown = useCallback((e: KeyboardEvent<SVGSVGElement>) => {
    if (!store) return;
    const current = store.get().profileHoverS ?? 0;
    const step = profile.lengthM * KEY_STEP_SHARE * (e.shiftKey ? KEY_FAST_FACTOR : 1);
    const next: Record<string, number> = { ArrowRight: current + step, ArrowLeft: current - step, Home: 0, End: profile.lengthM };
    if (!(e.key in next)) return;
    e.preventDefault();
    store.hoverProfile(Math.min(profile.lengthM, Math.max(0, next[e.key])));
  }, [profile, store]);
  return { svgRef, onPointerMove, onPointerLeave, onKeyDown };
}

function ProfileFigure({ profile, bandsPct, t }: { readonly profile: TerrainProfile; readonly bandsPct: readonly number[]; readonly t: T }) {
  const model = useMemo(() => profileChartModelOf(profile, bandsPct), [profile, bandsPct]);
  const hover = useProfileHover(profile);
  const summary = summaryOf(t, profile);
  return (
    <figure className="m-0 flex flex-col gap-1" data-terrain-profile="">
      <figcaption className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-foreground">{t(`${NS}.caption`)}</span>
        <span className="tabular-nums text-foreground">{summary}</span>
        <span className="text-muted-foreground">{t(`${NS}.vertical`, { ratio: formatNumber(model.verticalRatio, { maximumFractionDigits: 1 }) })}</span>
      </figcaption>
      <svg ref={hover.svgRef} viewBox={`0 0 ${PROFILE_CHART_WIDTH} ${PROFILE_CHART_HEIGHT}`} role="img" aria-label={`${t(`${NS}.chartLabel`)} · ${summary}`}
        tabIndex={0} aria-keyshortcuts="ArrowLeft ArrowRight Home End" onPointerMove={hover.onPointerMove} onPointerLeave={hover.onPointerLeave}
        onKeyDown={hover.onKeyDown} className="block h-auto w-full touch-none rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChartBody model={model} />
        <HoverMark profile={profile} model={model} />
      </svg>
      <p className="m-0 flex justify-between gap-2 text-xs tabular-nums text-muted-foreground">
        <span>{t(`${NS}.start`)} · {distanceLabel(t, 0)}</span>
        <span>{distanceLabel(t, profile.lengthM)} · {t(`${NS}.end`)}</span>
      </p>
      {profile.minM !== null && profile.maxM !== null && (
        <p className="m-0 flex justify-between gap-2 text-xs tabular-nums text-foreground">
          <span>{t(`${ELEVATION}.low`, { value: elevationLabel(t, profile.minM) })}</span>
          <span>{t(`${ELEVATION}.high`, { value: elevationLabel(t, profile.maxM) })}</span>
        </p>
      )}
      <HoverReadout profile={profile} t={t} />
      {profile.hasGap && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}.gap`)}</p>}
      {profile.pieces.some((piece) => piece.sparse) && <p className="m-0 text-xs text-muted-foreground">{t(`${NS}.sparse`)}</p>}
    </figure>
  );
}

/** Η τομή, όταν υπάρχει — κάτω από Κάτοψη και 3Δ, κοινή στα δύο. */
export function TerrainProfilePanel({ t }: { readonly t: T }) {
  const store = useTerrainInspectStore();
  const profile = useTerrainInspect(selectProfile);
  if (store === null || profile === null) return null;
  return <ProfileFigure profile={profile} bandsPct={store.index().snapshot.slopeBandsPct} t={t} />;
}
