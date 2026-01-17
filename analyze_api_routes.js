/**
 * Automated API Routes Security Analyzer
 * Extracts security metadata from all API route files
 */

const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'src', 'app', 'api');

function findAllRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findAllRouteFiles(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function analyzeRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(apiDir, filePath).replace(/\\/g, '/');

  // Extract patterns
  const hasWithAuth = /withAuth\s*\(/.test(content);
  const hasExportAsync = /export\s+async\s+function\s+(GET|POST|PUT|DELETE|PATCH)/.test(content);
  const usesAdminSDK = /(adminDb|adminAuth|firebase-admin|getFirestore\(|adminFirestore)/.test(content);
  const usesClientSDK = /from\s+['"]@\/lib\/firebase['"]/.test(content) && !usesAdminSDK;

  // Extract permissions
  const permissionMatch = content.match(/permissions:\s*['"]([^'"]+)['"]/);
  const permission = permissionMatch ? permissionMatch[1] : null;

  // Extract global role requirements
  const roleMatch = content.match(/requiredGlobalRoles:\s*\[['"]([^'"]+)['"]\]/);
  const globalRole = roleMatch ? roleMatch[1] : null;

  // Check for super_admin explicit check
  const hasSuperAdminCheck = /ctx\.globalRole\s*!==\s*['"]super_admin['"]/.test(content);

  // Check for tenant scoping (companyId filtering)
  const hasTenantScoping = /companyId\s*===|where\s*\(\s*['"]companyId['"]/.test(content);

  // Categorize
  let category = 'PRODUCTION';

  if (relativePath.includes('debug') || content.includes('@purpose Debug')) {
    category = 'DEBUG';
  } else if (relativePath.includes('run-jest') || relativePath.includes('run-playwright') || relativePath.includes('run-vitest')) {
    category = 'RCE';
  } else if (relativePath.startsWith('admin/') || relativePath.includes('/admin/')) {
    category = 'ADMIN';
  } else if (relativePath.includes('fix-') || relativePath.includes('cleanup') || relativePath.includes('force-') || relativePath.includes('auto-fix') || relativePath.includes('quick-fix') || relativePath.includes('radical') || relativePath.includes('final-solution')) {
    category = 'FIX';
  } else if (relativePath.includes('seed') || relativePath.includes('populate') || relativePath.includes('create-sample')) {
    category = 'SEED';
  } else if (relativePath.includes('webhooks/')) {
    category = 'WEBHOOK';
  }

  // Risk assessment
  let risk = '🟢 LOW';

  if (category === 'RCE') {
    risk = '🔴 CRITICAL';
  } else if (!hasWithAuth && !hasExportAsync) {
    risk = '🔴 CRITICAL';
  } else if (!hasWithAuth && hasExportAsync && (category === 'DEBUG' || category === 'FIX' || category === 'ADMIN')) {
    risk = '🟠 HIGH';
  } else if (!hasTenantScoping && category === 'PRODUCTION') {
    risk = '🟡 MEDIUM';
  } else if (usesClientSDK && category === 'PRODUCTION') {
    risk = '🟡 MEDIUM';
  } else if (hasWithAuth && hasSuperAdminCheck && usesAdminSDK) {
    risk = '🟢 LOW';
  }

  // Action recommendation
  let action = 'OK';

  if (category === 'RCE') {
    action = 'DELETE';
  } else if (category === 'DEBUG' && !hasWithAuth) {
    action = 'DELETE';
  } else if (!hasWithAuth && category !== 'WEBHOOK') {
    action = 'PROTECT';
  } else if (usesClientSDK && category === 'PRODUCTION') {
    action = 'MIGRATE';
  }

  return {
    file: relativePath,
    auth: hasWithAuth ? 'Yes' : 'No',
    permission: permission || (hasSuperAdminCheck ? 'super_admin (explicit)' : '-'),
    role: globalRole || '-',
    tenant: hasTenantScoping ? 'Yes' : 'No',
    sdk: usesAdminSDK ? 'Admin' : (usesClientSDK ? 'Client' : 'None'),
    category,
    risk,
    action
  };
}

function main() {
  const routeFiles = findAllRouteFiles(apiDir);
  console.log(`Found ${routeFiles.length} route files\n`);

  const results = routeFiles.map(analyzeRouteFile);

  // Sort by risk level
  const riskOrder = { '🔴 CRITICAL': 1, '🟠 HIGH': 2, '🟡 MEDIUM': 3, '🟢 LOW': 4 };
  results.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

  // Generate Markdown table
  console.log('| File | Auth | Permission | Role | Tenant | SDK | Category | Risk | Action |');
  console.log('|------|------|------------|------|--------|-----|----------|------|--------|');

  for (const result of results) {
    console.log(`| ${result.file} | ${result.auth} | ${result.permission} | ${result.role} | ${result.tenant} | ${result.sdk} | ${result.category} | ${result.risk} | ${result.action} |`);
  }

  // Summary statistics
  console.log('\n\n## Summary Statistics\n');

  const withAuth = results.filter(r => r.auth === 'Yes').length;
  const withoutAuth = results.filter(r => r.auth === 'No').length;
  const usesAdminSDK = results.filter(r => r.sdk === 'Admin').length;
  const usesClientSDK = results.filter(r => r.sdk === 'Client').length;
  const withTenantScoping = results.filter(r => r.tenant === 'Yes').length;

  const critical = results.filter(r => r.risk === '🔴 CRITICAL').length;
  const high = results.filter(r => r.risk === '🟠 HIGH').length;
  const medium = results.filter(r => r.risk === '🟡 MEDIUM').length;
  const low = results.filter(r => r.risk === '🟢 LOW').length;

  const toDelete = results.filter(r => r.action === 'DELETE').length;
  const toProtect = results.filter(r => r.action === 'PROTECT').length;
  const toMigrate = results.filter(r => r.action === 'MIGRATE').length;
  const ok = results.filter(r => r.action === 'OK').length;

  console.log(`- **Total Endpoints**: ${results.length}`);
  console.log(`- **With Auth**: ${withAuth} (${Math.round(withAuth/results.length*100)}%)`);
  console.log(`- **Without Auth**: ${withoutAuth} (${Math.round(withoutAuth/results.length*100)}%)`);
  console.log(`- **Uses Admin SDK**: ${usesAdminSDK}`);
  console.log(`- **Uses Client SDK**: ${usesClientSDK}`);
  console.log(`- **With Tenant Scoping**: ${withTenantScoping}`);
  console.log('');
  console.log(`### Risk Distribution:`);
  console.log(`- 🔴 **CRITICAL**: ${critical}`);
  console.log(`- 🟠 **HIGH**: ${high}`);
  console.log(`- 🟡 **MEDIUM**: ${medium}`);
  console.log(`- 🟢 **LOW**: ${low}`);
  console.log('');
  console.log(`### Actions Required:`);
  console.log(`- **DELETE**: ${toDelete} endpoints`);
  console.log(`- **PROTECT**: ${toProtect} endpoints`);
  console.log(`- **MIGRATE**: ${toMigrate} endpoints`);
  console.log(`- **OK**: ${ok} endpoints`);

  // Category breakdown
  console.log('\n### Category Breakdown:\n');
  const categories = {};
  for (const result of results) {
    categories[result.category] = (categories[result.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`- **${cat}**: ${count} endpoints`);
  }
}

main();
