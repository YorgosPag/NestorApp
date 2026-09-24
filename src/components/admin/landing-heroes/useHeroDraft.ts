'use client';

/**
 * @fileoverview **Το πρόχειρο στον browser** — τίποτα δεν ανεβαίνει μέχρι «Αποθήκευση» (ADR-881 §5.1).
 * @related lib/landing/hero-upload-check · hero-upload-prepare · HeroComposer
 * @module components/admin/landing-heroes/useHeroDraft
 *
 * 🔑 **Τοπικά πρώτα** (object URL): επικύρωση, προεπισκόπηση σε όλα τα κάδρα, εστίαση και αναγνωσιμότητα
 *    γίνονται **πριν** φύγει byte — ο άνθρωπος βλέπει το αποτέλεσμα αμέσως και ανεβάζει μόνο ό,τι θέλει.
 * ⚠️ Κάθε object URL ανακαλείται όταν αντικατασταθεί ή όταν φύγει το εργαλείο (διαρροή μνήμης αλλιώς).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  checkHeroDimensions,
  checkHeroFile,
  checkHeroPair,
  hasBlockingIssue,
  type HeroDimensions,
  type HeroUploadIssueCode,
} from '@/lib/landing/hero-upload-check';
import type { LandingHeroVariant } from '@/lib/landing/landing-hero-vocabulary';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

import { readImageDimensions } from './hero-upload-prepare';

export interface HeroDraftVariant {
  readonly file: File;
  readonly url: string;
  /** `null` ⇒ το αρχείο δεν αποκωδικοποιήθηκε (τύπος που δηλώνει εικόνα αλλά δεν είναι). */
  readonly size: HeroDimensions | null;
  readonly issues: readonly HeroUploadIssueCode[];
}

type Variants = Readonly<Record<LandingHeroVariant, HeroDraftVariant | null>>;

async function inspect(file: File): Promise<HeroDraftVariant> {
  const url = URL.createObjectURL(file);
  const fileIssues = checkHeroFile(file);
  const size = await readImageDimensions(file).catch(() => null);
  const sizeIssues: HeroUploadIssueCode[] = size === null ? ['type-not-accepted'] : checkHeroDimensions(size);
  return { file, url, size, issues: [...new Set([...fileIssues, ...sizeIssues])] };
}

export function useHeroDraft() {
  const [variants, setVariants] = useState<Variants>({ day: null, dusk: null });
  /** `null` ⇒ ο άνθρωπος δεν δήλωσε — ο διακομιστής θα εντοπίσει αυτόματα. */
  const [focalPoint, setFocalPoint] = useState<PhotoFocalPoint | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const setFile = useCallback(async (variant: LandingHeroVariant, file: File | null) => {
    const next = file === null ? null : await inspect(file);
    if (next !== null) urls.current.push(next.url);
    setVariants((current) => {
      const previous = current[variant];
      if (previous !== null) URL.revokeObjectURL(previous.url);
      return { ...current, [variant]: next };
    });
  }, []);

  const reset = useCallback(() => {
    setVariants((current) => {
      for (const variant of [current.day, current.dusk]) if (variant !== null) URL.revokeObjectURL(variant.url);
      return { day: null, dusk: null };
    });
    setFocalPoint(null);
  }, []);

  const pairIssues = useMemo<readonly HeroUploadIssueCode[]>(() => {
    const { day, dusk } = variants;
    return day?.size && dusk?.size ? checkHeroPair(day.size, dusk.size) : [];
  }, [variants]);

  const canSave =
    variants.day !== null &&
    !hasBlockingIssue(variants.day.issues) &&
    (variants.dusk === null || !hasBlockingIssue(variants.dusk.issues));

  return { variants, focalPoint, setFocalPoint, setFile, reset, pairIssues, canSave };
}
