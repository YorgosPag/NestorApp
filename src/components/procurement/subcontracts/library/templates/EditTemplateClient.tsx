'use client';

/**
 * Η είσοδος της σελίδας «Επεξεργασία προτύπου» (ADR-928 §5.22): καταχωρεί το route slice της (ADR-744 §18 — το
 * `page.tsx` είναι Server Component) και ζωγραφίζει την κοινή {@link TemplateEditorPage}.
 */

import routeSlice from '@/i18n/generated/routes/o__workspace__procurement__subcontracts__library__templates__templateId.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';
import { TemplateEditorPage } from './TemplateEditorPage';

registerRouteSlice(routeSlice);

export function EditTemplateClient({ templateId }: { readonly templateId: string }) {
  return <TemplateEditorPage templateId={templateId} />;
}
