/** CHECK 3.109 — η απόφαση της πύλης και το σύνολο τιμών του μητρώου της (ADR-925). */

const fs = require('node:fs');
const path = require('node:path');
const { isBlocked } = require('../check-agent-worktree-policy');

describe('CHECK 3.109', () => {
  const agentOnMain = { enforce: true, isAgent: true, branch: 'main' };

  it('μπλοκάρει πράκτορα στο main όταν η επιβολή είναι ενεργή', () => {
    expect(isBlocked(agentOnMain)).toBe(true);
  });

  it.each([
    ['ανενεργή επιβολή', { ...agentOnMain, enforce: false }],
    ['δικό του κλαδί', { ...agentOnMain, branch: 'agent/task-one' }],
    ['άνθρωπος στο main', { ...agentOnMain, isAgent: false }],
  ])('αφήνει: %s', (_label, input) => {
    expect(isBlocked(input)).toBe(false);
  });

  it('τιμή που δεν είναι ακριβώς true δεν ενεργοποιεί την πύλη', () => {
    expect(isBlocked({ ...agentOnMain, enforce: 'false' })).toBe(false);
  });

  it('το μητρώο δηλώνει boolean διακόπτη', () => {
    const file = path.resolve(__dirname, '../../.agent-worktree-policy.json');
    expect(typeof JSON.parse(fs.readFileSync(file, 'utf8')).enforce).toBe('boolean');
  });
});
