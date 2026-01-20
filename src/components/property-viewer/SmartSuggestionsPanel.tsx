'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/providers/NotificationProvider';
import { suggestionSystem } from './suggestion-system';
import type { Property } from '@/types/property-viewer';
import type { Suggestion } from '@/types/suggestions';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { SuggestionsList } from './suggestion-panel/SuggestionsList';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface SmartSuggestionsPanelProps {
  properties: Property[];
  onShowSuggestion: (suggestion: Suggestion | null) => void;
  onAcceptSuggestion: (suggestion: Suggestion) => void;
}

export function SmartSuggestionsPanel({ properties, onShowSuggestion, onAcceptSuggestion }: SmartSuggestionsPanelProps) {
  const notifications = useNotifications();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  const analyzePlacement = () => {
    const newSuggestions = suggestionSystem.analyzeFloorPlan(properties);
    setSuggestions(newSuggestions.sort((a, b) => b.score - a.score));
    notifications.success(`🔍 ${t('suggestions.analysisComplete', { count: newSuggestions.length })}`);
  };

  const handleSelectSuggestion = (id: string) => {
    if (selectedSuggestionId === id) {
      setSelectedSuggestionId(null);
      onShowSuggestion(null);
    } else {
      const selected = suggestions.find(s => s.propertyId === id);
      setSelectedSuggestionId(id);
      onShowSuggestion(selected ?? null);
    }
  };

  const handleAcceptSuggestion = (suggestion: Suggestion) => {
    onAcceptSuggestion(suggestion);
    clearSuggestions();
  };

  const clearSuggestions = () => {
    setSuggestions([]);
    onShowSuggestion(null);
    setSelectedSuggestionId(null);
  };

  return (
    <Card className="flex-1">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
                <span>🤖</span>
                {t('suggestions.title')}
            </CardTitle>
            <Button
                onClick={analyzePlacement}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
            >
                {t('suggestions.analyze')}
            </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {suggestions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
                <p className="text-xs">{t('suggestions.clickAnalyze')}</p>
            </div>
        ) : (
          <SuggestionsList
            suggestions={suggestions}
            selectedId={selectedSuggestionId}
            onSelect={handleSelectSuggestion}
            onAccept={handleAcceptSuggestion}
          />
        )}

        {selectedSuggestionId && (
            <Button
            onClick={clearSuggestions}
            className="w-full mt-2"
            variant="ghost"
            size="sm"
            >
            {t('suggestions.clearSuggestions')}
            </Button>
        )}
      </CardContent>
    </Card>
  );
}
