'use client';

/**
 * @fileoverview **ΤΟ ΟΡΓΑΝΟ ΤΗΣ ΚΙΝΗΣΗΣ** — πετάει αληθινά, και τυπώνει τι έγινε.
 * @related lib/geo/camera-trajectory · lib/geo/camera-motion · ADR-847 §9
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΣΕΛΙΔΑ
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Το ADR-847 ενοποίησε την κίνηση της κάμερας, πέρασε **κάθε** πύλη, και έφυγε στην
 * ιστορία *(`3d0d715e`)* κάνοντας **κάθε μακρινή πτήση ακαριαίο πήδημα** — `300 χλμ ⇒
 * 2 ms`. Δεκατρία tests ήταν πράσινα, γιατί ρωτούσαν *«κλήθηκε το `flyTo`;»*.
 *
 * 🔑 **Ο πίνακας παρακάτω είναι ΠΑΡΑΓΟΜΕΝΟΣ, όχι γραμμένος.** Είναι το ίδιο ήθος με το
 * `/test-harness/contrast-matrix` *(ADR-770)*: **νέα πηγή τιμών**, όχι νέα μηχανή. Οι
 * αριθμοί του ADR έπαψαν να είναι πρόζα που κάποιος μέτρησε μια φορά με το χέρι.
 *
 * ⚠️ **Η σελίδα ΔΕΝ κρίνει.** Παράγει μετρήσεις· η ετυμηγορία ζει στο
 * `lib/geo/camera-trajectory` *(καθαρό, ελεγμένο σε jest)* και στην πύλη Playwright.
 */

import { useCallback, useRef, useState } from 'react';

import { OSM_MAP_STYLE } from '@/components/projects/ika/map-shared';
import {
  cameraTrajectory,
  didFly,
  readsAsJourney,
  LONG_HOP_DEGREES,
} from '@/lib/geo/camera-trajectory';
import { Map, type MapRef } from '@/lib/maps/maplibre';

import { CAMERA_HOPS, HOME, RESULTS_ELEMENT_ID } from './camera-motion-hops';
import { measureFlight, type FlyableMap } from './measure-flight';
import styles from './camera-motion.module.css';

/** Ό,τι διαβάζει το `.spec.ts`. Σταθερό σχήμα — αλλαγή εδώ σπάει την πύλη, επίτηδες. */
export interface HopResult {
  readonly id: string;
  readonly label: string;
  readonly expectsArc: boolean;
  readonly durationMs: number;
  readonly arcDepth: number;
  readonly spanDegrees: number;
  readonly frames: number;
  readonly flew: boolean;
  readonly journey: boolean;
  /** Το κάδρο τη στιγμή της μέτρησης — **αριθμός χωρίς συνθήκες δεν είναι μέτρηση**. */
  readonly frameWidth: number;
  readonly frameHeight: number;
}

async function runAllHops(map: FlyableMap, frame: { width: number; height: number }): Promise<HopResult[]> {
  const results: HopResult[] = [];
  for (const hop of CAMERA_HOPS) {
    const samples = await measureFlight(map, hop, HOME);
    const trajectory = cameraTrajectory(samples);
    results.push({
      id: hop.id,
      label: hop.label,
      expectsArc: hop.expectsArc,
      durationMs: Math.round(trajectory.durationMs),
      arcDepth: Number(trajectory.arcDepth.toFixed(2)),
      spanDegrees: Number(trajectory.spanDegrees.toFixed(3)),
      frames: trajectory.frames,
      flew: didFly(trajectory),
      journey: readsAsJourney(trajectory),
      frameWidth: frame.width,
      frameHeight: frame.height,
    });
  }
  return results;
}

function ResultRow({ row }: { readonly row: HopResult }) {
  const arcVerdict = row.expectsArc ? (row.journey ? '✅ ταξίδι' : '❌ σύρσιμο') : '—';
  return (
    <tr>
      <td>{row.label}</td>
      <td className={styles.numeric}>{row.durationMs}</td>
      <td className={styles.numeric}>{row.flew ? '✅ πέταξε' : '❌ ΠΗΔΗΞΕ'}</td>
      <td className={styles.numeric}>{row.arcDepth}</td>
      <td>{arcVerdict}</td>
      <td className={styles.numeric}>{row.frames}</td>
    </tr>
  );
}

