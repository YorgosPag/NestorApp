/**
 * @jest-environment node
 *
 * ADR-841 §7 Α21.17 — ο κωδικός QR: ντετερμινιστικός, με ήσυχη ζώνη κατά την προδιαγραφή.
 */

import { QR_PRESETS, qrPngDataUrl, qrSvg } from '../qr-code';

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
});
