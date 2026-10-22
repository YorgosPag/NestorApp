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

import { PANEL_WIDTH_CLASS, PanelWidthSelect, type PanelWidth } from '@/components/testing/harness/harness-panel';
import { useScriptedTransport, type ScriptedGetRoute, type ScriptedRoute } from '@/components/testing/harness/scripted-transport';
import { Card } from '@/components/ui/card';
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
  const [width, setWidth] = React.useState<PanelWidth>('auto');
  // 🔴 Η ΣΕΙΡΑ: κανένα πάνελ δεν ρωτά πριν σταθεί ο μεταφορέας (τα effects των παιδιών τρέχουν πρώτα).
  const armed = useScriptedTransport(noPost, verificationRoute);
  const panelClass = `flex flex-col gap-3 overflow-visible p-4 ${PANEL_WIDTH_CLASS[width]}`;

  return (
    <section className="flex flex-col gap-6" aria-label="Handover Protocol Verify Harness">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-semibold text-foreground">Handover Protocol Verify — State Gallery</h1>
        <p className="m-0 max-w-3xl text-sm text-muted-foreground">
          Every state of <code>/handover-protocol/verify[/protocolId]</code>: real PDFs read by the real reader, hashed by
          Web Crypto, registry replies decoded by the real decoder. Only the network is scripted — no request leaves the page.
        </p>
      </header>

      <Card asChild className="flex flex-wrap items-center gap-6 p-4 text-sm">
        <section aria-label="Harness controls">
          <PanelWidthSelect width={width} onChange={setWidth} />
          <span className="text-muted-foreground">{PANEL_COUNT} panels</span>
        </section>
      </Card>

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
    </section>
  );
}

function PanelGroup({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="m-0 text-lg font-semibold text-foreground">{title}</h2>
      <section className="flex flex-wrap items-start gap-6">{children}</section>
    </section>
  );
}

function Panel({ id, className, children }: { readonly id: string; readonly className: string; readonly children: React.ReactNode }) {
  return (
    <Card asChild className={className}>
      <article data-testid={`harness-panel-${id}`}>
        <h3 className="m-0 font-mono text-xs text-muted-foreground">{id}</h3>
        {children}
      </article>
    </Card>
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
