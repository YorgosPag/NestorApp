/**
 * Demo — ADR-332 Phase 5: AddressEditor end-to-end + Phase 3-4 component showcase
 *
 * Route: /demo/addresses-editor
 *
 * Phase 5 section (top): live <AddressEditor> coordinator — type an address and
 * watch the activity log, confidence meter, and reconciliation panel react in
 * real time.
 *
 * Phase 3-4 sections (bottom): static fixtures for all presentational components.
 */

'use client';

import { useState } from 'react';
import { AddressEditor } from '@/components/shared/addresses/editor';
import { AddressFieldBadge } from '@/components/shared/addresses/editor/components/AddressFieldBadge';
import { AddressConfidenceMeter } from '@/components/shared/addresses/editor/components/AddressConfidenceMeter';
import { AddressSourceLabel } from '@/components/shared/addresses/editor/components/AddressSourceLabel';
import { AddressFreshnessIndicator } from '@/components/shared/addresses/editor/components/AddressFreshnessIndicator';
import { AddressActivityLog } from '@/components/shared/addresses/editor/components/AddressActivityLog';
import { AddressReconciliationPanel } from '@/components/shared/addresses/editor/components/AddressReconciliationPanel';
import { AddressSuggestionsPanel } from '@/components/shared/addresses/editor/components/AddressSuggestionsPanel';
import { AddressDiffSummary } from '@/components/shared/addresses/editor/components/AddressDiffSummary';
import { AddressDragConfirmDialog } from '@/components/shared/addresses/editor/components/AddressDragConfirmDialog';
import { Button } from '@/components/ui/button';
import { useAddressActivity } from '@/components/shared/addresses/editor/hooks/useAddressActivity';
import { useAddressReconciliation } from '@/components/shared/addresses/editor/hooks/useAddressReconciliation';
import type {
  AddressFieldStatus,
  AddressSourceType,
  AddressFreshness,
  GeocodingApiResponse,
  ResolvedAddressFields,
  SuggestionRanking,
} from '@/components/shared/addresses/editor/types';

// --- Phase 3 fixtures ---

const FIELD_STATUSES: Array<{ label: string; status: AddressFieldStatus }> = [
  { label: 'match', status: { kind: 'match', userValue: 'Σαμοθράκης 16', resolvedValue: 'Σαμοθράκης 16' } },
  { label: 'mismatch', status: { kind: 'mismatch', userValue: 'Σαμοθρακης', resolvedValue: 'Σαμοθράκης' } },
  { label: 'unknown', status: { kind: 'unknown', userValue: 'Κάποιο δρόμο' } },
  { label: 'not-provided (with suggestion)', status: { kind: 'not-provided', resolvedValue: 'Κεντρική Μακεδονία' } },
  { label: 'not-provided (empty)', status: { kind: 'not-provided' } },
  { label: 'pending', status: { kind: 'pending' } },
];

const CONFIDENCE_VALUES = [0.95, 0.82, 0.68, 0.50, 0.30, 0.0];
const SOURCE_TYPES: AddressSourceType[] = ['geocoded', 'dragged', 'manual', 'derived', 'imported', 'unknown'];

const NOW = Date.now();
const FRESHNESS_FIXTURES: Array<{ label: string; freshness: AddressFreshness }> = [
  { label: 'fresh (5 min ago)', freshness: { verifiedAt: NOW - 5 * 60_000, level: 'fresh' } },
  { label: 'recent (2 h ago)', freshness: { verifiedAt: NOW - 2 * 3600_000, level: 'recent' } },
  { label: 'aging (12 h ago)', freshness: { verifiedAt: NOW - 12 * 3600_000, level: 'aging' } },
  { label: 'stale — field changed', freshness: { verifiedAt: NOW - 48 * 3600_000, level: 'stale', staleReason: 'field-changed' } },
  { label: 'never verified', freshness: { verifiedAt: null, level: 'never' } },
];

