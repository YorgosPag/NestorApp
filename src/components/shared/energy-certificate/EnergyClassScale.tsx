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
  /**
   * `'certified'` (προεπιλογή): η κλάση του ΠΕΑ. `'projected'`: η **αναμενόμενη** κλάση της ΜΕΑ (ADR-777 §8.102) —
   * διακεκομμένο περίγραμμα αντί για συμπαγές, ώστε η εκτίμηση να μη διαβάζεται ποτέ ως πιστοποίηση, ούτε με μια ματιά.
   */
  readonly variant?: EnergyClassScaleVariant;
}

export type EnergyClassScaleVariant = 'certified' | 'projected';

/** Η σήμανση της βαθμίδας: συμπαγής για το ΠΕΑ, διακεκομμένη για την εκτίμηση. */
const CURRENT_STEP_CLASS: Readonly<Record<EnergyClassScaleVariant, string>> = {
  certified: 'h-4 ring-2 ring-foreground ring-offset-1 ring-offset-card',
  projected: 'h-4 opacity-70 outline-dashed outline-2 outline-offset-2 outline-foreground',
};

function ScaleStep({ energyClass, isCurrent, currentMarker, variant }: {
  readonly energyClass: EnergyClass;
  readonly isCurrent: boolean;
  readonly currentMarker: string;
  readonly variant: EnergyClassScaleVariant;
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
            isCurrent ? CURRENT_STEP_CLASS[variant] : 'h-2.5',
            ENERGY_CLASS_BAR_CLASS[energyClass],
            ENERGY_CLASS_BAR_WIDTH_CLASS[energyClass],
          )}
        />
        {isCurrent && <span className="shrink-0 text-xs font-semibold text-foreground">{currentMarker}</span>}
      </span>
    </li>
  );
}

export function EnergyClassScale({ current, label, currentMarker, variant = 'certified' }: EnergyClassScaleProps) {
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0" aria-label={label}>
      {ENERGY_CLASSES.map((energyClass) => (
        <ScaleStep
          key={energyClass}
          energyClass={energyClass}
          isCurrent={energyClass === current}
          currentMarker={currentMarker}
          variant={variant}
        />
      ))}
    </ol>
  );
}
