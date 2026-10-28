'use client';

/**
 * Κάλυψη κενού του PM σε μια προσφορά (ADR-327 §8.5 — BuildingConnected «plug»). Ο server είναι ο ΕΝΑΣ γραφέας
 * (`PUT /api/quotes/{id}/leveling-plugs`, ιδεμποτικό)· ο πίνακας ξαναϋπολογίζεται μόνος του (`useComparison`
 * ακούει τις αλλαγές της προσφοράς) — εδώ μόνο η αποστολή και η κατάσταση «αποθηκεύεται».
 *
 * @module subapps/procurement/hooks/useLevelingPlug
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import type { QuoteLevelingPlug } from '../types/quote';
import type { LevelingPlugChange } from '../utils/leveling-plugs';

export function useLevelingPlug(quoteId: string) {
  const [saving, setSaving] = useState(false);
  const save = useCallback(async (change: LevelingPlugChange): Promise<QuoteLevelingPlug[]> => {
    setSaving(true);
    try {
      return await apiClient.put<QuoteLevelingPlug[]>(API_ROUTES.QUOTES.LEVELING_PLUGS(quoteId), change);
    } finally {
      setSaving(false);
    }
  }, [quoteId]);
  return { saving, save };
}
