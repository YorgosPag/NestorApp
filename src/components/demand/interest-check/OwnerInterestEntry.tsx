'use client';

/**
 * **Η πόρτα του ιδιοκτήτη με πεδίο διεύθυνσης — «έχετε ακίνητο; δείτε αν κάποιος ψάχνει κάτι σαν αυτό»** (ADR-900 §3.7).
 *
 * @related lib/demand/prospect-interest.ts (`interestCheckHref` · `PROSPECT_ADDRESS_PARAM`) ·
 *   components/geo/AddressFocusFinder (`initialQuery`) · LandingDoors · MyOwnerPropertiesContent
 * @module components/demand/interest-check/OwnerInterestEntry
 *
 * 🔑 **ΜΙΑ κάρτα, δύο θέσεις — το σχήμα της Zillow.** Στην **αρχική** είναι το «Sell» (δημόσια πόρτα πριν την
 * ιδιοκτησία)· στα **«Τα ακίνητά μου»** είναι το «Claim your home» του Owner Dashboard (ο ίδιος άνθρωπος, για το
 * **επόμενο** ακίνητό του). Δύο αντίγραφα θα απέκλιναν στην πρώτη αλλαγή λέξης (N.18 / CHECK 3.28).
 *
 * 🔑 **ΠΕΔΙΟ ΔΙΕΥΘΥΝΣΗΣ, ΟΧΙ ΣΚΕΤΟΣ ΣΥΝΔΕΣΜΟΣ** — Zillow «Sell» και idealista «¿Cuánto vale tu casa?» ξεκινούν με
 * **τη διεύθυνση**, γιατί αυτή είναι η ερώτηση που ο ιδιοκτήτης ήδη ξέρει να απαντήσει. Ταξιδεύει ως `?address=`
 * και η σελίδα την εντοπίζει αυτόματα.
 *
 * 🔑 **ΔΟΥΛΕΥΕΙ ΚΑΙ ΧΩΡΙΣ JAVASCRIPT**: αληθινή φόρμα `GET` προς τη διαδρομή, με `name` το **ίδιο** όνομα
 * παραμέτρου που διαβάζει η σελίδα. Με JS η υποβολή γίνεται πλοήγηση πελάτη.
 *
 * ⚠️ **Ο ανώνυμος περνά από τη σύνδεση ΜΕ ΕΠΙΣΤΡΟΦΗ** (`ProtectedRoute` → `loginHrefForCurrentLocation`).
 * ⚠️ **Κανένας αριθμός εδώ, επίτηδες** (ADR-900 §3.3): ό,τι ποσοτικό λέγεται περνά από το `discloseDemand`
 *    (κατώφλι + βήμα) στη σελίδα, για συγκεκριμένο κτίριο.
 * ⚠️ **ΡΗΤΑ ΚΛΕΙΔΙΑ**: ζει στο κέλυφος (αρχική), όπου ο γεννήτορας του shell slice (ADR-744) αρνείται δυναμική `t()`.
 */

import React from 'react';
import { Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { PROSE_MEASURE_CLASS } from '@/components/shared/prose-measure';
import { INTEREST_CHECK_ROUTE } from '@/lib/demand/demand-routes';
import {
  PROSPECT_ADDRESS_MAX_LENGTH,
  PROSPECT_ADDRESS_PARAM,
  interestCheckHref,
} from '@/lib/demand/prospect-interest';
import { useRouter } from '@/lib/workspace/navigation';

export function OwnerInterestEntry(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const headingId = React.useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 text-foreground"
    >
      <header className="flex items-start gap-4">
        <Users aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="text-lg font-semibold">
            {t('property-market:interestCheck.entry.label')}
          </h2>
          <p className={cn('text-sm text-muted-foreground', PROSE_MEASURE_CLASS)}>
            {t('property-market:interestCheck.entry.hint')}
          </p>
        </span>
      </header>
      <OwnerInterestAddressForm />
    </section>
  );
}

/** Το πεδίο διεύθυνσης — φόρμα `GET` (χωρίς JS) που με JS γίνεται πλοήγηση πελάτη. */
function OwnerInterestAddressForm(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const router = useRouter();
  const inputId = React.useId();
  const [address, setAddress] = React.useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    router.push(interestCheckHref(address));
  }

  return (
    <form action={INTEREST_CHECK_ROUTE} method="get" onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 sm:pl-10">
      <label htmlFor={inputId} className="sr-only">
        {t('property-market:interestCheck.entry.addressLabel')}
      </label>
      <Input
        id={inputId}
        name={PROSPECT_ADDRESS_PARAM}
        type="search"
        autoComplete="street-address"
        enterKeyHint="go"
        maxLength={PROSPECT_ADDRESS_MAX_LENGTH}
        value={address}
        placeholder={t('property-market:offer.form.placeQueryPlaceholder')}
        className="min-w-field flex-1"
        onChange={(event) => setAddress(event.target.value)}
      />
      <Button type="submit">{t('property-market:interestCheck.submit')}</Button>
    </form>
  );
}
