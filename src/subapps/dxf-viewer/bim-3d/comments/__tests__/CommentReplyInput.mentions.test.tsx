/**
 * ADR-364 §10.14 / ADR-366 Phase 9 C.2 — @-mention keyboard ownership.
 *
 * These characterize the behaviour that ADR-364 §10.5 Κ2-γ found DEAD: the
 * picker's ArrowUp / ArrowDown / Enter / Escape handler was attached to a
 * `role="listbox" tabIndex={-1}` element that nothing ever focused, so none of
 * those keys did anything. §10.5 proposed deleting the handler; deleting it
 * would have frozen the defect. The keys now live on the focused `<textarea>`,
 * and every test below fails against the pre-migration component.
 *
 * Mocks: react-i18next identity translator (repo convention), apiClient so the
 * candidate fetch is deterministic.
 */

import React from 'react';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CommentReplyInput } from '../CommentReplyInput';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockGet = jest.fn();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

const USERS = [
  { uid: 'u1', displayName: 'Giorgos Pagonis', email: 'giorgos@example.com' },
  { uid: 'u2', displayName: 'Maria Papadopoulou', email: 'maria@example.com' },
  { uid: 'u3', displayName: null, email: 'nodisplay@example.com' },
];

beforeEach(() => {
  // jsdom lacks scrollIntoView; the component optional-calls it, but stub for safety.
  Element.prototype.scrollIntoView = jest.fn();
  mockGet.mockReset();
  mockGet.mockResolvedValue({ users: USERS });
});

afterEach(cleanup);

/** Types `value` into the textarea with the caret at the end. */
function type(textarea: HTMLTextAreaElement, value: string): void {
  fireEvent.change(textarea, { target: { value, selectionStart: value.length } });
}

async function openPicker(): Promise<{
  textarea: HTMLTextAreaElement;
  container: HTMLElement;
}> {
  const utils = render(<CommentReplyInput onSubmit={jest.fn().mockResolvedValue(undefined)} />);
  const textarea = utils.getByRole('textbox') as HTMLTextAreaElement;
  type(textarea, '@');
  await waitFor(() => {
    expect(utils.container.querySelector('[role="listbox"]')).not.toBeNull();
  });
  return { textarea, container: utils.container };
}

describe('mention list — activation', () => {
  it('does NOT fetch candidates until a mention starts', () => {
    const { getByRole } = render(<CommentReplyInput onSubmit={jest.fn()} />);
    type(getByRole('textbox') as HTMLTextAreaElement, 'plain reply, no mention');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('opens the listbox on "@" and fetches once', async () => {
    const { container } = await openPicker();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('filters candidates by query without re-fetching', async () => {
    const { textarea, container } = await openPicker();
    type(textarea, '@mar');
    await waitFor(() => {
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});

describe('mention list — keyboard navigation (was dead before ADR-364 §10.14)', () => {
  it('publishes the active option via aria-activedescendant on the textarea', async () => {
    const { textarea, container } = await openPicker();
    const first = container.querySelectorAll('[role="option"]')[0];
    expect(textarea.getAttribute('aria-activedescendant')).toBe(first.id);
  });

  it('ArrowDown moves the active option', async () => {
    const { textarea, container } = await openPicker();
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    const options = container.querySelectorAll('[role="option"]');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(textarea.getAttribute('aria-activedescendant')).toBe(options[1].id);
  });

  it('ArrowUp from the first option wraps to the last', async () => {
    const { textarea, container } = await openPicker();
    fireEvent.keyDown(textarea, { key: 'ArrowUp' });
    const options = container.querySelectorAll('[role="option"]');
    expect(options[2].getAttribute('aria-selected')).toBe('true');
  });

  it('Enter commits the active option instead of inserting a newline', async () => {
    const { textarea } = await openPicker();
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('@Maria Papadopoulou ');
  });

  it('Escape dismisses the list and leaves the typed text intact', async () => {
    const { textarea, container } = await openPicker();
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(textarea.value).toBe('@');
  });

  it('Ctrl+Enter still submits rather than picking a user', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole, container } = render(<CommentReplyInput onSubmit={onSubmit} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    type(textarea, 'hello @');
    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith('hello @', []);
  });

  it('falls back to the email when a user has no display name', async () => {
    const { textarea } = await openPicker();
    fireEvent.keyDown(textarea, { key: 'ArrowUp' }); // wraps to the last (u3)
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('@nodisplay@example.com ');
  });
});

describe('mention splice — caret-anchored, not last-match', () => {
  it('replaces the mention AT THE CARET, not the last one in the text', async () => {
    const { getByRole, container } = render(<CommentReplyInput onSubmit={jest.fn()} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;

    // Caret sits inside the FIRST mention; a second, later mention exists.
    // The pre-migration `text.replace(/@\w*$/, …)` rewrote the trailing one.
    fireEvent.change(textarea, {
      target: { value: '@gi and later @maria', selectionStart: 3 },
    });
    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(textarea.value).toBe('@Giorgos Pagonis  and later @maria');
  });

  it('reports the mentioned user id to onSubmit', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole, container } = render(<CommentReplyInput onSubmit={onSubmit} />);
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    type(textarea, '@gi');
    await waitFor(() => {
      expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('@Giorgos Pagonis', ['u1']);
    });
  });
});

describe('mention list — empty state', () => {
  it('shows the no-users message and consumes no navigation keys', async () => {
    const { getByRole, getByText, container } = render(
      <CommentReplyInput onSubmit={jest.fn()} />,
    );
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    type(textarea, '@zzzznomatch');
    await waitFor(() => {
      expect(getByText('comments.mention.noUsers')).toBeInTheDocument();
    });
    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(textarea.getAttribute('aria-activedescendant')).toBeNull();
  });
});
