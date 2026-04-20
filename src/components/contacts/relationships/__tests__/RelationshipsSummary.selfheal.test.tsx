import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RelationshipsSummary } from '../RelationshipsSummary';
import type { ContactRelationship } from '@/types/contacts/relationships';

// ── Context mock ──────────────────────────────────────────────────────────────

const mockRefreshRelationships = jest.fn();

jest.mock('../context/RelationshipProvider', () => ({
  useRelationshipContext: jest.fn(),
}));

import { useRelationshipContext } from '../context/RelationshipProvider';
const mockUseRelationshipContext = useRelationshipContext as jest.Mock;

// ── useContactNames mock ──────────────────────────────────────────────────────

jest.mock('../hooks/useContactNames', () => ({
  useContactNames: jest.fn(),
}));

import { useContactNames } from '../hooks/useContactNames';
const mockUseContactNames = useContactNames as jest.Mock;

// ── Heavy dependency mocks ────────────────────────────────────────────────────

jest.mock('../hooks/useOrganizationTree', () => ({
  useOrganizationTree: () => ({ organizationTree: null, loading: false, error: null, shouldShowTree: false }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/design-system', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4', md: 'h-5 w-5' }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    text: { primary: '', muted: '' },
    bg: { secondary: '' },
  }),
}));

jest.mock('@/components/navigation/config', () => ({
  NAVIGATION_ENTITIES: { building: { icon: () => null, color: '' } },
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('lucide-react', () => ({ Users: () => null }));

// ── Child component stubs ─────────────────────────────────────────────────────

jest.mock('../summary/StatisticsSection', () => ({
  StatisticsSection: () => <div data-testid="statistics" />,
}));

jest.mock('../summary/RecentRelationshipsSection', () => ({
  RecentRelationshipsSection: ({ relationships }: { relationships: ContactRelationship[] }) => (
    <div data-testid="recent-relationships" data-count={relationships.length} />
  ),
}));

jest.mock('../summary/ProjectRolesSection', () => ({
  ProjectRolesSection: () => null,
}));

jest.mock('../summary/ActionsSection', () => ({
  ActionsSection: () => null,
}));

jest.mock('../summary/StateComponents', () => ({
  NewContactState: () => <div data-testid="new-contact-state" />,
  LoadingState: () => <div data-testid="loading-state" />,
  EmptyState: () => <div data-testid="empty-state" />,
}));

jest.mock('../OrganizationTree', () => ({
  OrganizationTree: () => null,
}));

jest.mock('../utils/summary/contact-navigation', () => ({
  navigateToDashboardFilter: jest.fn(),
  navigateToRelationshipContact: jest.fn(),
}));

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeRel(id: string, sourceId: string, targetId: string): ContactRelationship {
  return {
    id,
    sourceContactId: sourceId,
    targetContactId: targetId,
    relationshipType: 'business_contact' as ContactRelationship['relationshipType'],
    status: 'active' as ContactRelationship['status'],
  } as unknown as ContactRelationship;
}

const CURRENT_ID = 'cont_current';
const TARGET_ID = 'cont_target';
const ORPHAN_ID = 'cont_orphan';

const defaultContextValue = {
  relationships: [],
  loading: false,
  error: null,
  expandedRelationships: new Set<string>(),
  refreshRelationships: mockRefreshRelationships,
  deleteRelationship: jest.fn(),
  terminateRelationship: jest.fn(),
  toggleExpanded: jest.fn(),
  contactId: CURRENT_ID,
  contactType: 'individual' as const,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RelationshipsSummary — self-heal on orphan detection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls refreshRelationships when orphanContactIds is non-empty after names load', async () => {
    const rel = makeRel('rel_1', CURRENT_ID, ORPHAN_ID);
    mockUseRelationshipContext.mockReturnValue({ ...defaultContextValue, relationships: [rel] });
    mockUseContactNames.mockReturnValue({ contactNames: {}, orphanContactIds: [ORPHAN_ID], loading: false });

    render(<RelationshipsSummary contactId={CURRENT_ID} contactType="individual" />);

    await waitFor(() => {
      expect(mockRefreshRelationships).toHaveBeenCalledTimes(1);
    });
  });

  it('does NOT call refreshRelationships when no orphans', async () => {
    const rel = makeRel('rel_2', CURRENT_ID, TARGET_ID);
    mockUseRelationshipContext.mockReturnValue({ ...defaultContextValue, relationships: [rel] });
    mockUseContactNames.mockReturnValue({
      contactNames: { [TARGET_ID]: 'Target Contact' },
      orphanContactIds: [],
      loading: false,
    });

    render(<RelationshipsSummary contactId={CURRENT_ID} contactType="individual" />);

    await waitFor(() => expect(mockUseContactNames).toHaveBeenCalled());
    expect(mockRefreshRelationships).not.toHaveBeenCalled();
  });

  it('does NOT call refreshRelationships while names are still loading', async () => {
    const rel = makeRel('rel_3', CURRENT_ID, ORPHAN_ID);
    mockUseRelationshipContext.mockReturnValue({ ...defaultContextValue, relationships: [rel] });
    mockUseContactNames.mockReturnValue({ contactNames: {}, orphanContactIds: [ORPHAN_ID], loading: true });

    render(<RelationshipsSummary contactId={CURRENT_ID} contactType="individual" />);

    await waitFor(() => expect(mockUseContactNames).toHaveBeenCalled());
    expect(mockRefreshRelationships).not.toHaveBeenCalled();
  });

  it('filters orphan relationships from RecentRelationshipsSection', () => {
    const goodRel = makeRel('rel_good', CURRENT_ID, TARGET_ID);
    const orphanRel = makeRel('rel_orphan', CURRENT_ID, ORPHAN_ID);
    mockUseRelationshipContext.mockReturnValue({
      ...defaultContextValue,
      relationships: [goodRel, orphanRel],
    });
    mockUseContactNames.mockReturnValue({
      contactNames: { [TARGET_ID]: 'Target Contact' },
      orphanContactIds: [ORPHAN_ID],
      loading: false,
    });

    const { getByTestId } = render(<RelationshipsSummary contactId={CURRENT_ID} contactType="individual" />);

    // Only goodRel passes through — orphanRel is filtered
    expect(getByTestId('recent-relationships').getAttribute('data-count')).toBe('1');
  });

  it('shows empty state when all relationships are orphans', () => {
    const orphanRel = makeRel('rel_orphan', CURRENT_ID, ORPHAN_ID);
    mockUseRelationshipContext.mockReturnValue({ ...defaultContextValue, relationships: [orphanRel] });
    mockUseContactNames.mockReturnValue({ contactNames: {}, orphanContactIds: [ORPHAN_ID], loading: false });

    const { getByTestId } = render(<RelationshipsSummary contactId={CURRENT_ID} contactType="individual" />);

    expect(getByTestId('empty-state')).toBeInTheDocument();
  });
});
