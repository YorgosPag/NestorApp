'use client';
/**
 * @fileoverview **Οι ενέργειες της κεφαλίδας σελίδας εγγραφής** (κεφαλίδα με `media`) — επιτόπου σε φαρδιά οθόνη, στην
 *   κάτω μπάρα σε στενή.
 * @related ADR-912 §12.13 · ADR-777 §8.87.11 · `core/layouts/record-action-bar.tsx` · `EntityHeaderActions.tsx`
 * @module core/entity-headers/RecordHeaderActions
 *
 * 🔑 **Εδώ ρωτάμε το ΠΑΡΑΘΥΡΟ, όχι τον χώρο** — ρητή εξαίρεση από το ADR-912 §2.1: η κάτω μπάρα είναι θέση **της
 *   συσκευής** (ζώνη αντίχειρα), όχι του πλάτους της κεφαλίδας. Ίδιο κατώφλι με όλη την εφαρμογή (`useViewportClass`).
 * 🔑 **`measuring` ⇒ καμία ενέργεια για ένα καρέ**: αν ζωγραφίζαμε επιτόπου και μετά μετακομίζαμε στην μπάρα, σε κάθε
 *   κινητό το περιεχόμενο θα πηδούσε ~130px προς τα πάνω. Ένα καρέ χωρίς κουμπιά δεν μετακινεί τίποτα.
 */
import React from 'react';
import { createPortal } from 'react-dom';

import { useRecordActionBar, type RecordActionBarSlot } from '@/core/layouts/record-action-bar';
import { useViewportClass } from '@/hooks/media/useViewportClass';

import { ActionOverflowMenu, EntityActionButton, EntityHeaderActions } from './EntityHeaderActions';
import { presentEntityActions } from './entity-action-presets';
import type { EntityHeaderAction } from './UnifiedEntityHeaderSystem';

interface RecordHeaderActionsProps {
  readonly actions: readonly EntityHeaderAction[];
}

/** Επιτόπου: τα κουμπιά αναδιπλώνονται (ADR-777 §8.87.2), οι καταστροφικές μένουν στο «⋯». */
function InlineRecordActions({ actions }: RecordHeaderActionsProps) {
  const { inline, menuOnly } = React.useMemo(() => presentEntityActions(actions), [actions]);
  return (
    <div className="flex max-w-full flex-wrap gap-2">
      {inline.map((action, index) => (
        <EntityActionButton key={index} action={action} />
      ))}
      {menuOnly.length > 0 && <ActionOverflowMenu actions={[]} destructive={menuOnly} />}
    </div>
  );
}

function RecordActionsWithBar({ actions, bar }: RecordHeaderActionsProps & { readonly bar: RecordActionBarSlot }) {
  const viewport = useViewportClass();
  if (viewport === 'measuring') return null;
  if (viewport === 'wide') return <InlineRecordActions actions={actions} />;
  // Στενή οθόνη, μπάρα που δεν στήθηκε ακόμη ⇒ περιμένουμε (ο ξενιστής είναι κατάσταση, θα ξαναζωγραφίσει).
  return bar.host ? createPortal(<EntityHeaderActions actions={actions} keepPrimary />, bar.host) : null;
}

export function RecordHeaderActions({ actions }: RecordHeaderActionsProps) {
  const bar = useRecordActionBar();
  // Χωρίς μπάρα (π.χ. η κεφαλίδα μέσα σε άλλη επιφάνεια) δεν ρωτάμε καν το παράθυρο.
  return bar ? <RecordActionsWithBar actions={actions} bar={bar} /> : <InlineRecordActions actions={actions} />;
}
