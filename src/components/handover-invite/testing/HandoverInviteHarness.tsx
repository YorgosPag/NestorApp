'use client';

/**
 * @fileoverview **ΓΚΑΛΕΡΙ ΚΑΤΑΣΤΑΣΕΩΝ — η πρόσκληση αγοραστή και η προέλευση του φακέλου, ΟΛΕΣ μαζί** (`/test-harness/handover-invite`).
 * @related ADR-916 Φ-Β2 · `handover-invite-scenarios.ts` · ADR-844 §11 (`FirstContactProofHarness` — το πρότυπο) ·
 *          `components/testing/harness/*` (ο κοινός μεταφορέας και το «πάτα όπως ο άνθρωπος»)
 * @module components/handover-invite/testing/HandoverInviteHarness
 *
 * 🔴 **Γιατί υπάρχει**: χωρίς `PROPERTY_HANDOVER_INVITE_SECRET` η ζωντανή σελίδα φτάνει **μία** από τις ~30 εκβάσεις
 * («δεν μπόρεσα» — μετρημένο 20/10 στον browser), και ο φυσικός δρόμος (συμφιλίωση πώλησης) θα έστελνε **αληθινά email
 * σε αληθινούς αγοραστές** από την παραγωγική βάση. Οι μεγάλοι δεν «βλέπουν» οθόνη γράφοντας στην παραγωγή· την αποδίδουν
 * σε **κάθε** κατάσταση, ντετερμινιστικά. Κανένα μυστικό, καμία βάση, κανένα email.
 *
 * 🏆 **Ό,τι φαίνεται εδώ είναι ό,τι θα δει ο άνθρωπος**: τα πάνελ αποδίδουν την **ίδια** `HandoverInviteContent` και τα
 * **ίδια** `PropertyDossierOrigin*` της παραγωγής· τα πάνελ απάντησης **πατούν** το κουμπί (η `play` του Storybook) και
 * η απάντηση του μεταφορέα περνά από τον **πραγματικό** αποκωδικοποιητή (`invitationLinkRefusalOf`).
 *
 * ⛔ **Ούτε διακόπτης θέματος/γλώσσας εδώ**: τα κατέχει το κέλυφος (CHECK 3.72) — 🧪 pseudo από τον ίδιο διακόπτη:
 * ό,τι μένει ελληνικό είναι hardcoded (ADR-666). ⛔ Ούτε `<main>` ούτε κενό/ταβάνι: ανήκουν στο κέλυφος (CHECK 3.63).
 * ⚠️ Ετικέτες εργαλείου στα αγγλικά, εκτός locales — το ιδίωμα κάθε harness (δες `harness-panel.tsx`).
 */

import React from 'react';

import { PropertyDossierOriginLine, PropertyDossierOriginNotice } from '@/components/property-dossier/PropertyDossierOrigin';
import { clickWhenEnabled, PANEL_WIDTH_CLASS, PanelWidthSelect, type PanelWidth } from '@/components/testing/harness/harness-panel';
import {
  scriptedBodyField,
  useScriptedTransport,
  type ScriptedGetRoute,
  type ScriptedRoute,
} from '@/components/testing/harness/scripted-transport';
import { Card } from '@/components/ui/card';
import { API_ROUTES } from '@/config/domain-constants';
import { FILE_CUSTODY_PARAM } from '@/lib/files/file-custody';

import { HandoverInviteContent } from '../HandoverInviteContent';
import {
  ANSWER_SCENARIOS,
  ORIGIN_SCENARIOS,
  SERVER_SCENARIOS,
  scriptedAnswerFor,
  scriptedDownloadFor,
  type AnswerScenario,
} from './handover-invite-scenarios';

/** Ο δρομολογητής του ΕΝΟΣ μεταφορέα — μόνο η πόρτα του αγοραστή, κατά token· όλα τα άλλα στον αληθινό. */
const handoverRoute: ScriptedRoute = (url, body) =>
  url.endsWith(API_ROUTES.PROPERTY_HANDOVER_INVITATIONS.REDEEM) ? scriptedAnswerFor(scriptedBodyField(body, 'token')) : undefined;

