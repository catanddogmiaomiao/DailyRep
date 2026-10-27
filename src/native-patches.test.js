import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const {preparePatch} = createRequire(import.meta.url)('../scripts/apply-native-patches.cjs');
const {patchPodfile, patchProject} = createRequire(import.meta.url)('../plugins/withIosCompatibility.cjs');
const hash = text => createHash('sha256').update(text).digest('hex');
test('native corrections are idempotent and reject changed upstream code',()=>{
  const p = {path:'fixture', beforeSha256:hash('old old'),afterSha256:hash('new new'),replacements:[{before:'old',after:'new',count:2}]};
  assert.equal(preparePatch('old old',p),'new new');
  assert.equal(preparePatch('new new',p),'new new');
  assert.throws(()=>preparePatch('upstream changed',p),/needs review/);
  assert.throws(()=>preparePatch('old old',{...p,replacements:[{before:'old',after:'new',count:1}]}),/context mismatch/);
});

test('native compatibility configuration preserves hooks and signing settings',()=>{
  const fixture = "target 'dailyRep' do\n  post_install do |installer|\n    existing_hook\n  end\nend\n";
  const result = patchPodfile(fixture);
  assert.match(result, /existing_hook/);
  assert.match(result, /pod 'libwebp', '1.6.0'/);
  assert.match(result, /apply-native-patches.cjs/);
  assert.equal(patchPodfile(result), result);
  assert.throws(()=>patchPodfile('invalid'), /Cannot locate/);
  const configs={a:{buildSettings:{DEVELOPMENT_TEAM:'preserved'}},a_comment:'Debug'};
  patchProject({pbxXCBuildConfigurationSection:()=>configs});
  assert.equal(configs.a.buildSettings.DEVELOPMENT_TEAM,'preserved');
  assert.match(configs.a.buildSettings.HERMES_GLOBALS_FILE,/hermes-globals.js/);
});
