# 🔧 TENANT FIX EXECUTION GUIDE

**ChatGPT Analysis - Sections 1 & 2 Implementation**
**Date:** 2026-01-17
**Target:** Fix tenant mismatch (companyId claim → Firestore data)

---

## 📋 **OVERVIEW**

This guide executes **Section 1** (Tenant Model Fix) and **Section 2** (Data Migration) from the ChatGPT analysis.

**Problem:**
- User claim: `companyId: "pagonis-company"` (string slug)
- Firestore data: `companyId: "pzNUy8ksddGCtcQMqumR"` (doc ID)
- → Backend tenant isolation returns 0 results

**Solution:**
1. Fix companyId claim to match Firestore doc ID
2. Ensure canonical company doc exists
3. Backfill buildings with companyId field

---

## 🚀 **EXECUTION STEPS**

### **STEP 1: Ensure Canonical Company Doc**

This ensures the company document exists in Firestore.

```bash
node scripts/ensure-canonical-company.js
```

**Expected Output:**
```
✅ [CANONICAL_COMPANY] Company document ALREADY EXISTS
   OR
✅ [CANONICAL_COMPANY] Company document CREATED successfully!
```

**Verifies:** Company doc `pzNUy8ksddGCtcQMqumR` exists in `contacts` collection with `type='company'`

---

### **STEP 2: Fix User companyId Claim**

This updates your Firebase Auth token claim.

**Run in BROWSER CONSOLE:**

1. Open https://nestor-app.vercel.app (logged in as pagonis.oe@gmail.com)
2. Open DevTools → Console
3. Paste the entire `scripts/fix-tenant-claim.js` file
4. Press Enter

**Expected Output:**
```
✅ [FIX_TENANT] Claims updated successfully!
✅ [FIX_TENANT] Token refreshed!
✅ ✅ ✅ TENANT CLAIM FIX COMPLETE! ✅ ✅ ✅

🔄 Auto-reloading page in 2 seconds...
```

**Page will auto-reload.**

**Verify:**
- Go to `/debug/token-info`
- Should show: `companyId: "pzNUy8ksddGCtcQMqumR"`

---

### **STEP 3: Backfill Buildings companyId (DRY RUN)**

This shows what would be changed WITHOUT making changes.

```bash
node scripts/backfill-buildings-companyId.js
```

**Expected Output:**
```
🔍 Running in DRY-RUN mode (no changes will be made)

📋 [BACKFILL] Buildings analysis:
   ✅ WITH companyId: 0
   ❌ WITHOUT companyId: 10

🔍 [DRY-RUN] Would update 10 buildings
🔍 [DRY-RUN] Each building would get: companyId = pzNUy8ksddGCtcQMqumR
```

**Review the output.** If it looks correct, proceed to Step 4.

---

### **STEP 4: Backfill Buildings companyId (APPLY)**

This ACTUALLY updates Firestore.

```bash
node scripts/backfill-buildings-companyId.js --apply
```

**Expected Output:**
```
⚠️ Running in APPLY mode (changes WILL be written to Firestore)

⚙️ [APPLY] Updating 10 buildings...
   ✅ Batch 1/1: Updated 10 buildings

📊 [APPLY] Backfill results:
   ✅ Successfully updated: 10
   ❌ Failed: 0

✅ BACKFILL COMPLETE
```

---

## ✅ **VERIFICATION CHECKLIST**

After running all steps, verify:

### 1. **Token Info**
- URL: https://nestor-app.vercel.app/debug/token-info
- Should show: `companyId: "pzNUy8ksddGCtcQMqumR"`

### 2. **Bootstrap API**
- Open DevTools → Network tab
- Reload page
- Find `/api/audit/bootstrap` request
- Should see: **200 OK** (not 401)
- Should NOT see error: "User's company … not found"

### 3. **Buildings API**
- Network tab: `/api/buildings` request
- Should see: **200 OK** (not 401)
- Response should have `buildings.length > 0`

### 4. **Projects List**
- Network tab: `/api/projects/list` request
- Should see: **200 OK** (not 401)
- Should return projects with `companyId: "pzNUy8ksddGCtcQMqumR"`

---

## 🚨 **TROUBLESHOOTING**

### **Script Error: "Firebase Admin failed"**

**Cause:** `.env.local` not found or invalid service account key

**Fix:**
- Verify `.env.local` exists in project root
- Check `FIREBASE_SERVICE_ACCOUNT_KEY` is valid JSON

---

### **Browser Script Error: "User not authenticated"**

**Cause:** Not logged in

**Fix:**
- Log in to https://nestor-app.vercel.app first
- Then run the script

---

### **Buildings still show 0 after backfill**

**Cause:** May not have any buildings in Firestore

**Check:**
- Go to Firebase Console → Firestore
- Look at `buildings` collection
- Verify documents exist and have `companyId` field

---

## 📊 **SCRIPT FILES CREATED**

| Script | Purpose | Runs In |
|--------|---------|---------|
| `ensure-canonical-company.js` | Creates/verifies company doc | Node.js |
| `fix-tenant-claim.js` | Updates user companyId claim | Browser |
| `backfill-buildings-companyId.js` | Adds companyId to buildings | Node.js |

---

## 📌 **NEXT STEPS (After Completion)**

Once all steps are complete:

1. **Section 3:** Migrate remaining endpoints (projects/notifications) to apiClient
2. **Section 4:** Polish server middleware (401 vs 403 distinction)
3. **Testing:** Full integration test of all endpoints

---

## 📝 **NOTES**

- **Dry run first:** Always run migration scripts with default (dry-run) mode first
- **Backup:** Firebase automatic backups should be enabled
- **Idempotent:** All scripts are safe to run multiple times
- **No destructive operations:** Scripts only ADD/UPDATE data, never DELETE

---

## ✅ **SUCCESS CRITERIA (Definition of Done)**

All 4 verifications must pass:

1. ✅ `/debug/token-info` shows `companyId: "pzNUy8ksddGCtcQMqumR"`
2. ✅ `/api/audit/bootstrap` returns **200 OK** (no "company not found")
3. ✅ `/api/projects/list` returns **200 OK** with projects
4. ✅ `/api/buildings` returns **200 OK** with buildings (if buildings exist)

---

**Last Updated:** 2026-01-17
**Status:** Ready for execution
**Estimated Time:** 5-10 minutes total
