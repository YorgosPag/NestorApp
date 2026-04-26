'use client';

import { useMemo, useState } from 'react';
import { TRADE_SEED_DATA, TRADES_BY_GROUP } from '@/subapps/procurement/data/trades';
import type { TradeCode, TradeGroup } from '@/subapps/procurement/types/trade';

export interface TradeOption {
  code: TradeCode;
  group: TradeGroup;
  labelEl: string;
  labelEn: string;
}

export function useTradeRegistry(search = '') {
  const allTrades = useMemo<TradeOption[]>(
    () =>
      TRADE_SEED_DATA.map((t) => ({
        code: t.code as TradeCode,
        group: t.group,
        labelEl: t.labelEl,
        labelEn: t.labelEn,
      })),
    []
  );

  const filtered = useMemo<TradeOption[]>(() => {
    if (!search.trim()) return allTrades;
    const q = search.toLowerCase();
    return allTrades.filter(
      (t) =>
        t.labelEl.toLowerCase().includes(q) ||
        t.labelEn.toLowerCase().includes(q) ||
        t.code.includes(q)
    );
  }, [allTrades, search]);

  const byGroup = useMemo(() => {
    const result = {} as Record<TradeGroup, TradeOption[]>;
    for (const group of Object.keys(TRADES_BY_GROUP) as TradeGroup[]) {
      result[group] = filtered.filter((t) => t.group === group);
    }
    return result;
  }, [filtered]);

  return { trades: filtered, byGroup, all: allTrades };
}
