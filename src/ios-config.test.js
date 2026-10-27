import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {patchPodfile} = createRequire(import.meta.url)('../plugins/withIosMinimumTarget.cjs');
test('native configuration preserves RN post-install and patches old resource targets once',()=>{
  const fixture="target 'dailyRep' do\n  post_install do |installer|\n    react_native_post_install(\n      installer,\n      config[:reactNativePath],\n    )\n  end\nend\n";
  const result=patchPodfile(fixture);
  assert.match(result,/react_native_post_install/);
  assert.match(result,/installer.pods_project.targets.each/);
  assert.match(result,/IPHONEOS_DEPLOYMENT_TARGET.*15.1/);
  assert.equal(patchPodfile(result),result);
  assert.throws(()=>patchPodfile('unexpected template'),/Cannot find/);
});

// Icon rendering loads this native module before the first screen mounts.
test('icon library and Expo resolve one SDK-compatible native font module',()=>{
  const require = createRequire(import.meta.url);
  const manifest = require('../package.json');
  const expected = require('expo/bundledNativeModules.json')['expo-font'];
  assert.equal(manifest.dependencies['expo-font'], expected);
  const fontPath = require.resolve('expo-font/package.json');
  const fromIcons = createRequire(require.resolve('@expo/vector-icons/package.json'));
  const fromExpo = createRequire(require.resolve('expo/package.json'));
  assert.equal(fromIcons.resolve('expo-font/package.json'), fontPath);
  assert.equal(fromExpo.resolve('expo-font/package.json'), fontPath);
  assert.equal(require(fontPath).version.split('.')[0], expected.match(/\d+/)[0]);
});

test('photo conversion native modules are explicit SDK-compatible dependencies',()=>{
  const require = createRequire(import.meta.url);
  const manifest = require('../package.json');
  const versions = require('expo/bundledNativeModules.json');
  const fromExpo = createRequire(require.resolve('expo/package.json'));
  for (const name of ['expo-image-manipulator', 'expo-file-system']) {
    assert.equal(manifest.dependencies[name], versions[name]);
    assert.equal(fromExpo.resolve(name + '/package.json'), require.resolve(name + '/package.json'));
  }
});
