'use client';

/**
 * @fileoverview **Η ΚΑΡΤΑ ΜΗΝΥΜΑΤΟΣ ΚΑΘΕ ΣΕΛΙΔΑΣ ΠΡΟΣΚΛΗΣΗΣ** — έκβαση ή εμπόδιο, με τίτλο, σώμα και προαιρετική έξοδο.
 * @related ADR-853 §20 · ADR-884 Κ3α (`/tour-invite`) · ADR-901 Φ3 (`/case-invite`)
 * @module components/invitations/InvitationMessageCard
 *
 * Εξήχθη 2026-10-03 (ADR-901 Φ3, N.0.2): η σελίδα φωτογράφου και η σελίδα υπόθεσης είχαν **ίδιο** `Message`.
 * Το σώμα φέρει `role="status"` — ο αναγνώστης οθόνης ανακοινώνει την έκβαση χωρίς να μετακινηθεί η εστίαση.
 */

import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

export function InvitationMessageCard({ title, body, children }: { readonly title: string; readonly body: string; readonly children?: ReactNode }) {
  const layout = useLayoutClasses();
  return (
    <Card className={layout.cardAuthWidth}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription role="status">{body}</CardDescription>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
