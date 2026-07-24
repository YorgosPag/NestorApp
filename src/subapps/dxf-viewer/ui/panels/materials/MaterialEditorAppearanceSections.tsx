'use client';

/**
 * ADR-687 — «Εμφάνιση» (C4D-style) form sections for `MaterialEditorDialog`.
 *
 * Extracted from `MaterialEditorSections.tsx` (Google file-size SSoT, ≤500 lines) so the
 * appearance column (real 3D sphere preview + PBR sliders + colour pickers) lives as a
 * cohesive unit. Covers Φ1 (colour/metal/rough), Φ4 (opacity/emissive) and Φ5 physical
 * props (clearcoat/transmission/ior/thickness). Shares `FormState` with the parent module.
 *
 * @see ./MaterialEditorSections.tsx — the remaining form sections + `FormState` shape
 * @see ../../../bim/materials/material-catalog-defs.ts — `appearanceToDef` (form → PBR def)
 */

import { useState, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { EnterpriseColorPicker } from '../../color/EnterpriseColorPicker';
import { EnterpriseColorDialog } from '../../color/EnterpriseColorDialog';
import { appearanceToDef } from '../../../bim/materials/material-catalog-defs';
import { MaterialPreviewSphere } from './MaterialPreviewSphere';
import type { FormState } from './MaterialEditorSections';

interface AppearanceSectionProps {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  labelClass: string;
  colors: ReturnType<typeof useSemanticColors>;
  t: (k: string) => string;
}

/**
 * SSoT PBR slider (label + live value + hint) — ONE markup for μεταλλικότητα, τραχύτητα,
 * αδιαφάνεια, αυτοφωτισμός (ADR-687 Φ1/Φ4) + clearcoat/transmission/ior/thickness (Φ5), so
 * the near-identical rows never diverge (N.18 anti-clone). `display` is the caller-formatted
 * numeric readout (NaN-guarded). `min`/`max`/`step` default to the 0..1 PBR range; Φ5 `ior`
 * (1..2.333) and `thickness` (0..5) pass their own range.
 */
function PbrSlider({
  label, hint, value, display, labelClass, mutedClass, onChange,
  min = 0, max = 1, step = 0.01,
}: {
  label: string;
  hint: string;
  value: string;
  display: string;
  labelClass: string;
  mutedClass: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className={`${labelClass} flex justify-between`}>
        <span>{label}</span>
        <span className={mutedClass}>{display}</span>
      </span>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[isNaN(parseFloat(value)) ? min : parseFloat(value)]}
        onValueChange={([next]) => onChange(String(next))}
        thumbAriaLabel={label}
        className="w-full"
      />
      <span className={`text-[10px] ${mutedClass}`}>{hint}</span>
    </label>
  );
}

/** NaN-guarded '0.00'..'1.00' readout for a slider's numeric value. */
function sliderDisplay(value: number, fallback: number): string {
  return (isNaN(value) ? fallback : value).toFixed(2);
}

/**
 * Στήλη «Σφαίρα»: real 3D preview (το ΑΚΡΙΒΕΣ `MeshStandardMaterial` που θα βαφτεί σε όψη) + οι
 * PBR sliders (μεταλλικότητα/τραχύτητα + ADR-687 Φ4 αδιαφάνεια/αυτοφωτισμός). `def` memoised → η
 * σφαίρα ξαναχτίζεται μόνο σε αλλαγή εμφάνισης. Ζωντανή στην αλλαγή χρώματος/emissive από τη
 * διπλανή στήλη (κοινό `form.*`).
 */
