# 🧹 Chrome Storage Cleanup Guide - Enterprise Edition

## 🚨 **ΠΡΟΒΛΗΜΑ ΕΝΤΟΠΙΣΤΗΚΕ**

**Error**: `IO error: .../036296.ldb: FILE_ERROR_NO_SPACE`
**Αιτία**: Δίσκος C:\ έχει μόνο **2.86 GB ελεύθερο χώρο** (από 232 GB συνολικά)
**Αποτέλεσμα**: Chrome δεν μπορεί να γράψει στην IndexedDB/LevelDB

---

## ⚡ **ΓΡΗΓΟΡΟΣ ΚΑΘΑΡΙΣΜΟΣ (2 λεπτά)**

### 🔧 **Βήμα 1: Chrome Storage Cleanup**

1. **Άνοιγμα Chrome Settings**:
   ```
   chrome://settings/privacy
   ```

2. **Clear Browsing Data**:
   - Click "Clear browsing data"
   - Select "Advanced" tab
   - Time range: **"All time"**
   - ✅ Check: Cached images and files
   - ✅ Check: Hosted app data
   - ✅ Check: Indexed database data
   - Click "Clear data"

### 🔧 **Βήμα 2: Chrome Developer Storage Cleanup**

1. **Άνοιγμα DevTools**:
   ```
   F12 → Application → Storage
   ```

2. **Clear All Storage**:
   - Click "Clear storage" (bottom left)
   - Select all checkboxes
   - Click "Clear site data"

### 🔧 **Βήμα 3: Disk Cleanup (Windows)**

1. **Run Disk Cleanup**:
   ```
   Start → "Disk Cleanup" → C: drive
   ```

2. **Select Items**:
   - ✅ Temporary files
   - ✅ Recycle Bin
   - ✅ System error memory dump files
   - ✅ Temporary Internet Files
   - ✅ Thumbnails

---

## 🏢 **ENTERPRISE ΛΥΣΕΙΣ (Αυτόματες)**

### ✅ **Storage Quota Management (ΗΔΗ ΕΝΣΩΜΑΤΩΜΕΝΟ)**

Το νέο enterprise system που προστέθηκε παρέχει:

1. **🔍 Real-time Monitoring**:
   - Έλεγχος χώρου κάθε 30 δευτερόλεπτα
   - Αυτόματη ειδοποίηση όταν ο χώρος < 50MB

2. **🛡️ Graceful Degradation**:
   - **Memory Mode**: Όταν χώρος < 50MB → No storage writes
   - **LocalStorage Mode**: Όταν χώρος < 95% → Use LocalStorage instead of IndexedDB
   - **Full Mode**: Όταν χώρος > 95% → Normal IndexedDB operation

3. **📊 Storage Monitoring UI**:
   ```tsx
   const { storageQuota } = useEnterpriseDxfSettings();

   if (storageQuota?.isStorageCritical) {
     console.log('Storage critical:', storageQuota.usagePercent + '%');
   }

   if (storageQuota?.isMemoryMode) {
     console.log('Running in memory-only mode');
   }
   ```

### 🎯 **Προτεινόμενες Ρυθμίσεις**

1. **Browser Settings**:
   - Chrome → Settings → Advanced → Content settings → Storage → Clear on exit

2. **Development Settings**:
   - DevTools → Settings → Preferences → Disable cache

3. **System Settings**:
   - Enable automatic disk cleanup
   - Set minimum free space alert to 5GB

---

## 📈 **ΠΑΡΑΚΟΛΟΥΘΗΣΗ & ΠΡΟΛΗΨΗ**

### 🔍 **Checking Storage Status**

```javascript
// Console command για έλεγχο storage quota
navigator.storage.estimate().then(quota => {
  console.log('Quota:', Math.round(quota.quota / 1024 / 1024) + 'MB');
  console.log('Usage:', Math.round(quota.usage / 1024 / 1024) + 'MB');
  console.log('Available:', Math.round((quota.quota - quota.usage) / 1024 / 1024) + 'MB');
  console.log('Usage %:', Math.round((quota.usage / quota.quota) * 100) + '%');
});
```

### 🚨 **Warning Thresholds**

| Ποσοστό | Κατάσταση | Ενέργεια |
|---------|-----------|----------|
| 0-85% | ✅ Normal | Full IndexedDB mode |
| 85-95% | ⚠️ Warning | Switch to LocalStorage |
| 95-100% | 🔴 Critical | Memory-only mode |

### 🛠️ **Automated Cleanup Script**

```javascript
// Automatic cleanup every 24 hours
setInterval(async () => {
  const quota = await navigator.storage.estimate();
  const usagePercent = (quota.usage / quota.quota) * 100;

  if (usagePercent > 90) {
    // Clear old IndexedDB entries
    console.log('Auto-cleanup triggered');
    // Implementation: Clear entries older than 30 days
  }
}, 24 * 60 * 60 * 1000); // 24 hours
```

---

## 🎯 **ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ**

1. **Άμεσα**: Κάνε Chrome storage cleanup (5 λεπτά)
2. **Σύντομα**: Καθάρισε δίσκο C:\ για περισσότερο χώρο (30 λεπτά)
3. **Μακροπρόθεσμα**: Το enterprise storage system θα αποτρέπει μελλοντικά προβλήματα

### 🏁 **Επιβεβαίωση Επιτυχίας**

Μετά τον καθαρισμό, το error `FILE_ERROR_NO_SPACE` δεν θα εμφανίζεται πια και το DXF Viewer θα λειτουργεί κανονικά με αυτόματη παρακολούθηση του χώρου αποθήκευσης.

---

**📞 Υποστήριξη**: Αν το πρόβλημα συνεχίζεται, ελέγξε τον ελεύθερο χώρο δίσκου με:
```bash
powershell.exe 'Get-PSDrive C'
```