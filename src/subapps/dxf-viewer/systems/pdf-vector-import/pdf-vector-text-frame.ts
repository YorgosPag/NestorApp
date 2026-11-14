/**
 * ADR-941 Φ2α · Φ2β — το **πλαίσιο** ενός κειμένου του PDF σε px της σελίδας: κέντρο του ύψους κεφαλαίου, μέσο της γραμμής
 * βάσης, διεύθυνση ανάγνωσης, em και μισό πλάτος. Ο ΕΝΑΣ υπολογισμός του, για το δέσιμο σε ακμή (Φ2α) και για την
 * αναγνώριση των σχεδιασμένων γραφικών διάστασης (Φ2β). Καθαρό.
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-text-frame
 */

import type { PdfVectorText, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import { PDF_EM_TO_CAP_HEIGHT } from './pdf-vector-entities';
import { distance, length, midpoint, sub } from './pdf-vector-segments';

export interface TextFrame {
  readonly centre: PxPoint;
  readonly baselineMid: PxPoint;
  /** Μοναδιαία διεύθυνση ανάγνωσης. */
  readonly dir: PxPoint;
  readonly em: number;
  /** Το μισό πλάτος προώθησης κατά μήκος της γραμμής βάσης (0 όταν το pdf.js δεν έδωσε πλάτος). */
  readonly halfWidth: number;
}

export function textFrame(text: PdfVectorText): TextFrame | null {
  const along = sub(text.along, text.origin);
  const up = sub(text.up, text.origin);
  const em = length(up);
  const alongLen = length(along);
  if (!(em > 0) || !(alongLen > 0)) return null;
  const baselineMid = midpoint(text.origin, text.end);
  const lift = PDF_EM_TO_CAP_HEIGHT / 2; // το κέντρο του ύψους κεφαλαίου, πάνω από τη γραμμή βάσης
  const centre: PxPoint = [baselineMid[0] + up[0] * lift, baselineMid[1] + up[1] * lift];
  return {
    centre, baselineMid, dir: [along[0] / alongLen, along[1] / alongLen], em, halfWidth: distance(text.origin, text.end) / 2,
  };
}
