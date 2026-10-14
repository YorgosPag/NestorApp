'use client';

/**
 * **Το ενεργειακό πιστοποιητικό στη δημόσια αγγελία** (ADR-777 §8.94) — η κλίμακα Α+ … Η με τη βαθμίδα του ακινήτου,
 * οι δύο αριθμοί του ΠΕΑ, και η ισχύς του.
 *
 * @related `lib/energy-certificate/energy-certificate.ts` (ο κριτής · το κουτί) ·
 *   `components/shared/energy-certificate/EnergyClassScale.tsx` (η κλίμακα) · `./ListingLegality.tsx` (το ίδιο σήμα
 *   νομιμότητας, στην ενότητα «Νομικά»)
 *
 * 🔴 **ΠΕΝΤΕ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΜΙΑ ΣΙΩΠΗΛΗ**
 *
 * | Κουτί · κλάση | Τι γράφει |
 * |---|---|
 * | κουτί `null` | τίποτα — η ερώτηση **δεν τίθεται** (γη, ή διάθεση που δεν σηκώνει ΠΕΑ) |
 * | χωρίς κλάση, `pending` | «Το πιστοποιητικό είναι υπό έκδοση» |
 * | χωρίς κλάση, `exempt` | «Το ακίνητο εξαιρείται από την υποχρέωση» |
 * | χωρίς κλάση, τίποτα | «Δεν έχει δηλωθεί» — το κενό έχει όνομα |
 * | με κλάση | κλίμακα · αριθμοί (ή «δεν έχει δηλωθεί» ο καθένας) · «ΠΕΑ κτηρίου» αν ισχύει · ισχύς · «από το ΠΕΑ, κατά δήλωση» |
 *
 * 🔑 **Η ισχύς ΔΕΝ υπολογίζεται εδώ.** Τη λέει το σήμα `'energy-performance'` του `listing.legality` — η **μία**
 * απάντηση στο «ισχύει το ΠΕΑ;», που διαβάζει και η ενότητα «Νομικά». Ακίνητο με παλιά κλάση που κανείς δεν
 * ξαναδήλωσε απαντά εκεί `undeclared` ⇒ εδώ δεν γράφεται **καμία** γραμμή ισχύος (όχι «ισχύει», όχι «έληξε»).
 *
 * 🏆 Idealista: κλάση + δύο αριθμοί, σε κλίμακα που τοποθετεί με τον αριθμό. Εδώ η θέση είναι **της κλάσης** (ΚΕΝΑΚ),
 * και ο αναγνώστης μαθαίνει και αν το πιστοποιητικό **ισχύει ακόμη** — που κανένα από τα δύο μεγάλα ελληνικά δεν λέει.
 */

import React from 'react';

