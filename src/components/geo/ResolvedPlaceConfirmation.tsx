'use client';

/**
 * @fileoverview **«ΑΥΤΟ ΒΡΗΚΑ — ΤΟ ΑΝΑΓΝΩΡΙΖΕΙΣ;»** — τι κατάλαβε ο γεωκωδικοποιητής, ειπωμένο με λέξεις.
 * @related hooks/geo/usePlaceResolver · lib/geocoding/house-number-standing · ADR-332 D28 · ADR-777 §7 (Α5 · Α14)
 * @module components/geo/ResolvedPlaceConfirmation
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ (2026-09-14, ADR-332 D28)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ζούσε **μέσα** στο `OwnerPropertyPlaceField`. Η βιτρίνα του γραφείου (`ShowcaseLocationEditor`)
 * καλεί **τον ίδιο** `usePlaceResolver`, το σχόλιό της υπόσχεται *«ίδιο μοτίβο»* — και **πετούσε**
 * ό,τι κατάλαβε ο πάροχος: ο άνθρωπος πατούσε «Εντοπισμός» και έβλεπε μόνο τον χάρτη να κινείται.
 * Δεύτερο αντίγραφο του πλαισίου θα ήταν ο κλώνος του N.18· ένα component, δύο οθόνες.
 *
 * 🔑 **Επιβεβαίωση, όχι δήλωση**: τίποτα από εδώ δεν αποθηκεύεται. Η δήλωση του ανθρώπου μένει το
 * κείμενο που έγραψε.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { ResolvedPlace } from '@/hooks/geo/usePlaceResolver';

const NS = 'property-market';
const K = `${NS}:offer.form`;

interface ResolvedPlaceConfirmationProps {
  readonly place: ResolvedPlace;
  readonly className?: string;
}

export function ResolvedPlaceConfirmation({ place, className }: ResolvedPlaceConfirmationProps): React.ReactElement {
  const { t } = useTranslation([NS]);

  return (
    <output className={cn('flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-sm', className)}>
      {/*
        🔴 **Η διεύθυνση ΟΠΩΣ ΤΗΝ ΚΑΤΑΛΑΒΕ ο πάροχος, όχι όπως γράφτηκε** — η διαφορά των δύο
        κειμένων ΕΙΝΑΙ η επαλήθευση (2026-09-02: εδώ έγραφε δεκαδικές συντεταγμένες).
      */}
      <span className="font-medium text-foreground">{place.label}</span>
      {/*
        ⚠️ Η ακρίβεια **γράφεται**, δεν υπονοείται από το σχήμα: ο κύκλος στον χάρτη τη δείχνει,
        αυτή η πρόταση τη λέει — και μόνο η δεύτερη φτάνει σε αναγνώστη οθόνης.
      */}
      <span className="text-muted-foreground">{t(`${K}.placeAccuracyNote.${place.accuracy}`)}</span>
      <RelaxationLine place={place} />
      <HouseNumberLine place={place} />
      {place.accuracy !== 'exact' && <span className="text-muted-foreground">{t(`${K}.placeRefine`)}</span>}
    </output>
  );
}

/**
 * **Η ΠΕΡΙΟΧΗ ΠΟΥ ΔΕΝ ΡΩΤΗΘΗΚΕ** (ADR-332 D28) — το `replaced` της Google, ειπωμένο στον άνθρωπο.
 *
 * 🔑 Δύο προτάσεις γιατί είναι δύο **διαφορετικές** αλήθειες: `broader` = *«η Θεσσαλονίκη σας είναι
 * η ευρύτερη περιοχή — σωστά»* (ήπιο)· αλλιώς = *«η περιοχή σας δεν ταίριαξε, βρέθηκε μόνο από τον
 * Τ.Κ.»* (θέλει βλέμμα). Ίδια πρόταση και για τα δύο θα εκπαίδευε τον αναγνώστη να την προσπερνά.
 */
function RelaxationLine({ place }: { readonly place: ResolvedPlace }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (!place.relaxation) return null;

  const broader = place.localityMatch === 'broader';
  const params = { postalCode: place.declaredPostalCode ?? '', locality: place.declaredLocality ?? '' };
  return (
    <span className={broader ? 'text-muted-foreground' : 'text-foreground'}>
      {t(`${K}.placeRelaxed.${broader ? 'broader' : 'dropped'}`, params)}
    </span>
  );
}

/**
 * **ΤΙ ΑΠΕΓΙΝΕ Ο ΑΡΙΘΜΟΣ** — ο βαθμός ακρίβειας περιγράφει την **απάντηση**, αυτή η γραμμή την
 * **ερώτηση**. Είναι το `UNCONFIRMED_BUT_PLAUSIBLE` της Google (δες `house-number-standing`).
 *
 * ⚠️ Σιωπά σε `absent`/`confirmed`: γραμμή που λέει το αυτονόητο εκπαιδεύει τον αναγνώστη να
 * προσπερνά **όλες** τις γραμμές του πλαισίου.
 */
function HouseNumberLine({ place }: { readonly place: ResolvedPlace }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (place.houseNumber === 'unconfirmed') {
    return (
      <span className="text-muted-foreground">
        {t(`${K}.placeHouseNumber.unconfirmed`, { number: place.declaredNumber ?? '' })}
      </span>
    );
  }
  if (place.houseNumber === 'contradicted') {
    return (
      <span className="text-foreground">
        {t(`${K}.placeHouseNumber.contradicted`, {
          number: place.declaredNumber ?? '',
          resolved: place.resolvedNumber ?? '',
        })}
      </span>
    );
  }
  return null;
}
