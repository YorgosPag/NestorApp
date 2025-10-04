'use client';
import { TYPE_OPTIONS } from '../constants';

export function TypeSelect({
  selected,
  onChange,
}: {
  selected: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={selected || 'all'}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2.5 border border-gray-200 dark:border-border dark:bg-muted/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      {TYPE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
