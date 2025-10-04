Param(
  [Parameter(Mandatory=$false)][string]$Root=".",
  [switch]$ApplySafe=$false,
  [switch]$RunPrettier=$true,
  [switch]$RunTypecheck=$true,
  [switch]$RunTests=$false,
  [switch]$CreateBranch=$true
)

$ErrorActionPreference = "Stop"

function Assert-HasCommand {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Απαιτείται '$Name' στο PATH."
  }
}

function Read-PackageJson {
  param([string]$Root)
  $pj = Join-Path $Root "package.json"
  if (-not (Test-Path $pj)) { throw "Δεν βρέθηκε package.json στο '$Root'." }
  return Get-Content $pj -Raw | ConvertFrom-Json
}

function Ensure-CleanGit {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return }
  $status = git status --porcelain
  if ($status) { throw "Το working tree δεν είναι καθαρό. Κάνε commit/stash πρώτα." }
}

function Ensure-Branch {
  param([string]$Prefix="chore/nekro")
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { return }
  $ts = Get-Date -UFormat "%Y%m%d-%H%M%S"
  $branch = "$Prefix-$ts"
  git checkout -b $branch | Out-Null
  Write-Host "✔ Δημιουργήθηκε branch: $branch"
}

function Safe-RunNpxJson {
  param([string]$CmdLine,[int]$AcceptExitCode=0)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "npx"
  $psi.Arguments = "--yes $CmdLine"
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $p.WaitForExit()
  if ($p.ExitCode -ne $AcceptExitCode) {
    Write-Warning ("npx {0} returned {1}. Συνεχίζω και κρατάω το output ως raw." -f $CmdLine, $p.ExitCode)
  }
  try { return $stdout | ConvertFrom-Json } catch { return @{ raw = $stdout; error = $stderr; code = $p.ExitCode } }
}

# === START ===
Push-Location $Root
try {
  Assert-HasCommand node
  Assert-HasCommand npx
  Assert-HasCommand git

  $pkg = Read-PackageJson -Root "."
  Ensure-CleanGit
  if ($CreateBranch) { Ensure-Branch }

  $reportsDir = Join-Path "." ("reports\deadcode\" + (Get-Date -UFormat "%Y%m%d-%H%M%S"))
  New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null

  Write-Host "→ Τρέχω detectors (ts-prune, unimported, madge, depcheck, eslint*)..."

  $report = [ordered]@{}

  # ts-prune: unused exports (TS/JS)
  try {
    $report.tsPrune = Safe-RunNpxJson "ts-prune --json"
  } catch { $report.tsPrune = @{ error = $_.Exception.Message } }

  # unimported: unused files/imports (graph-based)
  try {
    $report.unimported = Safe-RunNpxJson "unimported --reporter json"
  } catch { $report.unimported = @{ error = $_.Exception.Message } }

  # madge: orphans
  try {
    $src = if (Test-Path "src") { "src" } else { "." }
    $report.madgeOrphans = Safe-RunNpxJson ("madge {0} --extensions ts,tsx,js,jsx --orphans --json" -f $src)
  } catch { $report.madgeOrphans = @{ error = $_.Exception.Message } }

  # depcheck: unused deps
  try {
    $report.depcheck = Safe-RunNpxJson "depcheck --json"
  } catch { $report.depcheck = @{ error = $_.Exception.Message } }

  # eslint (if configured)
  $hasEslint = Test-Path ".eslintrc*" -PathType Leaf -ErrorAction SilentlyContinue
  if (-not $hasEslint) {
    try { if ($pkg.eslintConfig) { $hasEslint = $true } } catch {}
  }
  if ($hasEslint) {
    try {
      $eslintJsonPath = Join-Path $reportsDir "eslint.json"
      # capture stdout even if long
      $psi = New-Object System.Diagnostics.ProcessStartInfo
      $psi.FileName = "npx"
      $psi.Arguments = "--yes eslint ""src/**/*.{ts,tsx,js,jsx}"" -f json"
      $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.UseShellExecute = $false
      $p = New-Object System.Diagnostics.Process
      $p.StartInfo = $psi; [void]$p.Start()
      $stdout = $p.StandardOutput.ReadToEnd(); $stderr = $p.StandardError.ReadToEnd(); $p.WaitForExit()
      if ($stdout) { $stdout | Out-File -Encoding utf8 $eslintJsonPath }
      try { $report.eslint = Get-Content $eslintJsonPath -Raw | ConvertFrom-Json } catch { $report.eslint = @{ raw = $stdout; error = $stderr } }
    } catch { $report.eslint = @{ error = $_.Exception.Message } }
  } else {
    $report.eslint = @{ skipped = $true }
  }

  # coverage (jest/vitest) summary αν υπάρχει
  $covSummary = "coverage\coverage-summary.json"
  if (Test-Path $covSummary) {
    try { $report.coverage = Get-Content $covSummary -Raw | ConvertFrom-Json } catch { $report.coverage = @{ error = $_.Exception.Message } }
  } else {
    $report.coverage = @{ skipped = $true }
  }

  $outPath = Join-Path $reportsDir "deadcode-report.json"
  ($report | ConvertTo-Json -Depth 10) | Out-File -Encoding utf8 $outPath
  Copy-Item $outPath ".\deadcode-report.json" -Force
  Write-Host "✔ Αποθηκεύτηκε αναφορά: $outPath και ./deadcode-report.json"

  if ($ApplySafe) {
    Write-Host "→ Safe apply: καθαρισμός ΜΟΝΟ αχρησιμοποίητων imports (χωρίς regex)."

    $scriptPath = "scripts\remove-unused-imports.js"
    if (-not (Test-Path $scriptPath)) {
      New-Item -ItemType Directory -Force -Path "scripts" | Out-Null
      @"
//// Auto-generated by nekro.ps1 — DO NOT EDIT BY HAND (αν δεν ξέρεις τι κάνεις)
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const args = new Map(process.argv.slice(2).map((a)=> {
  const [k,v] = a.startsWith("--") ? a.replace(/^--/,"").split("=") : [a,true];
  return [k,v===undefined?true:v];
}));

const ROOT = args.get("root") || "src";
const DRY = args.has("dry");
const IGNORE_DIRS = new Set(["node_modules",".git","dist","build",".next","out","coverage","storybook-static","cypress","e2e",".turbo",".cache",".expo",".yalc",".pnpm","android","ios"]);
const exts = new Set([".ts",".tsx",".js",".jsx"]);

const changes = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (IGNORE_DIRS.has(name.name)) continue;
      walk(p);
    } else {
      const ext = path.extname(name.name);
      if (exts.has(ext)) files.push(p);
    }
  }
}

function parseKindByExt(file) {
  const ext = path.extname(file);
  if (ext === ".ts") return ts.ScriptKind.TS;
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".jsx") return ts.ScriptKind.TSX;
  return ts.ScriptKind.JS;
}

