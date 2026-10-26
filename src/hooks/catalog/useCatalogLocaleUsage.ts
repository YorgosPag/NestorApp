'use client';
/**
 * **Ποιες γλώσσες έχουν ήδη τιμές;** — ο προέλεγχος της αφαίρεσης γλώσσας (ADR-923 §5.10.2 `localeLockedInUse`).
 *
 * Ο διακομιστής αρνείται (422) να φύγει γλώσσα με τιμές: κάθε προϊόν με τιμή σε αυτήν θα γινόταν **μη αποθηκεύσιμο**
 * χωρίς να το αγγίξει κανείς. Η οθόνη ρωτά **το ίδιο παράγωγο** (`derived.valueLocales`, `array-contains` με δείκτη)
 * **πριν** από την αποστολή ⇒ το κελί κλειδώνει με λόγο και το γνωστό 422 δεν στέλνεται ποτέ.
 *
 * Μία ερώτηση ανά (συλλογή, γλώσσα), `limit 1` — απαντά «ναι/όχι», όχι «πόσα».
 *
 * @module hooks/catalog/useCatalogLocaleUsage
 */

import { useEffect, useState } from 'react';
import { where } from 'firebase/firestore';

import { useCompanyId } from '@/hooks/useCompanyId';
import { HUMAN_LANGUAGES, type HumanLanguage } from '@/i18n/languages';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';

const logger = createModuleLogger('useCatalogLocaleUsage');

/** `unknown` ⇒ η ερώτηση απέτυχε: η οθόνη **δεν** κλειδώνει (ο διακομιστής κρίνει), αλλά το λέει. */
export type LocaleUsage = 'used' | 'unused' | 'unknown';

const HOLDERS = ['CATALOG_PRODUCT_MODELS', 'CATALOG_PRODUCTS'] as const;

async function isLocaleUsed(locale: HumanLanguage): Promise<boolean> {
  const answers = await Promise.all(HOLDERS.map((key) => firestoreQueryService.getAll(key, {
    constraints: [where('isDeleted', '==', false), where('derived.valueLocales', 'array-contains', locale)],
    maxResults: 1,
  })));
  return answers.some((answer) => answer.documents.length > 0);
}

export function useCatalogLocaleUsage(): ReadonlyMap<HumanLanguage, LocaleUsage> | null {
  const companyId = useCompanyId()?.companyId ?? null;
  const [usage, setUsage] = useState<ReadonlyMap<HumanLanguage, LocaleUsage> | null>(null);
  useEffect(() => {
    if (!companyId) return undefined;
    let alive = true;
    void Promise.all(HUMAN_LANGUAGES.map(async (locale): Promise<[HumanLanguage, LocaleUsage]> => {
      try {
        return [locale, (await isLocaleUsed(locale)) ? 'used' : 'unused'];
      } catch (error) {
        logger.warn('Ο έλεγχος χρήσης γλώσσας απέτυχε', { locale, error: error instanceof Error ? error.message : String(error) });
        return [locale, 'unknown'];
      }
    })).then((entries) => { if (alive) setUsage(new Map(entries)); });
    return () => { alive = false; };
  }, [companyId]);
  return usage;
}
