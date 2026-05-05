/**
 * Demo — Address Editor State Machine (ADR-332 Phase 1)
 *
 * Debug view for the pure state machine + hooks built in Phase 1. No UI
 * components yet — Phase 3-4 add badges, panels, activity log component.
 *
 * Route: /demo/addresses-editor-state
 */

'use client';

import { useState } from 'react';
import { useAddressEditor } from '@/components/shared/addresses/editor/hooks/useAddressEditor';
import type { ResolvedAddressFields } from '@/components/shared/addresses/editor/types';

const FIELDS: Array<keyof ResolvedAddressFields> = [
  'street',
  'number',
  'postalCode',
  'neighborhood',
  'city',
  'county',
  'region',
  'country',
];

const INITIAL_INPUT: ResolvedAddressFields = {
  street: '',
  number: '',
  postalCode: '',
  neighborhood: '',
  city: '',
  county: '',
  region: '',
  country: 'Ελλάδα',
};

export default function AddressesEditorStateDemoPage() {
  const [input, setInput] = useState<ResolvedAddressFields>(INITIAL_INPUT);
  const editor = useAddressEditor(input, { autoGeocode: true, verbosity: 'debug' });

  const update = (field: keyof ResolvedAddressFields, value: string) => {
    setInput((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ADR-332 — State Machine Debug View</h1>
        <p className="text-sm text-muted-foreground">
          Phase 1 deliverable. Pure state + hooks, no UI components yet.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4">
        {FIELDS.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{field}</span>
            <input
              className="border rounded px-2 py-1"
              value={input[field] ?? ''}
              onChange={(e) => update(field, e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              status: {editor.fieldStatus[field]?.kind ?? '—'}
            </span>
          </label>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">State</h2>
        <pre className="bg-muted rounded p-3 text-xs overflow-auto">
          {JSON.stringify(editor.state, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Conflicts</h2>
        <pre className="bg-muted rounded p-3 text-xs overflow-auto">
          {JSON.stringify(editor.conflicts, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Activity log</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="border rounded px-2 py-1 text-xs"
              onClick={() => editor.activity.setVerbosity('basic')}
            >
              basic
            </button>
            <button
              type="button"
              className="border rounded px-2 py-1 text-xs"
              onClick={() => editor.activity.setVerbosity('detailed')}
            >
              detailed
            </button>
            <button
              type="button"
              className="border rounded px-2 py-1 text-xs"
              onClick={() => editor.activity.setVerbosity('debug')}
            >
              debug
            </button>
            <button
              type="button"
              className="border rounded px-2 py-1 text-xs"
              onClick={editor.activity.clear}
            >
              clear
            </button>
          </div>
        </header>
        <ul className="space-y-1 text-xs font-mono">
          {editor.activity.events.map((e) => (
            <li key={e.id}>
              [{new Date(e.timestamp).toISOString().slice(11, 23)}] {e.level}/{e.category} — {e.i18nKey}
              {e.i18nParams ? ` ${JSON.stringify(e.i18nParams)}` : ''}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex gap-2">
        <button
          type="button"
          className="border rounded px-3 py-1 text-sm"
          onClick={() => void editor.triggerGeocode()}
        >
          Trigger geocode
        </button>
        <button
          type="button"
          className="border rounded px-3 py-1 text-sm"
          onClick={editor.markStale}
        >
          Mark stale
        </button>
        <button
          type="button"
          className="border rounded px-3 py-1 text-sm"
          onClick={editor.applyCorrection}
        >
          Apply correction
        </button>
        <button
          type="button"
          className="border rounded px-3 py-1 text-sm"
          onClick={editor.reset}
        >
          Reset
        </button>
      </section>
    </main>
  );
}
