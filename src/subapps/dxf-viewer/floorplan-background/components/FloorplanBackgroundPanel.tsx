'use client';

import { useCallback, useMemo } from 'react';
import { FileImage, FileText, Trash2, RotateCcw, Eye, EyeOff, Lock, Unlock, Replace, Crosshair, X } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FileUploadButton } from '@/components/shared/files/FileUploadButton';
import { PANEL_ANCHORING } from '../../config/panel-tokens';
import { formatPercent } from '../../rendering/entities/shared/distance-label-utils';
import { useFloorplanBackgroundForLevel } from '../hooks/useFloorplanBackgroundForLevel';
import { useCalibration } from '../hooks/useCalibration';
import type { ProviderId } from '../providers/types';

const DEFAULT_POSITION = { x: 20, y: 100 };
const PANEL_DIMENSIONS = PANEL_ANCHORING.DIMENSIONS.FLOORPLAN_BACKGROUND_CONTROLS;
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/tiff,.tif,.tiff';
const PDF_ACCEPT = '.pdf,application/pdf';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FloorplanBackgroundPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FloorplanBackgroundPanel({ isOpen, onClose, className }: FloorplanBackgroundPanelProps) {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const colors = useSemanticColors();
  const result = useFloorplanBackgroundForLevel();
  const floorId = result?.floorId ?? '';
  const calibration = useCalibration(floorId);

  const handleImageSelect = useCallback((file: File) => {
    if (!result) return;
    void result.addBackground({ kind: 'file', file }, 'image');
  }, [result]);

  const handlePdfSelect = useCallback((file: File) => {
    if (!result) return;
    void result.addBackground({ kind: 'file', file }, 'pdf-page');
  }, [result]);

  const handleScaleChange = useCallback((value: number[]) => {
    if (!result) return;
    const s = value[0];
    result.setTransform({ scaleX: s, scaleY: s });
  }, [result]);

  const handleRotationChange = useCallback((value: number[]) => {
    if (!result) return;
    result.setTransform({ rotation: value[0] });
  }, [result]);

  const handleOpacityChange = useCallback((value: number[]) => {
    if (!result) return;
    result.setOpacity(value[0]);
  }, [result]);

  const handleResetTransform = useCallback(() => {
    if (!result) return;
    result.setTransform({ translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 });
  }, [result]);

  const providerLabel = useMemo(() => {
    if (!result?.background) return null;
    const id: ProviderId = result.background.providerId;
    return id === 'pdf-page'
      ? t('panels.floorplanBackground.providerPdf')
      : t('panels.floorplanBackground.providerImage');
  }, [result?.background, t]);

  if (!isOpen) return null;

  return (
    <FloatingPanel defaultPosition={DEFAULT_POSITION} dimensions={PANEL_DIMENSIONS} onClose={onClose} className={className}>
      <FloatingPanel.Header
        title={t('panels.floorplanBackground.title')}
        icon={<FileImage className="h-4 w-4" />}
      />
      <FloatingPanel.Content>
        {!result && (
          <p className={`text-xs ${colors.text.muted}`}>
            {t('panels.floorplanBackground.noLevelSelected')}
          </p>
        )}

        {result && !result.background && (
          <PanelEmptyState
            isLoading={result.isLoading}
            error={result.error}
            onImageSelect={handleImageSelect}
            onPdfSelect={handlePdfSelect}
            t={t}
            colors={colors}
          />
        )}

        {result?.background && (
          <PanelLoadedState
            background={result.background}
            providerLabel={providerLabel}
            isLoading={result.isLoading}
            error={result.error}
            isCalibrating={calibration.isActive}
            hasPointA={calibration.hasPointA}
            onScaleChange={handleScaleChange}
            onRotationChange={handleRotationChange}
            onOpacityChange={handleOpacityChange}
            onResetTransform={handleResetTransform}
            onToggleVisible={() => result.setVisible(!result.background!.visible)}
            onToggleLocked={() => result.setLocked(!result.background!.locked)}
            onRemove={() => { void result.removeBackground(); }}
            onReplaceImage={handleImageSelect}
            onReplacePdf={handlePdfSelect}
            onCalibrate={calibration.startCalibration}
            onCancelCalibration={calibration.cancelCalibration}
            t={t}
            colors={colors}
          />
        )}
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}

// ── Sub-components (split for ≤40 LOC functions) ──────────────────────────────

interface ColorsLike { text: { muted: string } }

interface EmptyStateProps {
  isLoading: boolean;
  error: string | null;
  onImageSelect: (f: File) => void;
  onPdfSelect: (f: File) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  colors: ColorsLike;
}

function PanelEmptyState({ isLoading, error, onImageSelect, onPdfSelect, t, colors }: EmptyStateProps) {
  return (
    <section className="space-y-3">
      <p className={`text-sm ${colors.text.muted}`}>
        {t('panels.floorplanBackground.empty.message')}
      </p>
      {error && (
        <output className="text-xs text-red-500 bg-red-500/10 p-2 rounded block" role="alert">
          {error}
        </output>
      )}
      <FileUploadButton
        onFileSelect={onPdfSelect}
        accept={PDF_ACCEPT}
        fileType="pdf"
        buttonText={isLoading ? t('panels.floorplanBackground.loading') : t('panels.floorplanBackground.empty.uploadPdf')}
        loading={isLoading}
        variant="outline"
        className="w-full"
        icon={<FileText className="h-4 w-4 mr-2" />}
      />
      <FileUploadButton
        onFileSelect={onImageSelect}
        accept={IMAGE_ACCEPT}
        fileType="image"
        buttonText={isLoading ? t('panels.floorplanBackground.loading') : t('panels.floorplanBackground.empty.uploadImage')}
        loading={isLoading}
        variant="outline"
        className="w-full"
        icon={<FileImage className="h-4 w-4 mr-2" />}
      />
      <p className={`text-xs ${colors.text.muted} text-center pt-1`}>
        {t('panels.floorplanBackground.empty.supportedFormats')}
      </p>
    </section>
  );
}

interface LoadedStateProps {
  background: NonNullable<ReturnType<typeof useFloorplanBackgroundForLevel>>['background'];
  providerLabel: string | null;
  isLoading: boolean;
  error: string | null;
  isCalibrating: boolean;
  hasPointA: boolean;
  onScaleChange: (v: number[]) => void;
  onRotationChange: (v: number[]) => void;
  onOpacityChange: (v: number[]) => void;
  onResetTransform: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onRemove: () => void;
  onReplaceImage: (f: File) => void;
  onReplacePdf: (f: File) => void;
  onCalibrate: () => void;
  onCancelCalibration: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  colors: ColorsLike;
}

function PanelLoadedState(props: LoadedStateProps) {
  const { background, providerLabel, error, isCalibrating, hasPointA, t, colors } = props;
  if (!background) return null;
  return (
    <section className="space-y-4">
      {error && (
        <output className="text-xs text-red-500 bg-red-500/10 p-2 rounded block" role="alert">{error}</output>
      )}

      {/* Header row: provider + remove */}
      <article className="flex items-center justify-between text-sm">
        <span className={`truncate max-w-[180px] ${colors.text.muted}`}>{providerLabel}</span>
        <article className="flex items-center gap-1">
          <PanelToggleButton on={background.visible} onClick={props.onToggleVisible} OnIcon={Eye} OffIcon={EyeOff} label={t('panels.floorplanBackground.controls.visible')} />
          <PanelToggleButton on={background.locked} onClick={props.onToggleLocked} OnIcon={Lock} OffIcon={Unlock} label={t('panels.floorplanBackground.controls.locked')} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={props.onRemove} aria-label={t('panels.floorplanBackground.controls.remove')}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('panels.floorplanBackground.controls.remove')}</TooltipContent>
          </Tooltip>
        </article>
      </article>

      {/* Calibration mode instructions */}
      {isCalibrating && (
        <CalibrationInstructions hasPointA={hasPointA} onCancel={props.onCancelCalibration} t={t} colors={colors} />
      )}

      {/* Transform controls — hidden while calibrating to reduce visual noise */}
      {!isCalibrating && (
        <article className="space-y-3 border-t pt-3">
          <PanelSlider label={t('panels.floorplanBackground.controls.scale')} value={background.transform.scaleX} display={`${background.transform.scaleX.toFixed(2)}×`} onChange={props.onScaleChange} min={0.1} max={5} step={0.05} colors={colors} />
          <PanelSlider label={t('panels.floorplanBackground.controls.rotation')} value={background.transform.rotation} display={`${Math.round(background.transform.rotation)}°`} onChange={props.onRotationChange} min={0} max={360} step={1} colors={colors} />
          <PanelSlider label={t('panels.floorplanBackground.controls.opacity')} value={background.opacity} display={formatPercent(background.opacity)} onChange={props.onOpacityChange} min={0} max={1} step={0.05} colors={colors} />
          <Button variant="ghost" size="sm" onClick={props.onResetTransform} className={`w-full ${colors.text.muted}`}>
            <RotateCcw className="h-3 w-3 mr-2" />
            {t('panels.floorplanBackground.controls.resetTransform')}
          </Button>
        </article>
      )}

      {/* Replace / Calibrate */}
      {!isCalibrating && (
        <article className="space-y-2 border-t pt-3">
          <FileUploadButton onFileSelect={props.onReplaceImage} accept={IMAGE_ACCEPT} fileType="image" buttonText={t('panels.floorplanBackground.controls.replaceImage')} variant="outline" className="w-full" icon={<Replace className="h-3 w-3 mr-2" />} />
          <FileUploadButton onFileSelect={props.onReplacePdf} accept={PDF_ACCEPT} fileType="pdf" buttonText={t('panels.floorplanBackground.controls.replacePdf')} variant="outline" className="w-full" icon={<Replace className="h-3 w-3 mr-2" />} />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={props.onCalibrate}
            disabled={background.locked}
          >
            <Crosshair className="h-3 w-3 mr-2" />
            {t('panels.floorplanBackground.controls.calibrate')}
          </Button>
        </article>
      )}
    </section>
  );
}

