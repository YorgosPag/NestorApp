'use client';

/**
 * **Βήμα 1 — η θέση του ακινήτου** (ADR-898 Φ2): διεύθυνση ή πινέζα στον χάρτη → ζώνη → τιμή ζώνης.
 *
 * 🔑 **Κάθε κατάσταση λέει κάτι**: κατά προσέγγιση διεύθυνση ⇒ «πατήστε στον χάρτη» · εκτός ζωνών ⇒ «συμπληρώστε την
 * τιμή» · αποτυχία ⇒ «δοκιμάστε ξανά» — ποτέ σιωπή που διαβάζεται ως «δεν υπάρχει ζώνη».
 *
 * 🔑 **Τα μέτωπα υπό όρο είναι ΕΡΩΤΗΣΗ** («έχει πρόσοψη στην οδό …;»), με προεπιλογή «όχι» — η θέση δεν αποδεικνύει
 * πρόσοψη (ADR-889 §10).
 */

import React, { useId } from 'react';
import dynamic from 'next/dynamic';

import { PlaceMap } from '@/components/geo/PlaceMap';
import { OpenDataAttribution } from '@/components/market/OpenDataAttribution';
import { useZonePriceLabel, ValueZoneSummary, type ReadyValueZone } from '@/components/market/ValueZoneSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { CalculatorStep, LabelledNumber } from './objective-value-inputs';
import { frontKeyOf } from '@/lib/objective-value/objective-value-zone';
import type { ObjectiveValueLocationState } from './useObjectiveValueLocation';

/**
 * ⚠️ **Δυναμικό, και είναι όριο κλειστότητας i18n** (CHECK 3.34 · ADR-744 §18): η επιβεβαίωση διεύθυνσης εμφανίζεται
 * **μόνο** μετά από αναζήτηση, δηλαδή ποτέ στο SSR. Στατική εισαγωγή θα έβαζε τα κλειδιά της (`property-market`) στο
 * route slice κάθε επισκέπτη — για κείμενο που ο περισσότερος κόσμος δεν θα δει.
 */
const ResolvedPlaceConfirmation = dynamic(
  () => import('@/components/geo/ResolvedPlaceConfirmation').then((m) => m.ResolvedPlaceConfirmation),
  { ssr: false },
);

const NS = 'objective-value';
const NO_FRONT = 'none';
/** Επίπεδο πόλης: ο άνθρωπος βλέπει δρόμους και μπορεί να πατήσει, πριν ψάξει διεύθυνση. */
const CITY_ZOOM = 12;
const MAP_CENTER = { lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE, lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE };

type LocationProps = { readonly location: ObjectiveValueLocationState };

function AddressSearch({ location }: LocationProps) {
  const { t } = useTranslation([NS]);
  const inputId = useId();
  const { query, setQuery, resolver } = location;
  const busy = resolver.state === 'resolving';
  return (
    <form
      role="search"
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void resolver.resolve(query);
      }}
    >
      <Label htmlFor={inputId}>{t(`${NS}:location.addressLabel`)}</Label>
      <span className="flex flex-wrap gap-2">
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(`${NS}:location.addressPlaceholder`)}
          disabled={busy}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="outline" disabled={busy || query.trim() === ''}>
          {busy ? t(`${NS}:location.resolving`) : t(`${NS}:location.resolve`)}
        </Button>
      </span>
      {resolver.state === 'not-found' && <p className="m-0 text-sm text-foreground">{t(`${NS}:location.notFound`)}</p>}
      {resolver.state === 'error' && <p className="m-0 text-sm text-foreground">{t(`${NS}:location.failed`)}</p>}
    </form>
  );
}

