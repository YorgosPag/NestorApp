"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { SectionCategory } from '@/types/obligations';
import type { FieldUpdate } from '../types';

interface CategoryRequiredFieldsProps {
  isEditing: boolean;
  category: SectionCategory;
  isRequired: boolean;
  categoryLabels: Record<SectionCategory, string>;
  onChange: FieldUpdate;
}

export function CategoryRequiredFields({
  isEditing,
  category,
  isRequired,
  categoryLabels,
  onChange,
}: CategoryRequiredFieldsProps) {
  const { t } = useTranslation('obligations');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="section-category">{t('sectionEditor.categoryLabel')}</Label>
        <Select
          value={category}
          onValueChange={(value: SectionCategory) => onChange('category', value)}
          disabled={!isEditing}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('sectionEditor.selectCategory')} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('sectionEditor.statusLabel')}</Label>
        <div className="flex items-center gap-4 pt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => onChange('isRequired', e.target.checked)}
              disabled={!isEditing}
              className="rounded"
            />
            <span className="text-sm">{t('sectionEditor.requiredArticle')}</span>
          </label>
        </div>
      </div>
    </div>
  );
}
