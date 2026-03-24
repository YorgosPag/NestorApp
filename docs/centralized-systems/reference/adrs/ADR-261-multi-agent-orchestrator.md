# ADR-261: Multi-Agent Orchestrator (Claude Agent SDK)

## Status
✅ IMPLEMENTED | 2026-03-24

## Context
Η ανάγκη για παράλληλη εκτέλεση εργασιών από πολλαπλούς specialized agents μέσα στο ίδιο project. Η χειροκίνητη εναλλαγή μεταξύ terminals (ADR-168) δεν κλιμακώνεται — χρειάζεται αυτοματοποιημένος συντονισμός.

## Decision
Υλοποίηση multi-agent orchestration system βασισμένου στο `@anthropic-ai/claude-agent-sdk` με:
- **Orchestrator Agent (Opus)**: Αναλύει task, σπάει σε subtasks, κατανέμει
- **5 Specialized Agents**: frontend, backend, testing, docs, review
- **Git worktree isolation**: Κάθε agent σε δικό branch
- **Quality Gate**: Automated checks + Opus review agent
- **File-based state**: `.agents/state.json` με filesystem locking

## Architecture

```
CLI (index.ts)
  → Orchestrator (Opus) — analyze + plan
    → Frontend Agent (Sonnet) — worktree
    → Backend Agent (Sonnet) — worktree
    → Docs Agent (Haiku) — worktree
  → Quality Gate
    → Automated checks (tsc, any, inline styles)
    → Review Agent (Opus) — semantic review
  → Merge worktrees → Commit
```

## Agent Definitions

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| Orchestrator | Opus | Read, Glob, Grep | Task decomposition |
| Frontend | Sonnet | Read, Edit, Write, Glob, Grep, Bash | React/UI |
| Backend | Sonnet | Read, Edit, Write, Glob, Grep, Bash | API/Services |
| Testing | Haiku | Read, Glob, Grep, Bash | Quality checks |
| Docs | Haiku | Read, Edit, Write, Glob, Grep | ADR updates |
| Review | Opus | Read, Glob, Grep, Bash | Code review |

## File Structure

```
scripts/orchestrator/
├── index.ts              — CLI entrypoint
├── types.ts              — Core interfaces
├── config.ts             — Agent definitions
├── orchestrator.ts       — Main flow (phase machine)
├── agent-runner.ts       — SDK query() wrapper
├── worktree-manager.ts   — Git worktree lifecycle
├── state-manager.ts      — File-based state + locking
├── quality-gate.ts       — Automated + review checks
├── error-recovery.ts     — Retry policies, cleanup
├── logger.ts             — Structured logging
└── prompts/              — Agent system prompts (6 files)
```

## Usage

```bash
# Basic execution
npx tsx scripts/orchestrator/index.ts "Add payment badges to unit cards"

# Dry run (plan only)
npx tsx scripts/orchestrator/index.ts --dry-run "Refactor auth module"

# Resume failed session
npx tsx scripts/orchestrator/index.ts --resume orch_20260324_abc

# Specific agents only
npx tsx scripts/orchestrator/index.ts --agents frontend,backend "Add feature"

# Verbose output
npx tsx scripts/orchestrator/index.ts --verbose "Debug issue"
```

## Dependencies

| Package | License | Purpose |
|---------|---------|---------|
| @anthropic-ai/claude-agent-sdk | Anthropic Commercial | Agent SDK |
| proper-lockfile | MIT | State file locking |
| ora | MIT | CLI spinners |
| chalk | MIT | CLI colors |
| commander | MIT | CLI parsing |

## Race Condition Prevention
1. **File ownership**: Κάθε task ορίζει `filesScope` — exclusive
2. **State writes**: Μόνο orchestrator γράφει state
3. **Worktree isolation**: Κάθε agent σε δικό git worktree
4. **Dependency resolution**: Topological sort στο planning phase

## Cost Optimization
- Opus μόνο για orchestrator + review (κρίσιμη σκέψη)
- Sonnet για execution (frontend/backend)
- Haiku για testing/docs (χαμηλό κόστος)

## References
- ADR-168: Multi-Agent Development Environment
- ADR-080: AI Pipeline Implementation
- ADR-171: Autonomous AI Agent with Agentic Tool Calling

## Changelog
- 2026-03-24: Initial implementation — 10 TypeScript files + 6 system prompts + CLI