// --- Phase 4 fixtures ---

const MOCK_USER_INPUT = { street: 'Σαμοθράκης', number: '16', postalCode: '54621', city: 'Θεσσαλονίκη' };
const MOCK_RESOLVED = { street: 'Σαμοθράκης', number: '16', postalCode: '54635', city: 'Θεσσαλονίκη', region: 'Κεντρική Μακεδονία' };

function makeMockCandidate(displayName: string, confidence: number, distance: number | null): SuggestionRanking {
  const candidate: GeocodingApiResponse = {
    lat: 40.64, lng: 22.93, confidence, displayName,
    accuracy: 'exact',
    resolvedFields: {},
    partialMatch: false,
    reasoning: { fieldMatches: {} as never, attemptsLog: [], confidenceBreakdown: { base: confidence, streetMatch: 0, cityMatch: 0, postalMatch: 0, countyMatch: 0, municipalityMatch: 0 } },
    alternatives: [],
    source: { provider: 'nominatim', variantUsed: 1 },
  };
  return { candidate, originalRank: 0, distanceFromCenterM: distance, rankScore: confidence };
}

const MOCK_CANDIDATES: SuggestionRanking[] = [
  makeMockCandidate('Σαμοθράκης 16, Θεσσαλονίκη, 54635', 0.92, 320),
  makeMockCandidate('Σαμοθράκης 16, Καλαμαριά, 55132', 0.75, 4200),
  makeMockCandidate('Σαμοθράκης, Εύοσμος, 56224', 0.61, 8900),
];

// --- Phase 5: end-to-end coordinator demo ---

const DEMO_INITIAL_ADDRESS: ResolvedAddressFields = {
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Θεσσαλονίκη',
  postalCode: '54621',
};

function AddressEditorDemo() {
  const [address, setAddress] = useState<ResolvedAddressFields>(DEMO_INITIAL_ADDRESS);
  const [viewMode, setViewMode] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={viewMode ? 'outline' : 'default'}
          onClick={() => setViewMode(false)}
        >
          Edit mode
        </Button>
        <Button
          size="sm"
          variant={viewMode ? 'default' : 'outline'}
          onClick={() => setViewMode(true)}
        >
          View mode
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAddress(DEMO_INITIAL_ADDRESS)}
        >
          Reset
        </Button>
      </div>
      <AddressEditor
        value={address}
        onChange={setAddress}
        mode={viewMode ? 'view' : 'edit'}
        activityLog={{ enabled: true, verbosity: 'detailed' }}
        className="border rounded-lg p-4"
      />
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Current value (JSON)</summary>
        <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto">
          {JSON.stringify(address, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// --- Layout helpers ---

function DemoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground border-b pb-1">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-56 text-xs text-muted-foreground font-mono shrink-0">{label}</span>
      {children}
    </div>
  );
}

// --- Phase 4 interactive demo sections ---

function ActivityLogDemo() {
  const activity = useAddressActivity({ verbosity: 'detailed' });
  const [collapsed, setCollapsed] = useState(false);

  function addSampleEvent() {
    const events = [
      { level: 'info' as const, category: 'input' as const, i18nKey: 'editor.field.badge.pending' },
      { level: 'success' as const, category: 'response' as const, i18nKey: 'editor.field.badge.match' },
      { level: 'warn' as const, category: 'conflict' as const, i18nKey: 'editor.field.badge.mismatch' },
      { level: 'error' as const, category: 'request' as const, i18nKey: 'editor.field.badge.unknown' },
    ];
    const ev = events[Math.floor(Math.random() * events.length)];
    activity.record(ev);
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={addSampleEvent}>
        + Add event
      </Button>
      <AddressActivityLog
        events={activity.events}
        verbosity={activity.verbosity}
        onClear={activity.clear}
        onSetVerbosity={activity.setVerbosity}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((p) => !p)}
      />
    </div>
  );
}

