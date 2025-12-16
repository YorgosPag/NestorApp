# 🔍 ΑΝΑΦΟΡΑ ΕΛΕΓΧΟΥ ΣΚΛΗΡΩΝ ΤΙΜΩΝ
**Ημερομηνία:** 16 Δεκεμβρίου 2025
**Status:** 🚨 **ΚΡΙΣΙΜΟ - ΑΝΑΓΚΑΙΟΣ REFACTORING**

---

## 📋 ΕΚΤΕΛΕΣΤΙΚΗ ΠΕΡΙΛΗΨΗ

Η έρευνα αποκάλυψε **εκτεταμένη χρήση σκληρών τιμών** σε όλη την εφαρμογή που εμποδίζει την ενοποίηση με τη βάση δεδομένων και δημιουργεί προβλήματα maintainability και scalability.

### ⚠️ ΚΡΙΣΙΜΑ ΕΥΡΗΜΑΤΑ:
- **27 αρχεία** με σκληρές τιμές
- **15+ Company IDs** hardcoded
- **Firebase configuration** exposed σε πολλαπλά σημεία
- **Mock data** embedded στον production κώδικα
- **API endpoints** με hardcoded queries

---

## 🔴 ΚΑΤΗΓΟΡΙΕΣ ΣΚΛΗΡΩΝ ΤΙΜΩΝ

### 1. 🏢 **COMPANY & PROJECT IDENTIFIERS**

#### **Locations & Impact:**

| File | Line | Hardcoded Value | Type | Impact |
|------|------|-----------------|------|--------|
| `src/hooks/useFirestoreProjects.ts` | 49 | `companyId: 'akmi-ate'` | Company ID | **High** |
| `src/hooks/useFirestoreProjects.ts` | 64 | `companyId: 'beta-constructions'` | Company ID | **High** |
| `src/hooks/useContactsState.ts` | 33 | `c.id === 'pagonis'` | Contact ID | **Critical** |
| `src/core/configuration/hardcoded-values-migration.ts` | 58 | `companyId: '5djayaxc0X33wsE8T2uY'` | Firebase Doc ID | **Critical** |
| `src/core/configuration/hardcoded-values-migration.ts` | 63 | `companyId: 'akmi-ate'` | Company ID | **High** |
| `src/core/configuration/hardcoded-values-migration.ts` | 68 | `companyId: 'beta-constructions'` | Company ID | **High** |
| `src/components/navigation/core/services/navigationApi.ts` | 156 | `['ZRCoT0yCeZQxUieIjTQb', 'kGKmSIbhoRlDdrtDnUgD']` | Invalid IDs Array | **Medium** |

#### **Company Names Hardcoded:**
- `ΑΚΜΗ ΑΤΕ`
- `ΒΕΤΑ ΚΑΤΑΣΚΕΥΕΣ`
- `Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε.` (σε PDF headers, obligation templates)

---

### 2. 🔥 **FIREBASE CONFIGURATION**

#### **ΕΚΤΕΘΕΙΜΕΝΕΣ ΔΙΑΜΟΡΦΩΣΕΙΣ:**

| File | Exposed Data | Risk Level |
|------|--------------|------------|
| `add-companies-to-navigation.js` | Full Firebase Config (API Keys, Project IDs) | **CRITICAL** |
| `create-more-projects.js` | Firebase API Key | **CRITICAL** |

```javascript
// CRITICAL SECURITY ISSUE
const firebaseConfig = {
  apiKey: "AIzaSyAXnmBhlPvUX89FmbYqvJdh7VLNKVBwx0Y",
  authDomain: "pagonis-87766.firebaseapp.com",
  projectId: "pagonis-87766",  // HARDCODED!
  storageBucket: "pagonis-87766.firebasestorage.app"
}
```

---

### 3. 📊 **MOCK DATA & SAMPLE PROJECTS**

#### **Embedded Sample Data:**

| File | Type | Count | Impact |
|------|------|-------|---------|
| `src/hooks/useFirestoreProjects.ts` | Sample Projects | 2 full projects | **High** |
| `src/app/api/contacts/create-sample/route.ts` | Sample Contacts | 8 names, cities, professions | **Medium** |

**Sample Projects Hardcoded:**
```typescript
const sampleProjects = [
  {
    name: 'Παλαιολόγου 15',
    company: 'ΑΚΜΗ ΑΤΕ',
    companyId: 'akmi-ate',    // HARDCODED!
    address: 'Παλαιολόγου 15',
    city: 'Εύοσμος, Θεσσαλονίκη',
    totalValue: 850000        // HARDCODED!
  }
]
```

---

### 4. 🔗 **API ENDPOINTS & QUERIES**

#### **Hardcoded Database Queries:**

| File | Query Type | Hardcoded Value |
|------|------------|-----------------|
| `src/app/api/debug-companies/route.ts` | Firebase Doc Query | `'kGKmSIbhoRlDdrtDnUgD'` |
| `src/app/api/debug-companies/route.ts` | Firestore Where | `where('companyId', '==', 'kGKmSIbhoRlDdrtDnUgD')` |
| `src/app/api/fix-companies/route.ts` | Doc ID Check | `doc.id === '5djayaxc0X33wsE8T2uY'` |
| `src/app/api/analyze-companies/route.ts` | Multiple Hardcoded | Company mappings & project connections |

---

### 5. 📝 **BUSINESS LOGIC & TEMPLATES**

