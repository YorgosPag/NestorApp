'use client';

/**
 * @fileoverview **ΓΚΑΛΕΡΙ ΚΑΤΑΣΤΑΣΕΩΝ — η καρτέλα «Παράδοση» του γραφείου, ΟΛΕΣ μαζί** (`/test-harness/property-handover-tab`).
 * @related ADR-916 §5.15 Φ-Δ · handover-office-scenarios.ts (ο ΕΝΑΣ πίνακας — τον διαβάζουν και οι άγκυρες Ζ1–Ζ7) ·
 *          components/testing/harness/harness-panel.tsx
 * @module components/property-handover-office/testing/PropertyHandoverOfficeHarness
 *
 * 🔴 **Γιατί υπάρχει**: η τοπική βάση είναι η **παραγωγική** και δεν έχει εκδοθεί κανένα Πρωτόκολλο — ο φυσικός δρόμος
 *    φτάνει ελάχιστες καταστάσεις. Εδώ φτάνει **κάθε** λόγος της κρίσης, ντετερμινιστικά, χωρίς κανένα αίτημα.
 * 🏆 **Ό,τι φαίνεται εδώ είναι ό,τι θα δει ο άνθρωπος**: η κατάσταση **υπολογίζεται** από την πραγματική κρίση
 *    (`handoverOfficeStatusOf`) πάνω στα σενάρια — ποτέ γραμμένη με το χέρι — και αποδίδεται από την πραγματική όψη.
 * ⛔ Ούτε διακόπτης θέματος/γλώσσας ούτε `<main>`: ανήκουν στο κέλυφος (CHECK 3.72 · 3.63).
 * ⚠️ Ετικέτες εργαλείου στα αγγλικά, εκτός locales — το ιδίωμα κάθε harness.
 */

import React from 'react';

import {
  HarnessPanel,
  HarnessPanelGroup,
  HarnessGallery,
  useHarnessPanelWidth,
} from '@/components/testing/harness/harness-panel';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { handoverOfficeStatusOf } from '@/lib/property-handover/handover-office-status';
import type { PropertyHandoverOfficeEntry, PropertyHandoverPreview } from '@/types/property-handover';

import { HandoverEntryCard } from '../HandoverEntryCard';
import { PropertyHandoverView } from '../PropertyHandoverView';
import { HANDOVER_OFFICE_SCENARIOS, type HandoverOfficeScenario } from './handover-office-scenarios';

/** Η κατάσταση ενός σεναρίου — από την **πραγματική** κρίση. */
function harnessEntryOf(scenario: HandoverOfficeScenario, index: number): PropertyHandoverOfficeEntry {
  return {
    handover: { ...scenario.handover, id: `phov_${scenario.id}` },
    recipientName: index % 5 === 4 ? null : `Buyer ${index + 1}`,
    status: handoverOfficeStatusOf(scenario.handover, scenario.context),
  };
}

const file = (id: string, displayName: string) => ({ fileId: id, displayName, entityType: ENTITY_TYPES.PROPERTY, entityId: 'prop_demo' });
const MIXED_IDS = ['declined', 'awaiting-buyer-expiring', 'delivering', 'awaiting-seal-configuration', 'sealed', 'cancelled'];

/** Ολόκληρη η καρτέλα: ανάμεικτοι αγοραστές, αρχεία που θέλουν απόφαση, πάροχος σφραγίδας χωρίς ρύθμιση. */
const HARNESS_VIEWS: readonly { readonly id: string; readonly preview: PropertyHandoverPreview }[] = [
  {
    id: 'whole-tab-mixed',
    preview: {
      handovers: HANDOVER_OFFICE_SCENARIOS.flatMap((s, i) => (MIXED_IDS.includes(s.id) ? [harnessEntryOf(s, i)] : [])),
      seal: { configured: false },
      files: {
        deliver: [file('f_plan', 'Floor plan A1.pdf'), file('f_epc', 'Energy certificate.pdf')],
        review: [file('f_unknown', 'Scan 0042.pdf')],
        internal: [file('f_invoice', 'Contractor invoice.pdf')],
      },
    },
  },
  { id: 'whole-tab-empty', preview: { handovers: [], seal: { configured: true }, files: { deliver: [], review: [], internal: [] } } },
];

export const PANEL_COUNT = HANDOVER_OFFICE_SCENARIOS.length + HARNESS_VIEWS.length;

export function PropertyHandoverOfficeHarness(): React.JSX.Element {
  const { width, setWidth, panelClass } = useHarnessPanelWidth();
  return (
    <HarnessGallery
      label="Property Handover Tab Harness"
      title="Property Handover Tab — State Gallery"
      panelCount={PANEL_COUNT}
      width={width}
      onWidthChange={setWidth}
      description={
        <>
          Every reason of the office judgment, computed by the real <code>handoverOfficeStatusOf</code> over synthetic
          handovers and rendered by the real view. No request leaves the page.
        </>
      }
    >
      <HarnessPanelGroup title="1 · One buyer per reason">
        {HANDOVER_OFFICE_SCENARIOS.map((scenario, index) => (
          <HarnessPanel key={scenario.id} id={scenario.id} className={panelClass}>
            <HandoverEntryCard entry={harnessEntryOf(scenario, index)} />
          </HarnessPanel>
        ))}
      </HarnessPanelGroup>
      <HarnessPanelGroup title="2 · The whole tab">
        {HARNESS_VIEWS.map((view) => (
          <HarnessPanel key={view.id} id={view.id} className={panelClass}>
            <PropertyHandoverView preview={view.preview} />
          </HarnessPanel>
        ))}
      </HarnessPanelGroup>
    </HarnessGallery>
  );
}