interface CalibrationInstructionsProps {
  hasPointA: boolean;
  onCancel: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  colors: ColorsLike;
}

function CalibrationInstructions({ hasPointA, onCancel, t, colors }: CalibrationInstructionsProps) {
  const key = hasPointA
    ? 'panels.floorplanBackground.calibration.instructionB'
    : 'panels.floorplanBackground.calibration.instructionA';
  return (
    <article className="border border-blue-400/30 rounded p-3 space-y-2 bg-blue-500/5">
      <p className={`text-xs font-medium text-blue-400`}>
        {t(key)}
      </p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className={`w-full text-xs ${colors.text.muted}`}
      >
        <X className="h-3 w-3 mr-1" />
        {t('panels.floorplanBackground.calibration.instructionCancel')}
      </Button>
    </article>
  );
}

interface PanelSliderProps {
  label: string;
  value: number;
  display: string;
  onChange: (v: number[]) => void;
  min: number;
  max: number;
  step: number;
  colors: ColorsLike;
}

function PanelSlider({ label, value, display, onChange, min, max, step, colors }: PanelSliderProps) {
  return (
    <fieldset className="space-y-2">
      <legend className={`flex items-center justify-between text-xs ${colors.text.muted}`}>
        <span>{label}</span>
        <span>{display}</span>
      </legend>
      <Slider value={[value]} onValueChange={onChange} min={min} max={max} step={step} />
    </fieldset>
  );
}

interface PanelToggleButtonProps {
  on: boolean;
  onClick: () => void;
  OnIcon: typeof Eye;
  OffIcon: typeof EyeOff;
  label: string;
}

function PanelToggleButton({ on, onClick, OnIcon, OffIcon, label }: PanelToggleButtonProps) {
  const Icon = on ? OnIcon : OffIcon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClick} aria-pressed={on} aria-label={label}>
          <Icon className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
