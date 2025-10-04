/**
 * LINE SETTINGS REFACTORED Component
 * Χρησιμοποιεί το νέο Zustand store με override support
 */

'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCcw, Copy, X } from 'lucide-react';

// Import micro controls
import { LineWidthControl } from './controls/LineWidthControl';
import { LineStyleControl } from './controls/LineStyleControl';
import { LineColorControl } from './controls/LineColorControl';
import { LinePreviewControl } from './controls/LinePreviewControl';

// Import new store hooks
import {
  useGeneralLineSettings,
  useEntitySettings,
  useSelectionSettings,
} from '../../../stores/useDxfSettings';

import type { EntityId, LineSettings } from '../../../settings-core/types';

interface LineSettingsRefactoredProps {
  context: 'general' | 'entity';
  entityId?: EntityId;
  className?: string;
}

export const LineSettingsRefactored: React.FC<LineSettingsRefactoredProps> = ({
  context,
  entityId,
  className = '',
}) => {
  // Get appropriate hooks based on context
  const generalHook = useGeneralLineSettings();
  const entityHook = useEntitySettings(context === 'entity' ? entityId || null : null);
  const selectionHook = useSelectionSettings();

  // Determine which settings to use
  const isEntityContext = context === 'entity' && entityId;
  const activeSettings = useMemo(() => {
    if (isEntityContext && entityHook) {
      return entityHook.effective.line;
    }
    return generalHook.settings;
  }, [isEntityContext, entityHook, generalHook.settings]);

  // Update handlers
  const handleLineWidthChange = (value: number) => {
    if (isEntityContext && entityHook) {
      entityHook.setOverride({ line: { lineWidth: value } });
    } else {
      generalHook.setSettings({ lineWidth: value });
    }
  };

  const handleLineStyleChange = (value: LineSettings['lineType']) => {
    if (isEntityContext && entityHook) {
      entityHook.setOverride({ line: { lineType: value } });
    } else {
      generalHook.setSettingsInstant({ lineType: value });
    }
  };

  const handleColorChange = (value: string) => {
    if (isEntityContext && entityHook) {
      entityHook.setOverride({ line: { color: value } });
    } else {
      generalHook.setSettingsInstant({ color: value });
    }
  };

  const handleOpacityChange = (value: number) => {
    if (isEntityContext && entityHook) {
      entityHook.setOverride({ line: { opacity: value } });
    } else {
      generalHook.setSettings({ opacity: value });
    }
  };

  const handleApplyToSelection = () => {
    if (selectionHook.hasSelection) {
      selectionHook.applyToSelection({
        line: activeSettings
      });
    }
  };

  const handleClearOverrides = () => {
    if (isEntityContext && entityHook) {
      entityHook.clearOverrides();
    }
  };

  const hasOverrides = isEntityContext && entityHook?.hasOverrides;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with override indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-100">
            Line Settings
          </h3>
          {hasOverrides && (
            <Badge variant="secondary" className="bg-blue-900 text-blue-100">
              Overridden
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Apply to selection button */}
          {selectionHook.hasSelection && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleApplyToSelection}
              className="gap-1"
            >
              <Copy className="w-3 h-3" />
              Apply to {selectionHook.selectionCount} selected
            </Button>
          )}

          {/* Clear overrides button */}
          {hasOverrides && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearOverrides}
              className="gap-1 text-red-400 hover:text-red-300"
            >
              <X className="w-3 h-3" />
              Clear Override
            </Button>
          )}
        </div>
      </div>

      {/* Tabs for different setting groups */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
          <TabsTrigger value="hover">States</TabsTrigger>
        </TabsList>

        {/* Basic Settings */}
        <TabsContent value="basic" className="space-y-4">
          <LineWidthControl
            value={activeSettings.lineWidth}
            onChange={handleLineWidthChange}
            label="Line Width (mm)"
          />

          <LineStyleControl
            value={activeSettings.lineType}
            onChange={handleLineStyleChange}
            label="Line Type"
          />

          <LineColorControl
            value={activeSettings.color}
            onChange={handleColorChange}
            label="Line Color"
          />

          <LineWidthControl
            value={activeSettings.opacity}
            onChange={handleOpacityChange}
            min={0}
            max={1}
            step={0.05}
            label="Opacity"
          />
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-4">
          <LineWidthControl
            value={activeSettings.dashScale}
            onChange={(value) => {
              if (isEntityContext && entityHook) {
                entityHook.setOverride({ line: { dashScale: value } });
              } else {
                generalHook.setSettings({ dashScale: value });
              }
            }}
            min={0.5}
            max={3}
            step={0.1}
            label="Dash Scale"
          />

          <LineWidthControl
            value={activeSettings.dashOffset}
            onChange={(value) => {
              if (isEntityContext && entityHook) {
                entityHook.setOverride({ line: { dashOffset: value } });
              } else {
                generalHook.setSettings({ dashOffset: value });
              }
            }}
            min={0}
            max={100}
            step={1}
            label="Dash Offset"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Line Cap
            </label>
            <select
              value={activeSettings.lineCap}
              onChange={(e) => {
                const value = e.target.value as LineSettings['lineCap'];
                if (isEntityContext && entityHook) {
                  entityHook.setOverride({ line: { lineCap: value } });
                } else {
                  generalHook.setSettingsInstant({ lineCap: value });
                }
              }}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100"
            >
              <option value="butt">Butt</option>
              <option value="round">Round</option>
              <option value="square">Square</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Line Join
            </label>
            <select
              value={activeSettings.lineJoin}
              onChange={(e) => {
                const value = e.target.value as LineSettings['lineJoin'];
                if (isEntityContext && entityHook) {
                  entityHook.setOverride({ line: { lineJoin: value } });
                } else {
                  generalHook.setSettingsInstant({ lineJoin: value });
                }
              }}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100"
            >
              <option value="miter">Miter</option>
              <option value="round">Round</option>
              <option value="bevel">Bevel</option>
            </select>
          </div>
        </TabsContent>

        {/* Hover/Final States */}
        <TabsContent value="hover" className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Hover State</h4>

            <LineColorControl
              value={activeSettings.hoverColor}
              onChange={(value) => {
                if (isEntityContext && entityHook) {
                  entityHook.setOverride({ line: { hoverColor: value } });
                } else {
                  generalHook.setSettingsInstant({ hoverColor: value });
                }
              }}
              label="Hover Color"
            />

            <LineWidthControl
              value={activeSettings.hoverWidth}
              onChange={(value) => {
                if (isEntityContext && entityHook) {
                  entityHook.setOverride({ line: { hoverWidth: value } });
                } else {
                  generalHook.setSettings({ hoverWidth: value });
                }
              }}
              label="Hover Width"
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Final State</h4>

            <LineColorControl
              value={activeSettings.finalColor}
              onChange={(value) => {
                if (isEntityContext && entityHook) {
                  entityHook.setOverride({ line: { finalColor: value } });
                } else {
                  generalHook.setSettingsInstant({ finalColor: value });
                }
              }}
              label="Final Color"
            />

            <LineWidthControl
              value={activeSettings.finalWidth}
              onChange={(value) => {
                if (isEntityContext && entityHook) {
                  entityHook.setOverride({ line: { finalWidth: value } });
                } else {
                  generalHook.setSettings({ finalWidth: value });
                }
              }}
              label="Final Width"
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Live Preview */}
      <LinePreviewControl
        settings={activeSettings}
        label="Live Preview"
      />

      {/* Context indicator */}
      <div className="text-xs text-gray-500 text-center">
        {context === 'general'
          ? 'Editing general settings (applies to all new entities)'
          : hasOverrides
          ? `Editing overrides for entity ${entityId}`
          : `Viewing inherited settings for entity ${entityId}`
        }
      </div>
    </div>
  );
};