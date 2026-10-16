'use client';

/**
 * @fileoverview **`/o/<χώρος>/settings/agency-profile/licences` — οι άδειες της βιτρίνας** (ADR-915 §21).
 * @related ShowcaseLicenceField.tsx (το πεδίο) · hooks/mandate/useShowcaseLicences.ts (η αποθήκευση) ·
 *   services/mandate/showcase-licence-custody.ts (ο γραφέας) · ShowcaseLicencesDoor.tsx (η πόρτα)
 * @module components/mandate/ShowcaseLicencesContent
 *
 * 🏆 **Πρακτική**: LinkedIn «Licenses & certifications» και Houzz «Verified License» — οι άδειες σε **δική τους** ενότητα,
 *    χωριστά από την ειδικότητα. **Εξυπνότερα**: ο αριθμός δείχνεται στην κάρτα ως **δήλωση**, με σύνδεσμο ελέγχου στο
 *    δημόσιο μητρώο — ποτέ ως «επαληθευμένο» χωρίς να ρωτηθεί η αρχή (ADR-798 §7).
 * 🔑 **Ένας αναγνώστης**: η βιτρίνα από το **ίδιο** hook με τη σελίδα της (`useAgencyShowcase`, ζωντανά)· μετά την
 *    αποθήκευση το έγγραφο ξαναφτάνει και η φόρμα ευθυγραμμίζεται μόνη της.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAgencyShowcase } from '@/hooks/mandate/useAgencyShowcase';
import { useShowcaseLicences, type ShowcaseLicencesFailure } from '@/hooks/mandate/useShowcaseLicences';
import { AGENCY_SHOWCASE_ROUTE } from '@/lib/mandate/mandate-routes';
import type { PublicShowcase } from '@/types/agency-profile';

import { SHOWCASE_CARD_KEYS, SHOWCASE_KEYS, SHOWCASE_LICENCE_REJECTION_KEYS, SHOWCASE_NS } from './agency-showcase-labels';
import { ShowcaseBackLink } from './ShowcaseDoorLink';
import { licenceDraftsOf, licenceWireOf, NO_LICENCE_DRAFTS, ShowcaseLicenceField } from './ShowcaseLicenceField';

// 🧩 ADR-744 §15 — PER-ROUTE SLICE, στο **client** component (όχι στο `page.tsx`): ξεχωριστοί γράφοι module (CHECK 3.51).
import routeSlice from '@/i18n/generated/routes/o__workspace__settings__agency-profile__licences.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

export function ShowcaseLicencesContent(): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { state } = useAgencyShowcase();

  return (
    <section className="flex w-full flex-col gap-6">
      <ShowcaseBackLink href={AGENCY_SHOWCASE_ROUTE} label={t(SHOWCASE_CARD_KEYS.backToShowcase)} />
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{t(SHOWCASE_KEYS.licencesTitle)}</h1>
        <p className="m-0 text-muted-foreground">{t(SHOWCASE_KEYS.licencesLead)}</p>
      </header>
      {state.phase === 'published' ? <LicencesForm published={state.profile} /> : null}
      {state.phase === 'not-published' ? (
        <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.licencesNeedsShowcase)}</p>
      ) : null}
      {state.phase === 'unavailable' ? (
        <p role="alert" className="m-0 text-sm text-destructive">{t(SHOWCASE_KEYS.temporarilyUnavailable)}</p>
      ) : null}
    </section>
  );
}

function LicencesForm({ published }: { readonly published: PublicShowcase }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { busy, failure, saved, save } = useShowcaseLicences();
  const [drafts, setDrafts] = React.useState(NO_LICENCE_DRAFTS);

  // 🔑 Προσυμπλήρωση από τη ΔΗΜΟΣΙΕΥΜΕΝΗ λίστα, όποτε αλλάζει (κλειδί = το περιεχόμενό της, όχι η ταυτότητα του πίνακα).
  const storedKey = JSON.stringify(published.licences);
  React.useEffect(() => {
    setDrafts(licenceDraftsOf(published.licences));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- κλειδί περιεχομένου
  }, [storedKey]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save({ licences: licenceWireOf(drafts) });
      }}
    >
      <ShowcaseLicenceField value={drafts} onChange={setDrafts} />
      {failure !== null ? <p role="alert" className="m-0 text-sm text-destructive">{failureText(t, failure)}</p> : null}
      <span className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? t(SHOWCASE_CARD_KEYS.saving) : t(SHOWCASE_KEYS.licencesSave)}
        </Button>
        {saved ? <span role="status" className="text-sm text-muted-foreground">{t(SHOWCASE_KEYS.licencesSaved)}</span> : null}
      </span>
    </form>
  );
}

function failureText(t: ReturnType<typeof useTranslation>['t'], failure: ShowcaseLicencesFailure): string {
  return failure.kind === 'rejected' ? t(SHOWCASE_LICENCE_REJECTION_KEYS[failure.reason]) : t(SHOWCASE_KEYS.failed);
}
