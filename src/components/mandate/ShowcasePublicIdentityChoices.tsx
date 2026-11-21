'use client';

/**
 * @fileoverview **Οι δύο επιλογές του «Τι θα δει ο κόσμος»** — δημόσιο όνομα και πόση έδρα (ADR-841 §7 Α23.14).
 * @related components/mandate/ShowcasePublicIdentitySection.tsx · lib/agency/showcase-legal-identity.ts
 * @module components/mandate/ShowcasePublicIdentityChoices
 *
 * 🔑 **Radio, όχι Select** (δόγμα `ChoiceField`): 2–4 επιλογές, όλες ορατές, μέσα σε `<fieldset>/<legend>`.
 *
 * 🏆 **Εξυπνότερο από τους μεγάλους**: κάθε επιλογή λέει **το ακριβές κείμενο** που θα δημοσιευτεί — ή, αν ο γραφέας
 * θα την αρνιόταν, **τον ίδιο λόγο** με σύνδεσμο στο σημείο όπου διορθώνεται, και **δεν** επιλέγεται. Ο άνθρωπος
 * δεν μαθαίνει το εμπόδιο **μετά** το «Δημοσίευση» (Google Business Profile: απόκρυψη διεύθυνσης χωρίς προεπισκόπηση).
 *
 * ⚖️ **Ατομική · ΟΕ: καμία προεπιλογή** (GDPR άρθ. 25(2), Δ7) — το «Μόνο ο δήμος» **προτείνεται**, δεν επιλέγεται.
 */

import React, { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { seatLineOf } from '@/lib/agency/showcase-legal-presentation';
import type { LegalIdentityPreview, SeatPreview } from '@/lib/agency/showcase-legal-identity';
import { AGENCY_SHOWCASE_CARD_ROUTE, AGENCY_SHOWCASE_REGISTRY_ROUTE } from '@/lib/mandate/mandate-routes';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { isOneOf } from '@/lib/type-guards';
import { Link } from '@/lib/workspace/navigation';
import { SEAT_DISCLOSURES, type PublicNameChoice, type SeatDisclosure } from '@/types/showcase-legal-identity';

import { SHOWCASE_NS, SHOWCASE_REJECTION_KEYS } from '@/components/mandate/agency-showcase-labels';
import {
  SEAT_DISCLOSURE_HINT_KEYS,
  SEAT_DISCLOSURE_TITLE_KEYS,
  SHOWCASE_PUBLIC_IDENTITY_KEYS,
} from '@/components/mandate/agency-showcase-public-identity-labels';

type ReadyPreview = Extract<LegalIdentityPreview, { kind: 'ready' }>;

const LINK_CLASS = 'text-sm font-medium text-foreground underline underline-offset-4';
const LEGAL_NAME_VALUE = 'legal-name';
const titleValue = (index: number): string => `title-${index}`;

/** Η τιμή του radio για την τρέχουσα επιλογή — `''` όταν ο τίτλος δεν είναι πια στο ΓΕΜΗ (ο γραφέας θα αρνιόταν). */
function nameValueOf(choice: PublicNameChoice, titles: readonly string[]): string {
  if (choice.kind === 'legal-name') return LEGAL_NAME_VALUE;
  const index = titles.indexOf(choice.title);
  return index < 0 ? '' : titleValue(index);
}

function nameChoiceOf(value: string, titles: readonly string[]): PublicNameChoice | null {
  if (value === LEGAL_NAME_VALUE) return { kind: 'legal-name' };
  const title = titles.find((_, index) => titleValue(index) === value);
  return title === undefined ? null : { kind: 'distinctive-title', title };
}

/** **Ποιο όνομα** — η επωνυμία ή ένας διακριτικός τίτλος του ΓΕΜΗ, **με την ορθογραφία του μητρώου**. */
export function PublicNameChoiceField({
  preview,
  value,
  onChange,
}: {
  readonly preview: ReadyPreview;
  readonly value: PublicNameChoice;
  readonly onChange: (next: PublicNameChoice) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const legendId = useId();
  const { titles } = preview;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.nameLegend)}</legend>
      <RadioGroup
        value={nameValueOf(value, titles)}
        onValueChange={(next) => {
          const choice = nameChoiceOf(next, titles);
          if (choice !== null) onChange(choice);
        }}
      >
        <Label className="flex items-center gap-2 text-sm font-normal">
          <RadioGroupItem value={LEGAL_NAME_VALUE} />
          <span>{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.nameLegal, { name: preview.base.legalName })}</span>
        </Label>
        {titles.map((title, index) => (
          <Label key={title} className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value={titleValue(index)} />
            <span>{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.nameTitle, { title })}</span>
          </Label>
        ))}
      </RadioGroup>
      {titles.length === 0 && (
        <p className="m-0 text-xs text-muted-foreground">
          {t(SHOWCASE_PUBLIC_IDENTITY_KEYS.noTitles)}{' '}
          <Link href={AGENCY_SHOWCASE_REGISTRY_ROUTE} className={LINK_CLASS}>{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.registryLink)}</Link>
        </p>
      )}
    </fieldset>
  );
}

