"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldUpdate } from '../types';

interface TitleFieldProps {
  isEditing: boolean;
  titleValue: string;
  onChange: FieldUpdate;
}

export function TitleField({
  isEditing,
  titleValue,
  onChange,
}: TitleFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="section-title">Τίτλος Άρθρου</Label>
      <Input
        id="section-title"
        value={titleValue}
        onChange={(e) => onChange('title', e.target.value)}
        disabled={!isEditing}
        placeholder="Εισάγετε τον τίτλο του άρθρου"
      />
    </div>
  );
}