export function AppearancePreviewSection({ form, setField, labelClass, colors, t }: AppearanceSectionProps) {
  const metalness = Number(form.metalness);
  const roughness = Number(form.roughness);
  const opacity = Number(form.opacity);
  const emissiveIntensity = Number(form.emissiveIntensity);
  // ADR-687 Φ5 — physical props.
  const clearcoat = Number(form.clearcoat);
  const clearcoatRoughness = Number(form.clearcoatRoughness);
  const transmission = Number(form.transmission);
  const ior = Number(form.ior);
  const thickness = Number(form.thickness);
  const def = useMemo(
    () =>
      appearanceToDef({
        baseColorHex: form.baseColorHex,
        metalness: isNaN(metalness) ? 0 : metalness,
        roughness: isNaN(roughness) ? 0.5 : roughness,
        emissiveHex: form.emissiveHex,
        emissiveIntensity: isNaN(emissiveIntensity) ? 0 : emissiveIntensity,
        opacity: isNaN(opacity) ? 1 : opacity,
        clearcoat: isNaN(clearcoat) ? 0 : clearcoat,
        clearcoatRoughness: isNaN(clearcoatRoughness) ? 0 : clearcoatRoughness,
        transmission: isNaN(transmission) ? 0 : transmission,
        ior: isNaN(ior) ? 1.5 : ior,
        thickness: isNaN(thickness) ? 0 : thickness,
      }),
    [
      form.baseColorHex, metalness, roughness, form.emissiveHex, emissiveIntensity, opacity,
      clearcoat, clearcoatRoughness, transmission, ior, thickness,
    ],
  );
  const muted = colors.text.muted;

  return (
    <section className="flex flex-col gap-3">
      <span className={labelClass}>{t('appearance.label')}</span>
      {/* The «ριγωτό» diagonal-stripe backdrop is rendered IN-SCENE by the sphere renderer
          (preview-backdrop-texture.ts), so the container itself just needs a neutral fill. */}
      <MaterialPreviewSphere
        def={def}
        ariaLabel={t('appearance.previewAlt')}
        className="aspect-square w-full overflow-hidden rounded border border-border bg-[hsl(var(--bg-canvas,0_0%_10%))]"
      />
      <PbrSlider
        label={t('appearance.metalness')} hint={t('appearance.metalnessHint')}
        value={form.metalness} display={sliderDisplay(metalness, 0)}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('metalness', v)}
      />
      <PbrSlider
        label={t('appearance.roughness')} hint={t('appearance.roughnessHint')}
        value={form.roughness} display={sliderDisplay(roughness, 0.5)}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('roughness', v)}
      />
      <PbrSlider
        label={t('appearance.opacity')} hint={t('appearance.opacityHint')}
        value={form.opacity} display={sliderDisplay(opacity, 1)}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('opacity', v)}
      />
      <PbrSlider
        label={t('appearance.emissive')} hint={t('appearance.emissiveHint')}
        value={form.emissiveIntensity} display={sliderDisplay(emissiveIntensity, 0)}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('emissiveIntensity', v)}
      />
      {/* ADR-687 Φ5 — physical (MeshPhysicalMaterial) props: clearcoat (βερνίκι) + transmission
          (γυαλί/refraction). All off by default → material stays MeshStandardMaterial. */}
      <PbrSlider
        label={t('appearance.clearcoat')} hint={t('appearance.clearcoatHint')}
        value={form.clearcoat} display={sliderDisplay(clearcoat, 0)}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('clearcoat', v)}
      />
      <PbrSlider
        label={t('appearance.clearcoatRoughness')} hint={t('appearance.clearcoatRoughnessHint')}
        value={form.clearcoatRoughness} display={sliderDisplay(clearcoatRoughness, 0)}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('clearcoatRoughness', v)}
      />
      <PbrSlider
        label={t('appearance.transmission')} hint={t('appearance.transmissionHint')}
        value={form.transmission} display={sliderDisplay(transmission, 0)}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('transmission', v)}
      />
      <PbrSlider
        label={t('appearance.ior')} hint={t('appearance.iorHint')}
        value={form.ior} display={sliderDisplay(ior, 1.5)}
        min={1} max={2.333} step={0.01}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('ior', v)}
      />
      <PbrSlider
        label={t('appearance.thickness')} hint={t('appearance.thicknessHint')}
        value={form.thickness} display={sliderDisplay(thickness, 0)}
        min={0} max={5} step={0.05}
        labelClass={labelClass} mutedClass={muted} onChange={(v) => setField('thickness', v)}
      />
    </section>
  );
}

/**
 * Στήλη «Χρώμα»: ο ΚΑΘΕΤΟΣ `EnterpriseColorPicker` (area + sliders + hex + παλέτες, ~260px) ώστε να
 * κάθεται άνετα σε ΜΙΑ στήλη του 4-column grid — ο οριζόντιος θα χρειαζόταν δύο.
 */
export function AppearanceColorSection({
  form, setField, labelClass, t,
}: Omit<AppearanceSectionProps, 'colors'>) {
  const [emissiveOpen, setEmissiveOpen] = useState(false);
  // Base colour change: while the emissive colour hasn't been customised, keep it in sync with the
  // base so «Αυτοφωτισμός ↑» always glows in the material's own colour (the intuitive default).
  const setBaseColor = (hex: string) => {
    setField('baseColorHex', hex);
    if (!form.emissiveCustom) setField('emissiveHex', hex);
  };
  // Emissive colour change: freeze it (stop tracking the base) so a deliberate glow colour sticks.
  const setEmissiveColor = (hex: string) => {
    setField('emissiveHex', hex);
    setField('emissiveCustom', true);
  };
  return (
    <section className="flex flex-col gap-2">
      <span className={labelClass}>{t('appearance.color')}</span>
      <EnterpriseColorPicker
        value={form.baseColorHex}
        onChange={setBaseColor}
        alpha={false}
        showContrast={false}
        variant="inline"
      />
      {/* ADR-687 Φ4 — emissive colour: a compact swatch that opens the SHARED
          `EnterpriseColorDialog` (no second inline picker → no layout blow-out, SSoT). */}
      <span className={labelClass}>{t('appearance.emissiveColor')}</span>
      <button
        type="button"
        onClick={() => setEmissiveOpen(true)}
        className="flex items-center gap-2 rounded border border-border px-2 py-1 text-left hover:bg-muted/40"
      >
        {/* Data-driven colour chip — accepted inline-style exception (CLAUDE.md N.3, cf. MaterialSwatch). */}
        <span
          aria-hidden="true"
          className="inline-block h-5 w-5 shrink-0 rounded-sm border border-black/20"
          style={{ backgroundColor: form.emissiveHex }}
        />
        <span className="text-xs">{form.emissiveHex}</span>
      </button>
      {emissiveOpen && (
        <EnterpriseColorDialog
          isOpen={emissiveOpen}
          onClose={() => setEmissiveOpen(false)}
          title={t('appearance.emissiveColor')}
          value={form.emissiveHex}
          onChange={setEmissiveColor}
          alpha={false}
          showContrast={false}
        />
      )}
    </section>
  );
}