/**
 * **Πού διορθώνεται** η έδρα που λείπει. 🔑 Α23.14.3 — η κάρτα συμπληρώνεται **και πριν** την πρώτη δημοσίευση
 * (πρόχειρο), άρα ο σύνδεσμος υπάρχει **πάντα**: η «διεύθυνση γραφείου» δεν είναι πια αδιέξοδο για ατομική/ΟΕ.
 */
function SeatFix({ disclosure }: { readonly disclosure: SeatDisclosure }) {
  const { t } = useTranslation([SHOWCASE_NS]);
  return disclosure === 'business-address' ? (
    <Link href={AGENCY_SHOWCASE_CARD_ROUTE} className={LINK_CLASS}>{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.fixCard)}</Link>
  ) : (
    <Link href={APP_ROUTES.accountingSetup} className={LINK_CLASS}>{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.fixProfile)}</Link>
  );
}

/** Τι θα γίνει με αυτή την επιλογή: το κείμενο που θα δημοσιευτεί, ή ο λόγος άρνησης και η θεραπεία. */
function SeatOutcome({
  disclosure,
  outcome,
}: {
  readonly disclosure: SeatDisclosure;
  readonly outcome: SeatPreview;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  if (outcome.kind === 'ok') {
    return <span className="text-sm text-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.willShow, { seat: seatLineOf(outcome.seat) })}</span>;
  }
  return (
    <span className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>{t(SHOWCASE_REJECTION_KEYS[outcome.reason])}</span>
      <SeatFix disclosure={disclosure} />
    </span>
  );
}

function SeatOption({
  disclosure,
  outcome,
  recommended,
}: {
  readonly disclosure: SeatDisclosure;
  /** `null` = καμία προεπισκόπηση (δεν είσαι διαχειριστής · δεν απάντησε) — η επιλογή μένει δυνατή. */
  readonly outcome: SeatPreview | null;
  readonly recommended: boolean;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const id = useId();
  return (
    // ⚠️ Ο σύνδεσμος «Συμπληρώστε…» ζει **έξω** από το `<Label>`: σύνδεσμος μέσα σε ετικέτα επιλέγει και πλοηγεί μαζί.
    <div className="flex items-start gap-3 rounded-md border border-border p-3">
      <RadioGroupItem id={id} value={disclosure} disabled={outcome?.kind === 'rejected'} className="mt-0.5" />
      <span className="flex flex-col gap-1">
        <Label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-foreground">
          {t(SEAT_DISCLOSURE_TITLE_KEYS[disclosure])}
          {recommended && <Badge variant="secondary">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.recommended)}</Badge>}
        </Label>
        <span className="text-xs text-muted-foreground">{t(SEAT_DISCLOSURE_HINT_KEYS[disclosure])}</span>
        {outcome !== null && <SeatOutcome disclosure={disclosure} outcome={outcome} />}
      </span>
    </div>
  );
}

/**
 * **Πόση έδρα** — οι τρεις επιλογές, η καθεμία με το ακριβές αποτέλεσμά της.
 *
 * 🔑 Σε ΑΕ/ΕΠΕ χωρίς ρητή επιλογή δείχνεται **επιλεγμένη η προεπιλογή του γραφέα** (`full`) — αυτό θα δημοσιευτεί·
 * σε ατομική/ΟΕ (`defaultSeat === null`) **τίποτα** δεν είναι επιλεγμένο μέχρι να διαλέξει ο άνθρωπος.
 */
export function SeatDisclosureField({
  preview,
  value,
  onChange,
}: {
  readonly preview: ReadyPreview | null;
  readonly value: SeatDisclosure | null;
  readonly onChange: (next: SeatDisclosure) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const legendId = useId();
  const required = preview !== null && preview.defaultSeat === null;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.seatLegend)}</legend>
      {required && <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_PUBLIC_IDENTITY_KEYS.seatRequired)}</p>}
      <RadioGroup
        value={value ?? preview?.defaultSeat ?? ''}
        onValueChange={(next) => {
          if (isOneOf(SEAT_DISCLOSURES, next)) onChange(next);
        }}
      >
        {SEAT_DISCLOSURES.map((disclosure) => (
          <SeatOption
            key={disclosure}
            disclosure={disclosure}
            outcome={preview?.seats[disclosure] ?? null}
            recommended={required && disclosure === 'municipality'}
          />
        ))}
      </RadioGroup>
    </fieldset>
  );
}
