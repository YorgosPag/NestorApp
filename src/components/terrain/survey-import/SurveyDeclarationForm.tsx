'use client';

/**
 * @fileoverview **Η δήλωση Δ2 και η δημοσίευση** (ADR-920 Β4.9): ποιος μέτρησε, πότε, και ότι έχεις δικαίωμα να το
 * δημοσιεύσεις — μετά ένα κουμπί, και η έκβαση με λέξεις.
 * @related hooks/listings/useTerrainSurveyImport (`publish` · `publication` · `canPublish`) ·
 *   lib/terrain/publication/terrain-survey-declaration (ο ΕΝΑΣ κριτής — τον τρέχει το hook πριν φύγει οτιδήποτε) ·
 *   lib/terrain/publication/terrain-publication-contract (`TERRAIN_REFUSAL_MESSAGE_LIMITS`)
 * @module components/terrain/survey-import/SurveyDeclarationForm
 *
 * 🔑 **Η φόρμα δεν κρίνει** — κρατά ό,τι γράφει ο άνθρωπος ωμό· το κρίνει ο κριτής της πόρτας (ίδιος κώδικας, ίδιο μήνυμα).
 *   Το κουμπί απλώς περιμένει να υπάρχει κάτι να κριθεί.
 * 🔑 **Η έκβαση ανήκει στα bytes που έφυγαν** (το hook): αλλάζει στήλη ή μονάδα ⇒ το «δημοσιεύτηκε» σβήνει.
 * 🔑 **Δημοσιεύεται μόνο το παράγωγο** (Δ2) — το λέει η ίδια η δήλωση, δίπλα στο κουτάκι, όχι κάπου στους όρους.
 */

import React, { useId, useState } from 'react';

import { CheckLine } from '@/components/shared/form/CheckLine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TerrainSurveyDraft, TerrainSurveyImportApi } from '@/hooks/listings/useTerrainSurveyImport';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { normalizeCalendarDay, todayLocalDate } from '@/lib/date-local';
import { LISTING_TERRAIN_SURVEYOR_NAME_MAX } from '@/lib/terrain/publication/listing-terrain-config';
import { TERRAIN_REFUSAL_MESSAGE_LIMITS } from '@/lib/terrain/publication/terrain-publication-contract';

const NS = 'terrain-survey';

const EMPTY_DRAFT: TerrainSurveyDraft = { surveyorName: '', surveyedOn: '', rightsAffirmed: false };

export interface SurveyDeclarationFormProps {
  readonly survey: Pick<TerrainSurveyImportApi, 'publish' | 'publication' | 'canPublish'>;
  /** Υπάρχει ήδη δημοσιευμένο έδαφος ⇒ το κουμπί λέει «αντικατάσταση», όχι «δημοσίευση». */
  readonly replacing: boolean;
}

/** Η έκβαση της τελευταίας δημοσίευσης — ανακοινώνεται· η άρνηση ως `alert`. */
function PublicationOutcome({ publication }: { readonly publication: TerrainSurveyImportApi['publication'] }) {
  const { t } = useTranslation([NS]);
  if (publication.kind === 'refused') {
    return (
      <p role="alert" className="m-0 rounded border border-destructive p-2 text-sm text-foreground">
        {t(`${NS}:publish.refusals.${publication.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)}
      </p>
    );
  }
  const text = publication.kind === 'publishing' ? t(`${NS}:publish.publishing`)
    : publication.kind === 'published' ? t(`${NS}:publish.listing.${publication.listing}`) : '';
  return <p role="status" className="m-0 text-sm text-foreground">{text}</p>;
}

function DeclarationFields({ draft, onDraft, disabled }: {
  readonly draft: TerrainSurveyDraft;
  readonly onDraft: (patch: Partial<TerrainSurveyDraft>) => void;
  readonly disabled: boolean;
}) {
  const { t } = useTranslation([NS]);
  const nameId = useId();
  const dateId = useId();
  return (
    <>
      <p className="m-0 flex flex-col gap-1">
        <Label htmlFor={nameId} className="text-xs text-muted-foreground">{t(`${NS}:declaration.surveyorName`)}</Label>
        <Input id={nameId} value={draft.surveyorName} maxLength={LISTING_TERRAIN_SURVEYOR_NAME_MAX} autoComplete="off"
          onChange={(event) => onDraft({ surveyorName: event.target.value })} disabled={disabled}
          aria-describedby={`${nameId}-hint`} size="sm" />
        <span id={`${nameId}-hint`} className="text-xs text-muted-foreground">{t(`${NS}:declaration.surveyorNameHint`)}</span>
      </p>
      <p className="m-0 flex flex-col gap-1">
        <Label htmlFor={dateId} className="text-xs text-muted-foreground">{t(`${NS}:declaration.surveyedOn`)}</Label>
        <Input id={dateId} type="date" value={draft.surveyedOn} max={todayLocalDate()} className="max-w-40"
          onChange={(event) => onDraft({ surveyedOn: normalizeCalendarDay(event.target.value) ?? '' })} disabled={disabled}
          aria-describedby={`${dateId}-hint`} size="sm" />
        <span id={`${dateId}-hint`} className="text-xs text-muted-foreground">{t(`${NS}:declaration.surveyedOnHint`)}</span>
      </p>
      <CheckLine label={t(`${NS}:declaration.rights`)} checked={draft.rightsAffirmed} disabled={disabled}
        onToggle={(rightsAffirmed) => onDraft({ rightsAffirmed })} />
      <p className="m-0 text-xs text-muted-foreground">{t(`${NS}:declaration.rightsHint`)}</p>
    </>
  );
}

export function SurveyDeclarationForm({ survey, replacing }: SurveyDeclarationFormProps) {
  const { t } = useTranslation([NS]);
  const [draft, setDraft] = useState<TerrainSurveyDraft>(EMPTY_DRAFT);
  const { publish, publication, canPublish } = survey;
  const publishing = publication.kind === 'publishing';
  const ready = canPublish && draft.surveyorName.trim() !== '' && draft.surveyedOn !== '' && draft.rightsAffirmed;
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ready) void publish(draft);
  };
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-busy={publishing}>
      <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 p-0 text-sm font-semibold text-foreground">{t(`${NS}:declaration.legend`)}</legend>
        <DeclarationFields draft={draft} onDraft={(patch) => setDraft((previous) => ({ ...previous, ...patch }))}
          disabled={publishing} />
      </fieldset>
      <footer className="flex flex-col items-start gap-2">
        <Button type="submit" disabled={!ready}>
          {t(replacing ? `${NS}:publish.replace` : `${NS}:publish.action`)}
        </Button>
        <PublicationOutcome publication={publication} />
      </footer>
    </form>
  );
}
