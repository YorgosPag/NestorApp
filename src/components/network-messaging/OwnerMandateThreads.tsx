'use client';

/**
 * @fileoverview **ΟΙ ΣΥΝΟΜΙΛΙΕΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΜΕ ΤΑ ΓΡΑΦΕΙΑ ΤΟΥ** — ένα νήμα ανά εντολή με ακμή, στη σελίδα της αγγελίας.
 * @related ADR-867 Β7 · `lib/network-edge/edge-sources.ts` (`mandateEdgesOf` — ο **ίδιος** κριτής με τον διακομιστή)
 * @module components/network-messaging/OwnerMandateThreads
 *
 * 🔑 **Ποια νήματα υπάρχουν το λέει η ΑΚΜΗ, όχι η οθόνη**: αποδεκτή εντολή · γνωστό γραφείο · ιδιοκτήτης με
 * λογαριασμό (§8 #1). Ο **ίδιος** κριτής με όποιον γεννά το νήμα — δεύτερος εδώ θα έδειχνε κενό πάνελ για
 * εντολή χωρίς νήμα, ή θα έκρυβε νήμα που υπάρχει.
 * ⚠️ Μόνο όσα έχουν **εμένα** αντισυμβαλλόμενο: η αγγελία είναι δική μου, αλλά μια παλιά επιβεβαίωση από
 * άλλον λογαριασμό δεν είναι δική μου συνομιλία.
 */

import React from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { mandateEdgesOf, type MandateEdgeRecord } from '@/lib/network-edge/edge-sources';
import { actNetworkRefs } from '@/lib/network-messaging/act-network-refs';

import { NetworkThreadPanel } from './NetworkThreadPanel';

export interface OwnerMandateThreadsProps {
  /** Το έγγραφο της αγγελίας όπως το διαβάζει ο κάτοχος — `propertyId` + εντολές. */
  readonly record: MandateEdgeRecord;
}

export function OwnerMandateThreads({ record }: OwnerMandateThreadsProps): React.ReactElement | null {
  const { user } = useAuth();
  const viewerUid = user?.uid ?? null;
  if (viewerUid === null) return null;

  const edges = mandateEdgesOf(record).filter((edge) => edge.counterpartUid === viewerUid);
  if (edges.length === 0) return null;
  return (
    <>
      {edges.map((edge) => (
        <NetworkThreadPanel key={edge.actSeed} threadId={actNetworkRefs(edge.actSeed).threadId} teamId={null} variant="owner" />
      ))}
    </>
  );
}
