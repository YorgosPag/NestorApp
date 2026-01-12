"use client";

import type { IPDFLoader, IPDFDoc } from '../contracts';
import { JSPDFAdapter } from '../adapters/JSPDFAdapter';
import type { jsPDF as JsPDFType } from 'jspdf';

// 🏢 ENTERPRISE: Type-safe jsPDF module loader
let jsPDFConstructor: typeof JsPDFType | null = null;

export class JSPDFLoader implements IPDFLoader {
  async initialize(): Promise<IPDFDoc> {
    if (typeof window === 'undefined') {
      throw new Error("PDF generation can only be done on the client-side.");
    }
    
    if (!jsPDFConstructor) {
      const jsPDFModule = await import('jspdf');
      jsPDFConstructor = jsPDFModule.default;
      // Ensure autotable is loaded for potential future use, as in original file
      await import('jspdf-autotable');
    }

    const docInstance = new jsPDFConstructor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    return new JSPDFAdapter(docInstance);
  }
}