function removeRanges(text, ranges) {
  if (!ranges.length) return text;
  ranges.sort((a,b)=>a.start-b.start);
  let out = "";
  let last = 0;
  for (const r of ranges) {
    out += text.slice(last, r.start);
    out += " ".repeat(r.end - r.start); // keep offsets
    last = r.end;
  }
  out += text.slice(last);
  return out;
}

function identUsedOutsideImports(textNoImports, ident) {
  const b = "\\b";
  const re = new RegExp(`${b}${ident}${b}`, "g");
  return re.test(textNoImports);
}

function transformFile(file) {
  const sourceText = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, parseKindByExt(file));

  const importNodes = [];
  sf.forEachChild(n => { if (ts.isImportDeclaration(n)) importNodes.push(n); });
  if (importNodes.length === 0) return { changed:false };

  const importRanges = importNodes.map(n=>({start:n.getStart(), end:n.getEnd()}));
  const textNoImports = removeRanges(sourceText, importRanges);

  let changed = false;

  function filterImport(node) {
    // side-effect import => keep
    if (!node.importClause) return node;

    // type-only import => keep, δεν πειράζουμε types
    if (node.importClause.isTypeOnly) return node;

    let keepDefault = false;
    let keepNamespace = false;
    const keepNamed = [];

    const ic = node.importClause;

    if (ic.name) {
      const local = ic.name.getText(sf);
      keepDefault = identUsedOutsideImports(textNoImports, local);
    }

    if (ic.namedBindings) {
      if (ts.isNamespaceImport(ic.namedBindings)) {
        const ns = ic.namedBindings.name.getText(sf);
        keepNamespace = identUsedOutsideImports(textNoImports, ns);
      } else if (ts.isNamedImports(ic.namedBindings)) {
        for (const spec of ic.namedBindings.elements) {
          // TS 5 has spec.isTypeOnly; αν υπάρχει και είναι true, κράτα
          if (spec.isTypeOnly) { keepNamed.push(spec); continue; }
          const local = (spec.name ?? spec.propertyName)?.getText(sf);
          if (!local) { keepNamed.push(spec); continue; }
          if (identUsedOutsideImports(textNoImports, local)) {
            keepNamed.push(spec);
          }
        }
      }
    }

    const nothingLeft = (!keepDefault) &&
      (!keepNamespace) &&
      (keepNamed.length === 0);

    if (nothingLeft) {
      changed = true;
      return undefined; // drop whole import
    }

    // rebuild import clause
    let newIC = ic;
    if (ts.isNamedImports(ic.namedBindings)) {
      const newElems = keepNamed.map(sp => ts.factory.createImportSpecifier(!!sp.isTypeOnly, sp.propertyName ?? undefined, sp.name));
      const nb = ts.factory.createNamedImports(newElems);
      newIC = ts.factory.updateImportClause(ic, ic.isTypeOnly, keepDefault ? ic.name : undefined, keepNamespace ? ic.namedBindings : nb);
    } else if (ts.isNamespaceImport(ic.namedBindings)) {
      newIC = ts.factory.updateImportClause(ic, ic.isTypeOnly, keepDefault ? ic.name : undefined, keepNamespace ? ic.namedBindings : undefined);
    } else {
      newIC = ts.factory.updateImportClause(ic, ic.isTypeOnly, keepDefault ? ic.name : undefined, undefined);
    }

    if (newIC !== ic) changed = true;

    return ts.factory.updateImportDeclaration(
      node,
      node.modifiers,
      newIC,
      node.moduleSpecifier,
      node.assertClause
    );
  }

  const transformer = (ctx) => {
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        const filtered = filterImport(node);
        return filtered ?? undefined;
      }
      return ts.visitEachChild(node, visit, ctx);
    };
    return (node) => ts.visitNode(node, visit);
  };

  const result = ts.transform(sf, [transformer]);
  const transformed = result.transformed[0];
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newText = printer.printFile(transformed);

  if (changed && !DRY && newText !== sourceText) {
    fs.writeFileSync(file, newText, "utf8");
  }
  return { changed, preview: changed ? (file) : null };
}

