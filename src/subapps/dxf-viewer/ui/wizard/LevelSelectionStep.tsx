'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { useLevels } from '../../systems/levels';
import { HOVER_BORDER_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

interface LevelSelectionStepProps {
    onNext: () => void;
    onClose: () => void;
}

export function LevelSelectionStep({ onNext, onClose }: LevelSelectionStepProps) {
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
        <h3 className="text-lg font-medium text-white mb-2">
          Επιλέξτε Επίπεδο για Εισαγωγή DXF
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Επιλέξτε ένα υπάρχον επίπεδο ή δημιουργήστε ένα νέο. Κάθε επίπεδο μπορεί να περιέχει πολλές κατόψεις.
        </p>
      </div>

      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
        <h4 className="text-sm font-medium text-gray-300">Υπάρχοντα Επίπεδα</h4>
        {levels.map((level) => (
          <label
            key={level.id}
            className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
              importWizard.selectedLevelId === level.id
                ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                : `border-gray-600 ${HOVER_BORDER_EFFECTS.MUTED}`
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
              <Building2 className="w-4 h-4 text-gray-400 mr-2" />
              <div>
                <div className="text-white font-medium">{level.name}</div>
                {level.isDefault && (
                  <div className="text-xs text-blue-400">Προεπιλεγμένο Επίπεδο</div>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300">Ή Δημιουργήστε Νέο Επίπεδο</h4>
        
        {!showNewLevelForm ? (
          <button
            onClick={handleCreateNewLevel}
            className={`flex items-center p-3 border-2 border-dashed rounded-lg w-full text-left transition-colors ${
              !importWizard.selectedLevelId && importWizard.newLevelName
                ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                : `border-gray-600 ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <Plus className="w-4 h-4 text-gray-400 mr-2" />
            <span className="text-gray-300">Δημιουργία Νέου Επιπέδου</span>
          </button>
        ) : (
          <div className="border border-gray-600 rounded-lg p-3">
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
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
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
              className={`mt-2 text-sm text-gray-400 ${HOVER_TEXT_EFFECTS.WHITE} transition-colors`}
            >
              Ακύρωση
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
