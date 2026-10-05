/**
 * =============================================================================
 * «Από ποιον χώρο κοιτάς;» — ο θεατής της λίστας και της σελίδας υπόθεσης (ADR-901 §15 · Γ2)
 * =============================================================================
 *
 * Το **ένα** σημείο όπου το σύνορο HTTP μεταφράζει το `?home=` σε **χώρο της σελίδας**. Το ζητούν οι δύο διαδρομές
 * που η απάντησή τους εξαρτάται από τον χώρο: η λίστα (`GET /api/engagements`) και η σελίδα μιας υπόθεσης
 * (`GET /api/engagements/{id}/case`). Δεύτερη γραφή θα ήταν δύο ερμηνείες του ίδιου αιτήματος.
 *
 * 🔑 Η παράμετρος δηλώνει **είδος** (`CaseHome`)· την **ταυτότητα** του γραφείου τη δίνει ο κριμένος χώρος του
 *    αιτήματος (`viewedWorkspace`). ⛔ Απόν ή άγνωστο `home` ⇒ **400**, ποτέ προεπιλογή: μια σελίδα που δεν λέει
 *    από πού κοιτά δεν επιτρέπεται να πάρει τη λίστα «κάποιου» χώρου.
 *
 * @module services/conveyance/conveyance-case-viewer.server
 */

import 'server-only';

import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';

import { malformedResponse, type MalformedRequestBody } from '@/lib/api/malformed-request';
import { readQueryParams } from '@/lib/api/query-params';
import { CASE_HOME_PARAM, CASE_HOMES } from '@/lib/conveyance/conveyance-routes';
import { viewedWorkspace, type ActingViewer } from './conveyance-acting-workspace.server';
import type { CasesViewer } from './conveyance-engagement-access.service';

const CASE_VIEWER_QUERY = z.object({ [CASE_HOME_PARAM]: z.enum(CASE_HOMES) });

export type CaseViewerReading = CasesViewer | { readonly rejected: NextResponse<MalformedRequestBody> };

/**
 * Ο θεατής **με τον χώρο της σελίδας του** — ή η έτοιμη απόρριψη `MALFORMED_QUERY` (400, πεδίο `home`).
 * «Γραφείο» από αίτημα που δεν ενεργεί σε κανένα γραφείο είναι **το ίδιο** λάθος αίτημα με την άγνωστη τιμή.
 */
export function readCaseViewer(request: NextRequest, viewer: ActingViewer): CaseViewerReading {
  const query = readQueryParams(request, CASE_VIEWER_QUERY);
  if ('rejected' in query) return query;
  const viewed = viewedWorkspace(viewer, query.data[CASE_HOME_PARAM]);
  if (viewed === null) return { rejected: malformedResponse('MALFORMED_QUERY', [{ path: [CASE_HOME_PARAM] }]) };
  return { ...viewer, viewed };
}
