'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Props {
  x: number;
  y: number;
  onChange: (coords: { x: number, y: number }) => void;
}

export function FormRowCoordinates({ x, y, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label>Συντεταγμένες (X, Y)</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          value={x}
          onChange={(e) => onChange({ x: parseFloat(e.target.value) || 0, y })}
          placeholder="X"
        />
        <Input
          type="number"
          value={y}
          onChange={(e) => onChange({ x, y: parseFloat(e.target.value) || 0 })}
          placeholder="Y"
        />
      </div>
      <p className="text-xs text-muted-foreground">Θέση στον χάρτη του κτιρίου</p>
    </div>
  );
}