#### **Organization Data:**

| File | Context | Hardcoded Content |
|------|---------|-------------------|
| `src/services/obligations/InMemoryObligationsRepository.ts` | Default Contractor | `"Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε."` |
| `src/services/pdf/renderers/HeaderFooterRenderer.ts` | PDF Footer | `'Χ.Γ.Γ. ΠΑΓΩΝΗΣ Ο.Ε.'` |
| `src/services/obligations/InMemoryObligationsRepository.ts` | Template Name | `"Βασικό Πρότυπο ΠΑΓΩΝΗΣ"` |

---

## 🎯 ΣΥΣΤΑΣΕΙΣ & ΛΥΣΗ

### **ΣΤΡΑΤΗΓΙΚΗ ΑΝΤΙΜΕΤΩΠΙΣΗΣ:**

#### 1. **🏛️ ΔΗΜΙΟΥΡΓΙΑ ΚΕΝΤΡΙΚΟΥ CONFIGURATION SYSTEM**

```typescript
// ✅ ΠΡΟΤΕΙΝΟΜΕΝΗ ΛΥΣΗ
interface DatabaseConfig {
  defaultCompany: {
    id: string;
    name: string;
    legalName: string;
  };
  environment: 'development' | 'staging' | 'production';
  dynamicDataSources: boolean;
}
```

#### 2. **🔄 ΜΕΤΑΦΟΡΑ ΣΕ ENVIRONMENT VARIABLES**

```bash
# .env.local
NEXT_PUBLIC_DEFAULT_COMPANY_ID=get_from_database
FIREBASE_PROJECT_ID=pagonis-87766
DEFAULT_CONTRACTOR_NAME=get_from_database
```

#### 3. **📦 ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ CONFIGURATION**

**Δημιουργία:** `src/core/configuration/DatabaseConfigManager.ts`
```typescript
export class DatabaseConfigManager {
  static async getDefaultCompany(): Promise<CompanyConfig> {
    // Fetch from Firestore companies collection
  }

  static async getSystemTemplates(): Promise<TemplateConfig[]> {
    // Fetch from Firestore templates collection
  }
}
```

#### 4. **🔥 ΑΦΑΙΡΕΣΗ HARDCODED FIREBASE CONFIG**

**Μετακίνηση στα:**
- `src/lib/firebase.ts` (μόνο)
- Environment variables
- Secure configuration management

---

## 📅 ΠΡΟΤΕΙΝΟΜΕΝΗ ΦΑΣΟΠΟΙΗΣΗ

### **ΦΑΣΗ 1: ΚΡΙΣΙΜΑ ΘΕΜΑΤΑ (Εβδομάδα 1)**
- [ ] Αφαίρεση exposed Firebase configurations
- [ ] Δημιουργία environment variables για company data
- [ ] Κεντρικοποίηση Company/Project ID management

### **ΦΑΣΗ 2: MOCK DATA CLEANUP (Εβδομάδα 2)**
- [ ] Μεταφορά sample projects σε seed data scripts
- [ ] Δημιουργία dynamic mock data generators
- [ ] Αφαίρεση hardcoded names/addresses

### **ΦΑΣΗ 3: API & BUSINESS LOGIC (Εβδομάδα 3)**
- [ ] Refactoring API endpoints για dynamic queries
- [ ] Database-driven templates
- [ ] Configuration-based PDF generation

### **ΦΑΣΗ 4: VALIDATION & TESTING (Εβδομάδα 4)**
- [ ] Testing όλων των configuration changes
- [ ] Production deployment με database integration
- [ ] Performance validation

---

## 🚨 ΚΡΙΣΙΜΟΤΗΤΑ & ΠΡΟΤΕΡΑΙΟΤΗΤΕΣ

### **🔴 CRITICAL (Άμεση ανάγκη)**
1. **Firebase Configuration Exposure** - Security risk
2. **Company ID Hardcoding** - Breaks multi-tenancy
3. **PDF/Template Company Names** - Brand consistency

### **🟠 HIGH (Εντός εβδομάδας)**
1. **Sample Project Data** - Production data pollution
2. **API Hardcoded Queries** - Scalability issues

### **🟡 MEDIUM (Εντός μήνα)**
1. **Mock Data Cleanup** - Development experience
2. **Navigation Invalid IDs** - Error handling

---

## ✅ ΕΠΙΒΕΒΑΙΩΣΗ ΕΠΙΤΥΧΙΑΣ

**Η εφαρμογή θα θεωρείται "database-driven" όταν:**

1. ✅ **Μηδέν hardcoded Company/Project IDs**
2. ✅ **Όλα τα configuration data από Firestore**
3. ✅ **Dynamic mock data generation**
4. ✅ **Environment-based configurations**
5. ✅ **Database-driven templates & content**

---

## 📞 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ

**Γιώργο,** αυτή η αναφορά αποκαλύπτει ότι η εφαρμογή έχει σημαντικές εξαρτήσεις από σκληρές τιμές. **Προτείνω να ξεκινήσουμε άμεσα με τη Φάση 1** για την αντιμετώπιση των κρισίμων security issues και την δημιουργία του κεντρικού configuration system.

Θέλεις να προχωρήσουμε με την υλοποίηση του `DatabaseConfigManager` ή να εστιάσουμε πρώτα σε κάποια συγκεκριμένη κατηγορία προβλημάτων;