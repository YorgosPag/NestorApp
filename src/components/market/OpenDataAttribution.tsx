'use client';

/**
 * **Η ΑΝΑΦΟΡΑ ΜΙΑΣ ΠΗΓΗΣ ΑΝΟΙΧΤΩΝ ΔΕΔΟΜΕΝΩΝ** — ό,τι ζητά η CC-BY 4.0, σε **ένα** σημείο (ADR-889 §2.1).
 *
 * Η άδεια ζητά τρία πράγματα, και τα τρία είναι εδώ:
 * 1. **τον κύριο** και το σύνολο δεδομένων, με σύνδεσμο (από το `config/open-data-sources.ts`)·
 * 2. **σύνδεσμο στην άδεια**·
 * 3. **δήλωση ότι τα δεδομένα άλλαξαν** — τι επεξεργασία έγινε.
 *
 * 🔑 Γιατί component και όχι γραμμή σε κάθε κάρτα: η αναφορά είναι **υποχρέωση άδειας**. Αντιγραμμένη, η
 * επόμενη αλλαγή θα διορθωνόταν σε ένα σημείο και θα ξεχνιόταν στα άλλα — ακριβώς ό,τι συνέβη με τις
 * αποδόσεις των χαρτών (`lib/maps/map-attribution.ts`: πέντε χάρτες, πέντε ξεχασμένες).
 */

import React from 'react';

import { OPEN_DATA_SOURCES, type OpenDataSourceId } from '@/config/open-data-sources';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const NS = 'market-contracts';
const EXTERNAL = { target: '_blank', rel: 'noopener noreferrer' } as const;
const LINK = 'underline underline-offset-4 hover:text-foreground';

interface OpenDataAttributionProps {
  readonly source: OpenDataSourceId;
}

export function OpenDataAttribution({ source }: OpenDataAttributionProps) {
  const { t } = useTranslation([NS]);
  const { datasetUrl, license } = OPEN_DATA_SOURCES[source];
  return (
    <footer className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p className="m-0">
        <a href={datasetUrl} className={LINK} {...EXTERNAL}>
          {t(`${NS}:source.line`, {
            owner: t(`${NS}:source.${source}.owner`),
            dataset: t(`${NS}:source.${source}.dataset`),
          })}
        </a>
        {' · '}
        <a href={license.url} className={LINK} {...EXTERNAL}>{t(`${NS}:source.license`)}</a>
      </p>
      <p className="m-0">{t(`${NS}:source.${source}.changes`)}</p>
    </footer>
  );
}