/** ADR-916 §5.13 — η πόρτα λήψης, κατά `fileId`: η «Λήψη PDF» των πάνελ Πρωτοκόλλου δεν φτάνει ποτέ στην παραγωγή. */
const downloadRoute: ScriptedGetRoute = (url, params) =>
  url.endsWith(API_ROUTES.DOWNLOAD) && typeof params.fileId === 'string'
    ? scriptedDownloadFor(params.fileId, String(params[FILE_CUSTODY_PARAM] ?? ''))
    : undefined;

const PANEL_COUNT = SERVER_SCENARIOS.length + ANSWER_SCENARIOS.length + ORIGIN_SCENARIOS.length;

export function HandoverInviteHarness(): React.JSX.Element {
  const [width, setWidth] = React.useState<PanelWidth>('auto');
  // 🔴 Η ΣΕΙΡΑ: κανένα πάνελ δεν πατά πριν σταθεί ο μεταφορέας (τα effects των παιδιών τρέχουν πρώτα).
  const armed = useScriptedTransport(handoverRoute, downloadRoute);
  const panelClass = `flex flex-col gap-3 overflow-visible p-4 ${PANEL_WIDTH_CLASS[width]}`;

  return (
    <section className="flex flex-col gap-6" aria-label="Handover Invite Harness">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-semibold text-foreground">Handover Invite — State Gallery</h1>
        <p className="m-0 max-w-3xl text-sm text-muted-foreground">
          Every state of <code>/handover-invite/[token]</code> and of the dossier origin badge, rendered at once against a
          scripted transport. Panels are derived from the closed sets (<code>InvitationRespond</code> × occasion,
          <code> CORE_INVITATION_REFUSALS</code>, <code>PROPERTY_HANDOVER_INVITATION_REFUSALS</code>,
          <code> PROPERTY_HANDOVER_LIFECYCLES</code>) — never listed by hand. No secret, no database, no email.
        </p>
      </header>

      <Card asChild className="flex flex-wrap items-center gap-6 p-4 text-sm">
        <section aria-label="Harness controls">
          <PanelWidthSelect width={width} onChange={setWidth} />
          <span className="text-muted-foreground">{PANEL_COUNT} panels</span>
        </section>
      </Card>

      <PanelGroup title="1 · Server — before any click">
        {SERVER_SCENARIOS.map((scenario) => (
          <Panel key={scenario.id} id={scenario.id} className={panelClass}>
            <HandoverInviteContent view={scenario.view} />
          </Panel>
        ))}
      </PanelGroup>

      <PanelGroup title="2 · Answer — the door's reply after the click">
        {ANSWER_SCENARIOS.map((scenario) => (
          <AnswerPanel key={scenario.id} scenario={scenario} armed={armed} className={panelClass} />
        ))}
      </PanelGroup>

      <PanelGroup title="3 · Dossier origin — card line + detail notice">
        {ORIGIN_SCENARIOS.map((scenario) => (
          <Panel key={scenario.id} id={scenario.id} className={panelClass}>
            <PropertyDossierOriginLine origin={scenario.origin} />
            <PropertyDossierOriginNotice origin={scenario.origin} />
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

/** **Ένα πάνελ = μία κατάσταση.** Η λεζάντα λέει μόνο την ταυτότητα — το «τι κάνει» το δείχνει η ίδια η οθόνη. */
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

/** Πατά **το κουμπί της πράξης του σεναρίου**, μία φορά, μόλις σταθεί ο μεταφορέας — όπως ο άνθρωπος. */
function AnswerPanel({ scenario, armed, className }: { readonly scenario: AnswerScenario; readonly armed: boolean; readonly className: string }) {
  const host = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const root = host.current;
    if (!armed || root === null) return;
    return clickWhenEnabled(root, `button[data-invite-action="${scenario.action}"]`);
  }, [armed, scenario.action]);

  return (
    <Panel id={scenario.id} className={className}>
      <section ref={host}>
        <HandoverInviteContent view={scenario.view} />
      </section>
    </Panel>
  );
}
