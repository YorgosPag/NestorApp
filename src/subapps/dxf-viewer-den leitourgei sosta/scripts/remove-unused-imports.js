// remove-unused-imports.js
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

function walk(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (IGNORE_DIRS.has(name.name)) continue;
      walk(p, out);
    } else {
      const ext = path.extname(name.name);
      if (exts.has(ext)) out.push(p);
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
    out += " ".repeat(r.end - r.start);
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
    if (!node.importClause) return node; // side-effect imports: keep
    if (node.importClause.isTypeOnly) return node; // don't touch type-only

    const ic = node.importClause;

    let keepDefault = false;
    let keepNamespace = false;
    const keepNamed = [];

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
          if (spec.isTypeOnly) { keepNamed.push(spec); continue; }
          const local = (spec.name ?? spec.propertyName)?.getText(sf);
          if (!local) { keepNamed.push(spec); continue; }
          if (identUsedOutsideImports(textNoImports, local)) {
            keepNamed.push(spec);
          }
        }
      }
    }

    const nothingLeft = (!keepDefault) && (!keepNamespace) && (keepNamed.length === 0);
    if (nothingLeft) { changed = true; return undefined; }

    // Rebuild
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
    const visit = (node) => ts.isImportDeclaration(node) ? (filterImport(node) ?? undefined) : ts.visitEachChild(node, visit, ctx);
    return (node) => ts.visitNode(node, visit);
  };

  const result = ts.transform(sf, [transformer]);
  const transformed = result.transformed[0];
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const newText = printer.printFile(transformed);

  if (changed && !DRY && newText !== sourceText) {
    fs.writeFileSync(file, newText, "utf8");
  }
  return { changed };
}

const files = [];
const rootAbs = path.resolve(process.cwd(), ROOT);
if (!fs.existsSync(rootAbs)) { console.error("Root not found:", rootAbs); process.exit(1); }
walk(rootAbs, files);

let changedCount = 0;
for (const f of files) {
  const res = transformFile(f);
  if (res.changed) changedCount++;
}

const summary = { root: ROOT, dry: !!DRY, files: files.length, changed: changedCount };
const out = path.join(process.cwd(), "reports", "deadcode", "codemod-changes.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(summary, null, 2));