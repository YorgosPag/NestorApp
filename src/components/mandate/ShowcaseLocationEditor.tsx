'use client';

/**
 * @fileoverview **ΕΝΑ ΚΑΤΑΣΤΗΜΑ ΤΗΣ ΚΑΡΤΑΣ** — ρόλος, τόπος, οδός, κανάλια, ωράριο (ADR-841 §7 Α21.16).
 * @related components/mandate/ShowcaseCardSection.tsx · lib/agency/showcase-card-draft.ts
 * @module components/mandate/ShowcaseLocationEditor
 *
 * 🔑 **Ο τόπος είναι το ΙΔΙΟ `PlaceIdentityField` με την έδρα της βιτρίνας** — τρίτο αντίγραφο
 * επιλογέα με χάρτη μέσα θα ήταν κλώνος. Ο διακομιστής επαληθεύει και παράγει τη θέση.
 *
 * ⚠️ **Διακόπτης οδού κλειστός από προεπιλογή** (GBP service-area): η **κατοικία** του υδραυλικού
 * δεν δημοσιεύεται επειδή ξέχασε ένα κουτάκι. Κλείνοντάς τον, η οδός **κρατιέται** στο πρόχειρο.
 */

import React from 'react';
import { MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlaceIdentityField } from '@/components/geo/PlaceIdentityField';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { draftHoursDefect, type ShowcaseLocationDraft } from '@/lib/agency/showcase-card-draft';
import { withoutProvenance } from '@/lib/agency/showcase-card-import';
import { usePlaceResolver, type ResolvedPlace } from '@/hooks/geo/usePlaceResolver';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';
import { SHOWCASE_CARD_IMPORT_KEYS } from '@/components/mandate/agency-showcase-import-labels';
import {
  SHOWCASE_CARD_KEYS,
  SHOWCASE_CARD_ROLE_KEYS,
  SHOWCASE_NS,
} from '@/components/mandate/agency-showcase-labels';
import { ShowcaseEmailFields, ShowcasePhoneFields } from './ShowcaseChannelFields';
import { ShowcaseImportProvenance } from './ShowcaseImportProvenance';
import type { SavedEmailChannels } from './ShowcaseEmailConfirmationControl';
import { WeeklyHoursField } from './WeeklyHoursField';

interface ShowcaseLocationEditorProps {
  readonly draft: ShowcaseLocationDraft;
  /** Α21.18 — ό,τι είναι **αποθηκευμένο** για αυτό το κατάστημα (κατάσταση επιβεβαίωσης email)· `null` = νέο. */
  readonly saved: SavedEmailChannels | null;
  readonly onChange: (draft: ShowcaseLocationDraft) => void;
  readonly onRemove: () => void;
}

/**
 * **Ο τόπος** — με «Εντοπισμό στον χάρτη» όταν η εισαγωγή (Α21.19) έφερε διεύθυνση αλλά όχι τόπο.
 *
 * 🔑 **Ο εντοπισμός ΚΕΝΤΡΑΡΕΙ, δεν ΕΠΙΛΕΓΕΙ**: η απάντηση του γεωκωδικοποιητή γίνεται `focus` και το κτίριο το
 * πατά ο άνθρωπος — ίδιο μοτίβο με το `OwnerPropertyPlaceField`. Ελεύθερο κείμενο διεύθυνσης λογιστικής που γινόταν
 * σιωπηλά τόπος θα ήταν σημείο που *μοιάζει* σωστό.
 */
function PlaceSection({ draft, onChange }: Omit<ShowcaseLocationEditorProps, 'onRemove' | 'saved'>): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const [focus, setFocus] = React.useState<PlaceFocus | null>(null);
  const { state, resolve } = usePlaceResolver({
    onFound: React.useCallback((place: ResolvedPlace) => {
      setFocus({ point: { lat: place.lat, lng: place.lng }, accuracy: place.accuracy, extent: place.extent });
    }, []),
    onCleared: React.useCallback(() => setFocus(null), []),
  });
  const placeHint = draft.place === null ? draft.placeHint : null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-medium text-foreground">{t(SHOWCASE_CARD_KEYS.placeLabel)}</h3>
      <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.placeHint)}</p>
      {placeHint !== null ? (
        <span className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={state === 'resolving'} onClick={() => void resolve(placeHint)}>
            <MapPin aria-hidden="true" /> {t(state === 'resolving' ? SHOWCASE_CARD_IMPORT_KEYS.locating : SHOWCASE_CARD_IMPORT_KEYS.locate)}
          </Button>
          <span className="text-xs text-muted-foreground">{placeHint}</span>
          {state === 'not-found' ? <span role="status" className="w-full text-sm text-muted-foreground">{t(SHOWCASE_CARD_IMPORT_KEYS.locateNotFound)}</span> : null}
          {state === 'error' ? <span role="alert" className="w-full text-sm text-destructive">{t(SHOWCASE_CARD_IMPORT_KEYS.locateFailed)}</span> : null}
        </span>
      ) : null}
      <PlaceIdentityField chosen={draft.place} onChosen={(place) => onChange({ ...draft, place })} target="land" focus={focus} />
    </section>
  );
}

