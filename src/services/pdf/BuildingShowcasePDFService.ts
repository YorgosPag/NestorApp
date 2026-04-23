/**
 * Building Showcase PDF Service (ADR-320).
 *
 * Orchestrates jsPDF + Greek font + BuildingShowcaseRenderer.
 * Mirrors ProjectShowcasePDFService — zero new infrastructure.
 *
 * @module services/pdf/BuildingShowcasePDFService
 */

import { JSPDFAdapter } from './adapters/JSPDFAdapter';
import { registerGreekFont } from './greek-font-loader';
import { BuildingShowcaseRenderer } from './renderers/BuildingShowcaseRenderer';
import type { BuildingShowcasePDFData } from './renderers/BuildingShowcaseRenderer';
import type { IPDFDoc, Margins } from './contracts';

export type { BuildingShowcasePDFData };

const DEFAULT_MARGINS: Margins = { top: 20, right: 18, bottom: 20, left: 18 };

export class BuildingShowcasePDFService {
  async generate(data: BuildingShowcasePDFData): Promise<Uint8Array> {
    const doc = await this.createDoc();
    const renderer = new BuildingShowcaseRenderer();
    renderer.render(doc, DEFAULT_MARGINS, data);
    return new Uint8Array(doc.output('arraybuffer'));
  }

  private async createDoc(): Promise<IPDFDoc> {
    const jsPDFModule = await import('jspdf');
    const JsPDF = jsPDFModule.default;
    const instance = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await registerGreekFont(instance);
    return new JSPDFAdapter(instance);
  }
}