function FrontQuestion({ verdict, location }: { readonly verdict: ReadyValueZone } & LocationProps) {
  const { t } = useTranslation([NS]);
  const price = useZonePriceLabel();
  if (verdict.fronts.length === 0) return null;
  return (
    <RadioGroup
      value={location.frontKey ?? NO_FRONT}
      onValueChange={(next) => location.setFrontKey(next === NO_FRONT ? null : next)}
      className="flex flex-col gap-2"
    >
      {verdict.fronts.map((front) => (
        <Label key={frontKeyOf(front)} className="flex items-start gap-2 font-normal">
          <RadioGroupItem value={frontKeyOf(front)} className="mt-0.5" />
          {t(`${NS}:location.frontQuestion`, { street: front.street, price: price(front.price) })}
        </Label>
      ))}
      <Label className="flex items-start gap-2 font-normal">
        <RadioGroupItem value={NO_FRONT} className="mt-0.5" />
        {t(`${NS}:location.frontNo`)}
      </Label>
    </RadioGroup>
  );
}

function ManualPrice({ location }: LocationProps) {
  const { t } = useTranslation([NS]);
  return (
    <LabelledNumber
      label={t(`${NS}:location.manualLabel`)}
      help={t(`${NS}:location.manualHelp`)}
      value={location.manualPrice}
      onChange={location.setManualPrice}
    />
  );
}

type ZoneProblem = 'imprecise' | 'zoneFailed' | 'outside';

/** Τι πήγε στραβά με τη ζώνη — `null` όσο δεν υπάρχει θέση ή η ζώνη βρέθηκε. */
function zoneProblem(location: ObjectiveValueLocationState): ZoneProblem | null {
  const { lookup } = location;
  if (location.imprecise) return 'imprecise';
  if (lookup.kind === 'failed') return 'zoneFailed';
  if (lookup.kind !== 'answered' || lookup.verdict.kind === 'ready') return null;
  if (lookup.verdict.kind === 'outside') return 'outside';
  return lookup.verdict.kind === 'imprecise' ? 'imprecise' : 'zoneFailed';
}

/** Η ζώνη στη θέση — ή τι συνέβη. Μόνο κείμενο: η περιοχή είναι `aria-live`, τα πεδία ζουν έξω από αυτήν. */
function ZoneStatus({ location }: LocationProps) {
  const { t } = useTranslation([NS]);
  const price = useZonePriceLabel();
  const { lookup } = location;
  if (lookup.kind === 'loading') return <span className="text-sm text-muted-foreground">{t(`${NS}:location.loadingZone`)}</span>;
  if (lookup.kind === 'answered' && lookup.verdict.kind === 'ready') {
    return (
      <>
        <ValueZoneSummary verdict={lookup.verdict} />
        {location.zonePrice !== null && (
          <span className="text-sm font-medium text-foreground">{t(`${NS}:location.usedPrice`, { price: price(location.zonePrice) })}</span>
        )}
      </>
    );
  }
  const problem = zoneProblem(location);
  return problem === null ? null : <span className="text-sm text-foreground">{t(`${NS}:location.${problem}`)}</span>;
}

function ZoneAnswer({ location }: LocationProps) {
  const { lookup } = location;
  const ready = lookup.kind === 'answered' && lookup.verdict.kind === 'ready' ? lookup.verdict : null;
  return (
    <>
      {/* `role="status"` και όχι `<output>`: η περίληψη ζώνης έχει παραγράφους, που το `<output>` δεν δέχεται. */}
      <div role="status" className="flex flex-col gap-1">
        <ZoneStatus location={location} />
      </div>
      {ready !== null && <FrontQuestion verdict={ready} location={location} />}
      {ready === null && lookup.kind !== 'loading' && <ManualPrice location={location} />}
      {(ready !== null || (lookup.kind === 'answered' && lookup.verdict.kind === 'outside')) && (
        <OpenDataAttribution source="valueZones" />
      )}
    </>
  );
}

export function ObjectiveValueLocation({ location }: LocationProps) {
  const { t } = useTranslation([NS]);
  return (
    <CalculatorStep title={t(`${NS}:location.title`)}>
      <AddressSearch location={location} />
      {location.resolved !== null && <ResolvedPlaceConfirmation place={location.resolved} />}
      <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:location.mapHint`)}</p>
      <PlaceMap
        center={MAP_CENTER}
        initialZoom={CITY_ZOOM}
        onPick={location.pick}
        pin={location.pin}
        focus={location.focus}
        busy={location.lookup.kind === 'loading'}
        heightClass="h-72 md:h-96"
      />
      <ZoneAnswer location={location} />
    </CalculatorStep>
  );
}
