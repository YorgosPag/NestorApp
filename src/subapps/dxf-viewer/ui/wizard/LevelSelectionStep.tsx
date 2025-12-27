'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import { HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium ${colors.text.primary} mb-2">
          Επιλέξτε Επίπεδο για Εισαγωγή DXF
        </h3>
        <p className={`text-sm ${colors.text.muted} mb-6`}>
          Επιλέξτε ένα υπάρχον επίπεδο ή δημιουργήστε ένα νέο. Κάθε επίπεδο μπορεί να περιέχει πολλές κατόψεις.
        </p>
      </div>

      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
        <h4 className="text-sm font-medium ${colors.text.tertiary}">Υπάρχοντα Επίπεδα</h4>
        {levels.map((level) => (
          <label
            key={level.id}
            className={`flex items-center p-3 cursor-pointer transition-colors ${
              importWizard.selectedLevelId === level.id
                ? `${getStatusBorder('active')} ${colors.bg.selection}`
                : `${quick.card} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <input
              type="radio"
              name="dxf-level-selection"
              value={level.id}
              checked={importWizard.selectedLevelId === level.id}
              onChange={() => handleLevelSelect(level.id)}
              className="mr-3"
            />
            <div className="flex items-center flex-1">
              <Building2 className={`${iconSizes.sm} ${colors.text.muted} mr-2`} />
              <div>
                <div className="${colors.text.primary} font-medium">{level.name}</div>
                {level.isDefault && (
                  <div className={`text-xs ${colors.text.info}`}>Προεπιλεγμένο Επίπεδο</div>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium ${colors.text.tertiary}">Ή Δημιουργήστε Νέο Επίπεδο</h4>
        
        {!showNewLevelForm ? (
          <button
            onClick={handleCreateNewLevel}
            className={`flex items-center p-3 w-full text-left transition-colors ${
              !importWizard.selectedLevelId && importWizard.newLevelName
                ? `${getStatusBorder('active')} ${colors.bg.selection}`
                : `${quick.dashed} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <Plus className={`${iconSizes.sm} ${colors.text.muted} mr-2`} />
            <span className="${colors.text.tertiary}">Δημιουργία Νέου Επιπέδου</span>
          </button>
        ) : (
          <div className={`${quick.card} p-3`}>
            <label className="flex items-center">
              <input
                type="radio"
                name="dxf-level-selection"
                checked={!importWizard.selectedLevelId}
                onChange={() => setSelectedLevel(undefined, newLevelName)}
                className="mr-3"
              />
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Εισάγετε όνομα επιπέδου (π.χ. Υπόγειο, 2ος Όροφος)"
                  value={newLevelName}
                  onChange={(e) => handleNewLevelNameChange(e.target.value)}
                  className={`w-full ${colors.bg.secondary} px-3 py-2 ${colors.text.primary} placeholder-gray-400 focus:outline-none ${quick.input}`}
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
              className={`mt-2 text-sm ${colors.text.muted} ${HOVER_TEXT_EFFECTS.WHITE} transition-colors`}
            >
              Ακύρωση
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
