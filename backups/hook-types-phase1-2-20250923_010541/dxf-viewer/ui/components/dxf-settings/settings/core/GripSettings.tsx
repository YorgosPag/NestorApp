'use client';

import React, { useState } from 'react';
import { useUnifiedGripPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';

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
  // 🎯 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
  const { settings: { gripSettings }, updateGripSettings, resetToDefaults } = useUnifiedGripPreview();

  // ✅ ΠΡΑΓΜΑΤΙΚΗ ΔΙΟΡΘΩΣΗ: Απλό fallback αν gripSettings είναι null/undefined ή δεν έχουν τις απαραίτητες properties
  if (!gripSettings || typeof gripSettings.gripSize === 'undefined') {
    return <div>Loading grip settings...</div>;
  }

  // Accordion state management
  const { toggleSection, isOpen } = useAccordion('basic');

  const updateSettings = (updates: any) => {
    updateGripSettings(updates);
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Ρυθμίσεις Grips</h3>
        <button
          onClick={resetToDefaults}
          className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
        >
          Επαναφορά
        </button>
      </div>

      {/* Enable/Disable Grips */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-md border-l-4 border-blue-500">
          <input
            type="checkbox"
            id="grips-enabled"
            checked={gripSettings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label
            htmlFor="grips-enabled"
            className={`text-sm font-medium ${gripSettings.enabled ? 'text-white' : 'text-gray-400'}`}
          >
            Εμφάνιση Grips
          </label>
        </div>
        {!gripSettings.enabled && (
          <div className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 p-2 rounded border border-yellow-700">
            ⚠️ Τα grips είναι απενεργοποιημένα και δεν θα εμφανίζονται
          </div>
        )}
      </div>

      {/* ACCORDION SECTIONS */}
      <div className="space-y-3">
        {/* 1. ΒΑΣΙΚΕΣ ΡΥΘΜΙΣΕΙΣ */}
        <AccordionSection
          title="Βασικές Ρυθμίσεις"
          icon={<CogIcon className="w-4 h-4" />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={!gripSettings.enabled}
          badge={3}
        >
          <div className="space-y-4">

          {/* Grip Size */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
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
                className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                min="4"
                max="16"
                step="1"
                value={gripSettings.gripSize || 8}
                onChange={(e) => updateSettings({ gripSize: parseInt(e.target.value) })}
                className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          </div>

          {/* Opacity */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">
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
                className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                min="0.1"
                max="1"
                step="0.1"
                value={gripSettings.opacity}
                onChange={(e) => updateSettings({ opacity: parseFloat(e.target.value) })}
                className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          </div>
        </div>
        </AccordionSection>

        {/* 2. ΧΡΩΜΑΤΑ GRIPS */}
        <AccordionSection
          title="Χρώματα Grips"
          icon={<ColorSwatchIcon className="w-4 h-4" />}
          isOpen={isOpen('colors')}
          onToggle={() => toggleSection('colors')}
          disabled={!gripSettings.enabled}
          badge={4}
        >
          <div className="grid grid-cols-2 gap-4">

            {/* Cold Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">Χρώμα Cold</label>
              <div className="flex items-center space-x-3">
                <div
                  className="w-16 h-10 rounded border border-gray-600"
                  style={{ backgroundColor: gripSettings.colors.cold }}
                />
                <input
                  type="color"
                  value={gripSettings.colors.cold || '#0000FF'}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, cold: e.target.value } })}
                  className="w-20 h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={gripSettings.colors.cold || '#0000FF'}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, cold: e.target.value } })}
                  className="w-16 px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                  placeholder="#0000FF"
                />
              </div>
            </div>

            {/* Warm Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">Χρώμα Warm (Hover)</label>
              <div className="flex items-center space-x-3">
                <div
                  className="w-16 h-10 rounded border border-gray-600"
                  style={{ backgroundColor: gripSettings.colors.warm }}
                />
                <input
                  type="color"
                  value={gripSettings.colors.warm || '#00FF80'}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, warm: e.target.value } })}
                  className="w-20 h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={gripSettings.colors.warm || '#00FF80'}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, warm: e.target.value } })}
                  className="w-16 px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                  placeholder="#ffff00"
                />
              </div>
            </div>

            {/* Hot Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">Χρώμα Hot (Επιλεγμένα)</label>
              <div className="flex items-center space-x-3">
                <div
                  className="w-16 h-10 rounded border border-gray-600"
                  style={{ backgroundColor: gripSettings.colors.hot }}
                />
                <input
                  type="color"
                  value={gripSettings.colors.hot || '#FF3B30'}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, hot: e.target.value } })}
                  className="w-20 h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={gripSettings.colors.hot || '#FF3B30'}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, hot: e.target.value } })}
                  className="w-16 px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                  placeholder="#ff0000"
                />
              </div>
            </div>

            {/* Contour Color */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">Χρώμα Περιγράμματος</label>
              <div className="flex items-center space-x-3">
                <div
                  className="w-16 h-10 rounded border border-gray-600"
                  style={{ backgroundColor: gripSettings.colors.contour }}
                />
                <input
                  type="color"
                  value={gripSettings.colors.contour}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, contour: e.target.value } })}
                  className="w-20 h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={gripSettings.colors.contour}
                  onChange={(e) => updateSettings({ colors: { ...gripSettings.colors, contour: e.target.value } })}
                  className="w-16 px-1 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* 3. ΤΥΠΟΙ GRIPS */}
        <AccordionSection
          title="Τύποι Grips"
          icon={<ViewGridIcon className="w-4 h-4" />}
          isOpen={isOpen('types')}
          onToggle={() => toggleSection('types')}
          disabled={!gripSettings.enabled}
          badge={3}
        >
          <div className="space-y-2">

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gripSettings.showMidpoints}
                onChange={(e) => updateSettings({ showMidpoints: e.target.checked })}
                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-200">Εμφάνιση Midpoints</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gripSettings.showCenters}
                onChange={(e) => updateSettings({ showCenters: e.target.checked })}
                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-200">Εμφάνιση Centers</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={gripSettings.showQuadrants}
                onChange={(e) => updateSettings({ showQuadrants: e.target.checked })}
                className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-200">Εμφάνιση Quadrants</span>
            </label>
          </div>
        </AccordionSection>

        {/* 4. ΠΡΟΧΩΡΗΜΕΝΕΣ ΡΥΘΜΙΣΕΙΣ */}
        <AccordionSection
          title="Προχωρημένες Ρυθμίσεις"
          icon={<AdjustmentsIcon className="w-4 h-4" />}
          isOpen={isOpen('advanced')}
          onToggle={() => toggleSection('advanced')}
          disabled={!gripSettings.enabled}
          badge={6}
        >
          <div className="space-y-4">

            {/* Pick Box Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
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
                  className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="8"
                  step="1"
                  value={gripSettings.pickBoxSize || 3}
                  onChange={(e) => updateSettings({ pickBoxSize: parseInt(e.target.value) })}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
              </div>
            </div>

            {/* Aperture Size */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
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
                  className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min="8"
                  max="32"
                  step="2"
                  value={gripSettings.apertureSize || 16}
                  onChange={(e) => updateSettings({ apertureSize: parseInt(e.target.value) })}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
              </div>
            </div>

            {/* Max Grips */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
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
                  className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min="10"
                  max="200"
                  step="10"
                  value={gripSettings.maxGripsPerEntity || 50}
                  onChange={(e) => updateSettings({ maxGripsPerEntity: parseInt(e.target.value) })}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
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
                  className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-200">Εμφάνιση Aperture</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gripSettings.multiGripEdit}
                  onChange={(e) => updateSettings({ multiGripEdit: e.target.checked })}
                  className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-200">Multi-Grip Επεξεργασία</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gripSettings.snapToGrips}
                  onChange={(e) => updateSettings({ snapToGrips: e.target.checked })}
                  className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-200">Snap σε Grips</span>
              </label>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2 pt-4 border-t border-gray-600">
              <h5 className="text-sm font-medium text-gray-300">Γρήγορα Presets</h5>
              <div className="flex space-x-2">
            <button
              onClick={() => updateSettings({ gripSize: 5, pickBoxSize: 2, apertureSize: 10 })}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Μικρό
            </button>
            <button
              onClick={() => updateSettings({ gripSize: 8, pickBoxSize: 3, apertureSize: 16 })}
              className="px-3 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
            >
              Κανονικό
            </button>
            <button
              onClick={() => updateSettings({ gripSize: 12, pickBoxSize: 5, apertureSize: 24 })}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
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