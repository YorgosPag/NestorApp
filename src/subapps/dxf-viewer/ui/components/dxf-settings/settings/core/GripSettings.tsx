'use client';

import React, { useState } from 'react';
import { Factory, RotateCcw } from 'lucide-react';  // 🏢 ENTERPRISE: Centralized Lucide icons
import { useUnifiedGripPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import type { GripSettings } from '../../../../../settings-core/types';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CAD_UI_COLORS, UI_COLORS } from '../../../../../config/color-config';
// 🏢 ENTERPRISE: Import centralized panel spacing (Single Source of Truth)
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: Centralized Checkbox component (Radix)
import { Checkbox } from '@/components/ui/checkbox';
// 🏢 ENTERPRISE: Centralized Button component (Radix)
import { Button } from '@/components/ui/button';
import { BaseModal } from '../../../../../components/shared/BaseModal';
import { useNotifications } from '@/providers/NotificationProvider';

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

export function GripSettings({ contextType }: { contextType?: 'preview' | 'completion' }) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getElementBorder, radius } = useBorderTokens();  // ✅ ENTERPRISE: Added getElementBorder, radius
  const colors = useSemanticColors();
  const notifications = useNotifications();  // 🏢 ENTERPRISE: Centralized notifications
  // 🎯 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
  const { settings: { gripSettings }, updateGripSettings, resetToDefaults } = useUnifiedGripPreview();

  // ✅ HOOKS FIRST: All hooks must be called before any conditional returns (React Rules of Hooks)
  const { toggleSection, isOpen } = useAccordion('basic');

  // 🏢 ENTERPRISE: Local state for Factory Reset modal
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  // ✅ ΠΡΑΓΜΑΤΙΚΗ ΔΙΟΡΘΩΣΗ: Απλό fallback αν gripSettings είναι null/undefined ή δεν έχουν τις απαραίτητες properties
  if (!gripSettings || typeof gripSettings.gripSize === 'undefined') {
    return <div>Loading grip settings...</div>;
  }

  const updateSettings = (updates: Partial<GripSettings>) => {
    updateGripSettings(updates);
  };

  // 🏢 ENTERPRISE: Factory Reset Handlers
  const handleFactoryResetClick = () => {
    setShowFactoryResetModal(true);
  };

  const handleFactoryResetConfirm = () => {
    resetToDefaults();
    console.log('🏭 [GripSettings] Factory reset confirmed - resetting to CAD defaults');

    // Close modal
    setShowFactoryResetModal(false);

    // Toast notification για επιτυχία
    notifications.success(
      '🏭 Εργοστασιακές ρυθμίσεις επαναφέρθηκαν! Όλες οι ρυθμίσεις grips επέστρεψαν στα πρότυπα CAD.',
      {
        duration: 5000
      }
    );
  };

  const handleFactoryResetCancel = () => {
    console.log('🏭 [GripSettings] Factory reset cancelled by user');
    setShowFactoryResetModal(false);

    // Toast notification για ακύρωση
    notifications.info('❌ Ακυρώθηκε η επαναφορά εργοστασιακών ρυθμίσεων');
  };

  // 🏢 ENTERPRISE: Conditional wrapper detection
  // When contextType exists (preview/completion), component is embedded in SubTabRenderer
  // → No wrapper needed (parent provides styling)
  // When contextType is undefined (general), component is standalone
  // → Semantic <section> wrapper with spacing
  const isEmbedded = Boolean(contextType);

  // 🏢 ENTERPRISE: Content rendered once, wrapper applied conditionally (DRY principle)
  const settingsContent = (
    <>
      {/* Header - Semantic <header> element */}
      {/* 🏢 ENTERPRISE: flex-col layout για να φαίνονται πλήρως τα κείμενα των κουμπιών */}
      <header className={`flex flex-col ${PANEL_LAYOUT.GAP.SM}`}>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>Ρυθμίσεις Grips</h3>
        <nav className={`flex ${PANEL_LAYOUT.GAP.SM}`} aria-label="Ενέργειες ρυθμίσεων grips">
          {/* 🏢 ENTERPRISE: Centralized Button component (variant="secondary") + Lucide icon */}
          <Button
            variant="secondary"
            size="sm"
            onClick={resetToDefaults}
            title="Επαναφορά στις προεπιλεγμένες ρυθμίσεις"
            className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}
          >
            <RotateCcw className={iconSizes.xs} />
            Επαναφορά
          </Button>
          {/* 🏢 ENTERPRISE: Centralized Button component (variant="destructive") + Lucide icon */}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleFactoryResetClick}
            title="Επαναφορά στις εργοστασιακές ρυθμίσεις (CAD Standards)"
            className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}
          >
            <Factory className={iconSizes.xs} />
            Εργοστασιακές
          </Button>
        </nav>
      </header>

      {/* 🏢 ENTERPRISE: Enable/Disable Grips - Centralized Radix Checkbox */}
      {/* 🏢 ADR-011: Using same styling as AccordionSection for visual consistency */}
      <fieldset className={PANEL_LAYOUT.SPACING.GAP_SM}>
        {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.SPACING.MD for container padding */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${getElementBorder('card', 'default')} ${radius.lg}`}>
          {/* 🏢 ENTERPRISE: Centralized Radix Checkbox */}
          <Checkbox
            id="grips-enabled"
            checked={gripSettings.enabled}
            onCheckedChange={(checked) => updateSettings({ enabled: checked === true })}
          />
          <label
            htmlFor="grips-enabled"
            className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.CURSOR.POINTER} ${gripSettings.enabled ? colors.text.primary : colors.text.muted}`}
          >
            Εμφάνιση Grips
          </label>
        </div>
        {/* 🏢 ENTERPRISE: Warning message - Using semantic colors & PANEL_LAYOUT.ALERT */}
        {!gripSettings.enabled && (
          <aside className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.warning} ${colors.bg.warningSubtle} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md} ${getStatusBorder('warning')}`} role="alert">
            ⚠️ Τα grips είναι απενεργοποιημένα και δεν θα εμφανίζονται
          </aside>
        )}
      </fieldset>

      {/* ACCORDION SECTIONS */}
      <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
        {/* 1. ΒΑΣΙΚΕΣ ΡΥΘΜΙΣΕΙΣ */}
        <AccordionSection
          title="Βασικές Ρυθμίσεις"
          icon={<CogIcon className={iconSizes.sm} />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={false}
          badge={3}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>

          {/* Grip Size */}
          <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
            <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
              Μέγεθος Grips: {gripSettings.gripSize || 8}px
            </label>
            <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
              <input
                type="range"
                min="4"
                max="16"
                step="1"
                value={gripSettings.gripSize || 8}
                onChange={(e) => updateSettings({ gripSize: parseInt(e.target.value) })}
                className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
              />
              <input
                type="number"
                min="4"
                max="16"
                step="1"
                value={gripSettings.gripSize || 8}
                onChange={(e) => updateSettings({ gripSize: parseInt(e.target.value) })}
                className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
              />
            </div>
          </div>

          {/* Opacity */}
          <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
            <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
              Διαφάνεια: {Math.round(gripSettings.opacity * 100)}%
            </label>
            <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={gripSettings.opacity}
                onChange={(e) => updateSettings({ opacity: parseFloat(e.target.value) })}
                className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
              />
              <input
                type="number"
                min="0.1"
                max="1"
                step="0.1"
                value={gripSettings.opacity}
                onChange={(e) => updateSettings({ opacity: parseFloat(e.target.value) })}
                className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
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
          <div className={`grid grid-cols-2 ${PANEL_LAYOUT.GAP.LG}`}>

            {/* Cold Color */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>Χρώμα Cold</label>
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
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>Χρώμα Warm (Hover)</label>
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
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>Χρώμα Hot (Επιλεγμένα)</label>
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
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>Χρώμα Περιγράμματος</label>
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
          <div className={PANEL_LAYOUT.SPACING.GAP_SM}>

            {/* 🏢 ENTERPRISE: Centralized Radix Checkboxes */}
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <Checkbox
                id="show-midpoints"
                checked={gripSettings.showMidpoints}
                onCheckedChange={(checked) => updateSettings({ showMidpoints: checked === true })}
              />
              <label htmlFor="show-midpoints" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>Εμφάνιση Midpoints</label>
            </div>

            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <Checkbox
                id="show-centers"
                checked={gripSettings.showCenters}
                onCheckedChange={(checked) => updateSettings({ showCenters: checked === true })}
              />
              <label htmlFor="show-centers" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>Εμφάνιση Centers</label>
            </div>

            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <Checkbox
                id="show-quadrants"
                checked={gripSettings.showQuadrants}
                onCheckedChange={(checked) => updateSettings({ showQuadrants: checked === true })}
              />
              <label htmlFor="show-quadrants" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>Εμφάνιση Quadrants</label>
            </div>
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
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>

            {/* Pick Box Size */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                Μέγεθος Pick Box: {gripSettings.pickBoxSize || 3}px
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={gripSettings.pickBoxSize || 3}
                  onChange={(e) => updateSettings({ pickBoxSize: parseInt(e.target.value) })}
                  className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
                />
                <input
                  type="number"
                  min="1"
                  max="8"
                  step="1"
                  value={gripSettings.pickBoxSize || 3}
                  onChange={(e) => updateSettings({ pickBoxSize: parseInt(e.target.value) })}
                  className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
                />
              </div>
            </div>

            {/* Aperture Size */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                Μέγεθος Aperture: {gripSettings.apertureSize || 16}px
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input
                  type="range"
                  min="8"
                  max="32"
                  step="2"
                  value={gripSettings.apertureSize || 16}
                  onChange={(e) => updateSettings({ apertureSize: parseInt(e.target.value) })}
                  className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
                />
                <input
                  type="number"
                  min="8"
                  max="32"
                  step="2"
                  value={gripSettings.apertureSize || 16}
                  onChange={(e) => updateSettings({ apertureSize: parseInt(e.target.value) })}
                  className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
                />
              </div>
            </div>

            {/* Max Grips */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                Μέγιστα Grips ανά Οντότητα: {gripSettings.maxGripsPerEntity || 50}
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={gripSettings.maxGripsPerEntity || 50}
                  onChange={(e) => updateSettings({ maxGripsPerEntity: parseInt(e.target.value) })}
                  className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
                />
                <input
                  type="number"
                  min="10"
                  max="200"
                  step="10"
                  value={gripSettings.maxGripsPerEntity || 50}
                  onChange={(e) => updateSettings({ maxGripsPerEntity: parseInt(e.target.value) })}
                  className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
                />
              </div>
            </div>

            {/* 🏢 ENTERPRISE: Advanced Options - Centralized Radix Checkboxes */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Checkbox
                  id="show-aperture"
                  checked={gripSettings.showAperture}
                  onCheckedChange={(checked) => updateSettings({ showAperture: checked === true })}
                />
                <label htmlFor="show-aperture" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>Εμφάνιση Aperture</label>
              </div>

              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Checkbox
                  id="multi-grip-edit"
                  checked={gripSettings.multiGripEdit}
                  onCheckedChange={(checked) => updateSettings({ multiGripEdit: checked === true })}
                />
                <label htmlFor="multi-grip-edit" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>Multi-Grip Επεξεργασία</label>
              </div>

              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Checkbox
                  id="snap-to-grips"
                  checked={gripSettings.snapToGrips}
                  onCheckedChange={(checked) => updateSettings({ snapToGrips: checked === true })}
                />
                <label htmlFor="snap-to-grips" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>Snap σε Grips</label>
              </div>
            </div>

            {/* 🏢 ENTERPRISE: Quick Presets - Using semantic colors */}
            <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.PADDING.TOP_LG}${quick.separator}`}>
              <h5 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted}`}>Γρήγορα Presets</h5>
              <div className={`flex ${PANEL_LAYOUT.SPACING.GAP_H_SM}`}>
                <button
                  onClick={() => updateSettings({ gripSize: 5, pickBoxSize: 2, apertureSize: 10 })}
                  className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                >
                  Μικρό
                </button>
                <button
                  onClick={() => updateSettings({ gripSize: 8, pickBoxSize: 3, apertureSize: 16 })}
                  className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                >
                  Κανονικό
                </button>
                <button
                  onClick={() => updateSettings({ gripSize: 12, pickBoxSize: 5, apertureSize: 24 })}
                  className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                >
                  Μεγάλο
                </button>
              </div>
            </div>
          </div>
        </AccordionSection>
      </div>
    </>
  );

  // 🏢 ENTERPRISE: Conditional wrapper pattern (ADR-011 compliance)
  // - Embedded (contextType exists): Fragment renders content directly in parent's container
  // - Standalone (no contextType): Semantic <section> wrapper with spacing
  return (
    <>
      {/* 🏢 ENTERPRISE: Conditional wrapper - Using PANEL_LAYOUT.SPACING for section */}
      {isEmbedded ? (
        settingsContent
      ) : (
        <section className={`${PANEL_LAYOUT.SPACING.GAP_XL} ${PANEL_LAYOUT.SPACING.LG}`} aria-label="Ρυθμίσεις Grips">
          {settingsContent}
        </section>
      )}

      {/* 🆕 ENTERPRISE FACTORY RESET CONFIRMATION MODAL - Always rendered (portal) */}
      <BaseModal
        isOpen={showFactoryResetModal}
        onClose={handleFactoryResetCancel}
        title="⚠️ Επαναφορά Εργοστασιακών Ρυθμίσεων"
        size="md"
        closeOnBackdrop={false}
        zIndex={10000}
      >
        <article className={PANEL_LAYOUT.SPACING.GAP_LG}>
          {/* 🏢 ENTERPRISE: Warning Message - Using semantic error colors */}
          {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.ALERT.PADDING_LG */}
          <aside className={`${colors.bg.errorSubtle} ${getStatusBorder('error')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="alert">
            <p className={`${colors.text.error} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
              ⚠️ ΠΡΟΕΙΔΟΠΟΙΗΣΗ: Θα χάσετε ΟΛΑ τα δεδομένα σας!
            </p>
          </aside>

          {/* Loss List */}
          <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
            <p className={`${colors.text.muted} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>Θα χάσετε:</p>
            <ul className={`list-disc list-inside ${PANEL_LAYOUT.SPACING.GAP_XS} ${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
              <li>Όλες τις προσαρμοσμένες ρυθμίσεις grips</li>
              <li>Όλα τα χρώματα που έχετε επιλέξει</li>
              <li>Όλες τις αλλαγές που έχετε κάνει</li>
            </ul>
          </section>

          {/* 🏢 ENTERPRISE: Reset Info - Using semantic info colors */}
          {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.ALERT.PADDING_LG */}
          <aside className={`${colors.bg.infoSubtle} ${getStatusBorder('info')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="note">
            <p className={`${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
              <strong>Επαναφορά:</strong> Οι ρυθμίσεις θα επανέλθουν στα πρότυπα CAD (AutoCAD/BricsCAD)
            </p>
          </aside>

          {/* Confirmation Question */}
          <p className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-center ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
            Είστε σίγουροι ότι θέλετε να συνεχίσετε;
          </p>

          {/* 🏢 ENTERPRISE: Action Buttons - Using semantic colors */}
          <footer className={`flex ${PANEL_LAYOUT.GAP.MD} justify-end ${PANEL_LAYOUT.PADDING.TOP_LG}${quick.separator}`}>
            <button
              onClick={handleFactoryResetCancel}
              className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
            >
              Ακύρωση
            </button>
            <button
              onClick={handleFactoryResetConfirm}
              className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.danger} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
            >
              <Factory className={iconSizes.xs} />
              Επαναφορά Εργοστασιακών
            </button>
          </footer>
        </article>
      </BaseModal>
    </>
  );
}

export default GripSettings;