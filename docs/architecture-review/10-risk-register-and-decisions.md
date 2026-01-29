# ⚠️ Risk Register & Strategic Decisions

**Review Date**: 2026-01-29
**Repository**: Nestor Construct Platform

---

## 📋 RISK REGISTER

### 🔴 CRITICAL RISKS (Production Blockers)

| ID | Risk | Likelihood | Impact | Evidence | Mitigation |
|----|------|------------|--------|----------|------------|
| **R-001** | **Broken Access Control** - 25+ Firestore collections lack tenant isolation | 🔴 **Certain** | 🔴 **CRITICAL** | `firestore.rules:393,415,423,630,665,677,686,752,788,839` | Fix all collections - Add `&& belongsToCompany(resource.data.companyId)` (4-6 hours) |
| **R-002** | **Public Read Access** - Buildings collection exposed to everyone | 🔴 **Certain** | 🟠 **HIGH** | `firestore.rules:264` - `allow read: if true;` | Change to `if isAuthenticated()` (30 min) |
| **R-003** | **No MFA Enforcement** - MFA exists but not validated | 🔴 **Certain** | 🔴 **CRITICAL** | `src/lib/auth/middleware.ts:167-254` - No `requireMFA()` call | Add MFA validation in middleware (2-3 hours) |
| **R-004** | **No Rate Limiting** - DoS attacks possible | 🔴 **Certain** | 🔴 **CRITICAL** | Config exists but not enforced | Implement Redis-backed rate limiter (6-8 hours) |
| **R-005** | **No Email Verification** - Unverified emails can access system | 🔴 **Certain** | 🟠 **HIGH** | `src/lib/auth/middleware.ts` - Not checked | Add email verification check (2-3 hours) |

**Total Blocker Mitigation**: 15-22 hours (2-3 days)

---

### 🟠 HIGH RISKS

| ID | Risk | Likelihood | Impact | Evidence | Mitigation |
|----|------|------------|--------|----------|------------|
| **R-006** | **DXF Export Missing** - Users cannot save modified drawings | 🟠 **HIGH** | 🟠 **HIGH** | Not found in codebase | Implement JSON→DXF converter (1 week) |
| **R-007** | **DXF Worker Unreliable** - 15s timeout, fallback to main thread | 🟡 **MEDIUM** | 🟠 **HIGH** | `dxf-parser.worker.ts` analysis | Fix timeout handling (1-2 days) |
| **R-008** | **Storage Legacy Paths** - Contact photos, floor plans lack tenant isolation | 🟠 **HIGH** | 🟠 **HIGH** | `storage.rules:243-296` | Add company isolation (2-3 hours) |
| **R-009** | **Incomplete Audit Trails** - Only 1-2 API routes log events | 🟡 **MEDIUM** | 🟠 **HIGH** | Most `src/app/api/**/*.ts` don't call audit | Wrap all routes (8-10 hours) |
| **R-010** | **Session Management Incomplete** - No activity timeout, no force logout | 🟡 **MEDIUM** | 🟡 **MEDIUM** | `src/services/session/` - Implementation partial | Add timeout + logout features (4-5 hours) |

---

### 🟡 MEDIUM RISKS

| ID | Risk | Likelihood | Impact | Evidence | Mitigation |
|----|------|------------|--------|----------|------------|
| **R-011** | **Test Infrastructure Broken** - Visual regression tests cannot run | 🟡 **MEDIUM** | 🟡 **MEDIUM** | `pixelmatch` dependencies missing | Install deps + update baselines (3-5 days) |
| **R-012** | **Env Variables Not Validated** - Runtime failures possible | 🟡 **MEDIUM** | 🟡 **MEDIUM** | No Zod schema | Add validation on startup (1 day) |
| **R-013** | **DXF Coverage 60%** - Limited file compatibility | 🟢 **LOW** | 🟡 **MEDIUM** | Custom parser analysis | Extend parser to 75%+ (2-3 weeks) |
| **R-014** | **No Golden Files** - No baseline for regression testing | 🟡 **MEDIUM** | 🟡 **MEDIUM** | Not found in codebase | Create baseline snapshots (2-3 days) |
| **R-015** | **Legacy Components** - EnterpriseComboBox (deprecated) | 🟢 **LOW** | 🟢 **LOW** | `src/subapps/dxf-viewer/` - 7 files | Migrate to Radix Select (1 week) |

---

## 🎯 STRATEGIC DECISIONS

### DECISION MATRIX

