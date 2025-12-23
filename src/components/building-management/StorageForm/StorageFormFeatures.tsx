'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommonBadge } from '@/core/badges';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface StorageFormFeaturesProps {
  features: string[];
  newFeature: string;
  setNewFeature: (value: string) => void;
  addFeature: () => void;
  removeFeature: (feature: string) => void;
  addCommonFeature: (feature: string) => void;
  commonFeaturesForType: string[];
}

export function StorageFormFeatures({
  features,
  newFeature,
  setNewFeature,
  addFeature,
  removeFeature,
  addCommonFeature,
  commonFeaturesForType,
}: StorageFormFeaturesProps) {
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle className={iconSizes.md} />
          Χαρακτηριστικά
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-2 block">Συνήθη Χαρακτηριστικά</Label>
          <div className="flex flex-wrap gap-2">
            {commonFeaturesForType.map(feature => (
              <Button
                key={feature}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addCommonFeature(feature)}
                disabled={features.includes(feature)}
                className="text-xs"
              >
                <Plus className={`${iconSizes.xs} mr-1`} />
                {feature}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">Προσθήκη Χαρακτηριστικού</Label>
          <div className="flex gap-2">
            <Input
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              placeholder="Νέο χαρακτηριστικό..."
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
            />
            <Button type="button" onClick={addFeature} variant="outline">
              <Plus className={iconSizes.sm} />
            </Button>
          </div>
        </div>

        {features.length > 0 && (
          <div>
            <Label className="text-sm font-medium mb-2 block">Επιλεγμένα Χαρακτηριστικά</Label>
            <div className="flex flex-wrap gap-2">
              {features.map((feature, index) => (
                <CommonBadge
                  key={index}
                  status="building"
                  customLabel={
                    <div className="flex items-center gap-1">
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(feature)}
                        className={`ml-1 text-destructive ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                      >
                        <Trash2 className={iconSizes.xs} />
                      </button>
                    </div>
                  }
                  variant="secondary"
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
