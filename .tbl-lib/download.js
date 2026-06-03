const fs = require('fs');
const path = require('path');

const ids = ['coffee_table_round_01', 'modern_coffee_table_01', 'modern_coffee_table_02', 'side_table_01'];
const ROOT = __dirname;

async function dl(url, dest) {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

(async () => {
  for (const id of ids) {
    const f = await fetch('https://api.polyhaven.com/files/' + id).then((r) => r.json());
    const g = f.gltf['1k'].gltf;
    const dir = path.join(ROOT, id);
    fs.mkdirSync(dir, { recursive: true });
    const mainName = path.basename(new URL(g.url).pathname);
    await dl(g.url, path.join(dir, mainName));
    // includes: keyed by relative path (e.g. textures/foo.jpg or foo.bin)
    for (const [rel, info] of Object.entries(g.include || {})) {
      await dl(info.url, path.join(dir, rel));
    }
    console.log('downloaded', id, '→', mainName, '+', Object.keys(g.include || {}).length, 'files');
  }
})();