| # | Decision | Option A | Option B | Option C | Recommended | Rationale |
|---|----------|----------|----------|----------|-------------|-----------|
| **D-001** | **Fix Firestore Rules** | ✅ Fix all 25+ collections NOW | Wait for user feedback | Partial fix (top 10 only) | **A: Fix all NOW** | Critical security blocker, GDPR compliance, 4-6 hours effort |
| **D-002** | **MFA Enforcement** | ✅ Require for company_admin & super_admin | Require for all users | Optional enrollment | **A: Require for admins** | Balance security vs UX, account takeover prevention |
| **D-003** | **Rate Limiting** | ✅ Redis-backed global middleware | In-memory (ephemeral) | Per-endpoint only | **A: Redis-backed** | Persistent, scalable, DoS protection |
| **D-004** | **DXF Export** | ✅ Implement JSON→DXF converter | Use external service (ezdxf API) | Wait for user request | **A: Implement converter** | Killer feature, user retention, 1 week effort |
| **D-005** | **DXF Worker Fix** | ✅ Fix timeout + add fallback logic | Disable worker entirely | Switch to Web Worker pool | **A: Fix timeout** | Async parsing is better UX, 1-2 days effort |
| **D-006** | **Audit Logging** | ✅ Wrap all API routes with audit middleware | Add to critical routes only | Use Firestore triggers | **A: Wrap all routes** | Complete audit trail, incident tracking, 8-10 hours |
| **D-007** | **Visual Regression Tests** | ✅ Install Pixelmatch + update baselines | Switch to different tool | Disable tests | **A: Install deps** | Prevent rendering regressions, 3-5 days effort |
| **D-008** | **Session Validation** | ✅ Add 30min activity timeout | Add 60min timeout | No timeout | **A: 30min timeout** | Balance security vs UX, session hijacking prevention |
| **D-009** | **DXF Parser Upgrade** | Extend current parser to 75%+ | Evaluate npm alternatives (`dxf-parser`) | Switch to ezdxf (server-side) | **B: Evaluate npm** | Reduce maintenance burden, 1 week effort |
| **D-010** | **Env Validation** | ✅ Zod schema on startup | Manual validation | No validation | **A: Zod schema** | Fail fast, prevent runtime errors, 1 day effort |

---

## 📊 DECISION IMPACT ANALYSIS

### High-Impact Decisions (Must Execute)

#### **D-001: Fix Firestore Rules**
- **Impact**: 🔴 **CRITICAL** - Prevents data breach, GDPR compliance
- **Effort**: 4-6 hours
- **Risk if Delayed**: Company A can read/write Company B data
- **ROI**: ∞ (blocker removal)

#### **D-002: MFA Enforcement**
- **Impact**: 🔴 **CRITICAL** - Account takeover prevention
- **Effort**: 2-3 hours
- **Risk if Delayed**: Privileged accounts vulnerable
- **ROI**: 50x (security breach prevention)

#### **D-003: Rate Limiting**
- **Impact**: 🔴 **CRITICAL** - DoS protection
- **Effort**: 6-8 hours
- **Risk if Delayed**: Resource exhaustion, service downtime
- **ROI**: 20x (uptime protection)

#### **D-004: DXF Export**
- **Impact**: 🟠 **HIGH** - Killer feature, user retention
- **Effort**: 1 week
- **Risk if Delayed**: Users frustrated, churn
- **ROI**: 10x (user retention)

---

### Medium-Impact Decisions (Recommended)

#### **D-006: Audit Logging**
- **Impact**: 🟠 **HIGH** - Complete audit trail
- **Effort**: 8-10 hours
- **Risk if Delayed**: Cannot track security incidents
- **ROI**: 5x (incident detection)

#### **D-007: Visual Regression Tests**
- **Impact**: 🟡 **MEDIUM** - Prevent rendering regressions
- **Effort**: 3-5 days
- **Risk if Delayed**: Rendering bugs in production
- **ROI**: 3x (QA automation)

#### **D-008: Session Validation**
- **Impact**: 🟡 **MEDIUM** - Session hijacking prevention
- **Effort**: 4-5 hours
- **Risk if Delayed**: Sessions persist indefinitely
- **ROI**: 3x (security hardening)

---

### Low-Impact Decisions (Optional)

#### **D-009: DXF Parser Upgrade**
- **Impact**: 🟡 **MEDIUM** - Better file compatibility
- **Effort**: 2-3 weeks
- **Risk if Delayed**: Limited file support
- **ROI**: 2x (reduced support burden)

#### **D-010: Env Validation**
- **Impact**: 🟡 **MEDIUM** - Fail fast on startup
- **Effort**: 1 day
- **Risk if Delayed**: Runtime failures
- **ROI**: 2x (faster debugging)

---

## 🚀 IMPLEMENTATION ROADMAP

### PHASE 1: CRITICAL SECURITY FIXES (Week 1)

**Goal**: Fix production blockers

**Tasks**:
1. Fix Firestore rules (4-6 hours) - **D-001**
2. Remove public read from Buildings (30 min) - **D-001**
3. Enforce MFA (2-3 hours) - **D-002**
4. Implement rate limiting (6-8 hours) - **D-003**
5. Enforce email verification (2-3 hours) - **D-002**

**Total**: 15-22 hours (2-3 days)
**Blocker**: YES
**Success Criteria**: Security audit passed with no critical findings

---

### PHASE 2: DXF IMPROVEMENTS (Weeks 2-3)

**Goal**: Complete DXF functionality

**Tasks**:
1. Implement DXF Export (1 week) - **D-004**
2. Fix DXF Worker (1-2 days) - **D-005**
3. Fix visual regression tests (3-5 days) - **D-007**
4. Add golden files (2-3 days) - **D-007**

