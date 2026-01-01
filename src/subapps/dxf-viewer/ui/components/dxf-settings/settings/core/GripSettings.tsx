'use client';

import React from 'react';
import { useUnifiedGripPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import type { GripSettings } from '../../../../../settings-core/types';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CAD_UI_COLORS, UI_COLORS } from '../../../../../config/color-config';

// SVG Icons για τα accordion sections
const CogIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ColorSwatchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2a2 2 0 002-2V5a2 2 0 00-2-2zM9 9h6m-6 4h6m2 5l-2-2 2-2M2 17l2 2-2 2" />
  </svg>
);

const ViewGridIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const AdjustmentsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
  </svg>
);

export function GripSettings() {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🎯 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
  const { settings: { gripSettings }, updateGripSettings, resetToDefaults } = useUnifiedGripPreview();

  // ✅ HOOKS FIRST: All hooks must be called before any conditional returns (React Rules of Hooks)
  const { toggleSection, isOpen } = useAccordion('basic');

  // ✅ ΠΡΑΓΜΑΤΙΚΗ ΔΙΟΡΘΩΣΗ: Απλό fallback αν gripSettings είναι null/undefined ή δεν έχουν τις απαραίτητες properties
  if (!gripSettings || typeof gripSettings.gripSize === 'undefined') {
    return <div>Loading grip settings...</div>;
  }

  const updateSettings = (updates: Partial<GripSettings>) => {
    updateGripSettings(updates);
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-medium ${colors.text.primary}`}>Ρυθμίσεις Grips</h3>
        <button
          onClick={resetToDefaults}
          className={`px-3 py-1 text-xs ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} rounded transition-colors`}
        >
          Επαναφορά
        </button>
      </div>

      {/* Enable/Disable Grips */}
      <div className="space-y-2">
        <div className={`flex items-center gap-3 p-3 ${colors.bg.secondary} rounded-md ${getStatusBorder('info')}`}>
          <input
            type="checkbox"
            id="grips-enabled"
            checked={gripSettings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className={`${iconSizes.sm} text-blue-600 ${colors.bg.hover} ${quick.input} focus:ring-blue-500 focus:ring-2`}
          />
          <label
            htmlFor="grips-enabled"
            className={`text-sm font-medium ${gripSettings.enabled ? colors.text.primary : colors.text.muted}`}
          >
            Εμφάνιση Grips
          </label>
        </div>
        {!gripSettings.enabled && (
          <div className={`text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 p-2 rounded ${getStatusBorder('warning')}`}>
            ⚠️ Τα grips είναι απενεργοποιημένα και δεν θα εμφανίζονται
          </div>
        )}
      </div>

      {/* ACCORDION SECTIONS */}
      <div className="space-y-3">
        {/* 1. ΒΑΣΙΚΕΣ ΡΥΘΜΙΣΕΙΣ */}
        <AccordionSection
          title="Βασικές Ρυθμίσεις"
          icon={<CogIcon className={iconSizes.sm} />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={false}
          badge={3}
        >
          <div className="space-y-4">

          {/* Grip Size */}
          <div className="space-y-2">
            <label className="block text-sm font-medium ${colors.text.secondary}">
              Μέγεθος Grips: {gripSettings.gripSize || 8}px
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="4"
                max="16"
                step="1"
                value={gripSettings.gripSize || 8}
                onChange={(e) => updateSettings({ gripSize: parseInt(e.target.value) })}
                className={`flex-1 h-2 ${colors.bg.muted} rounded-lg appearance-none cursor-pointer`}
              />
              <input
                type="number"
                min="4"
                max="16"
                step="1"
                value={gripSettings.gripSize || 8}
                onChange={(e) => updateSettings({ gripSize: parseInt(e.target.value) })}
                className={`w-16 px-2 py-1 ${colors.bg.hover} ${quick.input} ${colors.text.primary} text-sm`}
              />
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <label className="block text-sm font-medium ${colors.text.secondary}">
              Διαφάνεια: {Math.round(gripSettings.opacity * 100)}%
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={gripSettings.opacity}
                onChange={(e) => updateSettings({ opacity: parseFloat(e.target.value) })}
                className={`flex-1 h-2 ${colors.bg.muted} rounded-lg appearance-none cursor-pointer`}
              />
              <input
                type="number"
                min="0.1"
                max="1"
                step="0.1"
                value={gripSettings.opacity}
                onChange={(e) => updateSettings({ opacity: parseFloat(e.target.value) })}
                className={`w-16 px-2 py-1 ${colors.bg.hover} ${quick.input} ${colors.text.primary} text-sm`}
              />
            </div>
          </div>
        </div>
        </AccordionSection>

        {/* 2. ΧΡΩΜΑΤΑ GRIPS */}
        <AccordionSection
          title="Χρώματα Grips"
          icon={<ColorSwatchIcon className={iconSizes.sm} />}
          isOpen={isOpen('colors')}
          onToggle={() => toggleSection('colors')}
          disabled={false}
          badge={4}
        >
          <div className="grid grid-cols-2 gap-4">

            {/* Cold Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium ${colors.text.secondary}">Χρώμα Cold</label>
              <ColorDialogTrigger
                value={gripSettings.colors.cold || CAD_UI_COLORS.grips.cold}
                onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, cold: color } })}
                label={gripSettings.colors.cold || CAD_UI_COLORS.grips.cold}
                title="Επιλογή Χρώματος Cold Grip"
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>

            {/* Warm Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium ${colors.text.secondary}">Χρώμα Warm (Hover)</label>
              <ColorDialogTrigger
                value={gripSettings.colors.warm || CAD_UI_COLORS.grips.warm}
                onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, warm: color } })}
                label={gripSettings.colors.warm || CAD_UI_COLORS.grips.warm}
                title="Επιλογή Χρώματος Warm Grip"
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>

            {/* Hot Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium ${colors.text.secondary}">Χρώμα Hot (Επιλεγμένα)</label>
              <ColorDialogTrigger
                value={gripSettings.colors.hot || CAD_UI_COLORS.grips.hot}
                onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, hot: color } })}
                label={gripSettings.colors.hot || UI_COLORS.HIGHLIGHTED_ENTITY}
                title="Επιλογή Χρώματος Hot Grip"
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>

            {/* Contour Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium ${colors.text.secondary}">Χρώμα Περιγράμματος</label>
              <ColorDialogTrigger
                value={gripSettings.colors.contour}
                onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, contour: color } })}
                label={gripSettings.colors.contour}
                title="Επιλογή Χρώματος Contour Grip"
                alpha={false}
                modes={['hex', 'rgb', 'hsl']}
                palettes={['dxf', 'semantic', 'material']}
                recent={true}
                eyedropper={true}
              />
            </div>
          </div>
        </AccordionSection>

        {/* 3. ΤΥΠΟΙ GRIPS */}
        <AccordionSection
          title="Τύποι Grips"
          icon={<ViewGridIcon className={iconSizes.sm} />}
          isOpen={isOpen('types')}
          onToggle={() => toggleSection('types')}
          disabled={false}
          badge={3}
        >
          <div className="space-y-2">

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gripSettings.showMidpoints}
                onChange={(e) => updateSettings({ showMidpoints: e.target.checked })}
                className={`${quick.checkbox} text-blue-600 focus:ring-blue-500 focus:ring-2`}
              />
              <span className="text-sm ${colors.text.secondary}">Εμφάνιση Midpoints</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gripSettings.showCenters}
                onChange={(e) => updateSettings({ showCenters: e.target.checked })}
                className={`${quick.checkbox} text-blue-600 focus:ring-blue-500 focus:ring-2`}
              />
              <span className="text-sm ${colors.text.secondary}">Εμφάνιση Centers</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gripSettings.showQuadrants}
                onChange={(e) => updateSettings({ showQuadrants: e.target.checked })}
                className={`${quick.checkbox} text-blue-600 focus:ring-blue-500 focus:ring-2`}
              />
              <span className="text-sm ${colors.text.secondary}">Εμφάνιση Quadrants</span>
            </label>
          </div>
        </AccordionSection>

        {/* 4. ΠΡΟΧΩΡΗΜΕΝΕΣ ΡΥΘΜΙΣΕΙΣ */}
        <AccordionSection
          title="Προχωρημένες Ρυθμίσεις"
          icon={<AdjustmentsIcon className={iconSizes.sm} />}
          isOpen={isOpen('advanced')}
          onToggle={() => toggleSection('advanced')}
          disabled={false}
          badge={6}
        >
          <div className="space-y-4">

            {/* Pick Box Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium ${colors.text.secondary}">
                Μέγεθος Pick Box: {gripSettings.pickBoxSize || 3}px
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={gripSettings.pickBoxSize || 3}
                  onChange={(e) => updateSettings({ pickBoxSize: parseInt(e.target.value) })}
                  className={`flex-1 h-2 ${colors.bg.muted} rounded-lg appearance-none cursor-pointer`}
                />
                <input
                  type="number"
                  min="1"
                  max="8"
                  step="1"
                  value={gripSettings.pickBoxSize || 3}
                  onChange={(e) => updateSettings({ pickBoxSize: parseInt(e.target.value) })}
                  className={`w-16 px-2 py-1 ${colors.bg.hover} ${quick.input} ${colors.text.primary} text-sm`}
                />
              </div>
            </div>

            {/* Aperture Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium ${colors.text.secondary}">
                Μέγεθος Aperture: {gripSettings.apertureSize || 16}px
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="8"
                  max="32"
                  step="2"
                  value={gripSettings.apertureSize || 16}
                  onChange={(e) => updateSettings({ apertureSize: parseInt(e.target.value) })}
                  className={`flex-1 h-2 ${colors.bg.muted} rounded-lg appearance-none cursor-pointer`}
                />
                <input
                  type="number"
                  min="8"
                  max="32"
                  step="2"
                  value={gripSettings.apertureSize || 16}
                  onChange={(e) => updateSettings({ apertureSize: parseInt(e.target.value) })}
                  className={`w-16 px-2 py-1 ${colors.bg.hover} ${quick.input} ${colors.text.primary} text-sm`}
                />
              </div>
            </div>

            {/* Max Grips */}
            <div className="space-y-2">
              <label className="block text-sm font-medium ${colors.text.secondary}">
                Μέγιστα Grips ανά Οντότητα: {gripSettings.maxGripsPerEntity || 50}
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={gripSettings.maxGripsPerEntity || 50}
                  onChange={(e) => updateSettings({ maxGripsPerEntity: parseInt(e.target.value) })}
                  className={`flex-1 h-2 ${colors.bg.muted} rounded-lg appearance-none cursor-pointer`}
                />
                <input
                  type="number"
                  min="10"
                  max="200"
                  step="10"
                  value={gripSettings.maxGripsPerEntity || 50}
                  onChange={(e) => updateSettings({ maxGripsPerEntity: parseInt(e.target.value) })}
                  className={`w-16 px-2 py-1 ${colors.bg.hover} ${quick.input} ${colors.text.primary} text-sm`}
                />
              </div>
            </div>

            {/* Advanced Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gripSettings.showAperture}
                  onChange={(e) => updateSettings({ showAperture: e.target.checked })}
                  className={`${quick.checkbox} text-blue-600 focus:ring-blue-500 focus:ring-2`}
                />
                <span className="text-sm ${colors.text.secondary}">Εμφάνιση Aperture</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gripSettings.multiGripEdit}
                  onChange={(e) => updateSettings({ multiGripEdit: e.target.checked })}
                  className={`${quick.checkbox} text-blue-600 focus:ring-blue-500 focus:ring-2`}
                />
                <span className="text-sm ${colors.text.secondary}">Multi-Grip Επεξεργασία</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gripSettings.snapToGrips}
                  onChange={(e) => updateSettings({ snapToGrips: e.target.checked })}
                  className={`${quick.checkbox} text-blue-600 focus:ring-blue-500 focus:ring-2`}
                />
                <span className="text-sm ${colors.text.secondary}">Snap σε Grips</span>
              </label>
            </div>

            {/* Quick Presets */}
            <div className={`space-y-2 pt-4 ${quick.separator}`}>
              <h5 className="text-sm font-medium ${colors.text.muted}">Γρήγορα Presets</h5>
              <div className="flex space-x-2">
            <button
              onClick={() => updateSettings({ gripSize: 5, pickBoxSize: 2, apertureSize: 10 })}
              className={`px-3 py-1 text-xs ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-white rounded transition-colors`}
            >
              Μικρό
            </button>
            <button
              onClick={() => updateSettings({ gripSize: 8, pickBoxSize: 3, apertureSize: 16 })}
              className="px-3 py-1 text-xs bg-blue-700 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-white rounded transition-colors"
            >
              Κανονικό
            </button>
            <button
              onClick={() => updateSettings({ gripSize: 12, pickBoxSize: 5, apertureSize: 24 })}
              className={`px-3 py-1 text-xs ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} text-white rounded transition-colors`}
            >
              Μεγάλο
              </button>
              </div>
            </div>
          </div>
        </AccordionSection>
      </div>
    </div>
  );
}

export default GripSettings;