Found 86 route files

| File | Auth | Permission | Role | Tenant | SDK | Category | Risk | Action |
|------|------|------------|------|--------|-----|----------|------|--------|
| buildings/fix-project-ids/route.ts | No | - | - | No | Admin | FIX | 🔴 CRITICAL | PROTECT |
| buildings/populate/route.ts | No | - | - | Yes | None | SEED | 🔴 CRITICAL | PROTECT |
| buildings/route.ts | No | buildings:buildings:view | - | Yes | Admin | PRODUCTION | 🔴 CRITICAL | PROTECT |
| buildings/seed/route.ts | No | - | - | No | None | SEED | 🔴 CRITICAL | PROTECT |
| communications/email/route.ts | No | comm:messages:send | - | No | None | PRODUCTION | 🔴 CRITICAL | PROTECT |
| debug/firestore-data/route.ts | No | - | - | Yes | Client | DEBUG | 🔴 CRITICAL | DELETE |
| floors/route.ts | No | floors:floors:view | - | Yes | Admin | PRODUCTION | 🔴 CRITICAL | PROTECT |
| run-jest/route.ts | No | - | - | No | None | RCE | 🔴 CRITICAL | DELETE |
| run-playwright/route.ts | No | - | - | No | None | RCE | 🔴 CRITICAL | DELETE |
| run-vitest/route.ts | No | - | - | No | None | RCE | 🔴 CRITICAL | DELETE |
| floors/admin/route.ts | No | - | - | No | Admin | ADMIN | 🟠 HIGH | PROTECT |
| floors/debug/route.ts | No | - | - | No | Admin | DEBUG | 🟠 HIGH | DELETE |
| projects/fix-company-ids/route.ts | No | - | - | No | Admin | FIX | 🟠 HIGH | PROTECT |
| projects/quick-fix/route.ts | No | - | - | No | Admin | FIX | 🟠 HIGH | PROTECT |
| units/final-solution/route.ts | No | - | - | No | Admin | FIX | 🟠 HIGH | PROTECT |
| units/force-update/route.ts | No | - | - | No | Admin | FIX | 🟠 HIGH | PROTECT |
| communications/email/property-share/route.ts | No | comm:messages:send | - | No | None | PRODUCTION | 🟡 MEDIUM | PROTECT |
| contacts/update-existing/route.ts | Yes | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | OK |
| conversations/[conversationId]/messages/route.ts | No | comm:conversations:view | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| conversations/[conversationId]/send/route.ts | No | comm:conversations:update | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| download/route.ts | Yes | photos:photos:upload | - | No | None | PRODUCTION | 🟡 MEDIUM | OK |
| enterprise-ids/migrate/route.ts | No | - | - | No | None | PRODUCTION | 🟡 MEDIUM | PROTECT |
| floors/diagnostic/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| floors/enterprise-audit/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| navigation/add-companies/route.ts | Yes | admin:data:fix | - | No | Admin | PRODUCTION | 🟡 MEDIUM | OK |
| navigation/normalize-schema/route.ts | Yes | admin:data:fix | - | No | Client | PRODUCTION | 🟡 MEDIUM | MIGRATE |
| notifications/ack/route.ts | No | notifications:notifications:view | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| notifications/action/route.ts | No | notifications:notifications:view | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| notifications/dispatch/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| notifications/preferences/route.ts | No | notifications:notifications:view | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| notifications/route.ts | No | notifications:notifications:view | - | No | None | PRODUCTION | 🟡 MEDIUM | PROTECT |
| projects/add-buildings/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| projects/create-for-companies/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| setup/firebase-collections/route.ts | Yes | admin:data:fix | - | No | Client | PRODUCTION | 🟡 MEDIUM | MIGRATE |
| units/admin-link/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| units/connect-to-buildings/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| units/real-update/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| units/test-connection/route.ts | No | - | - | No | Admin | PRODUCTION | 🟡 MEDIUM | PROTECT |
| upload/photo/route.ts | Yes | photos:photos:upload | - | No | Admin | PRODUCTION | 🟡 MEDIUM | OK |
| v2/projects/[projectId]/customers/route.ts | Yes | crm:contacts:view | - | No | Admin | PRODUCTION | 🟡 MEDIUM | OK |
| admin/bootstrap-admin/route.ts | Yes | - | - | No | Admin | ADMIN | 🟢 LOW | OK |
| admin/cleanup-duplicates/route.ts | Yes | admin:data:fix | - | No | Client | ADMIN | 🟢 LOW | OK |
| admin/create-clean-projects/route.ts | Yes | admin:direct:operations | - | No | Admin | ADMIN | 🟢 LOW | OK |
| admin/fix-building-project/route.ts | Yes | admin:data:fix | - | No | Client | ADMIN | 🟢 LOW | OK |
| admin/fix-projects-direct/route.ts | Yes | admin:direct:operations | - | Yes | Admin | ADMIN | 🟢 LOW | OK |
| admin/fix-unit-project/route.ts | Yes | admin:data:fix | - | No | Client | ADMIN | 🟢 LOW | OK |
| admin/migrate-building-features/route.ts | Yes | admin:migrations:execute | - | No | Client | ADMIN | 🟢 LOW | OK |
| admin/migrate-dxf/route.ts | Yes | admin:migrations:execute | - | No | Client | ADMIN | 🟢 LOW | OK |
| admin/migrate-units/route.ts | Yes | admin:data:fix | - | No | Client | ADMIN | 🟢 LOW | OK |
| admin/migrations/execute/route.ts | Yes | admin:migrations:execute | - | No | None | ADMIN | 🟢 LOW | OK |
| admin/migrations/execute-admin/route.ts | Yes | admin:migrations:execute | - | No | Admin | ADMIN | 🟢 LOW | OK |
| admin/migrations/normalize-floors/route.ts | Yes | admin:migrations:execute | - | No | Admin | ADMIN | 🟢 LOW | OK |
| admin/seed-parking/route.ts | Yes | admin:migrations:execute | - | No | Client | ADMIN | 🟢 LOW | OK |
| admin/set-user-claims/route.ts | Yes | users:users:manage | - | No | Admin | ADMIN | 🟢 LOW | OK |
| admin/telegram/webhook/route.ts | Yes | admin:system:configure | - | No | None | ADMIN | 🟢 LOW | OK |
| audit/bootstrap/route.ts | Yes | projects:projects:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | OK |
| buildings/[buildingId]/customers/route.ts | No | buildings:buildings:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| communications/webhooks/telegram/route.ts | No | - | - | No | None | WEBHOOK | 🟢 LOW | OK |
| companies/route.ts | No | crm:contacts:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| contacts/add-real-contacts/route.ts | Yes | - | - | Yes | Admin | PRODUCTION | 🟢 LOW | OK |
| contacts/create-sample/route.ts | Yes | - | - | No | Admin | SEED | 🟢 LOW | OK |
| contacts/list-companies/route.ts | Yes | crm:contacts:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | OK |
| contacts/[contactId]/route.ts | No | crm:contacts:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| contacts/[contactId]/units/route.ts | Yes | crm:contacts:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | OK |
| conversations/route.ts | No | comm:conversations:list | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| debug/token-info/route.ts | Yes | - | - | No | None | DEBUG | 🟢 LOW | OK |
| debug-companies/route.ts | Yes | admin:debug:read | - | Yes | Admin | DEBUG | 🟢 LOW | OK |
| debug-projects/route.ts | Yes | admin:debug:read | - | No | Client | DEBUG | 🟢 LOW | OK |
| debug-unit-floorplans/route.ts | Yes | admin:debug:read | - | No | Client | DEBUG | 🟢 LOW | OK |
| fix-companies/route.ts | Yes | admin:data:fix | - | No | Client | FIX | 🟢 LOW | OK |
| fix-projects/route.ts | Yes | admin:data:fix | - | Yes | Admin | FIX | 🟢 LOW | OK |
| navigation/auto-fix-missing-companies/route.ts | Yes | admin:data:fix | - | No | Client | FIX | 🟢 LOW | OK |
| navigation/fix-contact-id/route.ts | Yes | admin:data:fix | - | No | Client | FIX | 🟢 LOW | OK |
| navigation/force-uniform-schema/route.ts | Yes | admin:data:fix | - | No | Client | FIX | 🟢 LOW | OK |
| navigation/radical-clean-schema/route.ts | Yes | admin:data:fix | - | No | Client | FIX | 🟢 LOW | OK |
| notifications/seed/route.ts | No | - | - | No | None | SEED | 🟢 LOW | PROTECT |
| parking/route.ts | No | units:units:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| projects/by-company/[companyId]/route.ts | No | projects:projects:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| projects/list/route.ts | No | projects:projects:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| projects/structure/[projectId]/route.ts | No | projects:projects:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| projects/[projectId]/customers/route.ts | Yes | projects:projects:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | OK |
| relationships/children/route.ts | Yes | projects:projects:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | OK |
| relationships/create/route.ts | Yes | projects:projects:update | - | Yes | Admin | PRODUCTION | 🟢 LOW | OK |
| storages/route.ts | No | units:units:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| units/route.ts | No | units:units:view | - | Yes | Admin | PRODUCTION | 🟢 LOW | PROTECT |
| webhooks/sendgrid/route.ts | No | - | - | No | Client | WEBHOOK | 🟢 LOW | OK |


## Summary Statistics

- **Total Endpoints**: 86
- **With Auth**: 40 (47%)
- **Without Auth**: 46 (53%)
- **Uses Admin SDK**: 53
- **Uses Client SDK**: 18
- **With Tenant Scoping**: 24

### Risk Distribution:
- 🔴 **CRITICAL**: 10
- 🟠 **HIGH**: 6
- 🟡 **MEDIUM**: 24
- 🟢 **LOW**: 46

### Actions Required:
- **DELETE**: 5 endpoints
- **PROTECT**: 39 endpoints
- **MIGRATE**: 2 endpoints
- **OK**: 40 endpoints

### Category Breakdown:

- **PRODUCTION**: 44 endpoints
- **ADMIN**: 16 endpoints
- **FIX**: 11 endpoints
- **DEBUG**: 6 endpoints
- **SEED**: 4 endpoints
- **RCE**: 3 endpoints
- **WEBHOOK**: 2 endpoints