**Total**: 10-15 days
**Blocker**: NO (but recommended)
**Success Criteria**: Users can export DXF, tests run in CI/CD

---

### PHASE 3: OBSERVABILITY & HARDENING (Week 4)

**Goal**: Improve monitoring and audit

**Tasks**:
1. Extend audit logging (8-10 hours) - **D-006**
2. Session validation (4-5 hours) - **D-008**
3. Env validation (1 day) - **D-010**
4. Fix Storage legacy paths (2-3 hours) - **R-008**

**Total**: 15-20 hours (2-3 days)
**Blocker**: NO
**Success Criteria**: Complete audit trail, sessions expire

---

### PHASE 4: DXF PARSER UPGRADE (Weeks 5-8, Optional)

**Goal**: Extend DXF parser coverage

**Tasks**:
1. Add support for blocks, attributes (1 week)
2. Add SPLINE entity support (1 week)
3. Evaluate npm alternatives (1 week) - **D-009**
4. Document parser capabilities (1-2 days)

**Total**: 15-20 days
**Blocker**: NO
**Success Criteria**: Parser supports 75%+ of DXF spec

---

## 📈 COST-BENEFIT ANALYSIS

| Phase | Cost (Time) | Benefit | ROI | Priority |
|-------|-------------|---------|-----|----------|
| **Phase 1: Security** | 2-3 days | Can deploy to production, no data breach, GDPR compliant | ∞ (blocker) | 🔴 CRITICAL |
| **Phase 2: DXF** | 2 weeks | Users can export drawings, no UI blocking, prevent regressions | 10x (retention) | 🟠 HIGH |
| **Phase 3: Observability** | 2-3 days | Detect incidents, prevent hijacking, faster debugging | 5x (incident prevention) | 🟡 MEDIUM |
| **Phase 4: Parser** | 3-4 weeks | Broader compatibility, reduced support | 3x (support cost) | 🟢 LOW |

---

## 🎯 SUCCESS METRICS

**How we'll know we're ready for production**:

### Security Metrics
- [ ] ✅ All Firestore collections have tenant isolation (0% → 100%)
- [ ] ✅ MFA required for company_admin and super_admin (0% → 100%)
- [ ] ✅ Rate limiting enforced on all API endpoints (0% → 100%)
- [ ] ✅ All API operations logged to audit_logs (10% → 100%)
- [ ] ✅ Sessions expire after 30min inactivity (0% → 100%)
- [ ] ✅ Security audit passed with no critical findings

### Functionality Metrics
- [ ] ✅ Users can export modified DXF files (0% → 100%)
- [ ] ✅ DXF Worker never falls back to main thread (50% → 100%)
- [ ] ✅ Visual regression tests run in CI/CD (0% → 100%)
- [ ] ✅ DXF parser supports 75%+ of spec (60% → 75%)

### Observability Metrics
- [ ] ✅ All security events logged (50% → 100%)
- [ ] ✅ Real-time alerts for failed logins (0% → 100%)
- [ ] ✅ Environment variables validated on startup (0% → 100%)

**Target Date**: 2026-02-15 (2 weeks from now for Phase 1+2)

---

## 📋 DECISION APPROVAL TRACKING

| Decision ID | Decision | Status | Approver | Date | Notes |
|-------------|----------|--------|----------|------|-------|
| D-001 | Fix Firestore Rules | ⏳ Pending | TBD | - | Waiting for approval |
| D-002 | MFA Enforcement | ⏳ Pending | TBD | - | Waiting for approval |
| D-003 | Rate Limiting | ⏳ Pending | TBD | - | Waiting for approval |
| D-004 | DXF Export | ⏳ Pending | TBD | - | Waiting for approval |
| D-005 | DXF Worker Fix | ⏳ Pending | TBD | - | Waiting for approval |
| D-006 | Audit Logging | ⏳ Pending | TBD | - | Waiting for approval |
| D-007 | Visual Regression | ⏳ Pending | TBD | - | Waiting for approval |
| D-008 | Session Validation | ⏳ Pending | TBD | - | Waiting for approval |
| D-009 | DXF Parser Upgrade | ⏳ Pending | TBD | - | Waiting for approval |
| D-010 | Env Validation | ⏳ Pending | TBD | - | Waiting for approval |

---

## 🚨 ESCALATION CRITERIA

**Escalate to stakeholders if**:
- Any critical risk materializes (R-001 to R-005)
- Phase 1 completion exceeds 1 week
- Security audit fails after fixes
- DXF Export implementation exceeds 2 weeks

---

**Related Reports**:
- [01-executive-summary.md](./01-executive-summary.md) - High-level overview
- [03-auth-rbac-security.md](./03-auth-rbac-security.md) - Detailed security findings
- [06-dxf-subsystem-review.md](./06-dxf-subsystem-review.md) - DXF analysis
- [09-quality-gates-production-readiness.md](./09-quality-gates-production-readiness.md) - Testing & CI/CD

---

**Next Steps**:
1. Review this risk register with stakeholders
2. Get approval for critical decisions (D-001 to D-005)
3. Assign owners and start work on Phase 1
4. Track progress weekly
5. Update decision approval tracking table
