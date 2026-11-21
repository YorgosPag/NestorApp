'use client';

/**
 * @fileoverview 🏆 **«ΤΙ ΘΑ ΔΕΙ Ο ΚΟΣΜΟΣ»** — δημόσιο όνομα + πόση έδρα, με ζωντανή προεπισκόπηση (ADR-841 §7 Α23.14).
 * @related components/mandate/ShowcasePublicIdentityChoices.tsx · hooks/mandate/useShowcaseLegalPreview.ts ·
 *   components/mandate/LegalIdentityStatement.tsx
 * @module components/mandate/ShowcasePublicIdentitySection
 *
 * 🔴 **ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ**: η φόρμα έστελνε πάντα `seatDisclosure: null` ⇒ **κάθε** ατομική επιχείρηση αποτύγχανε
 * στη δημοσίευση με `agency-profile-seat-disclosure-missing`, **χωρίς** πεδίο στην οθόνη (προσομοίωση 2026-11-21).
 *
 * 🔑 **Η προεπισκόπηση είναι η ΙΔΙΑ απόδοση με τη δημόσια σελίδα** — `LegalIdentityStatement`, όχι αντίγραφο: ό,τι
 * βλέπει εδώ ο επαγγελματίας είναι ό,τι θα δει ο επισκέπτης στο `/pro/<alias>`.
 */

import React, { useId } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseLegalPreviewState } from '@/hooks/mandate/useShowcaseLegalPreview';
import type { LegalIdentityPreview } from '@/lib/agency/showcase-legal-identity';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { Link } from '@/lib/workspace/navigation';
import type { ShowcaseLegalDeclaration } from '@/types/showcase-legal-identity';

import { SHOWCASE_NS, SHOWCASE_REJECTION_KEYS } from '@/components/mandate/agency-showcase-labels';
import { SHOWCASE_PUBLIC_IDENTITY_KEYS } from '@/components/mandate/agency-showcase-public-identity-labels';
import { LegalIdentityStatement } from '@/components/mandate/LegalIdentityStatement';
import { PublicNameChoiceField, SeatDisclosureField } from '@/components/mandate/ShowcasePublicIdentityChoices';

type ReadyPreview = Extract<LegalIdentityPreview, { kind: 'ready' }>;

/** Η κάρτα «Προεπισκόπηση» — όνομα + «Νομικά στοιχεία», ακριβώς όπως στη δημόσια σελίδα. */
function PublicIdentityPreviewCard({
  preview,
  value,
}: {
  readonly preview: ReadyPreview;
  readonly value: ShowcaseLegalDeclaration;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const headingId = useId();
  const disclosure = value.seatDisclosure ?? preview.defaultSeat;
  const outcome = disclosure === null ? null : preview.seats[disclosure];
  const displayName = value.publicName.kind === 'legal-name' ? preview.base.legalName : value.publicName.title;
  return (
    <aside aria-labelledby={headingId} className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <h3 id={headingId} className="m-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t(SHOWCASE_PUBLIC_IDENTITY_KEYS.previewTitle)}
      </h3>
      {outcome?.kind === 'ok' ? (
        <>
          <p className="m-0 text-base font-semibold text-foreground">{displayName}</p>
          <dl className="m-0">
            <LegalIdentityStatement
              identity={{ ...preview.base, publicName: value.publicName.kind, seat: outcome.seat }}
            />
          </dl>
        </>
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.previewEmpty)}</p>
      )}
    </aside>
  );
}

/** Χωρίς επωνυμία δεν υπάρχει καμία επιλογή που περνά — ο λόγος λέγεται **μία** φορά, με τη θεραπεία. */
function NoLegalName({ preview }: { readonly preview: Extract<LegalIdentityPreview, { kind: 'rejected' }> }) {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <p className="m-0 flex flex-col gap-1 text-sm text-muted-foreground">
      <span>{t(SHOWCASE_REJECTION_KEYS[preview.reason])}</span>
      <Link href={APP_ROUTES.accountingSetup} className="font-medium text-foreground underline underline-offset-4">
        {t(SHOWCASE_PUBLIC_IDENTITY_KEYS.fixProfile)}
      </Link>
    </p>
  );
}

/** Ό,τι δεν είναι προεπισκόπηση: φόρτωση · δεν είσαι διαχειριστής · δεν απάντησε. */
function PreviewNotice({ state }: { readonly state: ShowcaseLegalPreviewState }): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  if (state.kind === 'ready') return null;
  // ⚠️ Τρεις **κυριολεκτικές** κλήσεις, ποτέ `t(key)`: δυναμικό κλειδί είναι αόρατο στη CHECK 3.8 και στον τεμαχιστή.
  return (
    <p className="m-0 text-xs text-muted-foreground">
      {state.kind === 'loading'
        ? t(SHOWCASE_PUBLIC_IDENTITY_KEYS.loading)
        : state.kind === 'forbidden'
          ? t(SHOWCASE_PUBLIC_IDENTITY_KEYS.forbidden)
          : t(SHOWCASE_PUBLIC_IDENTITY_KEYS.unavailable)}
    </p>
  );
}

export function ShowcasePublicIdentitySection({
  state,
  value,
  onChange,
}: {
  readonly state: ShowcaseLegalPreviewState;
  readonly value: ShowcaseLegalDeclaration;
  readonly onChange: (next: ShowcaseLegalDeclaration) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const headingId = useId();
  const preview = state.kind === 'ready' ? state.preview : null;
  const ready = preview?.kind === 'ready' ? preview : null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4" data-testid="showcase-public-identity">
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="m-0 text-base font-semibold text-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.title)}</h2>
        <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.lead)}</p>
      </header>
      <PreviewNotice state={state} />
      {preview?.kind === 'rejected' ? (
        <NoLegalName preview={preview} />
      ) : (
        <>
          {ready !== null && (
            <PublicNameChoiceField
              preview={ready}
              value={value.publicName}
              onChange={(publicName) => onChange({ ...value, publicName })}
            />
          )}
          <SeatDisclosureField
            preview={ready}
            value={value.seatDisclosure}
            onChange={(seatDisclosure) => onChange({ ...value, seatDisclosure })}
          />
          {ready !== null && <PublicIdentityPreviewCard preview={ready} value={value} />}
        </>
      )}
      <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.privacy)}</p>
    </section>
  );
}
