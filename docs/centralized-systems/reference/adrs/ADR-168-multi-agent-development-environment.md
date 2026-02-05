# ADR-168: Multi-Agent Development Environment

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-05 |
| **Category** | Infrastructure |
| **Canonical Location** | `~/.codex/` και `~/.codex-account2/` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

Για μεγαλύτερη παραγωγικότητα στο project, χρειαζόμαστε **πολλαπλούς AI agents** να δουλεύουν παράλληλα σε διαφορετικά terminals.

### The Problem

- ❌ **Single Agent Bottleneck**: Ένας agent κάθε φορά = αργή πρόοδος
- ❌ **Subscription Waste**: Δύο OpenAI subscriptions (20€/μήνα each) χωρίς parallel usage
- ❌ **Complex Setup**: Άγνωστο πώς να τρέξουμε multiple accounts ταυτόχρονα

### Tools Analysis

| Agent | Tool | Version | Configuration Method |
|-------|------|---------|---------------------|
| **Claude** | Claude Code CLI | Latest | Browser-based login (subscription ~180€/μήνα) |
| **OpenAI #1** | Codex CLI | 0.94.0 | `~/.codex/` (browser login) |
| **OpenAI #2** | Codex CLI | 0.94.0 | `~/.codex-account2/` (browser login) |

### Key Discovery

**Το Codex CLI υποστηρίζει `CODEX_HOME` environment variable!**

Αυτό επιτρέπει **ξεχωριστά browser logins** για κάθε account - **ΧΩΡΙΣ API keys** (σταθερό κόστος subscription).

---

## 2. Decision

### Multi-Agent Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT ENVIRONMENT                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Terminal A │  │  Terminal B │  │  Terminal C │          │
│  │             │  │             │  │             │          │
│  │  Claude     │  │  Codex      │  │  Codex      │          │
│  │  Code CLI   │  │  Account 1  │  │  Account 2  │          │
│  │             │  │             │  │             │          │
│  │  Anthropic  │  │  ChatGPT    │  │  ChatGPT    │          │
│  │ ~180€/month │  │ ~20€/month  │  │ ~20€/month  │          │
│  │             │  │             │  │             │          │
│  │ ~/.claude/  │  │ ~/.codex/   │  │ ~/.codex-   │          │
│  │             │  │             │  │  account2/  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  Total: ~220€/month = 3 parallel AI agents                  │
│  ✅ ALL SUBSCRIPTION-BASED (σταθερό κόστος)                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Configuration Directories

| Agent | Config Directory | Login Type |
|-------|------------------|------------|
| Claude | `~/.claude/` | Browser (Anthropic subscription) |
| Codex #1 | `~/.codex/` | Browser (ChatGPT Plus) |
| Codex #2 | `~/.codex-account2/` | Browser (ChatGPT Plus) |

**Σημαντικό**: Κανένα API key δεν χρειάζεται! Όλα τα accounts χρησιμοποιούν subscription-based browser login.

---

## 3. Usage Commands

### PowerShell (Windows) - Με Shortcuts ✨

```powershell
# Terminal A: Claude Code (Anthropic)
claude

# Terminal B: Codex (OpenAI Account #1)
codex1

# Terminal C: Codex (OpenAI Account #2)
codex2

# Έλεγχος status και των δύο accounts
codex-status
```

### PowerShell - Χωρίς Shortcuts (εναλλακτικά)

```powershell
# Account #1 (default)
codex

# Account #2 (με environment variable)
$env:CODEX_HOME="$env:USERPROFILE\.codex-account2"; codex
```

### Bash / Git Bash / WSL

```bash
# Terminal A: Claude Code (Anthropic)
claude

# Terminal B: Codex (OpenAI Account #1 - default)
codex

# Terminal C: Codex (OpenAI Account #2)
CODEX_HOME=~/.codex-account2 codex
```

---

## 4. Initial Setup (One-Time)

### 4.1 Account 2 Login (ήδη ολοκληρώθηκε 2026-02-05)

```powershell
# PowerShell
mkdir $env:USERPROFILE\.codex-account2
$env:CODEX_HOME="$env:USERPROFILE\.codex-account2"; codex login
```

```bash
# Bash
mkdir ~/.codex-account2
CODEX_HOME=~/.codex-account2 codex login
```

Στο browser που ανοίγει, συνδέεσαι με το **δεύτερο ChatGPT account**.

### 4.2 PowerShell Shortcuts (ήδη ολοκληρώθηκε 2026-02-05)

**Location**: `~\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`

