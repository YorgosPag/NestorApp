'use client';

/**
 * Οι μονάδες μέτρησης της πύλης — **ΣΤΑΤΙΚΗ** `t()` ανά κωδικό (ADR-877 §6).
 *
 * Γιατί όχι `useUomLabel`: ο ΕΝΑΣ μορφοποιητής (`formatUom`) καλεί `` t(`${form}.${code}`) `` — δυναμικό κλειδί που
 * ο γεννήτορας του route slice **δεν** λύνει, και η πύλη ανοίγει από email, ψυχρή, χωρίς κέλυφος (CHECK 3.34 / 3.51).
 * Ο κατάλογος κωδικών μένει ο ΕΝΑΣ (`UOM_CODES` · λίστα = `PROCUREMENT_UNIT_OPTIONS`)· ο τύπος `Record<UomCode, …>` αναγκάζει νέα μονάδα να πάρει
 * ετικέτα **και εδώ** (σφάλμα μεταγλώττισης, όχι σιωπηλό κενό).
 *
 * @module app/(auth)/vendor/quote/useVendorUomOptions
 * @enterprise ADR-327 §8.5 · ADR-923 §5.11
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveUom, type UomCode } from '@/lib/uom/uom-registry';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';

export interface VendorUomOption {
  value: string;
  label: string;
}

function useUomSymbols(): Readonly<Record<UomCode, string>> {
  const { t } = useTranslation(['uom']);
  return useMemo(() => ({
    pcs: t('uom:symbol.pcs'), m: t('uom:symbol.m'), m2: t('uom:symbol.m2'), m3: t('uom:symbol.m3'),
    kg: t('uom:symbol.kg'), ton: t('uom:symbol.ton'), g: t('uom:symbol.g'), lt: t('uom:symbol.lt'),
    ml: t('uom:symbol.ml'), hr: t('uom:symbol.hr'), day: t('uom:symbol.day'), month: t('uom:symbol.month'),
    set: t('uom:symbol.set'), pair: t('uom:symbol.pair'), bag: t('uom:symbol.bag'), box: t('uom:symbol.box'),
    pallet: t('uom:symbol.pallet'), roll: t('uom:symbol.roll'), container: t('uom:symbol.container'),
    pack: t('uom:symbol.pack'), lump: t('uom:symbol.lump'), point: t('uom:symbol.point'), kW: t('uom:symbol.kW'),
    kWp: t('uom:symbol.kWp'),
  }), [t]);
}

/** Η ετικέτα μιας γραφής — άγνωστη μονάδα εμφανίζεται αυτούσια (ποτέ σιωπηλή «αντιστοίχιση»). */
export function useVendorUomLabel(): (raw: string | null | undefined) => string {
  const symbols = useUomSymbols();
  return (raw) => {
    const code = resolveUom(raw);
    return code ? symbols[code] : raw?.trim() ?? '';
  };
}

/** Οι επιλογές της λίστας = η ΙΔΙΑ λίστα της αλυσίδας προμηθειών (RFQ → προσφορά → παραγγελία)· μια άγνωστη τρέχουσα τιμή μένει **πρώτη** επιλογή, ώστε να μη χαθεί. */
export function useVendorUomOptions(current: string): VendorUomOption[] {
  const symbols = useUomSymbols();
  return useMemo(() => {
    const known = PROCUREMENT_UNIT_OPTIONS.map((code) => ({ value: code, label: symbols[code] }));
    if (!current || (PROCUREMENT_UNIT_OPTIONS as readonly string[]).includes(current)) return known;
    // εκτός λίστας: κωδικός του μητρώου (π.χ. `kWp`) με την ετικέτα του· άγνωστη γραφή αυτούσια
    const code = resolveUom(current);
    return [{ value: current, label: code ? symbols[code] : current }, ...known];
  }, [symbols, current]);
}
