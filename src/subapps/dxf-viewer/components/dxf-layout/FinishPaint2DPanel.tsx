'use client';

/**
 * FinishPaint2DPanel — ADR-449 PART B Slice C (2D) «Βαφή σοβά» material palette.
 *
 * Floating παλέτα υλικών/χρωμάτων για το 2D paintbrush mode (Revit «Paint» / Cinema 4D polygon
 * mode / Figma parity): όσο είναι ενεργό το εργαλείο `finish-paint`, διαλέγεις εδώ πινέλο
 * (υλικό swatch / custom χρώμα / σβήσιμο) και μετά κλικ στις όψεις σοβά στην κάτοψη. Το ίδιο το
 * βάψιμο γίνεται στο `useFinishPaintClick` (canvas click). Αδελφό του 3D `PolygonMaterialPanel`
 * — ΙΔΙΑ swatches (`FINISH_MATERIAL_OPTIONS` + `getMaterialFlatColorHex`) + ΙΔΙΟ
 * `EnterpriseColorDialog`.
 *
 * Διαφορά από το 3D panel: εδώ το swatch **δεν** εφαρμόζει άμεσα (δεν υπάρχει προ-επιλεγμένη
 * όψη) — ορίζει το πινέλο· η εφαρμογή γίνεται στο επόμενο κλικ όψης (paintbrush). ADR-040:
 * leaf React component — subscribe μόνο στο low-frequency tool-state + brush store.
 *
 * @see ../../bim/finishes/finish-paint-brush-store — το τρέχον πινέλο (setBrush)
 * @see ../../hooks/canvas/useFinishPaintClick — canvas click → βάψιμο
 * @see ../../bim-3d/ui/PolygonMaterialPanel — 3D αδελφό
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveTool } from '../../stores/ToolStateStore';
import { useFinishPaintBrushStore } from '../../bim/finishes/finish-paint-brush-store';
import { FINISH_MATERIAL_OPTIONS } from '../../ui/ribbon/hooks/bridge/finish-param';
import { getMaterialFlatColorHex } from '../../bim/materials/material-catalog-defs';
import { EnterpriseColorDialog } from '../../ui/color/EnterpriseColorDialog';

/** Seed χρώματος για το custom-colour dialog (ίδιο warm κόκκινο με το 3D panel). */
const DEFAULT_CUSTOM_COLOR = '#C0392B';

export function FinishPaint2DPanel() {
  const { t } = useTranslation('dxf-viewer-shell');
  const activeTool = useActiveTool();
  const brush = useFinishPaintBrushStore((s) => s.brush);
  const setBrush = useFinishPaintBrushStore((s) => s.setBrush);
  const [colorOpen, setColorOpen] = useState(false);
  const [customHex, setCustomHex] = useState(DEFAULT_CUSTOM_COLOR);

  if (activeTool !== 'finish-paint') return null;

  const hasColor = brush?.colorOverride != null;
  const swatches = FINISH_MATERIAL_OPTIONS.map((o) => ({
    id: o.value,
    color: getMaterialFlatColorHex(o.value),
    label: t(o.labelKey),
    selected: !hasColor && brush?.materialId === o.value,
  }));

  return (
    <section
      className="absolute right-3 top-20 z-[60] w-52 select-none rounded-md border border-white/20 bg-black/60 p-2 text-white/90 backdrop-blur-sm"
      aria-label={t('finishPaint.title')}
    >
      <header className="mb-1.5">
        <h3 className="text-xs font-semibold">{t('finishPaint.title')}</h3>
        <p className="mt-0.5 text-[10px] text-white/60">{t('finishPaint.hint')}</p>
      </header>
      <ul className="grid grid-cols-2 gap-1">
        {swatches.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              aria-pressed={m.selected}
              onClick={() => setBrush({ materialId: m.id })}
              className={`flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 ${
                m.selected ? 'border-white/60 bg-white/20' : 'border-white/15'
              }`}
            >
              {/* Data-driven catalog colour → inline style (accepted N.3 exception, mirror PolygonMaterialPanel). */}
              <span
                className="h-3 w-3 shrink-0 rounded-sm border border-white/30"
                style={{ backgroundColor: m.color }}
                aria-hidden="true"
              />
              <span className="truncate">{m.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {/* Custom χρώμα (EnterpriseColorDialog) → setBrush({ colorOverride }). */}
      <button
        type="button"
        aria-pressed={hasColor}
        onClick={() => setColorOpen(true)}
        className={`mt-1.5 flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 ${
          hasColor ? 'border-white/60 bg-white/20' : 'border-white/15'
        }`}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-sm border border-white/30"
          style={{ backgroundColor: hasColor ? brush!.colorOverride : customHex }}
          aria-hidden="true"
        />
        <span className="truncate">{t('finishPaint.customColor')}</span>
      </button>
      {/* Σβήσιμο (eraser): πινέλο = null → καθαρίζει το per-face override της επόμενης όψης. */}
      <button
        type="button"
        aria-pressed={brush === null}
        onClick={() => setBrush(null)}
        className={`mt-1 w-full rounded border px-1.5 py-1 text-[10px] transition-colors hover:bg-white/10 ${
          brush === null ? 'border-white/60 bg-white/20' : 'border-white/15'
        }`}
      >
        {t('finishPaint.erase')}
      </button>

      <EnterpriseColorDialog
        isOpen={colorOpen}
        onClose={() => setColorOpen(false)}
        value={customHex}
        onChange={setCustomHex}
        onChangeEnd={(hex) => setBrush({ colorOverride: hex })}
        title={t('finishPaint.customColorTitle')}
      />
    </section>
  );
}
