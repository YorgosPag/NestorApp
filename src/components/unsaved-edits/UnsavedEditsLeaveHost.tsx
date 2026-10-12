'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ ξενιστής** του διαλόγου εξόδου — στημένος μία φορά στη ρίζα της εφαρμογής.
 * @related ADR-912 §12.12 · `lib/unsaved-edits/leave-guard.ts` (`installLeavePrompt`)
 * @module components/unsaved-edits/UnsavedEditsLeaveHost
 *
 * 🔑 **Ένας, όχι ανά σελίδα**: την ερώτηση τη ζητά και το σύνορο πλοήγησης (σύνδεσμοι του μενού, που ζουν στο κέλυφος —
 *   έξω από κάθε σελίδα). Όποιος ρωτά δεν χρειάζεται να στήσει τίποτα.
 * 🔑 Ο διάλογος φορτώνεται με `next/dynamic` **όταν ζητηθεί**: το κέλυφος δεν πληρώνει ούτε τον κώδικά του ούτε τα
 *   κείμενά του (ADR-744 — η κλειστότητα του κελύφους κόβεται στο `next/dynamic`).
 */

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { installLeavePrompt, type LeaveDecision, type LeavePromptRequest } from '@/lib/unsaved-edits/leave-guard';
import { useLeaveNavigator } from '@/lib/workspace/navigation';

const UnsavedEditsLeaveDialog = dynamic(
  () => import('./UnsavedEditsLeaveDialog').then((module) => module.UnsavedEditsLeaveDialog),
  { ssr: false },
);

interface OpenRequest {
  readonly request: LeavePromptRequest;
  readonly resolve: (decision: LeaveDecision) => void;
}

export function UnsavedEditsLeaveHost() {
  const [open, setOpen] = useState<OpenRequest | null>(null);
  // Το `<Link>` του συνόρου συνεχίζει από εδώ μετά την απάντηση (δεν καλεί ο ίδιος hook δρομολογητή).
  useLeaveNavigator();

  useEffect(
    () => installLeavePrompt((request) => new Promise<LeaveDecision>((resolve) => setOpen({ request, resolve }))),
    [],
  );

  if (!open) return null;

  return (
    <UnsavedEditsLeaveDialog
      request={open.request}
      onDecision={(decision) => {
        setOpen(null);
        open.resolve(decision);
      }}
    />
  );
}
