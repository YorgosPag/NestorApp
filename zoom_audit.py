#!/usr/bin/env python3
"""
zoom_audit.py — Εντοπίζει και χαρτογραφεί όλα τα «συστήματα zoom» σε ένα TypeScript/React repo
και εντοπίζει πιθανά διπλότυπα (handlers, constants, APIs).

Χρήση:
  python zoom_audit.py /path/to/repo > zoom_audit_report.json
  # ή για ανθρώπινο output:
  python zoom_audit.py /path/to/repo --text > zoom_audit_report.txt
"""
import sys, re, json
from pathlib import Path
from collections import defaultdict, Counter

ZOOM_CONST_NAMES = ["ZOOM_FACTOR","MIN_SCALE","MAX_SCALE",
                    "DEFAULT_ZOOM_CONFIG","zoomStep","zoomInFactor","zoomOutFactor",
                    "wheelZoomSpeed","keyboardZoomSpeed"]

FUNC_NAMES = [
    "zoom","zoomIn","zoomOut","zoomAt","zoomAtScreenPoint","setZoom",
    "fitToView","resetZoom","activateZoomWindow","deactivateZoomWindow"
]

TERMS = [
    "getTransform","setTransform","ViewTransform","screenToWorld","worldToScreen",
    "wheel","pinch","gesture","devicePixelRatio","viewport","viewBox","scale","offset"
]

WHEEL_PATTERNS = [
    r'(?:const|let|var)\s+(handleWheel)\s*[:=]',
    r'addEventListener\s*\(\s*[\'"]wheel[\'"]'
]

def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return ""

def find_defs(pattern, text):
    return [m for m in re.finditer(pattern, text, re.MULTILINE)]

def scan_repo(root: Path):
    report = {
        "files": [],
        "summary": {},
        "duplicates": {
            "wheel_handlers": [],
            "constants": [],
            "api_names": [],
        }
    }
    files = [p for p in root.rglob('*') if p.suffix in ('.ts','.tsx','.js')]
    const_defs = []
    wheel_handlers = []
    api_defs = defaultdict(list)  # fn name -> [file,...]

    for p in files:
        rel=str(p.relative_to(root))
        text = read_text(p)
        if not text:
            continue
        entry = {
            "path": rel,
            "imports": re.findall(r"import\s+.*from\s+['\"]([^'\"]+)['\"]", text),
            "const_defs": [],
            "const_uses": {},
            "func_defs": [],
            "func_uses": {},
            "wheel_handlers": [],
            "has_transform_terms": False,
        }

        # constants (definitions + uses)
        for name in ZOOM_CONST_NAMES:
            for m in find_defs(rf'\bconst\s+{re.escape(name)}\s*=', text):
                entry["const_defs"].append(name)
                const_defs.append((name, rel))
            uses = len(find_defs(rf'\b{re.escape(name)}\b', text))
            if uses:
                entry["const_uses"][name]=uses

        # function names — defs και uses
        for fn in FUNC_NAMES:
            pat = rf'(?:export\s+)?function\s+{fn}\s*\(|(?:const|let|var)\s+{fn}\s*=\s*(?:async\s*)?\('
            if find_defs(pat, text):
                entry["func_defs"].append(fn)
                api_defs[fn].append(rel)
            uses = len(find_defs(rf'\b{fn}\b', text))
            if uses:
                entry["func_uses"][fn]=uses

        # wheel handlers
        for pat in WHEEL_PATTERNS:
            if find_defs(pat, text):
                entry["wheel_handlers"].append("wheel")

        # transform-related terms
        if any(find_defs(rf'\b{t}\b', text) for t in ["getTransform","setTransform","screenToWorld","worldToScreen","ViewTransform"]):
            entry["has_transform_terms"]=True

        if entry["const_defs"] or entry["func_defs"] or entry["wheel_handlers"] or entry["has_transform_terms"] or any(entry["const_uses"].values()) or any(entry["func_uses"].values()):
            report["files"].append(entry)

    # duplicates
    wheel_files = [f["path"] for f in report["files"] if f["wheel_handlers"]]
    if len(wheel_files) > 1:
        report["duplicates"]["wheel_handlers"] = wheel_files

    c_counter = Counter(name for name, _ in const_defs)
    report["summary"]["constant_definitions"]= {k:v for k,v in c_counter.items()}
    report["duplicates"]["constants"] = [
        {"name": name, "files":[rel for n, rel in const_defs if n==name]}
        for name,count in c_counter.items() if count>1
    ]

    report["duplicates"]["api_names"] = [
        {"name": fn, "files": files}
        for fn, files in api_defs.items()
        if len(files) > 1
    ]

    # buckets
    buckets = defaultdict(list)
    for f in report["files"]:
        path = f["path"]
        if path.startswith("canvas/engine/"):
            buckets["engine"].append(path)
        elif path.startswith("canvas/hooks/"):
            buckets["canvas_hooks"].append(path)
        elif path.startswith("systems/zoom/"):
            buckets["zoom_system"].append(path)
        elif "ZoomWindow" in path or "useZoomWindow" in path or path.endswith("useZoomWindow.ts"):
            buckets["zoom_window"].append(path)
        elif path.startswith("systems/interaction/"):
            buckets["interaction_engine"].append(path)
        elif path.startswith("ui/"):
            buckets["ui"].append(path)
        elif path.startswith("canvas/components/"):
            buckets["canvas_components"].append(path)
        else:
            buckets["other"].append(path)
    report["summary"]["buckets"]=buckets

    return report

def as_text(report):
    lines=[]
    lines.append("# Zoom Audit Report (text)")
    lines.append("## Buckets")
    for b, lst in report["summary"]["buckets"].items():
        lines.append(f"- {b}: {len(lst)} file(s)")
        for p in sorted(lst):
            lines.append(f"  • {p}")
    lines.append("\n## Duplicates")
    if report["duplicates"]["wheel_handlers"]:
        lines.append(f"- Wheel handlers in multiple places: {', '.join(report['duplicates']['wheel_handlers'])}")
    else:
        lines.append("- Wheel handlers: single source ✅")
    if report["duplicates"]["constants"]:
        lines.append("- Duplicate constant definitions:")
        for d in report["duplicates"]["constants"]:
            lines.append(f"  • {d['name']}: {', '.join(d['files'])}")
    else:
        lines.append("- Duplicate constant definitions: none ✅")
    if report["duplicates"]["api_names"]:
        lines.append("- Zoom API names defined across multiple modules:")
        for d in report["duplicates"]["api_names"]:
            lines.append(f"  • {d['name']}: {', '.join(sorted(set(d['files'])))}")
    else:
        lines.append("- Zoom API names: unique ✅")
    return "\n".join(lines)

def main():
    if len(sys.argv) < 2:
        print("Usage: python zoom_audit.py <repo_root> [--text]", file=sys.stderr)
        sys.exit(1)
    root = Path(sys.argv[1])
    text_mode = "--text" in sys.argv
    report = scan_repo(root)
    if text_mode:
        print(as_text(report))
    else:
        print(json.dumps(report, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()