'use client';

/**
 * @fileoverview ADR-920 §14.12 **Β4** — η σελίδα μέτρησης της σύντηξης υψομέτρων, πάνω στο **πρωτόκολλο της παραγωγής**.
 *
 * Ένα **συνθετικό** οικόπεδο (όχι μέτρηση) γίνεται κανονικό στιγμιότυπο εδάφους και δίνεται στο `terrain-fusion://`
 * (`lib/terrain/elevation-fusion/fusion-tile-protocol.ts`)· η MapLibre το ζωγραφίζει ως **ένα** έδαφος. Η σελίδα δεν έχει
 * δικό της ψηφιδωτή, Worker ή πρωτόκολλο: ό,τι μετρά είναι ο κώδικας που θα δει ο επισκέπτης. **Παράγει αριθμούς**· δεν
 * κρίνει. Ό,τι κρίνεται με το μάτι (ραφή, οξύτητα γραμμών) έχει κουμπιά όψης, όχι αριθμό.
 *
 * ⚠️ Προσωρινή: ζει στην παραγωγή μόνο ως τη δηλωμένη ημερομηνία (`isTerrainFusionProbeRouteEnabled`).
 */

import { useCallback, useRef, useState, type RefObject } from 'react';

import type { Map as MapLibreMap } from 'maplibre-gl';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_BASEMAP_SOURCE_ID } from '@/lib/maps/basemap-catalog';
import { Map, registerMapProtocol, type MapRef } from '@/lib/maps/maplibre';
import { protomapsStyle } from '@/lib/maps/protomaps-style';
import {
  ensureElevationFusionProtocol,
  retainElevationFusionSurface,
  type ElevationFusionSurfaceHandle,
} from '@/lib/terrain/elevation-fusion/fusion-tile-protocol';
import { terrainFusionSurfaceOf, type TerrainFusionSurface } from '@/lib/terrain/elevation-fusion/terrain-fusion-surface';
import type { ListingTerrainSnapshot } from '@/lib/terrain/publication/listing-terrain-types';
import type { GeoPoint } from '@/types/geo/coordinates';

import { addOverlays, retargetFusedTiles, setExaggeration, setFusedSource, setHairlinesVisible, setRelief } from './probe-map';
import {
  checkTerrainQuery,
  coarseHeightAt,
  jsHeapMb,
  measureFlight,
  measureSeam,
  probeEnvironment,
  startTileLog,
  sweepViews,
  waitForIdle,
} from './probe-measurements';
import { buildProbeSnapshot } from './synthetic-site';
import styles from './terrain-fusion.module.css';

/** Το κέντρο της δοκιμής — 1,4 km μακριά από το πλησιέστερο σύνορο πλακιδίου z12 του χοντρού. */
const CENTER: GeoPoint = { lng: 23.0985, lat: 40.5932 };

/** Από εδώ διαβάζονται τα αποτελέσματα (άνθρωπος ή αυτοματισμός). */
const RESULTS_ELEMENT_ID = 'terrain-fusion-results';

interface Settings {
  readonly offsetM: number;
  readonly transitionM: number;
  readonly exaggeration: number;
  readonly maxZoom: number;
  readonly relief: boolean;
  readonly hairlines: boolean;
}

const INITIAL: Settings = { offsetM: 0, transitionM: 30, exaggeration: 1, maxZoom: 18, relief: true, hairlines: true };

interface ChoiceProps<T extends string | number | boolean> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly (readonly [T, string])[];
  readonly onChange: (value: T) => void;
}

