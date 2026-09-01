'use client';

/**
 * **ΟΙ ΤΕΣΣΕΡΙΣ ΑΞΟΝΕΣ ΩΣ ΠΕΔΙΑ** — χώρος · χρόνος · χαρακτηριστικά · γειτονιά.
 *
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · SPEC-777B §12.2 · §12.3
 * @module components/demand/form/DemandAxisFields
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΔΙΑΤΑΞΗ ΤΗΣ ΦΟΡΜΑΣ ΕΙΝΑΙ ΤΟ ΜΟΝΤΕΛΟ, ΟΧΙ ΜΙΑ ΛΙΣΤΑ ΠΕΔΙΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §12.2 ονομάζει την τομή: `ΧΩΡΟΣ ∩ ΧΡΟΝΟΣ ∩ ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ ∩ ΓΕΙΤΟΝΙΑ`. Οι
 * οκτώ μορφές **Ζ1–Ζ8 αποσυντίθενται** πάνω σε αυτούς — δεν αντιστοιχίζονται μία προς
 * μία. Άρα η φόρμα έχει **τέσσερα** `<fieldset>`, ένα ανά άξονα, και **όχι** οκτώ
 * ομάδες «μία ανά μορφή»: εκείνο θα ήταν αδύνατο να εκφράσει το προφανές — *«αυτό το
 * κτίριο, 3ος όροφος, από τον Μάρτιο, κοντά σε σχολείο»* είναι **ένα** αίτημα που
 * αγγίζει **και τους τέσσερις** ταυτόχρονα.
 *
 * ⚠️ **Η Ζ7 δεν είναι εδώ** — δεν είναι άξονας. Ζει στο `DemandLifeContextField`, με
 * τον δικό της, γραμμένο ρόλο (Α14 §17.2 κανόνας 3).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PROPERTY_TYPES, PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
import { OFFER_KINDS, type OfferKind } from '@/types/property-offers';
import { DEMAND_PROXIMITY_KINDS, type DemandProximityKind } from '@/types/property-demand';
import { FORM_PLACE_KINDS, type DemandFormValues } from '@/lib/demand/demand-form-values';
import { useFormContext } from 'react-hook-form';
import {
  DemandFieldset,
  DemandNumberField,
  DemandOptionsField,
} from './demand-field-primitives';
import { DemandPlaceResolver } from './DemandPlaceResolver';
import { PlaceIdentityField } from '@/components/geo/PlaceIdentityField';
import { DemandAreaOutline } from './DemandAreaOutline';
import { DemandFrontageField } from './DemandFrontageField';
import { DemandProximityField } from './DemandProximityField';

const NS = 'property-market';

/**
 * **Ο άξονας διάθεσης** — `schema.org/Demand`: *«the very same properties used for
 * Offer apply»*.
 *
 * 🔑 Οι επιλογές είναι το **ίδιο** `OFFER_KINDS` που δηλώνει η προσφορά, όχι
 * καθρεφτισμένο λεξιλόγιο. Ένα `buy`/`rentIn` εδώ θα ήταν **δεύτερη αλήθεια για τον
 * ίδιο άξονα** (ADR-749) και θα απαιτούσε πίνακα μετάφρασης που μπορεί να αποκλίνει.
 */
export function DemandSeeksField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <DemandFieldset
      legend={t(`${NS}:demand.form.seeks.legend`)}
      help={t(`${NS}:demand.form.seeks.help`)}
    >
      <DemandOptionsField<OfferKind>
        name="seeks"
        mode="multiple"
        options={OFFER_KINDS}
        labelOf={(kind) => t(`${NS}:demand.form.seeks.${kind}`)}
      />
    </DemandFieldset>
  );
}

/**
 * **ΧΩΡΟΣ** (Ζ1 · Ζ2 · Ζ3 · Ζ4 · Ζ5) — και οι **τέσσερις** μορφές του μοντέλου.
 *
 * ✅ Το δηλωμένο κενό **έκλεισε** (2026-08-11): μέχρι τότε εδώ στεκόταν μια πρόταση
 * που έλεγε στον άνθρωπο ότι *«δύο ακόμη τρόποι έρχονται»*. Ήταν ειλικρινής όσο το
 * επίπεδο Α ήταν άδειο· τώρα η ταυτότητα γεννιέται **κατ' απαίτηση** (§13.5) και δεν
 * υπάρχει λίστα να ανοίξει κενή — ο άνθρωπος **δείχνει** στον χάρτη.
 */