```powershell
# Codex Account 1 (default)
function codex1 { codex @args }

# Codex Account 2 (secondary subscription)
function codex2 {
    $env:CODEX_HOME = "$env:USERPROFILE\.codex-account2"
    codex @args
}

# Quick status check
function codex-status {
    Write-Host "=== Codex Account 1 ===" -ForegroundColor Cyan
    codex login status
    Write-Host ""
    Write-Host "=== Codex Account 2 ===" -ForegroundColor Green
    $env:CODEX_HOME = "$env:USERPROFILE\.codex-account2"
    codex login status
    $env:CODEX_HOME = $null
}
```

**Σημείωση**: Μετά από αλλαγές στο profile, κλείσε και ξανά-άνοιξε το PowerShell.

---

## 5. Consequences

### Positive

- ✅ **3x Productivity**: Τρεις agents δουλεύουν παράλληλα
- ✅ **Fixed Cost**: ~220€/μήνα (σταθερό, χωρίς API surprises)
- ✅ **Subscription-Based**: Και τα 3 accounts με browser login
- ✅ **No API Keys**: Δεν χρειάζονται API keys (ασφάλεια)
- ✅ **No Code Changes**: Δεν απαιτούνται αλλαγές στο codebase

### Negative

- ⚠️ **Coordination Overhead**: Πρέπει να διαχειριστούμε τι κάνει κάθε agent
- ⚠️ **Git Conflicts**: Potential merge conflicts αν δουλεύουν στα ίδια αρχεία
- ⚠️ **Longer Command**: Το Account 2 χρειάζεται environment variable

### Mitigations

1. **Task Separation**: Assign different files/features σε κάθε agent
2. **Communication Protocol**: Claude coordinates, Codex executes isolated tasks
3. **Alias Creation**: Μπορείς να φτιάξεις PowerShell alias για συντομία

---

## 6. Prohibitions (after this ADR)

- ⛔ **ΜΗ χρησιμοποιείτε** API keys για Codex (χρησιμοποιήστε subscription login)
- ⛔ **ΜΗ χρησιμοποιείτε** `.env.agent.*` files (deleted, not needed)
- ⛔ **ΜΗ τρέχετε** πολλαπλά Codex instances στο ίδιο αρχείο ταυτόχρονα

---

## 7. Migration

### Deleted Files (Not Needed)

| File | Status | Reason |
|------|--------|--------|
| `.env.agent.claude` | ❌ Deleted | Claude uses subscription login |
| `.env.agent.openai.1` | ❌ Deleted | Codex uses browser login |
| `.env.agent.openai.2` | ❌ Deleted | Codex uses CODEX_HOME + browser login |

### Active Configuration

| File/Directory | Status | Purpose |
|----------------|--------|---------|
| `~/.claude/` | ✅ Active | Claude Code settings |
| `~/.codex/` | ✅ Active | Codex Account 1 (default) |
| `~/.codex-account2/` | ✅ Active | Codex Account 2 |
| `~/Documents/PowerShell/Microsoft.PowerShell_profile.ps1` | ✅ Active | Shortcuts: `codex1`, `codex2`, `codex-status` |

---

## 8. References

- **Codex CLI Docs**: https://developers.openai.com/codex/cli/
- **CODEX_HOME Variable**: https://developers.openai.com/codex/config-reference/
- **Claude Code Docs**: https://docs.anthropic.com/claude-code
- **Project CLAUDE.md**: Rules all agents must follow

---

## 9. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-05 | ADR Created - Multi-Agent Environment Setup | Γιώργος Παγώνης + Claude Code |
| 2026-02-05 | Discovered CODEX_HOME solution (no API keys needed) | Claude Code |
| 2026-02-05 | Account 2 login completed successfully | Γιώργος Παγώνης |
| 2026-02-05 | Added PowerShell shortcuts: `codex1`, `codex2`, `codex-status` | Claude Code |
| 2026-02-05 | Status: IMPLEMENTED | Γιώργος Παγώνης |

---

## 10. Quick Reference Card

### Start Development Session (PowerShell)

```powershell
# Άνοιξε 3 terminals:

# Terminal 1 (Claude - Primary)
cd C:\Nestor_Pagonis
claude

# Terminal 2 (Codex - Account 1)
cd C:\Nestor_Pagonis
codex1

# Terminal 3 (Codex - Account 2)
cd C:\Nestor_Pagonis
codex2
```

### Task Distribution Example

| Agent | Best For |
|-------|----------|
| **Claude** | Complex architecture, multi-file refactoring, code review, CLAUDE.md compliance |
| **Codex #1** | Feature implementation, bug fixes |
| **Codex #2** | Tests, documentation, isolated tasks |

### Verify Logins

```powershell
# Έλεγχος και των δύο accounts με μία εντολή:
codex-status

# Ή μεμονωμένα:
codex1 login status
codex2 login status
```

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
