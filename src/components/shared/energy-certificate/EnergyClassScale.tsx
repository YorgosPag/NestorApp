'use client';

/**
 * **Η κλίμακα Α+ … Η του ενεργειακού πιστοποιητικού**, με σημειωμένη τη βαθμίδα του ακινήτου (ADR-777 §8.94).
 *
 * @related `./energy-class-palette.ts` (χρώμα · μήκος) · `constants/energy-classes.ts` (η σειρά) ·
 *   `components/listing-detail/ListingEnergyCertificate.tsx` (η ενότητα της δημόσιας αγγελίας)
 *
 * 🔑 **Η θέση ορίζεται ΜΟΝΟ από την κλάση** — ποτέ από τα kWh. Στον ΚΕΝΑΚ η κατηγορία βγαίνει από τον λόγο προς το
 * κτίριο αναφοράς: μια κλίμακα που τοποθετεί το ακίνητο με τον αριθμό (όπως η ισπανική της Idealista) θα το έδειχνε
 * σε **άλλη** βαθμίδα από εκείνη που γράφει το πιστοποιητικό του.
 *
 * ♿ **Η βαθμίδα του ακινήτου λέγεται, δεν χρωματίζεται μόνο**: `aria-current`, έντονο γράμμα, και η λέξη του
 * καλούντος δίπλα της («αυτό το ακίνητο»). Οι μπάρες είναι διακόσμηση (`aria-hidden`) — τη σειρά τη δίνει η λίστα.
 */

import React from 'react';

import { ENERGY_CLASSES, type EnergyClass } from '@/constants/energy-classes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENERGY_CLASS_LABEL_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import { cn } from '@/lib/utils';

import { ENERGY_CLASS_BAR_CLASS, ENERGY_CLASS_BAR_WIDTH_CLASS } from './energy-class-palette';

export interface EnergyClassScaleProps {
  /** Η βαθμίδα του ακινήτου· `null` ⇒ η κλίμακα φαίνεται χωρίς σήμανση. */
  readonly current: EnergyClass | null;
  /** Το προσβάσιμο όνομα της λίστας — τι είναι αυτή η κλίμακα, και προς τα πού είναι το «καλύτερα». */
  readonly label: string;
  /** Η λέξη δίπλα στη βαθμίδα του ακινήτου. */
  readonly currentMarker: string;
}

function ScaleStep({ energyClass, isCurrent, currentMarker }: {
  readonly energyClass: EnergyClass;
  readonly isCurrent: boolean;
  readonly currentMarker: string;
}) {
  const { t } = useTranslation(['properties-enums']);

  return (
    <li className="grid grid-cols-[2rem_1fr] items-center gap-2" aria-current={isCurrent ? 'true' : undefined}>
      <span className={cn('text-sm tabular-nums', isCurrent ? 'font-bold text-foreground' : 'text-muted-foreground')}>
        {t(ENERGY_CLASS_LABEL_KEY[energyClass])}
      </span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'block rounded-r-sm',
            isCurrent ? 'h-4 ring-2 ring-foreground ring-offset-1 ring-offset-card' : 'h-2.5',
            ENERGY_CLASS_BAR_CLASS[energyClass],
            ENERGY_CLASS_BAR_WIDTH_CLASS[energyClass],
          )}
        />
        {isCurrent && <span className="shrink-0 text-xs font-semibold text-foreground">{currentMarker}</span>}
      </span>
    </li>
  );
}

export function EnergyClassScale({ current, label, currentMarker }: EnergyClassScaleProps) {
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0" aria-label={label}>
      {ENERGY_CLASSES.map((energyClass) => (
        <ScaleStep
          key={energyClass}
          energyClass={energyClass}
          isCurrent={energyClass === current}
          currentMarker={currentMarker}
        />
      ))}
    </ol>
  );
}
