/**
 * @jest-environment jsdom
 *
 * ADR-809 §9.6 — η μπάρα του `(app)` στο κινητό.
 *
 * Μετρημένο ζωντανά στα 390px (2026-10-11): τα χειριστήρια της μπάρας έφταναν ως τα 675px μέσα σε
 * `overflow-hidden` ⇒ φωνητική, βοήθεια, γλώσσα, θέμα, καμπανάκι και ΛΟΓΑΡΙΑΣΜΟΣ εκτός οθόνης.
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ κλειδώνει η **δήλωση** (ποιος κρύβεται κάτω από `md`, και ποιος
 * τον υποδέχεται). Τα pixel τα βλέπει μόνο ο browser.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ bg: { primary: 'bg-background' }, text: { muted: 'text-muted-foreground' } }),
}));
jest.mock('@/lib/design-system', () => ({}));

jest.mock('@/components/ui/sidebar', () => {
  const Passthrough = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );
  return {
    Sidebar: Passthrough,
    SidebarContent: Passthrough,
    SidebarFooter: Passthrough,
    SidebarHeader: Passthrough,
    SidebarRail: () => null,
    SidebarTrigger: () => <button type="button">trigger</button>,
  };
});
jest.mock('@/components/ui/separator', () => ({ Separator: () => null }));
jest.mock('@/components/header/help-button', () => ({ HelpButton: () => <button type="button">help</button> }));
jest.mock('@/components/header/voice-assistant-button', () => ({
  VoiceAssistantButton: () => <button type="button">voice</button>,
}));
jest.mock('@/components/header/SaveStatusIndicator', () => ({ SaveStatusIndicator: () => null }));
jest.mock('@/components/header/CompanySwitcher', () => ({
  CompanySwitcher: () => <span data-testid="company-switcher" />,
}));
jest.mock('@/components/header/JobSwitch', () => ({ JobSwitch: () => <span data-testid="job-switch" /> }));
jest.mock('@/core/containers/ShellUtilities', () => ({
  ShellUtilities: ({ collapsePreferences }: { collapsePreferences?: false | 'md' | 'lg' }) => (
    <span data-testid="shell-utilities" data-collapse={String(collapsePreferences ?? false)} />
  ),
  ShellPreferences: () => <span data-testid="shell-preferences" />,
}));

jest.mock('@/components/sidebar/sidebar-logo', () => ({ SidebarLogo: () => null }));
jest.mock('@/components/sidebar/sidebar-menu-section', () => ({ SidebarMenuSection: () => null }));
jest.mock('@/components/sidebar/sidebar-reveal-banner', () => ({ SidebarRevealBanner: () => null }));
jest.mock('@/components/legal/LegalLinksNav', () => ({ LegalLinksNav: () => null }));
jest.mock('@/hooks/useJobFilteredNavigation', () => ({
  useJobFilteredNavigation: () => ({
    mainMenuItems: [], toolsMenuItems: [], settingsMenuItems: [],
    reveal: { isRevealing: false, onStopRevealing: () => undefined },
  }),
}));
jest.mock('@/hooks/useSidebarState', () => ({
  useSidebarState: () => ({ expandedItems: [], toggleExpanded: () => undefined, activeHref: null }),
}));
jest.mock('@/contexts/BuildingsNoUnitsContext', () => ({ useBuildingsNoUnits: () => false }));

import { AppHeader } from '../app-header';
import { AppSidebar } from '../app-sidebar';

/** Ο πλησιέστερος πρόγονος που αποφασίζει ορατότητα κατά πλάτος. */
const gateOf = (testId: string): string =>
  screen.getByTestId(testId).closest('[class*="md:"]')?.className ?? '';

describe('ADR-809 §9.6 — η μπάρα του (app) κάτω από `md`', () => {
  it('Ν1: γλώσσα και θέμα μετακομίζουν στο `md`, εκεί όπου το πλαϊνό μενού γίνεται φύλλο', () => {
    render(<AppHeader />);
    expect(screen.getByTestId('shell-utilities').dataset.collapse).toBe('md');
  });

  it('Ν2: οι δύο επιλογείς με ετικέτα κρύβονται στη μπάρα κάτω από `md` (μόνο CSS)', () => {
    render(<AppHeader />);
    expect(gateOf('job-switch')).toBe('hidden md:contents');
    expect(gateOf('company-switcher')).toBe('hidden md:contents');
  });

  it('Ν3: ό,τι είναι εικονίδιο σταθερού πλάτους ΜΕΝΕΙ στη μπάρα (παρονομαστής του Ν2)', () => {
    render(<AppHeader />);
    for (const name of ['voice', 'help']) {
      expect(screen.getByRole('button', { name }).closest('.hidden')).toBeNull();
    }
    expect(screen.getByTestId('shell-utilities').closest('.hidden')).toBeNull();
  });

  it('Ν4: η δεξιά ομάδα μπορεί να στενέψει — δεν κόβεται αθόρυβα', () => {
    render(<AppHeader />);
    const group = screen.getByTestId('shell-utilities').parentElement;
    expect(group?.className).toContain('min-w-0');
    expect(group?.className).not.toMatch(/shrink-0/);
  });

  it('Ν5: ό,τι έφυγε από τη μπάρα το ΥΠΟΔΕΧΕΤΑΙ το συρτάρι, μόνο κάτω από `md`', () => {
    render(<AppSidebar />);
    for (const id of ['company-switcher', 'job-switch', 'shell-preferences']) {
      expect(gateOf(id)).toMatch(/\bmd:hidden\b/);
    }
  });
});