function StreetFields({ draft, onChange }: Omit<ShowcaseLocationEditorProps, 'onRemove' | 'saved'>): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const id = React.useId();
  // Α21.19 — ό,τι γράφει ο άνθρωπος δεν είναι πια «από την εταιρεία».
  const edit = (patch: Partial<ShowcaseLocationDraft['street']>) =>
    onChange({ ...withoutProvenance(draft, 'street'), street: { ...draft.street, ...patch } });

  return (
    <section className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <Switch id={`${id}-street`} checked={draft.publishStreet} onCheckedChange={(checked) => onChange({ ...draft, publishStreet: checked })} />
        <Label htmlFor={`${id}-street`}>{t(SHOWCASE_CARD_KEYS.publishStreet)}</Label>
        <ShowcaseImportProvenance origin={draft.provenance.street} />
      </span>
      <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.publishStreetHint)}</p>
      {draft.publishStreet ? (
        <span className="flex flex-wrap gap-2">
          <Input className="w-64" autoComplete="address-line1" aria-label={t(SHOWCASE_CARD_KEYS.streetLabel)} placeholder={t(SHOWCASE_CARD_KEYS.streetLabel)} value={draft.street.street} onChange={(event) => edit({ street: event.target.value })} />
          <Input className="w-24" aria-label={t(SHOWCASE_CARD_KEYS.numberLabel)} placeholder={t(SHOWCASE_CARD_KEYS.numberLabel)} value={draft.street.number} onChange={(event) => edit({ number: event.target.value })} />
          <Input className="w-28" autoComplete="postal-code" inputMode="numeric" aria-label={t(SHOWCASE_CARD_KEYS.postalCodeLabel)} placeholder={t(SHOWCASE_CARD_KEYS.postalCodeLabel)} value={draft.street.postalCode} onChange={(event) => edit({ postalCode: event.target.value })} />
        </span>
      ) : null}
    </section>
  );
}

function HoursSection({ draft, onChange }: Omit<ShowcaseLocationEditorProps, 'onRemove' | 'saved'>): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const id = React.useId();

  return (
    <section className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        <Switch id={`${id}-hours`} checked={draft.hoursEnabled} onCheckedChange={(checked) => onChange({ ...draft, hoursEnabled: checked })} />
        <Label htmlFor={`${id}-hours`}>{t(SHOWCASE_CARD_KEYS.hoursDeclare)}</Label>
      </span>
      {draft.hoursEnabled ? (
        <WeeklyHoursField hours={draft.hours} defect={draftHoursDefect(draft)} onChange={(hours) => onChange({ ...draft, hours })} />
      ) : null}
    </section>
  );
}

export function ShowcaseLocationEditor({ draft, saved, onChange, onRemove }: ShowcaseLocationEditorProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const id = React.useId();

  return (
    <fieldset className="m-0 flex flex-col gap-4 rounded-md border border-border bg-card p-4">
      <legend className="px-1 text-sm font-semibold text-foreground">{t(SHOWCASE_CARD_ROLE_KEYS[draft.role])}</legend>
      <span className="flex flex-col gap-1">
        <Label htmlFor={`${id}-label`}>{t(SHOWCASE_CARD_KEYS.labelLabel)}</Label>
        <Input id={`${id}-label`} maxLength={80} placeholder={t(SHOWCASE_CARD_KEYS.labelPlaceholder)} value={draft.label} onChange={(event) => onChange({ ...draft, label: event.target.value })} />
      </span>
      <PlaceSection draft={draft} onChange={onChange} />
      <StreetFields draft={draft} onChange={onChange} />
      <ShowcaseImportProvenance origin={draft.provenance.phones} />
      <ShowcasePhoneFields phones={draft.phones} onChange={(phones) => onChange({ ...withoutProvenance(draft, 'phones'), phones })} />
      <ShowcaseImportProvenance origin={draft.provenance.emails} />
      <ShowcaseEmailFields emails={draft.emails} saved={saved} onChange={(emails) => onChange({ ...withoutProvenance(draft, 'emails'), emails })} />
      <HoursSection draft={draft} onChange={onChange} />
      <Button type="button" variant="outline" className="self-start" onClick={onRemove}>
        {t(SHOWCASE_CARD_KEYS.removeLocation)}
      </Button>
    </fieldset>
  );
}
