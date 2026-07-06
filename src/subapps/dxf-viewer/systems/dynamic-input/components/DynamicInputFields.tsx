'use client';

/**
 * Field-render extraction from DynamicInputOverlay.
 *
 * Houses all `<DynamicInputField>` instances (X/Y/angle/length/radius/diameter
 * + ADR-358 Phase 7b2b-β Stream E stair rise/tread/width). Pure presentational
 * — no hooks, no event listeners. Receives value/setter/ref/activeField
 * surfaces from the parent overlay and renders only the fields enumerated in
 * `fieldsToShow`.
 *
 * Extraction reason: keeps DynamicInputOverlay.tsx under the 500-line
 * Google file-size ceiling (CLAUDE.md N.7.1) without sacrificing per-field
 * conditional render branches.
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { DynamicInputField } from './DynamicInputField';
// 🏢 SSoT: canonical comma→dot normalizer (comma-normalize ratchet module)
import { normalizeNumber } from '../utils/number';

type RefObj = React.RefObject<HTMLInputElement>;

export interface DynamicInputFieldsProps {
  readonly fieldsToShow: readonly string[];
  readonly t: TFunction;
  // ADR-357 Phase 13 G14 — active length/angle lock indicator.
  readonly lockedField?: 'length' | 'angle' | null;
  readonly onUnlock?: () => void;
  // Core values
  readonly xValue: string;
  readonly yValue: string;
  readonly angleValue: string;
  readonly lengthValue: string;
  readonly radiusValue: string;
  readonly diameterValue: string;
  // Stair values (ADR-358 Phase 7b2b-β Stream E)
  readonly riseValue: string;
  readonly treadValue: string;
  readonly widthValue: string;
  // Core setters
  readonly setXValue: (v: string) => void;
  readonly setYValue: (v: string) => void;
  readonly setAngleValue: (v: string) => void;
  readonly setLengthValue: (v: string) => void;
  readonly setRadiusValue: (v: string) => void;
  readonly setDiameterValue: (v: string) => void;
  // Stair setters
  readonly setRiseValue: (v: string) => void;
  readonly setTreadValue: (v: string) => void;
  readonly setWidthValue: (v: string) => void;
  readonly setIsManualInput: React.Dispatch<React.SetStateAction<{x: boolean; y: boolean; radius: boolean}>>;
  // Active field
  readonly activeField: string;
  readonly setActiveField: (f: 'x' | 'y' | 'angle' | 'length' | 'radius' | 'diameter') => void;
  readonly activeStairField: string;
  readonly setActiveStairField: (f: 'rise' | 'tread' | 'width') => void;
  // Lock / anchor state
  readonly fieldUnlocked: Record<string, boolean>;
  readonly isCoordinateAnchored: Record<string, boolean>;
  // Refs
  readonly xInputRef: RefObj;
  readonly yInputRef: RefObj;
  readonly angleInputRef: RefObj;
  readonly lengthInputRef: RefObj;
  readonly radiusInputRef: RefObj;
  readonly diameterInputRef: RefObj;
  readonly riseInputRef: RefObj;
  readonly treadInputRef: RefObj;
  readonly widthInputRef: RefObj;
}

export function DynamicInputFields(props: DynamicInputFieldsProps): React.ReactElement {
  const {
    fieldsToShow, t,
    xValue, yValue, angleValue, lengthValue, radiusValue, diameterValue,
    riseValue, treadValue, widthValue,
    setXValue, setYValue, setAngleValue, setLengthValue, setRadiusValue, setDiameterValue,
    setRiseValue, setTreadValue, setWidthValue,
    setIsManualInput,
    activeField, setActiveField,
    activeStairField, setActiveStairField,
    fieldUnlocked, isCoordinateAnchored,
    lockedField, onUnlock,
    xInputRef, yInputRef, angleInputRef, lengthInputRef, radiusInputRef, diameterInputRef,
    riseInputRef, treadInputRef, widthInputRef,
  } = props;

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      {fieldsToShow.includes('x') && (
        <DynamicInputField
          label="X"
          value={xValue}
          onChange={(e) => {
            const normalizedValue = normalizeNumber(e.target.value);
            setXValue(normalizedValue);
            setIsManualInput(prev => ({ ...prev, x: true }));
          }}
          onFocus={() => setActiveField('x')}
          inputRef={xInputRef}
          isActive={activeField === 'x'}
          isAnchored={isCoordinateAnchored.x}
          placeholder={t('dynamicInput.placeholders.xCoordinate')}
        />
      )}

      {fieldsToShow.includes('y') && (
        <DynamicInputField
          label="Y"
          value={yValue}
          onChange={(e) => {
            if (fieldUnlocked.y) {
              const normalizedValue = normalizeNumber(e.target.value);
              setYValue(normalizedValue);
              setIsManualInput(prev => ({ ...prev, y: true }));
            }
          }}
          onFocus={() => {
            if (fieldUnlocked.y) {
              setActiveField('y');
            } else {
              setTimeout(() => xInputRef.current?.focus(), PANEL_LAYOUT.TIMING.FOCUS_DELAY);
            }
          }}
          inputRef={yInputRef}
          disabled={!fieldUnlocked.y}
          isActive={activeField === 'y' && fieldUnlocked.y}
          isAnchored={isCoordinateAnchored.y}
          placeholder={t('dynamicInput.placeholders.yCoordinate')}
        />
      )}

      {fieldsToShow.includes('angle') && (
        <div className={`relative${lockedField === 'angle' ? ' ring-2 ring-ring rounded' : ''}`}>
          <DynamicInputField
            label="°"
            value={angleValue}
            onChange={(e) => {
              if (fieldUnlocked.angle) {
                setAngleValue(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (!fieldUnlocked.angle) {
                e.preventDefault();
                return;
              }
            }}
            onFocus={() => {
              if (fieldUnlocked.angle) {
                setActiveField('angle');
              } else {
                setTimeout(() => yInputRef.current?.focus(), PANEL_LAYOUT.TIMING.FOCUS_DELAY);
              }
            }}
            inputRef={angleInputRef}
            disabled={!fieldUnlocked.angle}
            isActive={activeField === 'angle' && fieldUnlocked.angle}
            placeholder={t('dynamicInput.placeholders.angle')}
            fieldType="angle"
          />
          {lockedField === 'angle' && (
            <button
              type="button"
              onClick={onUnlock}
              aria-label={t('dynamicInput.lock.unlock')}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[hsl(var(--text-warning))] text-xs leading-none cursor-pointer bg-transparent border-0 p-0"
            >🔒</button>
          )}
        </div>
      )}

      {fieldsToShow.includes('length') && (
        <div className={`relative${lockedField === 'length' ? ' ring-2 ring-ring rounded' : ''}`}>
          <DynamicInputField
            label="L"
            value={lengthValue}
            onChange={(e) => {
              if (fieldUnlocked.length) {
                setLengthValue(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (!fieldUnlocked.length) {
                e.preventDefault();
                return;
              }
            }}
            onFocus={() => {
              if (fieldUnlocked.length) {
                setActiveField('length');
              } else {
                const prevField = fieldUnlocked.y ? 'y' : 'x';
                setTimeout(() => {
                  if (prevField === 'y') yInputRef.current?.focus();
                  else xInputRef.current?.focus();
                }, 10);
              }
            }}
            inputRef={lengthInputRef}
            disabled={!fieldUnlocked.length}
            isActive={activeField === 'length' && fieldUnlocked.length}
            placeholder={t('dynamicInput.placeholders.length')}
            fieldType="length"
          />
          {lockedField === 'length' && (
            <button
              type="button"
              onClick={onUnlock}
              aria-label={t('dynamicInput.lock.unlock')}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[hsl(var(--text-warning))] text-xs leading-none cursor-pointer bg-transparent border-0 p-0"
            >🔒</button>
          )}
        </div>
      )}

      {fieldsToShow.includes('radius') && (
        <DynamicInputField
          label="R"
          value={radiusValue}
          onChange={(e) => {
            if (fieldUnlocked.radius) {
              setRadiusValue(e.target.value);
              setIsManualInput(prev => ({ ...prev, radius: true }));
            }
          }}
          onKeyDown={(e) => {
            if (!fieldUnlocked.radius) {
              e.preventDefault();
              return;
            }
          }}
          onFocus={() => {
            if (fieldUnlocked.radius) {
              setActiveField('radius');
            } else {
              setTimeout(() => xInputRef.current?.focus(), PANEL_LAYOUT.TIMING.FOCUS_DELAY);
            }
          }}
          inputRef={radiusInputRef}
          disabled={!fieldUnlocked.radius}
          isActive={activeField === 'radius' && fieldUnlocked.radius}
          placeholder={t('dynamicInput.placeholders.radius')}
          fieldType="radius"
        />
      )}

      {fieldsToShow.includes('diameter') && (
        <DynamicInputField
          label="D"
          value={diameterValue}
          onChange={(e) => {
            if (fieldUnlocked.diameter) {
              setDiameterValue(e.target.value);
              setIsManualInput(prev => ({ ...prev, diameter: true }));
            }
          }}
          onKeyDown={(e) => {
            if (!fieldUnlocked.diameter) {
              e.preventDefault();
              return;
            }
          }}
          onFocus={() => {
            if (fieldUnlocked.diameter) {
              setActiveField('diameter');
            } else {
              setTimeout(() => xInputRef.current?.focus(), PANEL_LAYOUT.TIMING.FOCUS_DELAY);
            }
          }}
          inputRef={diameterInputRef}
          disabled={!fieldUnlocked.diameter}
          isActive={activeField === 'diameter' && fieldUnlocked.diameter}
          placeholder={t('dynamicInput.placeholders.diameter')}
          fieldType="diameter"
        />
      )}

      {fieldsToShow.includes('rise') && (
        <DynamicInputField
          label="R"
          value={riseValue}
          onChange={(e) => setRiseValue(normalizeNumber(e.target.value))}
          onFocus={() => setActiveStairField('rise')}
          inputRef={riseInputRef}
          isActive={activeStairField === 'rise'}
          placeholder={t('dynamicInput.placeholders.rise')}
          fieldType="length"
        />
      )}

      {fieldsToShow.includes('tread') && (
        <DynamicInputField
          label="T"
          value={treadValue}
          onChange={(e) => setTreadValue(normalizeNumber(e.target.value))}
          onFocus={() => setActiveStairField('tread')}
          inputRef={treadInputRef}
          isActive={activeStairField === 'tread'}
          placeholder={t('dynamicInput.placeholders.tread')}
          fieldType="length"
        />
      )}

      {fieldsToShow.includes('width') && (
        <DynamicInputField
          label="W"
          value={widthValue}
          onChange={(e) => setWidthValue(normalizeNumber(e.target.value))}
          onFocus={() => setActiveStairField('width')}
          inputRef={widthInputRef}
          isActive={activeStairField === 'width'}
          placeholder={t('dynamicInput.placeholders.stairWidth')}
          fieldType="length"
        />
      )}
    </div>
  );
}
