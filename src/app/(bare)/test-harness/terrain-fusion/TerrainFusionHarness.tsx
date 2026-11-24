'use client';

/**
 * @fileoverview ADR-920 §14.12 **Β0** — δοκιμή εφικτότητας της σύντηξης υψομέτρων πάνω στη MapLibre.
 *
 * Ένα **συνθετικό** οικόπεδο (όχι μέτρηση) ψηφιδώνεται μέσα στο χοντρό ανάγλυφο από πρωτότυπο πρωτοκόλλου πλακιδίων,
 * και η MapLibre το ζωγραφίζει ως **ένα** έδαφος. Η σελίδα **παράγει αριθμούς** για τα (α)–(στ) του σχεδίου· δεν
 * κρίνει. Ό,τι κρίνεται με το μάτι (ραφή, οξύτητα γραμμών) έχει κουμπιά όψης, όχι αριθμό.
 *
 * ⚠️ Προσωρινή: ζει στην παραγωγή μόνο όσο διαρκεί το Β0 (`isTerrainFusionProbeRouteEnabled`).
 */

import { useCallback, useRef, useState, type RefObject } from 'react';

import type { Map as MapLibreMap } from 'maplibre-gl';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_BASEMAP_SOURCE_ID } from '@/lib/maps/basemap-catalog';
import { Map, type MapRef } from '@/lib/maps/maplibre';
import { protomapsStyle } from '@/lib/maps/protomaps-style';

import type { LngLat } from './fusion-math';
import { configureFusion, ensureFusionProtocol, type FusionMode } from './fusion-protocol';
import { addOverlays, reloadFusedTiles, setExaggeration, setFusedSource, setHairlinesVisible, setRelief } from './probe-map';
import {
  checkBitmapFidelity,
  checkTerrainQuery,
  coarseHeightAt,
  jsHeapMb,
  measureFlight,
  measureSeam,
  probeEnvironment,
  sweepViews,
  waitForIdle,
} from './probe-measurements';
import { buildProbeSurface, type ProbeSurface } from './synthetic-site';
import styles from './terrain-fusion.module.css';

/** Το κέντρο της δοκιμής — 1,4 km μακριά από το πλησιέστερο σύνορο πλακιδίου z12 του χοντρού. */
const CENTER: LngLat = { lng: 23.0985, lat: 40.5932 };

/** Από εδώ διαβάζονται τα αποτελέσματα (άνθρωπος ή αυτοματισμός). */
const RESULTS_ELEMENT_ID = 'terrain-fusion-results';

interface Settings {
  readonly mode: FusionMode;
  readonly offsetM: number;
  readonly transitionM: number;
  readonly exaggeration: number;
  readonly maxZoom: number;
  readonly relief: boolean;
  readonly hairlines: boolean;
}

const INITIAL: Settings = { mode: 'worker', offsetM: 0, transitionM: 30, exaggeration: 1, maxZoom: 18, relief: true, hairlines: true };

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

interface ProbeState {
  readonly map: MapLibreMap;
  surface: ProbeSurface;
  baseElevationM: number;
  revision: number;
}

function surfaceFor(baseElevationM: number, settings: Settings): ProbeSurface {
  const { offsetM, transitionM } = settings;
  return buildProbeSurface({ center: CENTER, baseElevationM, offsetM, transitionM, gridStepM: 2 });
}

