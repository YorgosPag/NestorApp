'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import { HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT, PANEL_COLORS } from '../../config/panel-tokens';

interface LevelSelectionStepProps {
    onNext: () => void;
    onClose: () => void;
}

export function LevelSelectionStep({ onNext, onClose }: LevelSelectionStepProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    levels,
    importWizard,
    setSelectedLevel
  } = useLevels();
  
  const [showNewLevelForm, setShowNewLevelForm] = useState(false);
  const [newLevelName, setNewLevelName] = useState('');

  const handleLevelSelect = (levelId: string) => {
    setSelectedLevel(levelId, undefined);
    setShowNewLevelForm(false);
  };

  const handleCreateNewLevel = () => {
    if (!showNewLevelForm) {
      setShowNewLevelForm(true);
      setSelectedLevel(undefined, '');
      setNewLevelName('');
    }
  };

  const handleNewLevelNameChange = (name: string) => {
    setNewLevelName(name);
    setSelectedLevel(undefined, name);
  };

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_XL}>
      {/* ✅ ENTERPRISE: Semantic header + fix broken template string (ADR-003) */}
      <header>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
          Επιλέξτε Επίπεδο για Εισαγωγή DXF
        </h3>
        <p className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
          Επιλέξτε ένα υπάρχον επίπεδο ή δημιουργήστε ένα νέο. Κάθε επίπεδο μπορεί να περιέχει πολλές κατόψεις.
        </p>
      </header>

      <section className={`${PANEL_LAYOUT.SPACING.GAP_MD} ${PANEL_LAYOUT.MAX_HEIGHT.MD} overflow-y-auto ${PANEL_LAYOUT.PADDING.RIGHT_SM}`}>
        <h4 className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.tertiary}`}>Υπάρχοντα Επίπεδα</h4>
        {levels.map((level) => (
          <label
            key={level.id}
            className={`flex items-center ${PANEL_LAYOUT.SPACING.MD} cursor-pointer transition-colors ${
              importWizard.selectedLevelId === level.id
                ? `${getStatusBorder('info')} ${colors.bg.selection}`
                : `${quick.card} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <input
              type="radio"
              name="dxf-level-selection"
              value={level.id}
              checked={importWizard.selectedLevelId === level.id}
              onChange={() => handleLevelSelect(level.id)}
              className={PANEL_LAYOUT.SPACING.GAP_H_MD}
            />
            <div className="flex items-center flex-1">
              <Building2 className={`${iconSizes.sm} ${colors.text.muted} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
              <div>
                <div className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{level.name}</div>
                {level.isDefault && (
                  <div className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.info}`}>Προεπιλεγμένο Επίπεδο</div>
                )}
              </div>
            </div>
          </label>
        ))}
      </section>

      <section className={PANEL_LAYOUT.SPACING.GAP_MD}>
        <h4 className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.tertiary}`}>Ή Δημιουργήστε Νέο Επίπεδο</h4>

        {!showNewLevelForm ? (
          <button
            onClick={handleCreateNewLevel}
            className={`flex items-center ${PANEL_LAYOUT.SPACING.MD} w-full text-left transition-colors ${
              !importWizard.selectedLevelId && importWizard.newLevelName
                ? `${getStatusBorder('info')} ${colors.bg.selection}`
                : `${quick.dashed} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <Plus className={`${iconSizes.sm} ${colors.text.muted} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
            <span className={`${colors.text.tertiary}`}>Δημιουργία Νέου Επιπέδου</span>
          </button>
        ) : (
          <div className={`${quick.card} ${PANEL_LAYOUT.SPACING.MD}`}>
            <label className="flex items-center">
              <input
                type="radio"
                name="dxf-level-selection"
                checked={!importWizard.selectedLevelId}
                onChange={() => setSelectedLevel(undefined, newLevelName)}
                className={PANEL_LAYOUT.SPACING.GAP_H_MD}
              />
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Εισάγετε όνομα επιπέδου (π.χ. Υπόγειο, 2ος Όροφος)"
                  value={newLevelName}
                  onChange={(e) => handleNewLevelNameChange(e.target.value)}
                  className={`${PANEL_LAYOUT.INPUT.FULL_WIDTH} ${colors.bg.secondary} ${PANEL_LAYOUT.INPUT.PADDING} ${colors.text.primary} ${PANEL_COLORS.TEXT_MUTED} ${PANEL_LAYOUT.INPUT.FOCUS} ${quick.input}`}
                  autoFocus
                />
              </div>
            </label>
            <button
              onClick={() => {
                setShowNewLevelForm(false);
                setSelectedLevel(levels[0]?.id || undefined, undefined);
                setNewLevelName('');
              }}
              className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${colors.text.muted} ${HOVER_TEXT_EFFECTS.WHITE} transition-colors`}
            >
              Ακύρωση
            </button>
          </div>
        )}
      </section>

    </div>
  );
}
