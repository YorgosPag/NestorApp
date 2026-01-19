"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n';
import { RichTextEditor } from '@/components/obligations/rich-text-editor';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ContentEditor({ value, onChange }: ContentEditorProps) {
  const { t } = useTranslation('obligations');

  return (
    <div className="space-y-2">
      <Label htmlFor="section-content">{t('article.contentLabel')}</Label>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={t('article.contentInputPlaceholder')}
      />
    </div>
  );
}
