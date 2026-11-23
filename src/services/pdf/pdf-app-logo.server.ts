import 'server-only';

/**
 * @fileoverview **ΤΟ ΛΟΓΟΤΥΠΟ ΤΗΣ ΕΦΑΡΜΟΓΗΣ ΣΤΑ PDF — ανάγνωση στον server** (ADR-947 Φ2β).
 * @module services/pdf/pdf-app-logo.server
 * @related services/pdf/pdf-app-logo.ts (τύπος · σχεδίαση · φόρτωση στη συσκευή)
 *
 * 🔑 Το ίδιο αρχείο του `public/` που κατεβάζει η συσκευή — άρα συσκευή και στιγμιότυπο τυπώνουν τα ΙΔΙΑ bytes, και το
 *    PDF του στιγμιοτύπου μένει ντετερμινιστικό. Αποτυχία ⇒ `null` + προειδοποίηση, ποτέ αποτυχία του PDF.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { createModuleLogger } from '@/lib/telemetry/Logger';

import { PDF_APP_LOGO_FORMAT, PDF_APP_LOGO_PUBLIC_PATH, type PdfAppLogo } from './pdf-app-logo';

const logger = createModuleLogger('PdfAppLogo');

/** Διαβάζει το λογότυπο από το `public/` του server. */
export async function readPdfAppLogo(): Promise<PdfAppLogo | null> {
  const fullPath = path.join(process.cwd(), 'public', ...PDF_APP_LOGO_PUBLIC_PATH.split('/').filter(Boolean));
  try {
    return { bytes: new Uint8Array(await fs.readFile(fullPath)), format: PDF_APP_LOGO_FORMAT };
  } catch (error) {
    logger.warn('PDF app logo read failed', { fullPath, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
