/**
 * useConstructionPortfolio — ADR-266 §5.9 / Phase D.5
 *
 * Fetches cross-building portfolio data from /api/construction/portfolio.
 */

import { useState, useEffect, useCallback } from 'react';
import type { BuildingPortfolioItem, PortfolioTotals } from '@/app/api/construction/portfolio/route';

export type { BuildingPortfolioItem, PortfolioTotals };

interface UseConstructionPortfolioReturn {
  items: BuildingPortfolioItem[];
  totals: PortfolioTotals;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const EMPTY_TOTALS: PortfolioTotals = {
  totalBuildings: 0,
  avgSPI: 0,
  totalActiveAlerts: 0,
  buildingsAtRisk: 0,
};

export function useConstructionPortfolio(): UseConstructionPortfolioReturn {
  const [items, setItems] = useState<BuildingPortfolioItem[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/construction/portfolio');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as { items: BuildingPortfolioItem[]; totals: PortfolioTotals };
        if (!cancelled) {
          setItems(data.items);
          setTotals(data.totals);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Σφάλμα φόρτωσης');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [tick]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  return { items, totals, loading, error, refresh };
}
