"use client";

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldUpdate } from '../types';

interface BasicInfoFieldsProps {
  isEditing: boolean;
  numberValue: string;
  orderValue: number;
  onChange: FieldUpdate;
}

export function BasicInfoFields({
  isEditing,
  numberValue,
  orderValue,
  onChange,
}: BasicInfoFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="section-number">Αριθμός Άρθρου</Label>
        <Input
          id="section-number"
          value={numberValue}
          onChange={(e) => onChange('number', e.target.value)}
          disabled={!isEditing}
          placeholder="π.χ. 1, 1.1, A"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="section-order">Σειρά</Label>
        <Input
          id="section-order"
          type="number"
          value={orderValue}
          onChange={(e) => onChange('order', parseInt(e.target.value) || 0)}
          disabled={!isEditing}
          min={0}
        />
      </div>
    </div>
  );
}
