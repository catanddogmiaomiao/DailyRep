const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const {withXcodeProject, withInfoPlist} = require('expo/config-plugins');
const name = 'DailyRepWidget';
const sharedGroup = config => '$(AppIdentifierPrefix)'+config.ios.bundleIdentifier+'.widgetdata';
function mergeEntitlements(file, shared) {
  const result=fs.existsSync(file)?plist.parse(fs.readFileSync(file,'utf8')):{};
  const groups=result['keychain-access-groups']||['$(AppIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)'];
  result['keychain-access-groups']=[...new Set([...groups,shared])];
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,plist.build(result));
}

function installWidget(project, config, iosRoot, projectRoot) {
  const shared=sharedGroup(config);
  const dest=path.join(iosRoot,name);fs.mkdirSync(dest,{recursive:true});
  fs.copyFileSync(path.join(projectRoot,'native/widget/DailyRepWidget.swift'),path.join(dest,'DailyRepWidget.swift'));
  const helper=fs.readFileSync(path.join(projectRoot,'modules/dailyrep-native/ios/DailyRepModule.swift'),'utf8').split('// WIDGET_SNAPSHOT_STORE\n')[1];
  if(!helper)throw new Error('Widget shared snapshot store is missing');
  fs.writeFileSync(path.join(dest,'WidgetSnapshotStore.swift'),helper);
  mergeEntitlements(path.join(dest,name+'.entitlements'),shared);
  const api=(process.env.EXPO_PUBLIC_API_URL || 'https://dailyrep.catanddogmiaomiao.workers.dev').replace(/\/$/,'');
  const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  fs.writeFileSync(path.join(dest,name+'-Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>$(PRODUCT_NAME)</string><key>CFBundleInfoDictionaryVersion</key><string>6.0</string><key>CFBundleDisplayName</key><string>健身坚持</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundlePackageType</key><string>XPC!</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>DailyRepWidgetKeychainGroup</key><string>${shared}</string><key>DailyRepAPIURL</key><string>${escape(api)}</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict></dict></plist>`);
  let target = Object.entries(project.pbxNativeTargetSection()).find(([id,t])=>!id.endsWith('_comment') && t.name?.replace(/"/g,'')===name);
  const parent=project.getFirstTarget();
  const configs=project.pbxXCBuildConfigurationSection();
  const parentList=project.pbxXCConfigurationList()[parent.firstTarget.buildConfigurationList];
  const settings=configs[parentList.buildConfigurations[0].value].buildSettings;
  for(const entry of parentList.buildConfigurations) {
    const appSettings=configs[entry.value].buildSettings;
    const entitlement=(appSettings.CODE_SIGN_ENTITLEMENTS||'dailyRep/dailyRep.entitlements').replace(/"/g,'');
    mergeEntitlements(path.join(iosRoot,entitlement),shared);
    appSettings.CODE_SIGN_ENTITLEMENTS='"'+entitlement+'"';
    const info=(appSettings.INFOPLIST_FILE||'dailyRep/Info.plist').replace(/"/g,'');
    const infoPath=path.join(iosRoot,info);
    if(fs.existsSync(infoPath)) {const data=plist.parse(fs.readFileSync(infoPath,'utf8'));data.DailyRepWidgetKeychainGroup=shared;fs.writeFileSync(infoPath,plist.build(data));}
  }
  if(!target) {
    const created=project.addTarget(name,'app_extension',name,config.ios.bundleIdentifier+'.widget');
    target=[created.uuid,created.pbxNativeTarget];
    project.addBuildPhase([],'PBXSourcesBuildPhase','Sources',created.uuid);
    project.addBuildPhase([],'PBXFrameworksBuildPhase','Frameworks',created.uuid);
    const group=project.addPbxGroup([],name,name);
    project.addToPbxGroup({fileRef:group.uuid,basename:name},project.getFirstProject().firstProject.mainGroup);
    project.addSourceFile('DailyRepWidget.swift',{target:created.uuid},group.uuid);
  }
  const widgetGroup=Object.entries(project.hash.project.objects.PBXGroup).find(([id,g])=>!id.endsWith('_comment')&&g.name?.replace(/"/g,'')===name);
  const sources=Object.values(project.pbxFileReferenceSection()).some(f=>typeof f==='object'&&f.path?.replace(/"/g,'')==='WidgetSnapshotStore.swift');
  if(widgetGroup&&!sources)project.addSourceFile('WidgetSnapshotStore.swift',{target:target[0]},widgetGroup[0]);
  const list=project.pbxXCConfigurationList()[target[1].buildConfigurationList];
  for(const entry of list.buildConfigurations) {
    Object.assign(configs[entry.value].buildSettings,{
      IPHONEOS_DEPLOYMENT_TARGET:'17.0',SWIFT_VERSION:'5.9',APPLICATION_EXTENSION_API_ONLY:'YES',
      CODE_SIGN_ENTITLEMENTS:'"'+name+'/'+name+'.entitlements"',
      TARGETED_DEVICE_FAMILY:'1',CODE_SIGN_STYLE:'Automatic',SKIP_INSTALL:'YES',
      PRODUCT_BUNDLE_IDENTIFIER:'"'+config.ios.bundleIdentifier+'.widget"',
      INFOPLIST_FILE:'"'+name+'/'+name+'-Info.plist"',GENERATE_INFOPLIST_FILE:'NO',
      MARKETING_VERSION:settings.MARKETING_VERSION||'1.0.0',CURRENT_PROJECT_VERSION:settings.CURRENT_PROJECT_VERSION||'1',
      ...(settings.DEVELOPMENT_TEAM?{DEVELOPMENT_TEAM:settings.DEVELOPMENT_TEAM}:{}),
    });
  }
  return project;
}
module.exports=config=>{
  config=withInfoPlist(config,mod=>{
    mod.modResults.DailyRepWidgetKeychainGroup=sharedGroup(config);
    const schemes=mod.modResults.CFBundleURLTypes||[];
    if(!schemes.some(s=>s.CFBundleURLSchemes?.includes('dailyrep')))schemes.push({CFBundleURLSchemes:['dailyrep']});
    mod.modResults.CFBundleURLTypes=schemes;return mod;
  });
  return withXcodeProject(config,mod=>{installWidget(mod.modResults,config,mod.modRequest.platformProjectRoot,mod.modRequest.projectRoot);return mod;});
};
module.exports.installWidget=installWidget;
