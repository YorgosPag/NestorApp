/**
 * Project Showcase PDF Service (ADR-316).
 *
 * Orchestrates jsPDF + Greek font + ProjectShowcaseRenderer.
 * Mirrors PropertyShowcasePDFService — zero new infrastructure.
 *
 * @module services/pdf/ProjectShowcasePDFService
 */

import { JSPDFAdapter } from './adapters/JSPDFAdapter';
import { registerGreekFont } from './greek-font-loader';
import { ProjectShowcaseRenderer } from './renderers/ProjectShowcaseRenderer';
import type { ProjectShowcasePDFData } from './renderers/ProjectShowcaseRenderer';
import type { IPDFDoc, Margins } from './contracts';

export type { ProjectShowcasePDFData };

const DEFAULT_MARGINS: Margins = { top: 20, right: 18, bottom: 20, left: 18 };

export class ProjectShowcasePDFService {
  async generate(data: ProjectShowcasePDFData): Promise<Uint8Array> {
    const doc = await this.createDoc();
    const renderer = new ProjectShowcaseRenderer();
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
