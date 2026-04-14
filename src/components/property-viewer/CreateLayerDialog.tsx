/**
 * @fileoverview CreateLayerDialog — Dialog for creating new layers in the Admin Layer Manager.
 * Extracted from AdminLayerManager.tsx for SRP compliance (ADR N.7.1).
 *
 * @module property-viewer/CreateLayerDialog
 */

'use client';

import '@/lib/design-system';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';

import type { LayerCategory } from '@/types/layers';
import { LAYER_CATEGORIES } from '@/types/layers';

export interface CreateLayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLayer: (layerData: {
    name: string;
    description: string;
    category: LayerCategory;
    color: string;
  }) => void;
}

const DEFAULT_COLOR = '#3b82f6'; // eslint-disable-line design-system/no-hardcoded-colors

export function CreateLayerDialog({ open, onOpenChange, onCreateLayer }: CreateLayerDialogProps) {
  const iconSizes = useIconSizes();
  const { radius } = useBorderTokens();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<LayerCategory>('annotations');
  const [color, setColor] = useState(DEFAULT_COLOR);

  const handleSubmit = () => {
    if (!name.trim()) return;

    onCreateLayer({
      name: name.trim(),
      description: description.trim(),
      category,
      color
    });

    // Reset form
    setName('');
    setDescription('');
    setCategory('annotations');
    setColor(DEFAULT_COLOR);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('layerManager.createDialog.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="layer-name">{t('layerManager.createDialog.nameLabel')}</Label>
            <Input
              id="layer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('layerManager.createDialog.namePlaceholder')}
            />
          </div>

          <div>
            <Label htmlFor="layer-description">{t('layerManager.createDialog.descriptionLabel')}</Label>
            <Textarea
              id="layer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('layerManager.createDialog.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="layer-category">{t('layerManager.createDialog.categoryLabel')}</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as LayerCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LAYER_CATEGORIES).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`${iconSizes.xs} ${radius.full} ${getDynamicBackgroundClass(info.color)}`}
                      />
                      {info.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="layer-color">{t('layerManager.createDialog.colorLabel')}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="layer-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className={`${iconSizes.xl2} h-8 rounded border`}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3b82f6" // eslint-disable-line design-system/no-hardcoded-colors
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('layerManager.createDialog.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {t('layerManager.createDialog.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
