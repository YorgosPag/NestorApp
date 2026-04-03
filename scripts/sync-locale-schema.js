#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getLocaleFiles, readJson } = require('./_shared/i18n-governance');

function syncNode(referenceNode, targetNode) {
  if (Array.isArray(referenceNode)) {
    if (!Array.isArray(targetNode)) {
      return referenceNode;
    }

    const next = referenceNode.map((item, index) => syncNode(item, targetNode[index]));
    return next;
  }

  if (referenceNode !== null && typeof referenceNode === 'object') {
    const targetObject = targetNode && typeof targetNode === 'object' && !Array.isArray(targetNode)
      ? targetNode
      : {};

    return Object.fromEntries(
      Object.entries(referenceNode).map(([key, value]) => [key, syncNode(value, targetObject[key])])
    );
  }

  return targetNode === undefined ? referenceNode : targetNode;
}

function main() {
  const sourceLocale = process.argv[2] ?? 'el';
  const targetLocale = process.argv[3] ?? 'en';
  const root = process.cwd();
  const sourceDir = path.join(root, 'src', 'i18n', 'locales', sourceLocale);
  const targetDir = path.join(root, 'src', 'i18n', 'locales', targetLocale);

  if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
    console.error('Both source and target locale directories must exist.');
    process.exit(1);
  }

  for (const fileName of getLocaleFiles(sourceLocale)) {
    const sourcePath = path.join(sourceDir, fileName);
    const targetPath = path.join(targetDir, fileName);
    const sourceData = readJson(sourcePath);
    const targetData = fs.existsSync(targetPath) ? readJson(targetPath) : {};
    const synced = syncNode(sourceData, targetData);
    fs.writeFileSync(targetPath, `${JSON.stringify(synced, null, 2)}\n`, 'utf8');
    console.log(`synced ${targetLocale}/${fileName}`);
  }
}

main();
