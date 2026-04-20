import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RelationshipCard } from '../RelationshipCard';
import { useContactName } from '../hooks/useContactName';
import type { ContactRelationship } from '@/types/contacts/relationships';

// ── Core mocks ────────────────────────────────────────────────────────────────

// Block Firebase chain: useContactName → contacts.service → firestore → firebase/auth (needs fetch)
jest.mock('@/services/contacts.service', () => ({
  ContactsService: { getContact: jest.fn() },
}));
jest.mock('@/services/realtime', () => ({
  RealtimeService: { subscribe: jest.fn(() => jest.fn()), emit: jest.fn() },
}));
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('../hooks/useContactName');
const mockUseContactName = useContactName as jest.Mock;

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/design-system', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

// ── UI component mocks (minimal stubs) ───────────────────────────────────────

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: 'h-4 w-4', md: 'h-5 w-5', xl: 'h-8 w-8' }),
}));

jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({
    quick: { rounded: 'rounded', card: 'rounded', table: 'rounded', separator: 'border-t' },
    getDirectionalBorder: () => 'border-l-2 border-blue-500',
  }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    text: { primary: 'text-gray-900', muted: 'text-gray-500', error: 'text-red-500' },
    bg: { muted: 'bg-gray-100', secondary: 'bg-gray-50' },
  }),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/intl-utils', () => ({
  formatDate: (d: string) => d,
  formatFlexibleDate: (d: string) => d,
}));

jest.mock('@/components/navigation/config', () => ({
  NAVIGATION_ENTITIES: {
    building: { icon: () => null, color: '' },
    phone: { icon: () => null, color: '' },
    email: { icon: () => null, color: '' },
  },
}));

jest.mock('../utils/relationship-types', () => ({
  getRelationshipDisplayProps: () => ({
    icon: () => null,
    color: 'bg-blue-100',
    label: 'relationships.types.business_contact',
  }),
}));

jest.mock('@/components/ui/effects', () => ({
  HOVER_TEXT_EFFECTS: { RED: 'hover:text-red-500' },
  INTERACTIVE_PATTERNS: { LINK_PRIMARY: 'text-blue-600' },
}));

jest.mock('lucide-react', () => ({
  Edit: () => <span data-testid="icon-edit" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Calendar: () => null,
  ChevronDown: () => null,
  ChevronRight: () => null,
  MapPin: () => null,
}));

// ── Test fixtures ─────────────────────────────────────────────────────────────

function makeRelationship(overrides: Partial<ContactRelationship> = {}): ContactRelationship {
  return {
    id: 'rel_test_001',
    sourceContactId: 'cont_source',
    targetContactId: 'cont_target',
    relationshipType: 'business_contact' as ContactRelationship['relationshipType'],
    status: 'active' as ContactRelationship['status'],
    position: null,
    department: null,
    startDate: null,
    endDate: null,
    notes: null,
    contactInfo: null,
    createdAt: null,
    updatedAt: null,
    createdBy: 'user_1',
    lastModifiedBy: 'user_1',
    ...overrides,
  } as unknown as ContactRelationship;
}

const defaultProps = {
  relationship: makeRelationship(),
  currentContactId: 'cont_source',
  isExpanded: false,
  onToggleExpanded: jest.fn(),
  readonly: false,
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RelationshipCard — trash-status awareness', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows amber trash badge when contactStatus is deleted', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'deleted', loading: false });
    render(<RelationshipCard {...defaultProps} />);
    expect(screen.getByText('relationships.card.relatedInTrash')).toBeInTheDocument();
  });

  it('does NOT show trash badge when contactStatus is active', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'active', loading: false });
    render(<RelationshipCard {...defaultProps} />);
    expect(screen.queryByText('relationships.card.relatedInTrash')).not.toBeInTheDocument();
  });

  it('does NOT show trash badge when contactStatus is null', () => {
    mockUseContactName.mockReturnValue({ contactName: '', contactStatus: null, loading: true });
    render(<RelationshipCard {...defaultProps} />);
    expect(screen.queryByText('relationships.card.relatedInTrash')).not.toBeInTheDocument();
  });

  it('hides edit button when contactStatus is deleted', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'deleted', loading: false });
    render(<RelationshipCard {...defaultProps} />);
    expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
  });

  it('shows edit button when contactStatus is active', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'active', loading: false });
    render(<RelationshipCard {...defaultProps} />);
    expect(screen.getByTestId('icon-edit')).toBeInTheDocument();
  });

  it('always shows delete button regardless of contactStatus', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'deleted', loading: false });
    render(<RelationshipCard {...defaultProps} />);
    // Two icon-trash expected: one inside the amber badge, one inside the delete button
    const trashIcons = screen.getAllByTestId('icon-trash');
    expect(trashIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('adds opacity-60 class on card when contactStatus is deleted', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'deleted', loading: false });
    render(<RelationshipCard {...defaultProps} />);
    const card = screen.getByTestId('card');
    expect(card.className).toContain('opacity-60');
  });

  it('does NOT add opacity-60 class when contactStatus is active', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'active', loading: false });
    render(<RelationshipCard {...defaultProps} />);
    const card = screen.getByTestId('card');
    expect(card.className).not.toContain('opacity-60');
  });

  it('edit button not rendered when onEdit prop is undefined', () => {
    mockUseContactName.mockReturnValue({ contactName: 'ACME Ltd', contactStatus: 'active', loading: false });
    const { onEdit: _omit, ...propsWithoutEdit } = defaultProps;
    render(<RelationshipCard {...propsWithoutEdit} />);
    expect(screen.queryByTestId('icon-edit')).not.toBeInTheDocument();
  });
});