import { EnergyClassScale } from '@/components/shared/energy-certificate/EnergyClassScale';
import { SectionFrame } from '@/components/ui/section-frame';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListedEnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import { ENERGY_CERTIFICATE_ABSENCE_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import { formatNumber } from '@/lib/intl-formatting';
import type { LegalitySignalState } from '@/lib/legality/legality-signal';
import type { PublicListing } from '@/types/public-listing';

import { ListingEnergyCost } from './ListingEnergyCost';

type Translate = (key: string, options?: Record<string, unknown>) => string;

const ROW = 'flex flex-wrap items-baseline gap-x-3';
const TERM = 'text-sm text-muted-foreground';

/**
 * Η γραμμή ισχύος ανά κατάσταση του σήματος — κάθε κλειδί **κυριολεκτικό** μέσα στην κλήση, ώστε να το βλέπει ο
 * γεννήτορας του slice (κλειδί από μεταβλητή μένει ανεπίλυτο και το slice αρνείται να εκπεμφθεί).
 *
 * ⚠️ `undeclared` και `not-applicable` **δεν έχουν γραμμή**: το πρώτο σημαίνει «κλάση χωρίς δήλωση με προέλευση»
 * (παλιό έγγραφο), το δεύτερο δεν συνυπάρχει με κουτί. Και στα δύο η σιωπή είναι η αλήθεια — όχι «ισχύει».
 */
function validityText(t: Translate, state: LegalitySignalState | null): string | null {
  switch (state) {
    case 'declared':
      return t('listing-detail:energyCertificate.validity.valid');
    case 'expired':
      return t('listing-detail:energyCertificate.validity.expired');
    case 'expiry-unknown':
      return t('listing-detail:energyCertificate.validity.unknown');
    case 'undeclared':
    case 'not-applicable':
    case null:
      return null;
  }
}

/** Η κατάσταση του ΠΕΑ στο κανάλι νομιμότητας — `null` όταν η προβολή δεν κουβαλά καθόλου το είδος. */
function energyValidityOf(listing: PublicListing): LegalitySignalState | null {
  return listing.legality.find((signal) => signal.kind === 'energy-performance')?.state ?? null;
}

/** Ο αριθμός όπως τον τυπώνει το πιστοποιητικό: το πολύ ένα δεκαδικό, με τον διαχωριστή της γλώσσας. */
function figureOf(figure: number): string {
  return formatNumber(figure, { maximumFractionDigits: 1 });
}

/** Χωρίς κλάση: ο λόγος που δήλωσε ο αγγελιοδότης, ή το ονομασμένο κενό. */
function AbsenceLine({ certificate }: { readonly certificate: ListedEnergyCertificate }) {
  const { t } = useTranslation(['listing-detail', 'properties-enums']);
  const text =
    certificate.absence === null
      ? t('listing-detail:energyCertificate.undeclared')
      : t(ENERGY_CERTIFICATE_ABSENCE_KEY[certificate.absence]);
  return <p className="m-0 mt-2 text-sm text-foreground">{text}</p>;
}

/** Οι δύο αριθμοί με τη μονάδα τους — ή, ρητά για τον καθένα, ότι δεν δηλώθηκε. */
function Figures({ certificate }: { readonly certificate: ListedEnergyCertificate }) {
  const { t } = useTranslation(['listing-detail']);
  const { primaryEnergy, co2Emissions } = certificate;
  const undeclared = t('listing-detail:energyCertificate.figureUndeclared');

  return (
    <dl className="mt-3 space-y-1">
      <div className={ROW}>
        <dt className={TERM}>{t('listing-detail:energyCertificate.primaryEnergy')}</dt>
        <dd className="text-sm font-medium text-foreground">
          {primaryEnergy === null
            ? undeclared
            : t('listing-detail:energyCertificate.primaryEnergyValue', { value: figureOf(primaryEnergy) })}
        </dd>
      </div>
      <div className={ROW}>
        <dt className={TERM}>{t('listing-detail:energyCertificate.co2Emissions')}</dt>
        <dd className="text-sm font-medium text-foreground">
          {co2Emissions === null
            ? undeclared
            : t('listing-detail:energyCertificate.co2EmissionsValue', { value: figureOf(co2Emissions) })}
        </dd>
      </div>
    </dl>
  );
}

export function ListingEnergyCertificate({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['listing-detail']);
  const { energyCertificate: certificate, energyClass } = listing;
  if (certificate === null) return null;

  const validity = validityText(t, energyValidityOf(listing));

  return (
    <SectionFrame
      headingId="listing-energy-heading"
      title={t('listing-detail:energyCertificate.heading')}
      headingLevel="h2"
      titleSize="sm"
    >
      {energyClass === null ? (
        <AbsenceLine certificate={certificate} />
      ) : (
        <>
          <div className="mt-3 max-w-md">
            <EnergyClassScale
              current={energyClass}
              label={t('listing-detail:energyCertificate.scaleLabel')}
              currentMarker={t('listing-detail:energyCertificate.thisProperty')}
            />
          </div>
          <Figures certificate={certificate} />
          {/* ADR-777 §8.96 — κοινή πιστοποίηση (ν. 4122/2013 άρθ. 11 §5): οι αριθμοί είναι του ΚΤΗΡΙΟΥ, και λέγεται (GEG §87). */}
          {certificate.scope === 'building' && (
            <p className="m-0 mt-2 text-sm text-foreground">{t('listing-detail:energyCertificate.scopeBuilding')}</p>
          )}
          {validity !== null && <p className="m-0 mt-2 text-sm text-foreground">{validity}</p>}
          {/* Κανόνας 18: αριθμός χωρίς προέλευση είναι ισχυρισμός — και εδώ η προέλευση είναι διπλή: το ΠΕΑ, όπως το μεταφέρει ο αγγελιοδότης. */}
          <p className="m-0 mt-1 text-xs text-muted-foreground">{t('listing-detail:energyCertificate.provenance')}</p>
          <ListingEnergyCost listing={listing} />
        </>
      )}
    </SectionFrame>
  );
}
