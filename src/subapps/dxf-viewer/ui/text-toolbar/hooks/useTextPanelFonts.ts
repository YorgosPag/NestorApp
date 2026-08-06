'use client';

/**
 * ADR-344 Phase 6.D — Font source for the Text Properties panel.
 *
 * The cache singleton from Phase 2 is the SSoT for loaded fonts. It
 * has no native subscription mechanism (a WeakMap-backed Map), so the
 * panel reads it on mount and again when the missing-font report
 * changes — the report fires whenever a new font is loaded or marked
 * missing, making it a reliable "fonts changed" signal.
 *
 * We additionally union the family names declared in scene STYLE
 * entries so the picker shows fonts the document references even if
 * they have not been resolved yet (missing-font UX).
 */

import { useEffect, useMemo, useState } from 'react';
import { collectAvailableFontNames, subscribeMissingFontReport } from '../../../text-engine/fonts';
import { useCurrentSceneModel } from './useCurrentSceneModel';

/**
 * ⚠️ ADR-739 §55 — **η γνώση μετακόμισε** στο {@link collectAvailableFontNames}: το mini
 * toolbar του πίνακα τη ζητά κι εκείνο, αλλά ως **getter** (ζει μέσα στον `CanvasSection`,
 * όπου κάθε συνδρομή είναι re-render του orchestrator — ADR-040 κανόνας #1). Εδώ μένει ό,τι
 * είναι όντως του πάνελ: **πότε** ξαναρωτιέται.
 */
export function useTextPanelFonts(): readonly string[] {
  const scene = useCurrentSceneModel();
  const [bump, setBump] = useState(0);

  useEffect(() => {
    return subscribeMissingFontReport(() => setBump((n) => n + 1));
  }, []);

  return useMemo(() => {
    void bump;
    return collectAvailableFontNames(scene);
  }, [scene, bump]);
}
