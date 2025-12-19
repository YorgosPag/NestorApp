"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/obligations/rich-text-editor';

interface ContentEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function ContentEditor({ value, onChange }: ContentEditorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="section-content">Περιεχόμενο Άρθρου</Label>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="Εισάγετε το περιεχόμενο του άρθρου..."
      />
    </div>
  );
}