const files = [];
const rootAbs = path.resolve(process.cwd(), ROOT);
if (!fs.existsSync(rootAbs)) {
  console.error("Root not found:", rootAbs);
  process.exit(1);
}
walk(rootAbs);

let changedCount = 0;
for (const f of files) {
  const res = transformFile(f);
  if (res.changed) {
    changedCount++;
    changes.push({ file: f, changed: true });
  }
}

const summary = { root: ROOT, dry: !!DRY, files: files.length, changed: changedCount, changes };
const out = path.join(process.cwd(), "reports", "deadcode", "codemod-changes.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
"@ | Set-Content -Encoding UTF8 $scriptPath
      Write-Host "✔ Δημιουργήθηκε $scriptPath"
    }

    # Τρέξε codemod (DRY true? μόνο αν ApplySafe ΟΧΙ - εδώ ApplySafe σημαίνει πραγματικές αλλαγές)
    $rootArg = (Test-Path "src") ? "src" : "."
    $dryFlag = ""  # Επειδή ApplySafe = true => εφαρμόζουμε αλλαγές
    node $scriptPath --root="$rootArg" $dryFlag | Tee-Object -FilePath (Join-Path $reportsDir "codemod-log.txt")

    if ($RunPrettier) {
      try { npx --yes prettier --write . | Out-Null; Write-Host "✔ Prettier ok" } catch { Write-Warning "Prettier: $_" }
    }

    if ($RunTypecheck) {
      try { npx --yes tsc --noEmit | Out-Null; Write-Host "✔ Typecheck ok" } catch { Write-Warning "Typecheck: δες τα σφάλματα παραπάνω." }
    }

    if ($RunTests) {
      try {
        if (Get-Command jest -ErrorAction SilentlyContinue -or (Select-String -Path "package.json" -Pattern '"jest"')) {
          npx --yes jest -w
        } elseif (Select-String -Path "package.json" -Pattern '"vitest"') {
          npx --yes vitest run -w
        } else {
          Write-Host "ℹ Tests: δεν βρέθηκε jest/vitest — παράλειψη."
        }
      } catch { Write-Warning "Tests: $_" }
    }

    Write-Host "✔ Safe apply ολοκληρώθηκε. Δες git diff."
  } else {
    Write-Host "ℹ Παραλείφθηκε apply (τρέχεις μόνο report)."
  }

  Write-Host "Τέλος. Δες: $reportsDir και ./deadcode-report.json"
}
finally { Pop-Location }
