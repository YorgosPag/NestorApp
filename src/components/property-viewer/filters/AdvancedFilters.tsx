'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Filter } from "lucide-react";

interface AdvancedFiltersProps {
    features: string[];
    onFeatureChange: (featureId: string, checked: boolean | 'indeterminate') => void;
}

export function AdvancedFilters({ features, onFeatureChange }: AdvancedFiltersProps) {
    const { t } = useTranslation('properties');
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const featureOptions = [
        { id: 'parking', label: t('filters.advanced.features.parking') },
        { id: 'storage', label: t('filters.advanced.features.storage') },
        { id: 'fireplace', label: t('filters.advanced.features.fireplace') },
        { id: 'view', label: t('filters.advanced.features.view') },
        { id: 'pool', label: t('filters.advanced.features.pool') },
    ];

    return (
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="pt-2">
            <CollapsibleTrigger asChild>
                <Button variant="link" size="sm">
                    <Filter className="w-4 h-4 mr-2"/>
                    {showAdvanced ? t('filters.advanced.hide') : t('filters.advanced.show')}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 p-4 border rounded-lg bg-background animate-in fade-in-0 zoom-in-95">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                 {featureOptions.map(feature => (
                    <div key={feature.id} className="flex items-center space-x-2">
                        <Checkbox 
                            id={`feature-${feature.id}`}
                            checked={features.includes(feature.id)}
                            onCheckedChange={(checked) => onFeatureChange(feature.id, checked)}
                            aria-label={feature.label}
                        />
                        <Label htmlFor={`feature-${feature.id}`} className="text-sm font-normal">
                            {feature.label}
                        </Label>
                    </div>
                 ))}
              </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
