const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const digest = text => createHash('sha256').update(text).digest('hex');
function preparePatch(source, patch) {
  if (digest(source) === patch.afterSha256) return source;
  if (digest(source) !== patch.beforeSha256) throw new Error(`Native patch needs review after dependency change: ${patch.path}`);
  let result = source;
  for (const edit of patch.replacements) {
    if (result.split(edit.before).length - 1 !== edit.count) throw new Error(`Native patch context mismatch: ${patch.path}`);
    result = result.split(edit.before).join(edit.after);
  }
  if (digest(result) !== patch.afterSha256) throw new Error(`Native patch checksum mismatch: ${patch.path}`);
  return result;
}
function applyPatches(includePods = false) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'patches/native-compat.json'), 'utf8'));
  // Validate the entire batch before changing any files.
  const plans = manifest.files.filter(p => includePods || !p.path.startsWith('ios/Pods/')).map(p => {
    const file = path.resolve(root, p.path);
    if (!file.startsWith(root + path.sep)) throw new Error('Patch outside project');
    const source = fs.readFileSync(file, 'utf8');
    return {file, source, result: preparePatch(source, p)};
  });
  let changed = 0;
  for (const plan of plans) {
    if (plan.source === plan.result) continue;
    const mode = fs.statSync(plan.file).mode;
    fs.chmodSync(plan.file, mode | 0o200);
    try { fs.writeFileSync(plan.file, plan.result); } finally {fs.chmodSync(plan.file, mode);}
    changed++;
  }
  console.log(`Native compatibility: ${changed} patched, ${plans.length - changed} already current`);
}
if (require.main === module) applyPatches(process.argv.includes('--pods'));
module.exports = {preparePatch, applyPatches};
