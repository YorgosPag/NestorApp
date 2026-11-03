/**
 * @jest-environment node
 *
 * ADR-841 §7 Α21.17 — ο κωδικός QR: ντετερμινιστικός, με ήσυχη ζώνη κατά την προδιαγραφή.
 */

import jsQR from 'jsqr';
import QRCode from 'qrcode';

import { QR_PRESETS, qrModuleRuns, qrPngDataUrl, qrSvg, type QrModuleRuns } from '../qr-code';

/** Ζωγραφίζει τις σειρές σε RGBA, με τη ζώνη ησυχίας λευκή — ό,τι κάνει το πρότυπο Typst, χωρίς τη μηχανή. */
function rasterOf(symbol: QrModuleRuns, pixelsPerModule: number): { readonly data: Uint8ClampedArray; readonly side: number } {
  const side = (symbol.size + 2 * symbol.quietModules) * pixelsPerModule;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [row, column, length] of symbol.runs) {
    for (let y = 0; y < pixelsPerModule; y += 1) {
      const top = (symbol.quietModules + row) * pixelsPerModule + y;
      for (let x = 0; x < length * pixelsPerModule; x += 1) {
        const at = (top * side + (symbol.quietModules + column) * pixelsPerModule + x) * 4;
        data.fill(0, at, at + 3);
      }
    }
  }
  return { data, side };
}

const URL = 'https://nestorconstruct.gr/pro/vafes-pagoni';

describe('qr-code', () => {
  it('ίδιο payload + ίδια χρήση ⇒ ίδιο SVG (τίποτα τυχαίο στην εκτύπωση)', async () => {
    const first = await qrSvg(URL, 'print');
    expect(first).toContain('<svg');
    expect(await qrSvg(URL, 'print')).toBe(first);
  });

  it('🔑 η εκτύπωση έχει ΙΣΧΥΡΟΤΕΡΗ διόρθωση ⇒ άλλος κωδικός από την οθόνη', async () => {
    expect(await qrSvg(URL, 'print')).not.toBe(await qrSvg(URL, 'screen'));
  });

  it('ήσυχη ζώνη 4 μονάδων στην οθόνη και στην εκτύπωση (ISO/IEC 18004)', () => {
    expect(QR_PRESETS.screen.margin).toBe(4);
    expect(QR_PRESETS.print.margin).toBe(4);
    expect(QR_PRESETS.print.errorCorrectionLevel).toBe('Q');
  });

  it('PNG ως data URL', async () => {
    expect(await qrPngDataUrl(URL, 'screen', 128)).toMatch(/^data:image\/png;base64,/);
  });

  describe('qrModuleRuns — ο κωδικός ως γεωμετρία (ADR-923 §5.13 Σ7)', () => {
    const PRINTED = 'https://nestorconstruct.gr/q/catpm_8f3c2a10-5b7e-4c1d-9a2f-0e6b1d4c7a99';

    it('οι σειρές ξαναχτίζουν ΑΚΡΙΒΩΣ τον πίνακα του qrcode, μονάδα προς μονάδα', () => {
      const symbol = qrModuleRuns(PRINTED, 'print');
      const { modules } = QRCode.create(PRINTED, { errorCorrectionLevel: 'Q' });
      const rebuilt = new Set(symbol.runs.flatMap(([row, column, length]) => Array.from({ length }, (_, offset) => row * symbol.size + column + offset)));
      const expected = Array.from(modules.data).flatMap((bit, index) => (bit === 1 ? [index] : []));
      expect(symbol.size).toBe(modules.size);
      expect([...rebuilt].sort((a, b) => a - b)).toEqual(expected);
    });

    it('🔑 ανεξάρτητος αποκωδικοποιητής (jsQR) διαβάζει την ίδια διεύθυνση', () => {
      const { data, side } = rasterOf(qrModuleRuns(PRINTED, 'print'), 4);
      expect(jsQR(data, side, side)?.data).toBe(PRINTED);
    });

    it('η ζώνη και η διόρθωση έρχονται από το preset, όχι από τον καλούντα', () => {
      const symbol = qrModuleRuns(PRINTED, 'print');
      expect(symbol.quietModules).toBe(QR_PRESETS.print.margin);
      expect(QRCode.create(PRINTED, { errorCorrectionLevel: 'Q' }).version).toBeLessThanOrEqual(6);
    });

    it('σειρές συνεχόμενες, ποτέ μηδενικές ή επικαλυπτόμενες', () => {
      const { runs, size } = qrModuleRuns(PRINTED, 'print');
      for (const [, column, length] of runs) {
        expect(length).toBeGreaterThan(0);
        expect(column + length).toBeLessThanOrEqual(size);
      }
      const perRow = new Map<number, number[]>();
      for (const [row, column, length] of runs) perRow.set(row, [...(perRow.get(row) ?? []), column, column + length]);
      for (const edges of perRow.values()) for (let index = 2; index < edges.length; index += 2) expect(edges[index]).toBeGreaterThan(edges[index - 1]);
    });

    it('ντετερμινιστικό', () => {
      expect(qrModuleRuns(PRINTED, 'print')).toEqual(qrModuleRuns(PRINTED, 'print'));
    });
  });
});
