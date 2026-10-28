const fs = require('node:fs');
const path = require('node:path');
const {withXcodeProject, withInfoPlist} = require('expo/config-plugins');
const name = 'DailyRepWidget';
function installWidget(project, config, iosRoot, projectRoot) {
  const dest=path.join(iosRoot,name);fs.mkdirSync(dest,{recursive:true});
  fs.copyFileSync(path.join(projectRoot,'native/widget/DailyRepWidget.swift'),path.join(dest,'DailyRepWidget.swift'));
  const api=(process.env.EXPO_PUBLIC_API_URL || 'https://dailyrep.catanddogmiaomiao.workers.dev').replace(/\/$/,'');
  const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  fs.writeFileSync(path.join(dest,name+'-Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleDisplayName</key><string>健身坚持</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundlePackageType</key><string>XPC!</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>DailyRepAPIURL</key><string>${escape(api)}</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict></dict></plist>`);
  let target = Object.entries(project.pbxNativeTargetSection()).find(([id,t])=>!id.endsWith('_comment') && t.name?.replace(/"/g,'')===name);
  const parent=project.getFirstTarget();
  const configs=project.pbxXCBuildConfigurationSection();
  const parentList=project.pbxXCConfigurationList()[parent.firstTarget.buildConfigurationList];
  const settings=configs[parentList.buildConfigurations[0].value].buildSettings;
  if(!target) {
    const created=project.addTarget(name,'app_extension',name,config.ios.bundleIdentifier+'.widget');
    target=[created.uuid,created.pbxNativeTarget];
    project.addBuildPhase([],'PBXSourcesBuildPhase','Sources',created.uuid);
    project.addBuildPhase([],'PBXFrameworksBuildPhase','Frameworks',created.uuid);
    const group=project.addPbxGroup([],name,name);
    project.addToPbxGroup({fileRef:group.uuid,basename:name},project.getFirstProject().firstProject.mainGroup);
    project.addSourceFile('DailyRepWidget.swift',{target:created.uuid},group.uuid);
  }
  const list=project.pbxXCConfigurationList()[target[1].buildConfigurationList];
  for(const entry of list.buildConfigurations) {
    Object.assign(configs[entry.value].buildSettings,{
      IPHONEOS_DEPLOYMENT_TARGET:'17.0',SWIFT_VERSION:'5.9',APPLICATION_EXTENSION_API_ONLY:'YES',
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
    const schemes=mod.modResults.CFBundleURLTypes||[];
    if(!schemes.some(s=>s.CFBundleURLSchemes?.includes('dailyrep')))schemes.push({CFBundleURLSchemes:['dailyrep']});
    mod.modResults.CFBundleURLTypes=schemes;return mod;
  });
  return withXcodeProject(config,mod=>{installWidget(mod.modResults,config,mod.modRequest.platformProjectRoot,mod.modRequest.projectRoot);return mod;});
};
module.exports.installWidget=installWidget;
