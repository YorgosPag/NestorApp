'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldWithConfidence } from '@/subapps/procurement/types/quote';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'empty';

export function levelOf(value: unknown, confidence: number): ConfidenceLevel {
  if (value === null || value === '' || value === undefined) return 'empty';
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

export function levelClasses(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':   return 'border-l-4 border-l-green-500 bg-[hsl(var(--bg-success))]/40';
    case 'medium': return 'border-l-4 border-l-yellow-500 bg-[hsl(var(--bg-warning))]/40';
    case 'low':    return 'border-l-4 border-l-red-500 bg-[hsl(var(--bg-error))]/40';
    case 'empty':  return 'border-l-4 border-l-muted bg-muted/20';
  }
}

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 80) {
    return <Badge variant="outline" className="border-[hsl(var(--bg-success))] text-green-700">{confidence}%</Badge>;
  }
  if (confidence >= 50) {
    return <Badge variant="outline" className="border-[hsl(var(--bg-warning))] text-[hsl(var(--bg-warning))]">{confidence}%</Badge>;
  }
  return <Badge variant="outline" className="border-destructive text-destructive">{confidence}%</Badge>;
}

interface FieldRowProps<T> {
  label: string;
  field: FieldWithConfidence<T>;
}

export function FieldRow<T>({ label, field }: FieldRowProps<T>) {
  const level = levelOf(field.value, field.confidence);
  const display = field.value === null || field.value === '' ? '—' : String(field.value);
  return (
    <div className={`rounded-md px-3 py-2 ${levelClasses(level)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <p className="break-words text-sm font-medium">{display}</p>
        </div>
        <ConfidenceBadge confidence={field.confidence} />
      </div>
    </div>
  );
}

export interface EditableFieldRowProps {
  label: string;
  value: string;
  confidence: number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}

export function EditableFieldRow({ label, value, confidence, onChange, type = 'text', placeholder }: EditableFieldRowProps) {
  const level = levelOf(value, confidence);
  return (
    <div className={`rounded-md px-3 py-2 ${levelClasses(level)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Input
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 h-8 text-sm"
          />
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>
    </div>
  );
}
