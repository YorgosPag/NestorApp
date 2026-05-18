# Boy Scout Centralization Rule

**Added:** 2026-05-19
**Confirmed by:** Giorgio Pagonis
**CLAUDE.md reference:** N.0.2

## The Rule

When investigating code for ANY task, if you discover duplicate or scattered patterns:

- **Small (< 1h)**: Fix immediately, before continuing main task
- **Large (> 1h)**: Add to `pending-ratchet-work.md` immediately
- **Never**: Wait for Giorgio to ask

## Decision Tree

```
Investigating code
    ↓
Found duplicate/scattered pattern?
    ↓ YES
Is it < 1h to fix?
    ↓ YES                    ↓ NO
Fix immediately         Add to pending-ratchet-work.md
    ↓                        ↓
SSoT exists?            Include: what/where/why/fix
    ↓ YES    ↓ NO
Centralize  Create SSoT first,
to it       then centralize
```

## Root Incident (why this rule exists)

During slab/xline selection visual fix (2026-05-19):
- Discovered: `if (options.grips) { this.renderGrips(entity, options); }` repeated in 7 BIM renderers
- Should have done: add `finalizeRender(entity, options)` to `BaseEntityRenderer` and call it from each renderer
- What happened instead: copy-pasted the pattern to 6 more files (agent was focused on main task)
- Cost: technical debt, 7-file duplication, future bugs if pattern changes

## SSoT Check Commands

Before creating a new helper/method, grep for existing ones:

```bash
# Find existing pattern in centralized files
grep -r "renderGrips" src/subapps/dxf-viewer/rendering/entities/BaseEntityRenderer.ts

# Find if SSoT exists for a concept
grep -r "finalizeRender\|renderGrips\|cleanupStyle" src/subapps/dxf-viewer/rendering/entities/

# Check .ssot-registry.json for registered modules
cat .ssot-registry.json | grep -i "renderer\|grip"
```

## This Rule Applies To All Agents

This file is git-tracked. All agents working on this project MUST follow this rule.
If you are a new agent reading this: proactive centralization is not optional.
