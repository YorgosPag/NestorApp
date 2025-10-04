/**
 * DXF SETTINGS PANEL - Main Component
 * Κεντρικό panel με tabs για General και Special settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Layers, RotateCcw, Save, Check } from 'lucide-react';

// Import refactored components
import { LineSettingsRefactored } from './LineSettingsRefactored';

// Import store hooks
import {
  useDxfSettingsInit,
  useSaveStatus,
  useSelectionSettings,
} from '../../../stores/useDxfSettings';
import { useDxfSettingsStore } from '../../../stores/DxfSettingsStore';

import type { EntityId } from '../../../settings-core/types';

interface DxfSettingsPanelProps {
  selectedEntityId?: EntityId;
  className?: string;
}

export const DxfSettingsPanel: React.FC<DxfSettingsPanelProps> = ({
  selectedEntityId,
  className = '',
}) => {
  // Initialize store
  const { isLoaded } = useDxfSettingsInit();
  const { status: saveStatus, lastSaved } = useSaveStatus();
  const selectionHook = useSelectionSettings();

  // Local state for active tab
  const [activeTab, setActiveTab] = useState<'general' | 'special'>('general');

  // Store actions
  const resetGeneralToDefaults = useDxfSettingsStore((state) => state.resetGeneralToDefaults);
  const clearAllOverrides = useDxfSettingsStore((state) => state.clearAllOverrides);
  const saveToLocalStorage = useDxfSettingsStore((state) => state.saveToLocalStorage);

  // Check if entity has overrides
  const hasEntityOverrides = selectedEntityId
    ? useDxfSettingsStore.getState().hasEntityOverrides(selectedEntityId)
    : false;

  // Auto-switch to special tab if entity is selected
  useEffect(() => {
    if (selectedEntityId && hasEntityOverrides) {
      setActiveTab('special');
    }
  }, [selectedEntityId, hasEntityOverrides]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-950 border border-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          <h2 className="text-xl font-bold text-gray-100">DXF Settings</h2>

          {/* Save status indicator */}
          {saveStatus === 'saving' && (
            <Badge variant="secondary" className="bg-blue-900 text-blue-100">
              Saving...
            </Badge>
          )}
          {saveStatus === 'saved' && (
            <Badge variant="secondary" className="bg-green-900 text-green-100">
              <Check className="w-3 h-3 mr-1" />
              Saved
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Reset button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (activeTab === 'general') {
                resetGeneralToDefaults();
              } else {
                clearAllOverrides();
              }
              saveToLocalStorage();
            }}
            className="gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset {activeTab === 'general' ? 'General' : 'All Overrides'}
          </Button>

          {/* Manual save button */}
          <Button
            size="sm"
            variant="outline"
            onClick={saveToLocalStorage}
            className="gap-1"
          >
            <Save className="w-3 h-3" />
            Save
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'general' | 'special')}>
        <TabsList className="grid w-full grid-cols-2 bg-gray-800">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-gray-700"
          >
            <Settings className="w-4 h-4 mr-2" />
            Γενικές Ρυθμίσεις
          </TabsTrigger>
          <TabsTrigger
            value="special"
            className="data-[state=active]:bg-gray-700"
            disabled={!selectedEntityId}
          >
            <Layers className="w-4 h-4 mr-2" />
            Ειδικές Ρυθμίσεις
            {hasEntityOverrides && (
              <Badge
                variant="secondary"
                className="ml-2 bg-blue-900 text-blue-100 text-xs"
              >
                Override
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="mt-4 space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Οι γενικές ρυθμίσεις εφαρμόζονται σε όλα τα νέα entities.
              Τα υπάρχοντα entities με overrides δεν επηρεάζονται.
            </p>

            {/* Line Settings */}
            <div className="border border-gray-800 rounded-lg p-4">
              <LineSettingsRefactored context="general" />
            </div>

            {/* Text Settings - TODO */}
            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">
                Text Settings
              </h3>
              <p className="text-sm text-gray-500">Coming soon...</p>
            </div>

            {/* Grip Settings - TODO */}
            <div className="border border-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">
                Grip Settings
              </h3>
              <p className="text-sm text-gray-500">Coming soon...</p>
            </div>
          </div>
        </TabsContent>

        {/* Special Settings Tab */}
        <TabsContent value="special" className="mt-4 space-y-6">
          {selectedEntityId ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Οι ειδικές ρυθμίσεις είναι overrides για το επιλεγμένο entity.
                Αποθηκεύονται μόνο οι διαφορές από τις γενικές ρυθμίσεις.
              </p>

              {/* Selection info */}
              {selectionHook.hasSelection && (
                <div className="bg-blue-950 border border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-200">
                    {selectionHook.selectionCount} entities επιλεγμένα.
                    Οι αλλαγές θα εφαρμοστούν σε όλα.
                  </p>
                </div>
              )}

              {/* Line Settings for Entity */}
              <div className="border border-gray-800 rounded-lg p-4">
                <LineSettingsRefactored
                  context="entity"
                  entityId={selectedEntityId}
                />
              </div>

              {/* Text Settings - TODO */}
              <div className="border border-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">
                  Text Settings
                </h3>
                <p className="text-sm text-gray-500">Coming soon...</p>
              </div>

              {/* Grip Settings - TODO */}
              <div className="border border-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">
                  Grip Settings
                </h3>
                <p className="text-sm text-gray-500">Coming soon...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-400 text-center">
                Επιλέξτε ένα entity για να δείτε τις ειδικές ρυθμίσεις
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer info */}
      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
        <div>
          {lastSaved && (
            <span>
              Last saved: {new Date(lastSaved).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div>
          <span>
            Override Pattern: General → Special → Effective
          </span>
        </div>
      </div>
    </div>
  );
};