function Choice<T extends string | number | boolean>({ label, value, options, onChange }: ChoiceProps<T>) {
  const selected = String(options.findIndex(([option]) => option === value));
  return (
    <label>
      {label}
      <Select value={selected} onValueChange={(index) => onChange(options[Number(index)][0])}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([, text], index) => (
            <SelectItem key={text} value={String(index)}>{text}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/** Ό,τι κρατά η σελίδα για τον χάρτη της: το στιγμιότυπο, η λαβή του στο πρωτόκολλο, και η επιφάνεια (για τα όργανα). */
interface ProbeState {
  readonly map: MapLibreMap;
  readonly baseElevationM: number;
  snapshot: ListingTerrainSnapshot;
  handle: ElevationFusionSurfaceHandle;
  surface: TerrainFusionSurface;
}

function surfaceOf(snapshot: ListingTerrainSnapshot, transitionM: number): TerrainFusionSurface {
  const surface = terrainFusionSurfaceOf(snapshot, transitionM);
  if (surface === null) throw new Error('terrain-fusion probe: the synthetic snapshot carries no georeference');
  return surface;
}

function snapshotFor(baseElevationM: number, offsetM: number): ListingTerrainSnapshot {
  return buildProbeSnapshot({ center: CENTER, baseElevationM, offsetM, gridStepM: 2 });
}

/** Δίνει στο πρωτόκολλο το `snapshot` ως τη νέα επιφάνεια της σελίδας και αφήνει την προηγούμενη. */
function serve(probe: ProbeState, snapshot: ListingTerrainSnapshot, transitionM: number): void {
  const previous = probe.handle;
  probe.snapshot = snapshot;
  probe.handle = retainElevationFusionSurface(snapshot, transitionM);
  probe.surface = surfaceOf(snapshot, transitionM);
  if (previous !== probe.handle) previous.release();
}

/** Φέρνει τον χάρτη στις ρυθμίσεις `next`· `previous === null` ⇒ πρώτη εφαρμογή. */
function applySettings(probe: ProbeState, next: Settings, previous: Settings | null): void {
  const { map } = probe;
  const offsetChanged = previous !== null && previous.offsetM !== next.offsetM;
  const surfaceChanged = offsetChanged || (previous !== null && previous.transitionM !== next.transitionM);
  if (surfaceChanged) serve(probe, offsetChanged ? snapshotFor(probe.baseElevationM, next.offsetM) : probe.snapshot, next.transitionM);
  if (previous === null || previous.maxZoom !== next.maxZoom) setFusedSource(map, probe.handle.tileTemplate, next.maxZoom, next.exaggeration);
  else if (surfaceChanged) retargetFusedTiles(map, probe.handle.tileTemplate);
  if (previous !== null && previous.exaggeration !== next.exaggeration) setExaggeration(map, next.exaggeration);
  addOverlays(map, probe.surface);
  setRelief(map, next.relief);
  setHairlinesVisible(map, next.hairlines);
}

/**
 * Η ίδια επιφάνεια ως **νέο αντικείμενο** ⇒ νέο κλειδί ⇒ νέα διεύθυνση πλακιδίων: ο χάρτης και ο χειριστής ξεχνούν ό,τι
 * είχαν ψηφιδώσει. Έτσι μια μέτρηση ξεκινά από άδεια μνήμη πλακιδίων (τα χοντρά μένουν στη μνήμη του αναγνώστη).
 */
function renewOf(probe: ProbeState, transitionM: number): () => void {
  return () => {
    serve(probe, { ...probe.snapshot }, transitionM);
    retargetFusedTiles(probe.map, probe.handle.tileTemplate);
  };
}

type Results = Readonly<Record<string, unknown>>;

interface Probe {
  readonly mapRef: RefObject<MapRef | null>;
  readonly settings: Settings;
  readonly results: Results;
  readonly busy: string | null;
  readonly onLoad: () => void;
  readonly change: (patch: Partial<Settings>) => void;
  readonly look: (view: { readonly zoom?: number; readonly pitch?: number }) => void;
  readonly run: (name: string, measure: (probe: ProbeState) => Promise<unknown>) => void;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function createProbeState(map: MapLibreMap, baseElevationM: number): ProbeState {
  const snapshot = snapshotFor(baseElevationM, INITIAL.offsetM);
  return {
    map,
    baseElevationM,
    snapshot,
    handle: retainElevationFusionSurface(snapshot, INITIAL.transitionM),
    surface: surfaceOf(snapshot, INITIAL.transitionM),
  };
}

function useProbe(): Probe {
  const mapRef = useRef<MapRef | null>(null);
  const probeRef = useRef<ProbeState | null>(null);
  const settingsRef = useRef<Settings>(INITIAL);
  const [settings, setSettings] = useState<Settings>(INITIAL);
  const [results, setResults] = useState<Results>({});
  const [busy, setBusy] = useState<string | null>('φόρτωση χάρτη');

  const record = useCallback((name: string, value: unknown) => setResults((known) => ({ ...known, [name]: value })), []);

  const run = useCallback<Probe['run']>((name, measure) => {
    const probe = probeRef.current;
    if (probe === null) return;
    setBusy(name);
    measure(probe)
      .then((value) => record(name, value), (error: unknown) => record(name, { error: errorText(error) }))
      .finally(() => setBusy(null));
  }, [record]);

  const onLoad = useCallback(() => {
    const map: MapLibreMap | undefined = mapRef.current?.getMap();
    if (map === undefined || probeRef.current !== null) return;
    ensureElevationFusionProtocol(registerMapProtocol);
    startTileLog();
    coarseHeightAt(CENTER)
      .then((base) => {
        const probe = createProbeState(map, base ?? 0);
        probeRef.current = probe;
        applySettings(probe, INITIAL, null);
        const { mesh } = probe.snapshot;
        record('environment', {
          environment: probeEnvironment(map),
          center: CENTER,
          coarseHeightAtCenterM: base,
          meshTriangles: mesh.triangles.length / 3,
          rimEdges: probe.surface.rim.length,
          frameLattice: probe.surface.frameLattice !== null,
        });
      })
      .catch((error: unknown) => record('environment', { error: errorText(error) }))
      .finally(() => setBusy(null));
  }, [record]);

  const change = useCallback<Probe['change']>((patch) => {
    const probe = probeRef.current;
    if (probe === null) return;
    const next = { ...settingsRef.current, ...patch };
    applySettings(probe, next, settingsRef.current);
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const look = useCallback<Probe['look']>((view) => {
    probeRef.current?.map.easeTo({ center: [CENTER.lng, CENTER.lat], ...view, duration: 800 });
  }, []);

  return { mapRef, settings, results, busy, onLoad, change, look, run };
}

async function measureTerrainQuery(probe: ProbeState): Promise<unknown> {
  probe.map.jumpTo({ center: [CENTER.lng, CENTER.lat], zoom: 19, pitch: 0, bearing: 0 });
  await waitForIdle(probe.map);
  return checkTerrainQuery(probe.map, probe.surface, probe.handle.key);
}

function Controls({ probe }: { readonly probe: Probe }) {
  const { settings, change } = probe;
  return (
    <fieldset className={styles.controls}>
      <legend>Ρυθμίσεις</legend>
      <Choice label="Μετατόπιση «μέτρησης»" value={settings.offsetM} onChange={(offsetM) => change({ offsetM })} options={[[-4, '−4 m'], [-2, '−2 m'], [0, '0 m'], [2, '+2 m'], [4, '+4 m']]} />
      <Choice label="Ζώνη μετάβασης" value={settings.transitionM} onChange={(transitionM) => change({ transitionM })} options={[[0, '0 m (σκαλοπάτι)'], [15, '15 m'], [30, '30 m'], [45, '45 m']]} />
      <Choice label="Υπερύψωση" value={settings.exaggeration} onChange={(exaggeration) => change({ exaggeration })} options={[[1, '×1'], [1.5, '×1,5'], [2, '×2']]} />
      <Choice label="Βαθύτερο ζουμ πηγής εδάφους" value={settings.maxZoom} onChange={(maxZoom) => change({ maxZoom })} options={[[16, 'z16'], [18, 'z18'], [20, 'z20']]} />
      <Choice label="Σκίαση γύρω χώρου (2η πηγή)" value={settings.relief} onChange={(relief) => change({ relief })} options={[[true, 'ναι'], [false, 'όχι']]} />
      <Choice label="Γραμμές δοκιμής 1 px" value={settings.hairlines} onChange={(hairlines) => change({ hairlines })} options={[[true, 'ναι'], [false, 'όχι']]} />
    </fieldset>
  );
}

function Actions({ probe }: { readonly probe: Probe }) {
  const { run, look, settings, busy } = probe;
  const idle = busy === null;
  const zone = settings.transitionM;
  return (
    <nav className={styles.actions} aria-label="Όψεις και μετρήσεις">
      <Button size="sm" variant="outline" onClick={() => look({ pitch: 0 })}>Κάτοψη 0°</Button>
      <Button size="sm" variant="outline" onClick={() => look({ pitch: 60 })}>3Δ 60°</Button>
      <Button size="sm" variant="outline" onClick={() => look({ pitch: 80 })}>3Δ 80°</Button>
      <Button size="sm" variant="outline" onClick={() => look({ zoom: 18 })}>z18</Button>
      <Button size="sm" variant="outline" onClick={() => look({ zoom: 20 })}>z20</Button>
      <Button size="sm" variant="outline" onClick={() => look({ zoom: 22 })}>z22</Button>
      <Button size="sm" disabled={!idle} onClick={() => run(`a_views_zone${zone}`, (p) => sweepViews(p.map, CENTER, renewOf(p, zone)))}>(α) Όψεις</Button>
      <Button size="sm" disabled={!idle} onClick={() => run(`b_flight_zone${zone}`, (p) => measureFlight(p.map, CENTER, renewOf(p, zone)))}>(β) Πτήση</Button>
      <Button size="sm" disabled={!idle} onClick={() => run('c_terrain_query', measureTerrainQuery)}>(γ) Ύψη χάρτη</Button>
      <Button size="sm" disabled={!idle} onClick={() => run(`d_seam_offset${settings.offsetM}_zone${zone}`, (p) => measureSeam(p.surface))}>(δ) Χείλος</Button>
      <Button size="sm" disabled={!idle} onClick={() => run(`f_memory_relief_${settings.relief ? 'on' : 'off'}`, async () => ({ jsHeapMb: jsHeapMb(), gpuMemory: null, workerHeap: null }))}>(στ) Μνήμη</Button>
    </nav>
  );
}

export default function TerrainFusionHarness() {
  const probe = useProbe();
  return (
    <main className={styles.page}>
      <h1>Σύντηξη υψομέτρων πάνω στον χάρτη — μέτρηση του πρωτοκόλλου (Β4)</h1>
      <p className={styles.note}>
        Το κόκκινο περίγραμμα είναι το χείλος ενός <strong>συνθετικού</strong> οικοπέδου· τα ύψη μέσα του βγαίνουν από τύπο,
        όχι από αποτύπωση. Γύρω του το ανάγλυφο είναι Copernicus GLO-30 (μοντέλο επιφάνειας, ±4 m). Η σελίδα μετρά· δεν κρίνει.
      </p>
      <Controls probe={probe} />
      <Actions probe={probe} />
      <p role="status" aria-live="polite">{probe.busy === null ? 'Έτοιμο.' : `Τρέχει: ${probe.busy}…`}</p>
      <figure>
        <div className={styles.mapCanvas}>
          <Map
            ref={probe.mapRef}
            mapStyle={protomapsStyle(DEFAULT_BASEMAP_SOURCE_ID, 'light')}
            initialViewState={{ longitude: CENTER.lng, latitude: CENTER.lat, zoom: 17.5, pitch: 60, bearing: 30 }}
            maxPitch={85}
            maxZoom={22}
            onLoad={probe.onLoad}
          />
        </div>
        <figcaption className={styles.note}>Ένα έδαφος: μετρημένα ύψη μέσα στο χείλος, χοντρά έξω, ζώνη μετάβασης ανάμεσα.</figcaption>
      </figure>
      <section aria-label="Αποτελέσματα">
        <h2>Αποτελέσματα</h2>
        <pre id={RESULTS_ELEMENT_ID} className={styles.results}>{JSON.stringify(probe.results, null, 2)}</pre>
      </section>
    </main>
  );
}
