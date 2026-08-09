'use strict';

/**
 * Το ύφος του φύλλου διαλογής (ADR-775 §15).
 *
 * ⚠️ Ουδέτερο γκρι πλαίσιο γύρω από κάθε εικόνα, **επίτηδες**: ο καμβάς DXF είναι μαύρος και σε
 * μαύρη σελίδα δεν φαίνεται πού τελειώνει — ένα κενό golden θα έμοιαζε με «σωστό μαύρο».
 * Η ακμή είναι μέρος της πληροφορίας που κρίνει ο άνθρωπος.
 */
const SHEET_CSS = `
:root { color-scheme: dark; --bg:#0f1115; --panel:#171a21; --line:#2a2f3a; --ink:#e6e9ef;
        --dim:#98a2b3; --yes:#22c55e; --no:#ef4444; --warn:#f59e0b; --accent:#60a5fa; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink);
       font:14px/1.5 "Segoe UI", system-ui, sans-serif; }
header { position:sticky; top:0; z-index:10; background:var(--panel);
         border-bottom:1px solid var(--line); padding:10px 16px;
         display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
h1 { font-size:15px; margin:0; font-weight:600; }
.tabs { display:flex; gap:6px; }
.tab { background:transparent; color:var(--dim); border:1px solid var(--line);
       border-radius:6px; padding:5px 12px; cursor:pointer; font-size:13px; }
.tab[aria-selected="true"] { background:var(--accent); color:#0b1220; border-color:var(--accent);
                             font-weight:600; }
.counts { margin-left:auto; display:flex; gap:14px; font-size:13px; color:var(--dim); }
.counts b { color:var(--ink); }
.pill { padding:2px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }
.pill.yes { color:var(--yes); border-color:var(--yes); }
.pill.no  { color:var(--no);  border-color:var(--no); }
.pill.warn{ color:var(--warn);border-color:var(--warn); }
button.act { border:0; border-radius:8px; padding:10px 18px; font-size:15px; font-weight:600;
             cursor:pointer; }
button.yes { background:var(--yes); color:#052e16; }
button.no  { background:var(--no);  color:#450a0a; }
button.skip{ background:#334155; color:var(--ink); }
main { padding:16px; }
.hidden { display:none !important; }

/* ---- Επισκόπηση ---- */
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:12px; }
.cell { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:8px;
        cursor:pointer; }
.cell[data-decision="yes"] { border-color:var(--yes); }
.cell[data-decision="no"]  { border-color:var(--no); }
.cell img { width:100%; display:block; background:#000; border:1px solid var(--line);
            border-radius:4px; }
.cell .name { font-size:12px; margin-top:6px; display:flex; justify-content:space-between;
              gap:6px; align-items:center; }
.cell .name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* ---- Έγκριση μία-μία ---- */
.one { max-width:1400px; margin:0 auto; }
.title { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:4px; }
.title h2 { font-size:20px; margin:0; }
.title .sub { color:var(--dim); font-size:13px; }
.frames { display:grid; grid-template-columns:3fr 1fr; gap:14px; align-items:start; }
figure { margin:0; background:var(--panel); border:1px solid var(--line); border-radius:8px;
         padding:8px; }
figcaption { font-size:12px; color:var(--dim); margin-bottom:6px; display:flex;
             justify-content:space-between; gap:8px; }
figure img { width:100%; display:block; background:#000; border:1px solid var(--line);
             border-radius:4px; }
.facts { margin-top:10px; font-size:12px; color:var(--dim); display:flex; gap:14px;
         flex-wrap:wrap; }
.facts code { color:var(--ink); }
.alerts { margin-top:10px; display:flex; flex-direction:column; gap:6px; }
.alert { border-left:3px solid var(--warn); background:#1e1b12; padding:8px 10px;
         font-size:13px; border-radius:0 6px 6px 0; }
.alert.bad { border-color:var(--no); background:#1f1315; }
.bar { position:sticky; bottom:0; background:var(--panel); border-top:1px solid var(--line);
       margin-top:16px; padding:12px 16px; display:flex; gap:12px; align-items:center;
       flex-wrap:wrap; }
.bar .nav { margin-left:auto; display:flex; gap:8px; align-items:center; color:var(--dim);
            font-size:12px; }
kbd { background:#0b0e13; border:1px solid var(--line); border-radius:4px; padding:1px 6px;
      font-size:11px; }
.done { text-align:center; padding:40px 16px; }
.done h2 { font-size:22px; }
`;

module.exports = { SHEET_CSS };