function ReconciliationDemo() {
  const recon = useAddressReconciliation(MOCK_USER_INPUT, MOCK_RESOLVED);
  return (
    <AddressReconciliationPanel
      conflicts={recon.conflicts}
      pending={recon.pending}
      decisions={recon.decisions}
      resolved={recon.resolved}
      applyField={recon.applyField}
      keepField={recon.keepField}
      applyAll={recon.applyAll}
      keepAll={recon.keepAll}
      onTrySuggestions={() => alert('→ suggestions')}
    />
  );
}

function SuggestionsDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {selected && (
        <p className="text-xs text-green-600">Selected: {selected}</p>
      )}
      <AddressSuggestionsPanel
        trigger="low-confidence"
        candidates={MOCK_CANDIDATES}
        nextOmitField="postalCode"
        retryExhausted={false}
        onSelect={(c) => setSelected(c.displayName)}
        onRetry={(f) => alert(`retry without ${f}`)}
        onDismiss={() => setSelected(null)}
      />
    </div>
  );
}

function DragConfirmDemo() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Open drag confirm dialog
      </Button>
      {result && <p className="text-xs text-muted-foreground">Result: {result}</p>}
      <AddressDragConfirmDialog
        open={open}
        currentAddress={MOCK_USER_INPUT}
        newAddress={MOCK_RESOLVED}
        onConfirm={() => { setResult('confirmed'); setOpen(false); }}
        onCancel={() => { setResult('cancelled'); setOpen(false); }}
      />
    </div>
  );
}

export default function AddressesEditorDemoPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-10">
      <header>
        <h1 className="text-2xl font-bold">ADR-332 Phase 4 — Panels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive panels: activity log, reconciliation, suggestions, diff, drag confirm.
        </p>
      </header>

      <DemoSection title="AddressActivityLog — ring buffer + verbosity + collapse">
        <ActivityLogDemo />
      </DemoSection>

      <DemoSection title="AddressReconciliationPanel — per-field apply/keep">
        <ReconciliationDemo />
      </DemoSection>

      <DemoSection title="AddressSuggestionsPanel — keyboard nav ↑↓ Enter Esc">
        <SuggestionsDemo />
      </DemoSection>

      <DemoSection title="AddressDiffSummary — compact before/after">
        <AddressDiffSummary
          conflicts={[
            { field: 'postalCode', userValue: '54621', resolvedValue: '54635' },
            { field: 'region', userValue: '', resolvedValue: 'Κεντρική Μακεδονία' },
          ]}
        />
      </DemoSection>

      <DemoSection title="AddressDragConfirmDialog — Radix Dialog">
        <DragConfirmDemo />
      </DemoSection>

      <hr className="border-dashed" />

      <DemoSection title="Phase 3 — AddressFieldBadge (all 5 states)">
        {FIELD_STATUSES.map(({ label, status }) => (
          <Row key={label} label={label}>
            <AddressFieldBadge status={status} />
          </Row>
        ))}
      </DemoSection>

      <DemoSection title="Phase 3 — AddressConfidenceMeter">
        {CONFIDENCE_VALUES.map((v) => (
          <Row key={v} label={`confidence = ${v}`}>
            <AddressConfidenceMeter confidence={v} />
          </Row>
        ))}
      </DemoSection>

      <DemoSection title="Phase 3 — AddressSourceLabel (all 6 types)">
        {SOURCE_TYPES.map((src) => (
          <Row key={src} label={src}>
            <AddressSourceLabel source={src} />
          </Row>
        ))}
      </DemoSection>

      <DemoSection title="Phase 3 — AddressFreshnessIndicator">
        {FRESHNESS_FIXTURES.map(({ label, freshness }) => (
          <Row key={label} label={label}>
            <AddressFreshnessIndicator freshness={freshness} />
          </Row>
        ))}
      </DemoSection>
    </main>
  );
}
