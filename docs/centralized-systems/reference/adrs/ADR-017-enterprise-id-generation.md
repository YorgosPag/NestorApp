# ADR-017: Enterprise ID Generation

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Entity Systems |
| **Canonical Location** | `@/services/enterprise-id.service` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `@/services/enterprise-id.service`
- **Prohibited**: `Math.random()`, `Date.now()`, inline `crypto.randomUUID()` for ID generation
- **54+ generators** covering all entity types
- **Latest additions (2026-03-12)**: `generateWorkspaceId()` (`ws`), `generateAddressId()` (`addr`), `generateOpportunityId()` (`opp`), `generateTransmittalId()` (`xmit`)
