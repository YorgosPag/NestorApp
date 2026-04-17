/**
 * 🏢 ENTERPRISE: Property Showcase PDF Service (ADR-312)
 *
 * Generates a single-page branded PDF for a property showcase. Works on
 * the server (Node) — imports jspdf dynamically and bypasses the
 * client-only JSPDFLoader guard (jsPDF text-only PDFs work in Node).
 */

import { JSPDFAdapter } from './adapters/JSPDFAdapter';
import { PropertyShowcaseRenderer } from './renderers/PropertyShowcaseRenderer';
import type { PropertyShowcasePDFData } from './renderers/PropertyShowcaseRenderer';
import type { IPDFDoc, Margins } from './contracts';

const DEFAULT_MARGINS: Margins = { top: 20, right: 18, bottom: 20, left: 18 };

export class PropertyShowcasePDFService {
  async generate(data: PropertyShowcasePDFData): Promise<Uint8Array> {
    const doc = await this.createDoc();
    const renderer = new PropertyShowcaseRenderer();
    renderer.render(doc, DEFAULT_MARGINS, data);
    return new Uint8Array(doc.output('arraybuffer'));
  }

  private async createDoc(): Promise<IPDFDoc> {
    const jsPDFModule = await import('jspdf');
    const JsPDF = jsPDFModule.default;
    const instance = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    return new JSPDFAdapter(instance);
  }
}