export default function CameraMotionHarness() {
  const mapRef = useRef<MapRef | null>(null);
  const [rows, setRows] = useState<HopResult[] | null>(null);
  const startedRef = useRef(false);

  const onLoad = useCallback(() => {
    /*
      ⚠️ **Μία φορά, με φρουρό σε `ref`.** Το `onLoad` του react-map-gl μπορεί να ξανακληθεί
      σε αλλαγή στυλ· δύο ταυτόχρονες μετρήσεις πάνω στον ίδιο χάρτη θα αλληλοπατιούνταν
      και η πύλη θα διάβαζε ανακατεμένα καρέ.
    */
    if (startedRef.current) return;
    const map = mapRef.current?.getMap() as unknown as FlyableMap | undefined;
    if (!map) return;
    startedRef.current = true;
    const canvas = map.getCanvas();
    void runAllHops(map, { width: canvas.clientWidth, height: canvas.clientHeight }).then(setRows);
  }, []);

  return (
    <main className={styles.page}>
      <h1>Κίνηση κάμερας χάρτη — μετρημένη, όχι γραμμένη</h1>
      <p>
        Κάθε γραμμή είναι <strong>πραγματική πτήση</strong> με τις επιλογές που στέλνει η
        εφαρμογή (<code>cameraFlight(&apos;travel&apos;)</code>), βηματισμένη με{' '}
        <strong>παγωμένο ρολόι</strong> — άρα οι αριθμοί δεν εξαρτώνται από τον ρυθμό
        καρέ ούτε από το αν η καρτέλα είναι ορατή.
      </p>
      <p className={styles.note}>
        «Καμπύλη» = πόσα επίπεδα ζουμ βυθίστηκε ο χάρτης κάτω από <em>και τα δύο</em> άκρα.
        Απαιτείται μόνο σε άλματα πάνω από {LONG_HOP_DEGREES}° — αλλιώς δεν υπάρχει τίποτα
        να δει κανείς από ψηλά.
      </p>

      <section aria-live="polite">
        {rows === null ? (
          <p data-testid="camera-motion-pending">Μετράει…</p>
        ) : (
          <table className={styles.table}>
            <caption>Αποτελέσματα {rows.length} διαδρομών</caption>
            <thead>
              <tr>
                <th scope="col">Διαδρομή</th>
                <th scope="col">Διάρκεια (ms)</th>
                <th scope="col">Πέταξε;</th>
                <th scope="col">Καμπύλη</th>
                <th scope="col">Διαβάζεται ως</th>
                <th scope="col">Καρέ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => <ResultRow key={row.id} row={row} />)}
            </tbody>
          </table>
        )}
      </section>

      {rows !== null && (
        <script
          type="application/json"
          id={RESULTS_ELEMENT_ID}
          // eslint-disable-next-line react/no-danger -- δικά μας δεδομένα, σε `application/json` που ΔΕΝ εκτελείται
          dangerouslySetInnerHTML={{ __html: JSON.stringify(rows) }}
        />
      )}

      <figure className={styles.mapFrame}>
        {/*
          ⚠️ **Δικό του δοχείο με ΡΗΤΟ ύψος, και δεν είναι διακόσμηση.** Το `react-map-gl`
          δίνει στο `<div>` του **inline** `height: 100%`· χωρίς γονέα με ύψος λύνεται σε
          **0**, και η μέτρηση τρέχει σε κάδρο `958×0` **βγάζοντας εύλογους αριθμούς**.
        */}
        <div className={styles.mapCanvas}>
          <Map ref={mapRef} mapStyle={OSM_MAP_STYLE} initialViewState={{ longitude: HOME.center[0], latitude: HOME.center[1], zoom: HOME.zoom }} onLoad={onLoad} />
        </div>
        <figcaption>Ο χάρτης που μετριέται — ίδιο στυλ με την εφαρμογή.</figcaption>
      </figure>
    </main>
  );
}
