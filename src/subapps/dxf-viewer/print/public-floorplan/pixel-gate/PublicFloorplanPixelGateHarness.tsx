'use client';

/**
 * @fileoverview **ΤΟ ΟΡΓΑΝΟ ΤΗΣ ΠΥΛΗΣ PIXELS** — τρέχει τη μέτρηση μία φορά και τη δημοσιεύει ως JSON (CHECK 3.101).
 * @related ADR-909 §6.7 · ./public-floorplan-pixels.e2e.spec.ts · `/test-harness/public-floorplan-pixels`
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/PublicFloorplanPixelGateHarness
 *
 * 🔑 Ζει **μέσα** στο subapp: ζητά το σχέδιο-δείγμα, τη λήψη και τον καταγραφέα, που δεν ανήκουν στη δημόσια
 * επιφάνεια (CHECK 3.62). Η σελίδα δοκιμής ζητά **μόνο αυτό** το σύμβολο.
 *
 * 🔑 Οι μονάδες της μέτρησης φορτώνονται **μέσα στο effect**: ο αποδότης και τα εργοστάσια BIM δεν έχουν λόγο
 * να αποτιμηθούν στον διακομιστή για μια σελίδα που μετρά μόνο σε browser.
 *
 * ⚠️ **«Δεν πρόλαβα να μετρήσω» ≠ «όλα καλά»**: σε αποτυχία δημοσιεύεται `error` με το μήνυμα, ποτέ άδεια
 * μέτρηση — και το spec κοκκινίζει πάνω του.
 */

import { useEffect, useState } from 'react';

import {
  PIXEL_GATE_RESULTS_ELEMENT_ID,
  type PixelGateLevel,
  type PixelGateMeasurement,
} from './pixel-gate-contract';

/** Ό,τι δημοσιεύει το όργανο: μέτρηση **ή** ο λόγος που δεν έγινε. */
export type PixelGateHarnessOutput =
  | { readonly ok: true; readonly measurement: PixelGateMeasurement }
  | { readonly ok: false; readonly error: string };

async function measure(): Promise<PixelGateMeasurement> {
  const [{ buildPixelGateSampleScene }, { measurePixelGateLevel }, presets, capture] = await Promise.all([
    import('./pixel-gate-samples'),
    import('./measure-public-floorplan-pixels'),
    import('../public-floorplan-presets'),
    import('../capture-public-floorplan'),
  ]);

  const { scene, cells, sampleTypes } = buildPixelGateSampleScene();
  const levels: PixelGateLevel[] = [];
  // Διαδοχικά, ποτέ παράλληλα: ο καταγραφέας τυλίγει το πρωτότυπο του καμβά, και η πολιτική χρώματος είναι καθολική.
  for (const plotStyle of presets.PUBLIC_FLOORPLAN_PLOT_STYLES) {
    levels.push(await measurePixelGateLevel(scene, cells, plotStyle));
  }
  return { sampleTypes, minLineWidthPx: capture.PUBLIC_FLOORPLAN_MIN_LINE_WIDTH_PX, levels };
}

export function PublicFloorplanPixelGateHarness() {
  const [output, setOutput] = useState<PixelGateHarnessOutput | null>(null);

  useEffect(() => {
    let cancelled = false;
    measure()
      .then((measurement): PixelGateHarnessOutput => ({ ok: true, measurement }))
      .catch((reason: unknown): PixelGateHarnessOutput => ({
        ok: false,
        error: reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason),
      }))
      .then((result) => {
        if (!cancelled) setOutput(result);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main data-pixel-gate-state={output === null ? 'measuring' : output.ok ? 'measured' : 'failed'}>
      {output !== null && (
        <script
          id={PIXEL_GATE_RESULTS_ELEMENT_ID}
          type="application/json"
          // Δεδομένα μέτρησης για το spec — όχι περιεχόμενο χρήστη.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(output).replace(/</g, '\\u003c') }}
        />
      )}
    </main>
  );
}
