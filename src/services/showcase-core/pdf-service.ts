/**
 * =============================================================================
 * SHOWCASE CORE — PDF Service (ADR-321 Phase 1.3a)
 * =============================================================================
 *
 * Config-driven generic service lifted from property/project/building showcase
 * PDF services (literally identical bodies). Orchestrates jsPDF + Greek font
 * registration + renderer composition:
 *
 *   1. Dynamically import jspdf (server-safe — matches the legacy services).
 *   2. Register Roboto with Identity-H encoding so Greek glyphs render
 *      correctly (ADR-267 SSoT — skipping this turns every label into
 *      gibberish, Giorgio incident 2026-04-17).
 *   3. Wrap the jsPDF instance in `JSPDFAdapter` (maps to `IPDFDoc`).
 *   4. Delegate rendering to the caller's `ShowcaseRendererLike<TData>`.
 *   5. Return the finished PDF as a `Uint8Array` (identical byte-layout to
 *      the legacy services so downstream Storage uploads remain unaffected).
 *
 * Default margins match every legacy service: `{ top:20, right:18, bottom:20,
 * left:18 }`. Callers may override via the constructor.
 *
 * @module services/showcase-core/pdf-service
 */

import { JSPDFAdapter } from '@/services/pdf/adapters/JSPDFAdapter';
import { registerGreekFont } from '@/services/pdf/greek-font-loader';
import type { IPDFDoc, Margins } from '@/services/pdf/contracts';

// =============================================================================
// Public contracts
// =============================================================================

/**
 * Minimal renderer contract consumed by the service. Every showcase renderer
 * (property / project / building / future) exposes exactly this shape — the
 * `BaseShowcaseRenderer` in `pdf-renderer-base.ts` conforms natively.
 */
export interface ShowcaseRendererLike<TData> {
  render(doc: IPDFDoc, margins: Margins, data: TData): void;
}

export const DEFAULT_SHOWCASE_PDF_MARGINS: Margins = {
  top: 20,
  right: 18,
  bottom: 20,
  left: 18,
};

// =============================================================================
// Service
// =============================================================================

export class ShowcasePDFService<TData> {
  constructor(
    private readonly renderer: ShowcaseRendererLike<TData>,
    private readonly margins: Margins = DEFAULT_SHOWCASE_PDF_MARGINS,
  ) {}

  async generate(data: TData): Promise<Uint8Array> {
    const doc = await this.createDoc();
    this.renderer.render(doc, this.margins, data);
    return new Uint8Array(doc.output('arraybuffer'));
  }

  private async createDoc(): Promise<IPDFDoc> {
    const jsPDFModule = await import('jspdf');
    const JsPDF = jsPDFModule.default;
    const instance = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    // ADR-267 SSoT — Unicode (Roboto Identity-H) so Greek renders.
    await registerGreekFont(instance);
    return new JSPDFAdapter(instance);
  }
}