export function DemandPlaceField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const { watch, setValue } = useFormContext<DemandFormValues>();
  const placeKind = watch('placeKind');
  const placeRef = watch('placeRef');
  const placeOutline = watch('placeOutline');

  return (
    <DemandFieldset legend={t(`${NS}:demand.form.place.legend`)}>
      <DemandOptionsField
        name="placeKind"
        mode="single"
        options={FORM_PLACE_KINDS}
        labelOf={(kind) => t(`${NS}:demand.form.place.${kind}`)}
      />

      {placeKind === 'near' && <DemandPlaceResolver />}

      {/*
        **Ζ3/Ζ5** — «αυτό το κτίριο». Ο επιλογέας δίνει ταυτότητα του **επιπέδου Α**,
        δηλαδή ακριβώς το πράγμα στο οποίο δείχνει και μια προσφορά (§14.5). Ο
        `target` είναι `building` γιατί αυτή είναι η ερώτηση της Ζ3/Ζ5· η γη έρχεται
        μαζί, γιατί **αυτή** κρατά τη θέση (Α1).
      */}
      {placeKind === 'place' && (
        <PlaceIdentityField
          chosen={placeRef}
          onChosen={(ref) => setValue('placeRef', ref, { shouldDirty: true })}
        />
      )}

      {/*
        **Ζ4** — «μόνο αυτό το κομμάτι της». Η **ίδια** επιφάνεια σχεδίασης με τη
        χειρονομία `drawn` του §13.6 — μία επιφάνεια, δύο χρήσεις.
      */}
      {placeKind === 'area' && (
        <DemandAreaOutline
          outline={placeOutline}
          onDrawn={(outline) => setValue('placeOutline', outline, { shouldDirty: true })}
        />
      )}

      {/*
        **Ζ4 δομημένη** — «μόνο η νότια πλευρά, μόνο αυτά τα 200 μέτρα». Δικός της
        άξονας + πλευρά + βάθος, γι' αυτό διαβάζει/γράφει τη φόρμα η ίδια αντί να
        περνούν τέσσερα props — ίδιο ιδίωμα με το {@link DemandProximityField}.
      */}
      {placeKind === 'frontage' && <DemandFrontageField />}
    </DemandFieldset>
  );
}

/**
 * **ΧΡΟΝΟΣ** (Ζ1 · Ζ2 · Ζ3) — ο άξονας που **δεν υπάρχει σε κανένα portal** (§12.3).
 *
 * ⚠️ Ημερομηνίες `<input type="date">`, δηλαδή ISO `YYYY-MM-DD` — **ποτέ** επιλογέας
 * που παράγει `Date`: το «Μάρτιος 2027» είναι **πρόθεση σε ημερολόγιο**, χωρίς ώρα και
 * χωρίς ζώνη ώρας, και ένα `Timestamp` θα του επινοούσε **και τα δύο**.
 */
export function DemandTimingField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<DemandFormValues>();
  const timingKind = form.watch('timingKind');

  return (
    <DemandFieldset
      legend={t(`${NS}:demand.form.timing.legend`)}
      help={t(`${NS}:demand.form.timing.help`)}
    >
      <DemandOptionsField
        name="timingKind"
        mode="single"
        options={['now', 'window', 'whenever'] as const}
        labelOf={(kind) => t(`${NS}:demand.form.timing.${kind}`)}
      />

      {timingKind === 'window' && (
        <div className="flex flex-wrap gap-3">
          <DemandDateField name="fromDate" label={t(`${NS}:demand.form.timing.fromLabel`)} />
          <DemandDateField name="toDate" label={t(`${NS}:demand.form.timing.toLabel`)} />
        </div>
      )}

      {timingKind === 'whenever' && (
        <p className="text-sm text-muted-foreground">
          {t(`${NS}:demand.form.timing.wheneverHint`)}
        </p>
      )}
    </DemandFieldset>
  );
}

