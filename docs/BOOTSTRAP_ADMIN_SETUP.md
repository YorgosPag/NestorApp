# 🔐 Bootstrap Admin User Setup - Enterprise Guide

**Enterprise-grade solution for setting up the first admin user with custom claims.**

This guide follows RFC v6 Authorization & RBAC System design.

---

## 📋 Overview

When a user signs in with Google for the first time, their Firebase token **does not contain custom claims** (`companyId`, `globalRole`). This causes:

- ❌ HTTP 401 errors on protected API endpoints
- ❌ "Authentication required" messages in the UI
- ❌ Unable to access company data

**Solution**: Bootstrap the first admin user with custom claims using the `/api/admin/bootstrap-admin` endpoint.

---

## 🏗️ Architecture

```
┌──────────────────┐
│  Firebase Auth   │  User signs in with Google
│  (No claims yet) │
└────────┬─────────┘
         │
         │ 1. Call Bootstrap API
         ▼
┌──────────────────┐
│ Bootstrap Admin  │  🔐 Protected by BOOTSTRAP_ADMIN_SECRET
│   API Endpoint   │  📍 /api/admin/bootstrap-admin
└────────┬─────────┘
         │
         │ 2. Set Custom Claims
         ▼
┌──────────────────┐
│  Firebase Token  │  Now contains:
│  (With Claims)   │  - companyId: "pagonis-company"
│                  │  - globalRole: "super_admin"
│                  │  - mfaEnrolled: false
└────────┬─────────┘
         │
         │ 3. Create Firestore Document
         ▼
┌──────────────────┐
│   /users/{uid}   │  Contains:
│  Firestore Doc   │  - email, displayName
│                  │  - companyId, globalRole
│                  │  - status: "active"
└──────────────────┘
```

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Set Bootstrap Secret

Add to `.env.local`:

```bash
BOOTSTRAP_ADMIN_SECRET=dev-bootstrap-secret-2026
```

**⚠️ SECURITY NOTE**:
- Use a strong secret in production
- Never commit this to git
- Rotate secrets regularly

### Step 2: Start Development Server

```bash
npm run dev
```

### Step 3: Run Bootstrap Script

```powershell
.\scripts\bootstrap-admin-user.ps1
```

**Output:**
```
🔐 BOOTSTRAP ADMIN USER - Enterprise Setup

📋 Configuration:
   User Email:   pagonis.oe@gmail.com
   Company ID:   pagonis-company
   Global Role:  super_admin
   API URL:      http://localhost:3000/api/admin/bootstrap-admin

🚀 Sending bootstrap request...

✅ SUCCESS!

📋 Admin User Created:
   UID:              ITjmw0syn7WiYuskqaGtzLPuN852
   Email:            pagonis.oe@gmail.com
   Company ID:       pagonis-company
   Global Role:      super_admin
   Custom Claims:    True
   Firestore Doc:    True

📝 NEXT STEPS:
1. Refresh your browser (Ctrl + Shift + R)
2. Sign out and sign in again to get new token with custom claims
3. Navigate to http://localhost:3000/crm/communications
4. Verify that the 'Authentication required' error is gone
```

### Step 4: Refresh Browser & Test

1. **Sign out** from the app
2. **Sign in** again (to get new token with claims)
3. Navigate to `/crm/communications`
4. ✅ No more "Authentication required" error!

---

## 🛠️ Manual API Call (Alternative)

If you prefer to call the API manually:

```bash
curl -X POST http://localhost:3000/api/admin/bootstrap-admin \
  -H "Content-Type: application/json" \
  -d '{
    "userIdentifier": "pagonis.oe@gmail.com",
    "companyId": "pagonis-company",
    "globalRole": "super_admin",
    "bootstrapSecret": "dev-bootstrap-secret-2026"
  }'
```

---

## 📊 Valid Global Roles

| Role | Description | Use Case |
|------|-------------|----------|
| `super_admin` | Full system access | Platform administrators |
| `company_admin` | Company-wide admin | Tenant administrators |
| `company_staff` | Internal staff | Employees with limited access |
| `company_user` | Regular user | Customers, clients |

