/**
 * Demo — ADR-332 Phase 3: Presentational Components Set 1
 *
 * Showcases all 5 status-indicator components across every state combination.
 * Route: /demo/addresses-editor
 */

'use client';

import { AddressFieldBadge } from '@/components/shared/addresses/editor/components/AddressFieldBadge';
import { AddressConfidenceMeter } from '@/components/shared/addresses/editor/components/AddressConfidenceMeter';
import { AddressSourceLabel } from '@/components/shared/addresses/editor/components/AddressSourceLabel';
import { AddressFreshnessIndicator } from '@/components/shared/addresses/editor/components/AddressFreshnessIndicator';
import type { AddressFieldStatus, AddressSourceType, AddressFreshness } from '@/components/shared/addresses/editor/types';

// --- AddressFieldBadge fixtures ---

const FIELD_STATUSES: Array<{ label: string; status: AddressFieldStatus }> = [
  {
    label: 'match',
    status: { kind: 'match', userValue: 'Σαμοθράκης 16', resolvedValue: 'Σαμοθράκης 16' },
  },
  {
    label: 'mismatch',
    status: { kind: 'mismatch', userValue: 'Σαμοθρακης', resolvedValue: 'Σαμοθράκης' },
  },
  {
    label: 'unknown',
    status: { kind: 'unknown', userValue: 'Κάποιο δρόμο' },
  },
  {
    label: 'not-provided (with suggestion)',
    status: { kind: 'not-provided', resolvedValue: 'Κεντρική Μακεδονία' },
  },
  {
    label: 'not-provided (empty)',
    status: { kind: 'not-provided' },
  },
  {
    label: 'pending',
    status: { kind: 'pending' },
  },
];

// --- ConfidenceMeter fixtures ---

const CONFIDENCE_VALUES = [0.95, 0.82, 0.68, 0.50, 0.30, 0.0];

// --- AddressSourceLabel fixtures ---

const SOURCE_TYPES: AddressSourceType[] = [
  'geocoded',
  'dragged',
  'manual',
  'derived',
  'imported',
  'unknown',
];

// --- AddressFreshnessIndicator fixtures ---

const NOW = Date.now();

const FRESHNESS_FIXTURES: Array<{ label: string; freshness: AddressFreshness }> = [
  {
    label: 'fresh (5 min ago)',
    freshness: { verifiedAt: NOW - 5 * 60_000, level: 'fresh' },
  },
  {
    label: 'recent (2 h ago)',
    freshness: { verifiedAt: NOW - 2 * 3600_000, level: 'recent' },
  },
  {
    label: 'aging (12 h ago)',
    freshness: { verifiedAt: NOW - 12 * 3600_000, level: 'aging' },
  },
  {
    label: 'stale — field changed',
    freshness: {
      verifiedAt: NOW - 48 * 3600_000,
      level: 'stale',
      staleReason: 'field-changed',
    },
  },
  {
    label: 'stale — time elapsed',
    freshness: {
      verifiedAt: NOW - 96 * 3600_000,
      level: 'stale',
      staleReason: 'time-elapsed',
    },
  },
  {
    label: 'stale — force refresh pending',
    freshness: {
      verifiedAt: NOW - 10 * 60_000,
      level: 'stale',
      staleReason: 'force-refresh-pending',
    },
  },
  {
    label: 'never verified',
    freshness: { verifiedAt: null, level: 'never' },
  },
];

// --- Demo sections ---

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

export default function AddressesEditorDemoPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">ADR-332 Phase 3 — Status Indicators</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hover each badge or meter for the tooltip. All states covered.
        </p>
      </header>

      <DemoSection title="AddressFieldBadge — all 5 states">
        {FIELD_STATUSES.map(({ label, status }) => (
          <Row key={label} label={label}>
            <AddressFieldBadge status={status} />
          </Row>
        ))}
      </DemoSection>

      <DemoSection title="AddressConfidenceMeter — confidence levels">
        {CONFIDENCE_VALUES.map((v) => (
          <Row key={v} label={`confidence = ${v}`}>
            <AddressConfidenceMeter confidence={v} />
          </Row>
        ))}
      </DemoSection>

      <DemoSection title="AddressSourceLabel — all 6 source types">
        {SOURCE_TYPES.map((src) => (
          <Row key={src} label={src}>
            <AddressSourceLabel source={src} />
          </Row>
        ))}
      </DemoSection>

      <DemoSection title="AddressFreshnessIndicator — all freshness levels">
        {FRESHNESS_FIXTURES.map(({ label, freshness }) => (
          <Row key={label} label={label}>
            <AddressFreshnessIndicator freshness={freshness} />
          </Row>
        ))}
      </DemoSection>
    </main>
  );
}
