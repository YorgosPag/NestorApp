'use client';

/**
 * ADR-565 §12 / Φ1.x — Wall «Draw Options Bar» (Revit «Modify | Place Wall» Draw panel).
 *
 * Σειρά 6 μικρών κουμπιών-εικονιδίων (Revit Draw gallery): Ευθύς · Καμπύλος (3-σημείων /
 * κέντρο–άκρα / αρχή–τέλος–ακτίνα / εφαπτομενικό) · Πολυγραμμή. Το ενεργό είναι φωτισμένο.
 *
 * ΕΝΑ εργαλείο με sub-modes (ΟΧΙ πλήκτρο-ανά-variant): κλικ → `setArcVariant` (curved) ή
 * `setKind` (straight/polyline) στο drawing-tool handle. Reactive read μέσω
 * `wallToolBridgeStore.use()` (mirror `RibbonColumn*` reactive pattern) → highlight ακολουθεί
 * το active FSM state. Self-contained inline SVG glyphs (ΟΧΙ shared icon registry) + semantic
 * colors — μηδέν inline CSS (N.3), semantic `<nav>`/`<button>` (N.4).
 *
 * @see ../hooks/bridge/wall-draw-mode.ts — SSoT των 6 modes
 * @see ../hooks/bridge/wall-tool-bridge-store.ts — reactive handle (kind/arcVariant/setters)
 * @see docs/centralized-systems/reference/adrs/ADR-565-curved-circular-structural-bim-elements.md §12
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { wallToolBridgeStore } from '../hooks/bridge/wall-tool-bridge-store';
import {
  WALL_DRAW_MODES,
  activeWallDrawModeId,
  type WallDrawMode,
} from '../hooks/bridge/wall-draw-mode';

/** Common SVG presentation attrs για όλα τα glyphs (μηδέν inline CSS — SVG attributes only). */
const GLYPH_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Ανά-mode glyph (recognizable Draw-gallery icon). Keyed by `WallDrawMode.id`. */
function DrawModeGlyph({ id }: { readonly id: string }): React.JSX.Element {
  return (
    <svg {...GLYPH_PROPS} aria-hidden="true">
      {id === 'straight' && <line x1="3" y1="16" x2="17" y2="4" />}
      {id === 'arc-3-point' && (
        <>
          <path d="M3 15 Q10 2 17 15" />
          <circle cx="3" cy="15" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="10" cy="6.2" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="17" cy="15" r="1.3" fill="currentColor" stroke="none" />
        </>
      )}
      {id === 'arc-center-ends' && (
        <>
          <path d="M4 16 A8 8 0 0 1 16 16" />
          <circle cx="10" cy="16" r="1.3" fill="currentColor" stroke="none" />
          <path d="M10 16 L4 16" />
          <path d="M10 16 L16 16" />
        </>
      )}
      {id === 'arc-start-end-radius' && (
        <>
          <path d="M3 15 Q10 3 17 15" />
          <path d="M10 15 L10 8.6" strokeDasharray="2 2" />
        </>
      )}
      {id === 'arc-tangent' && (
        <>
          <line x1="2" y1="16" x2="18" y2="16" />
          <path d="M6 16 A7 7 0 0 1 15 8" />
        </>
      )}
      {id === 'polyline' && <path d="M3 15 L7 6 L11 14 L17 5" />}
    </svg>
  );
}

export function RibbonWallDrawModeWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const handle = wallToolBridgeStore.use();

  const onPick = useCallback((mode: WallDrawMode) => {
    const h = wallToolBridgeStore.get();
    if (!h) return;
    // Curved variant → setArcVariant (forces kind='curved'); ευθύς/πολυγραμμή → setKind.
    if (mode.arcVariant) h.setArcVariant(mode.arcVariant);
    else h.setKind(mode.kind);
  }, []);

  // Revit-parity: η Draw gallery εμφανίζεται ΜΟΝΟ κατά τη σχεδίαση (tool active), όχι όταν
  // απλώς επιλέγεται υπάρχων τοίχος. `handle` null (unmounted) ή idle → τίποτα.
  if (!handle || !handle.isActive) return null;

  const activeId = activeWallDrawModeId(handle.kind, handle.arcVariant);

  return (
    <nav className="flex items-center gap-0.5" aria-label={t('ribbon.commands.wallEditor.drawMode.section')}>
      {WALL_DRAW_MODES.map((mode) => {
        const isActive = mode.id === activeId;
        return (
          <button
            key={mode.id}
            type="button"
            aria-pressed={isActive}
            aria-label={`${t(mode.labelKey)} — ${t(mode.tooltipKey)}`}
            onClick={() => onPick(mode)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded border transition-colors',
              isActive
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <DrawModeGlyph id={mode.id} />
          </button>
        );
      })}
    </nav>
  );
}