/** Φέρνει τον χάρτη στις ρυθμίσεις `next`· `previous === null` ⇒ πρώτη εφαρμογή. */
function applySettings(probe: ProbeState, next: Settings, previous: Settings | null): void {
  const { map } = probe;
  probe.surface = surfaceFor(probe.baseElevationM, next);
  configureFusion({ mode: next.mode, surface: probe.surface.spec });
  const surfaceChanged =
    previous === null || previous.mode !== next.mode || previous.offsetM !== next.offsetM || previous.transitionM !== next.transitionM;
  if (previous === null || previous.maxZoom !== next.maxZoom) setFusedSource(map, ++probe.revision, next.maxZoom, next.exaggeration);
  else if (surfaceChanged) reloadFusedTiles(map, ++probe.revision);
  if (previous !== null && previous.exaggeration !== next.exaggeration) setExaggeration(map, next.exaggeration);
  addOverlays(map, probe.surface);
  setRelief(map, next.relief);
  setHairlinesVisible(map, next.hairlines);
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
      .then((value) => record(name, value), (error: unknown) => record(name, { error: error instanceof Error ? error.message : String(error) }))
      .finally(() => setBusy(null));
  }, [record]);

  const onLoad = useCallback(() => {
    const map: MapLibreMap | undefined = mapRef.current?.getMap();
    if (map === undefined || probeRef.current !== null) return;
    ensureFusionProtocol();
    void coarseHeightAt(INITIAL.mode, CENTER).then((base) => {
      const probe: ProbeState = { map, baseElevationM: base ?? 0, revision: 0, surface: surfaceFor(base ?? 0, INITIAL) };
      probeRef.current = probe;
      applySettings(probe, INITIAL, null);
      const { pointCount, triangleCount } = probe.surface;
      record('environment', { ...probeEnvironment(map), center: CENTER, coarseHeightAtCenterM: base, tinPoints: pointCount, tinTriangles: triangleCount });
      setBusy(null);
    }, (error: unknown) => {
      record('environment', { error: error instanceof Error ? error.message : String(error) });
      setBusy(null);
    });
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

function reloadOf(probe: ProbeState): () => void {
  return () => reloadFusedTiles(probe.map, ++probe.revision);
}

async function measureFidelity(probe: ProbeState): Promise<unknown> {
  probe.map.jumpTo({ center: [CENTER.lng, CENTER.lat], zoom: 19, pitch: 0, bearing: 0 });
  await waitForIdle(probe.map);
  return {
    worker: await checkBitmapFidelity('worker', CENTER, probe.surface),
    main: await checkBitmapFidelity('main', CENTER, probe.surface),
    terrainQuery: checkTerrainQuery(probe.map, probe.surface),
  };
}

function Controls({ probe }: { readonly probe: Probe }) {
  const { settings, change } = probe;
  return (
    <fieldset className={styles.controls}>
      <legend>Ρυθμίσεις</legend>
      <Choice label="Ψηφίδωση" value={settings.mode} onChange={(mode) => change({ mode })} options={[['worker', 'Worker'], ['main', 'Κύριο νήμα']]} />
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
  return (
    <nav className={styles.actions} aria-label="Όψεις και μετρήσεις">
      <Button size="sm" variant="outline" onClick={() => look({ pitch: 0 })}>Κάτοψη 0°</Button>
      <Button size="sm" variant="outline" onClick={() => look({ pitch: 60 })}>3Δ 60°</Button>
      <Button size="sm" variant="outline" onClick={() => look({ pitch: 80 })}>3Δ 80°</Button>
      <Button size="sm" variant="outline" onClick={() => look({ zoom: 18 })}>z18</Button>
      <Button size="sm" variant="outline" onClick={() => look({ zoom: 20 })}>z20</Button>
      <Button size="sm" variant="outline" onClick={() => look({ zoom: 22 })}>z22</Button>
      <Button size="sm" disabled={!idle} onClick={() => run('a_views', (p) => sweepViews(p.map, CENTER, reloadOf(p)))}>(α) Όψεις</Button>
      <Button size="sm" disabled={!idle} onClick={() => run(`b_flight_${settings.mode}`, (p) => measureFlight(p.map, CENTER, settings.mode, reloadOf(p)))}>(β) Πτήση</Button>
      <Button size="sm" disabled={!idle} onClick={() => run('c_fidelity', measureFidelity)}>(γ) Πιστότητα</Button>
      <Button size="sm" disabled={!idle} onClick={() => run(`d_seam_offset${settings.offsetM}_zone${settings.transitionM}`, (p) => measureSeam(settings.mode, p.surface))}>(δ) Ακμή</Button>
      <Button size="sm" disabled={!idle} onClick={() => run(`f_memory_relief_${settings.relief ? 'on' : 'off'}`, async () => ({ jsHeapMb: jsHeapMb(), gpuMemory: null }))}>(στ) Μνήμη</Button>
    </nav>
  );
}

export default function TerrainFusionHarness() {
  const probe = useProbe();
  return (
    <main className={styles.page}>
      <h1>Σύντηξη υψομέτρων πάνω στον χάρτη — δοκιμή εφικτότητας (Β0)</h1>
      <p className={styles.note}>
        Το κόκκινο περίγραμμα είναι <strong>συνθετικό</strong> οικόπεδο· τα ύψη μέσα του βγαίνουν από τύπο, όχι από
        αποτύπωση. Γύρω του το ανάγλυφο είναι Copernicus GLO-30 (μοντέλο επιφάνειας, ±4 m). Η σελίδα μετρά· δεν κρίνει.
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
        <figcaption className={styles.note}>Ένα έδαφος: μετρημένα ύψη μέσα στο περίγραμμα, χοντρά έξω, ζώνη μετάβασης ανάμεσα.</figcaption>
      </figure>
      <section aria-label="Αποτελέσματα">
        <h2>Αποτελέσματα</h2>
        <pre id={RESULTS_ELEMENT_ID} className={styles.results}>{JSON.stringify(probe.results, null, 2)}</pre>
      </section>
    </main>
  );
}
