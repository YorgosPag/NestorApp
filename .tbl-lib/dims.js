const fs = require('fs');
const path = require('path');
const ids = ['coffee_table_round_01', 'modern_coffee_table_01', 'modern_coffee_table_02', 'side_table_01'];
const ROOT = __dirname;

for (const id of ids) {
  const gltfPath = path.join(ROOT, id, `${id}_1k.gltf`);
  const g = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  // walk meshes → primitives → POSITION accessor min/max
  for (const mesh of g.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const accIdx = prim.attributes && prim.attributes.POSITION;
      if (accIdx == null) continue;
      const acc = g.accessors[accIdx];
      if (!acc.min || !acc.max) continue;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], acc.min[i]);
        max[i] = Math.max(max[i], acc.max[i]);
      }
    }
  }
  const dx = max[0] - min[0];
  const dy = max[1] - min[1]; // Y-up = height
  const dz = max[2] - min[2];
  console.log(
    `${id} | widthMm: ${Math.round(dx * 1000)}, depthMm: ${Math.round(dz * 1000)}, heightMm: ${Math.round(dy * 1000)}`
  );
}
