/**
 * ADR-899 §9 θέμα 8 — `renderDxfToCanvas` με **0 οντότητες**: ο καμβάς παίρνει το μέγεθος του κουτιού και
 * καθαρίζεται. Πριν, η έξοδος ήταν **πριν** από τη μέτρηση ⇒ ο καμβάς έμενε στο προεπιλεγμένο 300×150 του browser
 * με ό,τι είχε το προηγούμενο σχέδιο (μετρημένο στην παραγωγή: 300×150 σε κουτί 1227×625).
 *
 * Μετάλλαξη που πρέπει να πιάσει: το πρόωρο `return` πίσω στην αρχή της συνάρτησης.
 */

import type { DxfSceneData } from '@/types/file-record';

import { DRAWING_MODE_CONFIG, renderDxfToCanvas } from '../floorplan-dxf-renderer';

function canvasInBox(width: number, height: number) {
  const fillRect = jest.fn();
  const clearRect = jest.fn();
  const ctx = { fillRect, clearRect, fillStyle: '', strokeStyle: '', lineWidth: 0 };
  const container = document.createElement('figure');
  container.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext'];
  return { canvas, ctx, fillRect, clearRect };
}

describe('renderDxfToCanvas — άδεια σκηνή', () => {
  it('🔴 0 οντότητες ⇒ ο καμβάς μετριέται στο κουτί και βάφεται με το φόντο της λειτουργίας', () => {
    const { canvas, ctx, fillRect, clearRect } = canvasInBox(1227, 625);
    expect([canvas.width, canvas.height]).toEqual([300, 150]);

    const empty: DxfSceneData = { entities: [], layers: {} };
    renderDxfToCanvas(canvas, empty, 1, { x: 0, y: 0 }, 'light');

    expect([canvas.width, canvas.height]).toEqual([1227, 625]);
    expect(clearRect).toHaveBeenCalledWith(0, 0, 1227, 625);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1227, 625);
    expect(ctx.fillStyle).toBe(DRAWING_MODE_CONFIG.light.background);
  });
});
