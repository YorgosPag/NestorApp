"use client";

import type { IPDFLoader, IPDFDoc } from '../contracts';
import { JSPDFAdapter } from '../adapters/JSPDFAdapter';

let jsPDF: any = null;

export class JSPDFLoader implements IPDFLoader {
  async initialize(): Promise<IPDFDoc> {
    if (typeof window === 'undefined') {
      throw new Error("PDF generation can only be done on the client-side.");
    }
    
    if (!jsPDF) {
      const jsPDFModule = await import('jspdf');
      jsPDF = jsPDFModule.default;
      // Ensure autotable is loaded for potential future use, as in original file
      await import('jspdf-autotable');
    }

    const docInstance = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    return new JSPDFAdapter(docInstance);
  }
}
