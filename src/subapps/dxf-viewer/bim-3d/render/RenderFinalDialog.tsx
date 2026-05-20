"use client";

/**
 * RenderFinalDialog — ADR-366 §B.4 Phase 6
 *
 * Final render dialog: quality preset / resolution / format / destination / denoiser.
 * Uses Radix Dialog (ADR-001). Pure UI — triggers ViewMode3DStore.startFinalRender().
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  type FinalRenderConfig,
  type RenderPreset,
  type RenderFormat,
  type RenderResolutionPreset,
  PRESET_SPP,
  RESOLUTION_PRESETS,
} from '../stores/ViewMode3DStore';
import { estimateRender, calibrateGpu } from './render-cost-estimator';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RenderFinalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user confirms render. Parent calls sceneManager.startFinalRender(). */
  onConfirm: (config: FinalRenderConfig) => void;
  /** Renderer canvas — used for GPU benchmark */
  rendererCanvas: HTMLCanvasElement | null;
  /** One path-trace sample callback for GPU calibration */
  onCalibrateSample: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: FinalRenderConfig = {
  preset: 'standard',
  presetSPP: 256,
  resolutionPreset: '4k',
  resolutionW: 3840,
  resolutionH: 2160,
  format: 'png',
  destDisk: true,
  destProject: false,
  denoiseEnabled: true,
};

const PRESET_KEYS: RenderPreset[] = ['draft', 'standard', 'high', 'production'];
const FORMAT_KEYS: RenderFormat[] = ['png', 'jpg', 'exr'];
const RESOLUTION_KEYS: RenderResolutionPreset[] = ['hd', '4k', '8k', 'custom'];

// ── Component ─────────────────────────────────────────────────────────────────

export function RenderFinalDialog({
  open,
  onOpenChange,
  onConfirm,
  onCalibrateSample,
}: RenderFinalDialogProps) {
  const { t } = useTranslation('bim3d');

  const [preset, setPreset] = useState<RenderPreset>(DEFAULT_CONFIG.preset);
  const [resPreset, setResPreset] = useState<RenderResolutionPreset>(DEFAULT_CONFIG.resolutionPreset);
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [format, setFormat] = useState<RenderFormat>(DEFAULT_CONFIG.format);
  const [destDisk, setDestDisk] = useState(DEFAULT_CONFIG.destDisk);
  const [destProject, setDestProject] = useState(DEFAULT_CONFIG.destProject);
  const [denoiseEnabled, setDenoiseEnabled] = useState(DEFAULT_CONFIG.denoiseEnabled);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [gpuSamplesPerSec, setGpuSamplesPerSec] = useState(0);
  const [calibrating, setCalibrating] = useState(false);

  const resolvedW = resPreset === 'custom' ? customW : RESOLUTION_PRESETS[resPreset].w;
  const resolvedH = resPreset === 'custom' ? customH : RESOLUTION_PRESETS[resPreset].h;
  const spp = PRESET_SPP[preset];

  // GPU calibration on dialog open
  useEffect(() => {
    if (!open || calibrating || gpuSamplesPerSec > 0) return;
    setCalibrating(true);
    calibrateGpu(onCalibrateSample, resolvedW * resolvedH)
      .then(setGpuSamplesPerSec)
      .catch(() => setGpuSamplesPerSec(500_000))
      .finally(() => setCalibrating(false));
  }, [open, calibrating, gpuSamplesPerSec, onCalibrateSample, resolvedW, resolvedH]);

  const estimate = estimateRender({
    presetSPP: spp,
    resolutionW: resolvedW,
    resolutionH: resolvedH,
    format,
    samplesPerSecondGpu: gpuSamplesPerSec,
  });

  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 60) return t('render.estimate.seconds', { value: Math.round(seconds) });
    if (seconds < 3600) return t('render.estimate.minutes', { value: Math.ceil(seconds / 60) });
    return t('render.estimate.hours', { value: (seconds / 3600).toFixed(1) });
  }, [t]);

  const handleConfirm = useCallback(() => {
    if (!destDisk && !destProject) return;
    const config: FinalRenderConfig = {
      preset,
      presetSPP: spp,
      resolutionPreset: resPreset,
      resolutionW: resolvedW,
      resolutionH: resolvedH,
      format,
      destDisk,
      destProject,
      denoiseEnabled,
    };
    onConfirm(config);
    onOpenChange(false);
  }, [preset, spp, resPreset, resolvedW, resolvedH, format, destDisk, destProject, denoiseEnabled, onConfirm, onOpenChange]);

  const noDestination = !destDisk && !destProject;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('render.dialogTitle')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Quality preset */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              {t('render.presets.label')}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_KEYS.map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors
                    ${preset === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                    }`}
                >
                  <input
                    type="radio"
                    name="preset"
                    value={p}
                    checked={preset === p}
                    onChange={() => setPreset(p)}
                    className="sr-only"
                  />
                  <span>{t(`render.presets.${p}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Resolution */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              {t('render.resolution.label')}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTION_KEYS.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors
                    ${resPreset === r
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                    }`}
                >
                  <input
                    type="radio"
                    name="resolution"
                    value={r}
                    checked={resPreset === r}
                    onChange={() => setResPreset(r)}
                    className="sr-only"
                  />
                  <span>{r === 'custom' ? t('render.resolution.custom') : t(`render.resolution.${r}`)}</span>
                </label>
              ))}
            </div>
            {resPreset === 'custom' && (
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  {t('render.resolution.widthLabel')}
                  <input
                    type="number"
                    min={64}
                    max={16384}
                    value={customW}
                    onChange={(e) => setCustomW(Math.max(64, Number(e.target.value)))}
                    className="rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  {t('render.resolution.heightLabel')}
                  <input
                    type="number"
                    min={64}
                    max={16384}
                    value={customH}
                    onChange={(e) => setCustomH(Math.max(64, Number(e.target.value)))}
                    className="rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>
            )}
          </fieldset>

          {/* Format */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              {t('render.format.label')}
            </legend>
            <div className="flex gap-2">
              {FORMAT_KEYS.map((f) => (
                <label
                  key={f}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors
                    ${format === f
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted'
                    }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="sr-only"
                  />
                  <span>{t(`render.format.${f}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Destination */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">
              {t('render.destination.label')}
            </legend>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={destDisk}
                onChange={(e) => setDestDisk(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {t('render.destination.disk')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={destProject}
                onChange={(e) => setDestProject(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {t('render.destination.project')}
            </label>
          </fieldset>

          {/* Advanced collapsible */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <span className={`transition-transform ${advancedOpen ? 'rotate-90' : ''}`}>▶</span>
              {t('render.advanced.expander')}
            </button>
            {advancedOpen && (
              <label className="ml-4 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={denoiseEnabled}
                  onChange={(e) => setDenoiseEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                {t('render.advanced.denoiser')}
              </label>
            )}
          </div>

          {/* Time estimate panel — always visible */}
          <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('render.estimate.time')}</span>
              {calibrating ? (
                <span className="text-muted-foreground">{t('render.estimate.calculating')}</span>
              ) : (
                <span className="font-mono font-semibold">
                  {formatTime(estimate.seconds)}
                  {' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t('render.estimate.margin', { pct: estimate.marginPercent })}
                  </span>
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">{t('render.estimate.size')}</span>
              <span className="font-mono">~{estimate.outputMB.toFixed(0)} MB</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('render.button.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={noDestination}
          >
            {t('render.button.render')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