/** Ημερομηνία ISO. Ξεχωριστό από το αριθμητικό: **κενό = `''`**, ποτέ `null`. */
function DemandDateField({
  name,
  label,
}: {
  name: 'fromDate' | 'toDate';
  label: string;
}): React.ReactElement {
  const form = useFormContext<DemandFormValues>();
  const inputId = React.useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        type="date"
        {...form.register(name)}
        className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
      />
    </div>
  );
}

/** **ΧΑΡΑΚΤΗΡΙΣΤΙΚΑ** (Ζ8 + ο όροφος της Ζ5). */
export function DemandFeaturesField(): React.ReactElement {
  const { t } = useTranslation([NS, 'properties-enums']);
  const K = `${NS}:demand.form.features`;

  return (
    <DemandFieldset legend={t(`${K}.legend`)}>
      <p className="text-sm text-foreground">{t(`${K}.typesLabel`)}</p>
      <p className="text-sm text-muted-foreground">{t(`${K}.typesHelp`)}</p>
      <DemandOptionsField
        name="types"
        mode="multiple"
        options={PROPERTY_TYPES}
        labelOf={(type) => t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[type]}`)}
      />

      <DemandRangeRow
        legend={t(`${K}.priceLegend`)}
        help={t(`${K}.priceHelp`)}
        minName="priceMin"
        maxName="priceMax"
        minLabel={t(`${K}.priceMin`)}
        maxLabel={t(`${K}.priceMax`)}
        floor={0}
      />
      <DemandRangeRow
        legend={t(`${K}.areaLegend`)}
        minName="areaMin"
        maxName="areaMax"
        minLabel={t(`${K}.areaMin`)}
        maxLabel={t(`${K}.areaMax`)}
        floor={0}
      />
      <DemandRangeRow
        legend={t(`${K}.floorLegend`)}
        help={t(`${K}.floorHelp`)}
        minName="floorMin"
        maxName="floorMax"
        minLabel={t(`${K}.floorMin`)}
        maxLabel={t(`${K}.floorMax`)}
      />

      <div className="flex flex-col gap-1">
        <DemandNumberField name="bedroomsMin" label={t(`${K}.bedroomsMin`)} min={0} />
        <p className="text-sm text-muted-foreground">{t(`${K}.bedroomsHelp`)}</p>
      </div>
    </DemandFieldset>
  );
}

/**
 * Ένα εύρος «από/έως».
 *
 * ⚠️ Το `floor` λείπει **επίτηδες** στον όροφο: υπάρχουν **υπόγεια**, και ένα
 * `min={0}` θα έκανε το «−1» αδύνατο να πληκτρολογηθεί. Το ισόγειο είναι `0`, όχι το
 * κάτω άκρο του κόσμου.
 */
function DemandRangeRow({
  legend,
  help,
  minName,
  maxName,
  minLabel,
  maxLabel,
  floor,
}: {
  legend: string;
  help?: string;
  minName: 'priceMin' | 'areaMin' | 'floorMin';
  maxName: 'priceMax' | 'areaMax' | 'floorMax';
  minLabel: string;
  maxLabel: string;
  floor?: number;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{legend}</p>
      {help !== undefined && <p className="text-sm text-muted-foreground">{help}</p>}
      <div className="flex flex-wrap gap-3">
        <DemandNumberField name={minName} label={minLabel} min={floor} />
        <DemandNumberField name={maxName} label={maxLabel} min={floor} />
      </div>
    </div>
  );
}

/** **ΓΕΙΤΟΝΙΑ** (Ζ6) — το λεξιλόγιο είναι δικό μας, η άντληση έρχεται. */
export function DemandNeighbourhoodField(): React.ReactElement {
  const { t } = useTranslation([NS]);
  return (
    <DemandFieldset
      legend={t(`${NS}:demand.form.proximity.legend`)}
      help={t(`${NS}:demand.form.proximity.help`)}
    >
      <DemandProximityField
        kinds={DEMAND_PROXIMITY_KINDS}
        labelOf={(kind: DemandProximityKind) => t(`${NS}:demand.proximityKind.${kind}`)}
      />
    </DemandFieldset>
  );
}
