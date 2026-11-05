'use client';

/**
 * Η είσοδος της σελίδας «Νέα ρήτρα» (ADR-928 §5.22): καταχωρεί το route slice της (ADR-744 §18 — το `page.tsx` είναι
 * Server Component) και ζωγραφίζει την κοινή {@link ClauseAuthoringPage}.
 */

import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__subcontracts__library__clauses__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { ClauseAuthoringPage } from './ClauseAuthoringPage';

registerRouteSlice(routeSlice);

export function NewClauseClient() {
  return <ClauseAuthoringPage clauseId={null} />;
}
