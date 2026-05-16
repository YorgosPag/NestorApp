---
name: Giorgio fa commit e push — agent NEVER autonomo
description: ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ (2026-05-16): Ο Γιώργος κάνει SIA commit SIA push. Ο agent NEVER autonomamente.
type: feedback
---

**Aggiornamento 2026-05-16 (override regola precedente)**:

Ο Γιώργος κάνει **και τα commit και τα push** μόνος του. Ο agent **NEVER** κάνει commit autonomamente, **NEVER** κάνει push autonomamente.

**Permesso all'agent**:
- ✅ `git status` / `git diff` / `git log` (read-only inspection)
- ✅ `git add <specific-files>` (preparazione, per verifica)
- ❌ `git commit` (mai senza ordine esplicito Giorgio)
- ❌ `git push` (mai senza ordine esplicito Giorgio)

**Trigger words per commit** (greco/italiano/inglese):
- "commit", "κάνε commit", "fai commit", "commit it"

**Trigger words per push**:
- "push", "στείλε", "ανέβασε", "πήγαινε Vercel", "send it", "upload", "go Vercel"

**Why:**
- Commit: Giorgio decide quando il lavoro è pronto per essere committed. Non l'agent.
- Push: Ogni push = Vercel build = consumo credits ($). Giorgio paga e vuole controllo totale del deploy.
- Storia precedente: regola "commit autonomous, push solo con ordine" del 2026-03-24 → revocata 2026-05-16.

**How to apply:**
- Dopo aver finito il lavoro (Edit/Write/test): `git status` + `git diff --cached` per riassunto, poi **STOP**.
- Aspetta che Giorgio dica esplicitamente "commit" o "commit + push".
- Se Giorgio dice solo "commit" → fai commit, NON push.
- Se Giorgio dice "commit + push" o "commita e pusha" → entrambi.

**Riferimento canonico**: `CLAUDE.md` N.(-1) + sezione "🔄 GIT / VERCEL / BACKUP".

Related: [[feedback_no_push_without_order]], [[feedback_never_ask_commit_push]], [[feedback_commit_background]]
