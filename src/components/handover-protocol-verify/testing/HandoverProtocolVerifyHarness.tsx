'use client';

/**
 * @fileoverview **ΓΚΑΛΕΡΙ ΚΑΤΑΣΤΑΣΕΩΝ — η πόρτα επαλήθευσης Πρωτοκόλλου, ΟΛΕΣ μαζί** (`/test-harness/handover-protocol-verify`).
 * @related ADR-916 Φ-Γ2 Σ6 · `handover-protocol-verify-scenarios.ts` · `components/handover-invite/testing/HandoverInviteHarness.tsx`
 *          (το πρότυπο) · `components/testing/harness/scripted-transport.ts` (ο ΕΝΑΣ μεταφορέας)
 * @module components/handover-protocol-verify/testing/HandoverProtocolVerifyHarness
 *
 * 🔴 **Γιατί υπάρχει**: δεν έχει εκδοθεί κανένα Πρωτόκολλο (λείπει ο πάροχος σφραγίδας) και η τοπική βάση είναι η
 *    **παραγωγική** — ο φυσικός δρόμος δεν φτάνει καμία ετυμηγορία. Εδώ φτάνει **κάθε** μία, ντετερμινιστικά.
 * 🏆 **Ό,τι φαίνεται εδώ είναι ό,τι θα δει ο άνθρωπος**: ίδια hooks, ίδια όψη, πραγματικό PDF που διαβάζεται με τον
 *    πραγματικό αναγνώστη· το μητρώο απαντά **ωμά** και περνά από τον πραγματικό αποκωδικοποιητή. Μηδέν αιτήματα έξω.
 * ⛔ Ούτε διακόπτης θέματος/γλώσσας ούτε `<main>`: ανήκουν στο κέλυφος (CHECK 3.72 · 3.63).
 * ⚠️ Ετικέτες εργαλείου στα αγγλικά, εκτός locales — το ιδίωμα κάθε harness.
 */

import React from 'react';

import {
  HarnessPanel as Panel,
  HarnessPanelGroup as PanelGroup,
  HarnessGallery,
  useHarnessPanelWidth,
} from '@/components/testing/harness/harness-panel';
import { useScriptedTransport, type ScriptedGetRoute, type ScriptedRoute } from '@/components/testing/harness/scripted-transport';
import { handoverPackageCheckOf } from '@/lib/property-handover/handover-protocol-package-check';

import { ProtocolCheckView } from '../ProtocolCheckView';
import { ProtocolPackageView } from '../ProtocolPackageSection';
import { ProtocolRecordView } from '../ProtocolRecordView';
import { useHandoverProtocolCheck, useHandoverProtocolRecord } from '../use-handover-protocol-verification';
import {
  HARNESS_FILES,
  PACKAGE_SCENARIOS,
  PROTOCOL_CHECK_SCENARIOS,
  PROTOCOL_RECORD_SCENARIOS,
  scenarioFileOf,
  scriptedVerificationFor,
  type ProtocolCheckScenario,
} from './handover-protocol-verify-scenarios';

/** Καμία πόρτα `POST` εδώ — ό,τι φτάσει πάει στον αληθινό μεταφορέα (κέλυφος). */
const noPost: ScriptedRoute = () => undefined;

/** Η πόρτα επαλήθευσης, κατά ταυτότητα στο URL. Το `sha256` φτάνει ως παράμετρος — όπως στον διακομιστή. */
const VERIFICATION_URL = /\/api\/handover-protocols\/([^/]+)\/verification$/;
const verificationRoute: ScriptedGetRoute = (url) => {
  const match = VERIFICATION_URL.exec(url);
  return match === null ? undefined : scriptedVerificationFor(decodeURIComponent(match[1]));
};

const PANEL_COUNT = PROTOCOL_CHECK_SCENARIOS.length + PROTOCOL_RECORD_SCENARIOS.length + PACKAGE_SCENARIOS.length;

export function HandoverProtocolVerifyHarness(): React.JSX.Element {
  const { width, setWidth, panelClass } = useHarnessPanelWidth();
  // 🔴 Η ΣΕΙΡΑ: κανένα πάνελ δεν ρωτά πριν σταθεί ο μεταφορέας (τα effects των παιδιών τρέχουν πρώτα).
  const armed = useScriptedTransport(noPost, verificationRoute);

  return (
    <HarnessGallery
      label="Handover Protocol Verify Harness"
      title="Handover Protocol Verify — State Gallery"
      panelCount={PANEL_COUNT}
      width={width}
      onWidthChange={setWidth}
      description={
        <>
          Every state of <code>/handover-protocol/verify[/protocolId]</code>: real PDFs read by the real reader, hashed by
          Web Crypto, registry replies decoded by the real decoder. Only the network is scripted — no request leaves the page.
        </>
      }
    >

      <PanelGroup title="1 · Protocol PDF — local reading + registry">
        {armed && PROTOCOL_CHECK_SCENARIOS.map((item) => <CheckPanel key={item.id} scenario={item} className={panelClass} />)}
      </PanelGroup>

      <PanelGroup title="2 · Paper / QR — registry entry without a file">
        {armed && PROTOCOL_RECORD_SCENARIOS.map((item) => (
          <Panel key={item.id} id={item.id} className={panelClass}>
            <RecordPanelBody protocolId={item.protocolId} />
          </Panel>
        ))}
      </PanelGroup>

      <PanelGroup title="3 · Package — delivered files against the sealed table">
        {PACKAGE_SCENARIOS.map((item) => (
          <Panel key={item.id} id={item.id} className={panelClass}>
            <ProtocolPackageView state={{ phase: 'checked', check: handoverPackageCheckOf(HARNESS_FILES, item.provided) }} />
          </Panel>
        ))}
      </PanelGroup>
    </HarnessGallery>
  );
}

/** «Ρίχνει» το αρχείο του σεναρίου **μία** φορά — από τον ίδιο δρόμο με τον επιλογέα (`check(file)`). */
function CheckPanel({ scenario, className }: { readonly scenario: ProtocolCheckScenario; readonly className: string }) {
  const { state, check } = useHandoverProtocolCheck(scenario.expectedProtocolId);
  React.useEffect(() => {
    let alive = true;
    void scenarioFileOf(scenario).then((file) => alive && check(file));
    return () => {
      alive = false;
    };
  }, [check, scenario]);
  return (
    <Panel id={scenario.id} className={className}>
      <ProtocolCheckView state={state} />
    </Panel>
  );
}

function RecordPanelBody({ protocolId }: { readonly protocolId: string }) {
  const state = useHandoverProtocolRecord(protocolId);
  return <ProtocolRecordView protocolId={protocolId} state={state} />;
}
