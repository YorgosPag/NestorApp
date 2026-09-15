'use client';

/**
 * @fileoverview **`/o/<χώρος>/settings/agency-profile/registry` — τα Στοιχεία ΓΕΜΗ** (ADR-841 §7 Α23.9 Φέτα Β).
 * @related components/mandate/ShowcaseRegistrySections.tsx · components/mandate/ShowcaseRegistryDoor.tsx
 * @module components/mandate/ShowcaseRegistryContent
 *
 * 🔑 **Δύο αναγνώστες, και κανένας δεύτερος**: η βιτρίνα από το **ίδιο** hook με τη σελίδα της (`useAgencyShowcase`
 * — κλείσιμο + απόσυρση) και η κρίση από το **ίδιο** hook με τη δήλωση μεσιτείας (`useCompanyRegistryIdentity`).
 *
 * 🏆 **Πρακτική**: Google Business Profile — η οριστικά κλειστή *«clearly shows that your business is closed»* και
 * διορθώνεται από τον κάτοχο· Stripe — τα στοιχεία επιχείρησης σε δική τους οθόνη ρυθμίσεων, με την επωνυμία
 * ευθυγραμμισμένη με το **επίσημο αρχείο** (`failed_name_match`). **Εξυπνότερα**: η επωνυμία δεν ξαναγράφεται με
 * το χέρι — υιοθετείται **από την ίδια την αρχή** με έλεγχο ταυτόχρονης αλλαγής (Α23.2).
 *
 * ⚖️ **GDPR άρθ. 14(2)(στ)** — η πηγή («ΓΕΜΗ, δημόσιο μητρώο») γράφεται **στην οθόνη**, δίπλα στα στοιχεία.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAgencyShowcase } from '@/hooks/mandate/useAgencyShowcase';
import { useCompanyRegistryIdentity } from '@/hooks/company/useCompanyRegistryIdentity';
import { registryClosureOf } from '@/lib/agency/showcase-registry-closure';
import { AGENCY_SHOWCASE_ROUTE } from '@/lib/mandate/mandate-routes';

import { SHOWCASE_CARD_KEYS, SHOWCASE_KEYS, SHOWCASE_NS } from './agency-showcase-labels';
import { SHOWCASE_REGISTRY_KEYS } from './agency-showcase-registry-labels';
import { ShowcaseBackLink } from './ShowcaseDoorLink';
import { RegistryClosureNotice, RegistryJudgmentSection } from './ShowcaseRegistrySections';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE, στο **client** component (όχι στο `page.tsx`): ξεχωριστοί γράφοι module (CHECK 3.51).
import routeSlice from '@/i18n/generated/routes/o__workspace__settings__agency-profile__registry.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function ShowcaseRegistryContent(): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const showcase = useAgencyShowcase();
  const registry = useCompanyRegistryIdentity();
  const published = showcase.state.phase === 'published' ? showcase.state.profile : null;
  const closure = published === null ? null : registryClosureOf(published);

  return (
    <section className="flex w-full flex-col gap-6">
      <ShowcaseBackLink href={AGENCY_SHOWCASE_ROUTE} label={t(SHOWCASE_CARD_KEYS.backToShowcase)} />
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(SHOWCASE_REGISTRY_KEYS.title)}</h1>
        <p className="m-0 text-muted-foreground">{t(SHOWCASE_REGISTRY_KEYS.lead)}</p>
      </header>
      {closure !== null ? (
        <RegistryClosureNotice closure={closure} busy={showcase.busy} onWithdraw={showcase.withdraw} />
      ) : null}
      {showcase.failure !== null ? (
        <p role="alert" className="m-0 text-sm text-destructive">{t(SHOWCASE_KEYS.failed)}</p>
      ) : null}
      <RegistryJudgmentSection registry={registry} />
      <p className="m-0 text-xs text-muted-foreground" data-testid="showcase-registry-source">
        {t(SHOWCASE_REGISTRY_KEYS.source)}
      </p>
    </section>
  );
}
