/**
 * Integration test: JSPDFAdapter.addImage with REAL jsPDF on Node.
 *
 * Why this test exists
 * --------------------
 * jsPDF's `addImage()` takes either a string (base64 / data-URI) or raw
 * bytes. On the browser, both paths work. On Node (server-side showcase
 * PDF generation), the string path tries to resolve a global `Image`
 * constructor and silently produces an empty image — the PDF is valid but
 * the cell stays blank. This shipped once already (showcase Phase 2
 * regression, 2026-04-17): Giorgio saw a 2-page PDF with a blank photo
 * grid even though server logs showed 6 buffers had been downloaded.
 *
 * This test pins the contract: feeding a real JPEG byte sequence (as
 * Uint8Array) to our adapter must noticeably grow the PDF output, proving
 * the image bytes landed inside the PDF stream rather than being dropped.
 */

// jsdom in Node 20 ships without TextEncoder/TextDecoder on the global
// (they only live on `util`). jsPDF's PNG decoder imports iobuffer, which
// reaches for global TextEncoder at module-load time — polyfill before
// the dynamic jsPDF import below so the resolver doesn't crash.
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';
if (typeof globalThis.TextEncoder === 'undefined') {
  (globalThis as unknown as { TextEncoder: typeof NodeTextEncoder }).TextEncoder = NodeTextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  (globalThis as unknown as { TextDecoder: typeof NodeTextDecoder }).TextDecoder = NodeTextDecoder;
}

import { JSPDFAdapter } from '../JSPDFAdapter';

// Minimal but structurally valid JPEG (SOI + APP0 + SOF0 + DHT + SOS + EOI).
// Decoding a "real" photo is overkill for the contract test — we only care
// that jsPDF accepts the bytes and writes them into the PDF stream.
// Source: reduced from https://github.com/mathiasbynens/small
const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xfb, 0xd0, 0xff, 0xd9,
]);

describe('JSPDFAdapter.addImage (integration, real jsPDF)', () => {
  it('accepts Uint8Array JPEG bytes and grows the PDF stream proportionally', async () => {
    const jsPDFModule = await import('jspdf');
    const JsPDF = jsPDFModule.default;

    const baseDoc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const baseBuf = baseDoc.output('arraybuffer');

    const withImgDoc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const adapter = new JSPDFAdapter(withImgDoc);
    // Repeat the buffer so the size delta is well above any constant
    // overhead jsPDF adds when marking a page as image-bearing.
    for (let i = 0; i < 4; i++) {
      adapter.addImage(TINY_JPEG, 'JPEG', 20 + i * 10, 20, 40, 30, `img-${i}`, 'FAST');
    }
    const withImgBuf = adapter.output('arraybuffer');

    // Four embeddings of a ~150-byte JPEG should add at least a few
    // hundred bytes to the PDF (xref entries + stream headers + the bytes
    // themselves). The exact delta is jsPDF-version-dependent, so we only
    // assert "substantially larger" rather than an exact byte count.
    expect(withImgBuf.byteLength).toBeGreaterThan(baseBuf.byteLength + 300);
  });
});