---

## 🔐 Security

### Development Mode
- ✅ Bootstrap endpoint **enabled**
- ✅ Only requires `BOOTSTRAP_ADMIN_SECRET`
- ✅ No Firebase authentication required (chicken-and-egg problem)

### Production Mode
- ❌ Bootstrap endpoint **disabled**
- ✅ Use `/api/admin/set-user-claims` instead
- ✅ Requires Firebase authentication with `super_admin` or `company_admin` role

---

## 🌐 Production Deployment

### Vercel Setup

1. Add environment variable in Vercel dashboard:
   ```
   BOOTSTRAP_ADMIN_SECRET=<strong-random-secret>
   ```

2. **IMPORTANT**: The bootstrap endpoint is **DISABLED** in production for security.

3. After initial setup, use `/api/admin/set-user-claims` for subsequent users:
   ```typescript
   // Requires authenticated admin
   const token = await auth.currentUser.getIdToken();

   await fetch('/api/admin/set-user-claims', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       uid: 'user-uid-here',
       companyId: 'company-id',
       globalRole: 'company_staff',
       email: 'user@example.com'
     })
   });
   ```

---

## 🧪 Testing

### Verify Custom Claims

After bootstrapping, verify claims in browser console:

```javascript
// Get current user token
const user = auth.currentUser;
const token = await user.getIdToken(true); // Force refresh

// Decode token (use jwt.io or browser console)
const decoded = JSON.parse(atob(token.split('.')[1]));
console.log('Custom Claims:', {
  companyId: decoded.companyId,
  globalRole: decoded.globalRole,
  mfaEnrolled: decoded.mfaEnrolled
});
```

**Expected Output:**
```json
{
  "companyId": "pagonis-company",
  "globalRole": "super_admin",
  "mfaEnrolled": false
}
```

### Verify Firestore Document

Check Firebase Console:
1. Go to: https://console.firebase.google.com/project/pagonis-87766/firestore
2. Navigate to: `users/{uid}`
3. Verify document contains:
   - `companyId`: "pagonis-company"
   - `globalRole`: "super_admin"
   - `status`: "active"
   - `email`: "pagonis.oe@gmail.com"

---

## 🐛 Troubleshooting

### Error: "User not found in Firebase Auth"

**Solution**: The user must sign in with Google first to create their Firebase Auth account.

1. Go to http://localhost:3000/login
2. Click "Sign in with Google"
3. Complete the sign-in flow
4. Run bootstrap script again

---

### Error: "Invalid bootstrap secret"

**Solution**: Verify `BOOTSTRAP_ADMIN_SECRET` in `.env.local` matches the secret in the script.

```bash
# .env.local
BOOTSTRAP_ADMIN_SECRET=dev-bootstrap-secret-2026
```

---

### Error: "Bootstrap endpoint disabled in production"

**Solution**: In production, use `/api/admin/set-user-claims` endpoint instead.

1. Have an existing admin user authenticate
2. Get their ID token
3. Call `/api/admin/set-user-claims` with Bearer token

---

### Custom Claims Not Working After Bootstrap

**Solution**: Firebase tokens are cached. Force a token refresh:

1. Sign out completely
2. Sign in again
3. Or force refresh token in code:
   ```javascript
   await auth.currentUser.getIdToken(true); // Force refresh
   ```

---

## 📚 References

- [RFC: Authorization & RBAC System](../rfc/authorization-rbac.md)
- [Firebase Custom Claims Documentation](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)

---

## 🎯 Enterprise Standards

This implementation follows:
- ✅ **SAP**: Role-based access control patterns
- ✅ **Salesforce**: Multi-tenant architecture
- ✅ **Microsoft Dynamics**: Custom claims for authorization
- ✅ **Google Cloud**: Identity Platform best practices
- ✅ **Autodesk**: Secure bootstrap procedures

**No shortcuts. No "μπακάλικο γειτονιάς". Enterprise quality only.** 🏢
