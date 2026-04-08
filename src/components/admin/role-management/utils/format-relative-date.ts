/**
 * ADR-244: Relative date formatting utility
 *
 * Lightweight implementation — no external dependencies.
 * Used for "Last Sign-In" column in UserTable.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never';

  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins}m ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours}h ago`;
  }
  if (diff < WEEK) {
    const days = Math.floor(diff / DAY);
    return `${days}d ago`;
  }
  if (diff < MONTH) {
    const weeks = Math.floor(diff / WEEK);
    return `${weeks}w ago`;
  }

  const months = Math.floor(diff / MONTH);
  if (months < 12) {
    return `${months}mo ago`;
  }

  return date.toLocaleDateString();
}
