import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const xcode=require('xcode');
const plist=require('@expo/plist').default;
const {installWidget}=require('../plugins/withDailyRepWidget.cjs');
test('widget generation is idempotent, preserves application signing and shares only widget snapshots without changing login keychain defaults',()=>{
  const project=xcode.project(path.resolve('src/fixtures/app-project.pbxproj'));
  project.parseSync();
  const mainConfigs=Object.fromEntries(Object.entries(project.pbxXCBuildConfigurationSection()).map(([id,value])=>[id,JSON.stringify(value)]));
  const initial=JSON.stringify(project.pbxXCBuildConfigurationSection());
  const dir=mkdtempSync(path.join(tmpdir(),'dailyrep-widget-config-'));
  try {
    mkdirSync(path.join(dir,'ios/dailyRep'),{recursive:true});
    writeFileSync(path.join(dir,'ios/dailyRep/Info.plist'),plist.build({CFBundleName:'dailyRep'}));
    const config={ios:{bundleIdentifier:'com.catanddogmiaomiao.dailyrep'}};
    installWidget(project,config,path.join(dir,'ios'),path.resolve('.'));
    const metadata=plist.parse(readFileSync(path.join(dir,'ios/DailyRepWidget/DailyRepWidget-Info.plist'),'utf8'));
    for(const key of ['CFBundleName','CFBundleIdentifier','CFBundleExecutable','CFBundlePackageType','CFBundleShortVersionString','CFBundleVersion']) {
      assert.equal(typeof metadata[key],'string',`${key} must be present for device installation`);
      assert.ok(metadata[key].trim().length,`${key} must be nonempty`);
    }
    assert.equal(metadata.CFBundlePackageType,'XPC!');
    const shared='$(AppIdentifierPrefix)com.catanddogmiaomiao.dailyrep.widgetdata';
    assert.equal(metadata.DailyRepWidgetKeychainGroup,shared);
    for(const file of ['dailyRep/dailyRep.entitlements','DailyRepWidget/DailyRepWidget.entitlements']) {
      const entitlements=plist.parse(readFileSync(path.join(dir,'ios',file),'utf8'));
      assert.deepEqual(entitlements['keychain-access-groups'],['$(AppIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)',shared]);
    }
    assert.equal(plist.parse(readFileSync(path.join(dir,'ios/dailyRep/Info.plist'),'utf8')).DailyRepWidgetKeychainGroup,shared);
    assert.equal(metadata.NSExtension.NSExtensionPointIdentifier,'com.apple.widgetkit-extension');
    const once=project.writeSync();
    installWidget(project,config,path.join(dir,'ios'),path.resolve('.'));
    assert.equal(project.writeSync(),once);
    const targets=Object.entries(project.pbxNativeTargetSection()).filter(([key,value])=>!key.endsWith('_comment')&&value.name?.replaceAll('"','')==='DailyRepWidget');
    assert.equal(targets.length,1);
    assert.equal(project.pbxXCBuildConfigurationSection()[project.pbxXCConfigurationList()[targets[0][1].buildConfigurationList].buildConfigurations[0].value].buildSettings.IPHONEOS_DEPLOYMENT_TARGET,'17.0');
    assert.match(initial,/FIXTURETEAM/);
    for(const [id,source] of Object.entries(mainConfigs)) {
      const updated=JSON.parse(JSON.stringify(project.pbxXCBuildConfigurationSection()[id]));
      delete updated.buildSettings?.CODE_SIGN_ENTITLEMENTS;
      assert.equal(JSON.stringify(updated),source);
    }
    assert.doesNotMatch(once,/com\.apple\.security\.application-groups/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
