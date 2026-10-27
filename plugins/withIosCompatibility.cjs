const {withPodfile, withXcodeProject} = require('expo/config-plugins');
const marker = '# dailyRep: reviewed native compatibility corrections';
const pins = '# dailyRep: pin reviewed image codec sources';
function patchPodfile(contents) {
  if (!contents.includes(pins)) {
    const target = /(target '[^']+' do\n)/;
    if (!target.test(contents)) throw new Error('Cannot locate application Pod target');
    contents = contents.replace(target, `$1    ${pins}
    pod 'SDWebImage', '5.21.7'
    pod 'SDWebImageWebPCoder', '0.15.0'
    pod 'libwebp', '1.6.0'
`);
  }
  if (contents.includes(marker)) return contents;
  const hook = '  post_install do |installer|';
  if (!contents.includes(hook)) throw new Error('Cannot locate Pod post-install hook');
  return contents.replace(hook, `${hook}
    ${marker}
    unless system('node', File.join(__dir__, '..', 'scripts', 'apply-native-patches.cjs'), '--pods')
      raise 'Native compatibility patches need review'
    end
    installer.pods_project.targets.each do |pod_target|
      next unless pod_target.name == 'hermes-engine'
      pod_target.shell_script_build_phases.each do |phase|
        if phase.name.to_s.include?('Replace Hermes')
          phase.always_out_of_date = '1'
        end
      end
    end
`);
}
function patchProject(project) {
  for (const config of Object.values(project.pbxXCBuildConfigurationSection())) {
    if (config && typeof config === 'object' && config.buildSettings) {
      config.buildSettings.HERMES_GLOBALS_FILE = '"$(SRCROOT)/../config/hermes-globals.js"';
    }
  }
  return project;
}
module.exports = config => {
  config = withPodfile(config, mod => {mod.modResults.contents = patchPodfile(mod.modResults.contents); return mod;});
  return withXcodeProject(config, mod => {patchProject(mod.modResults); return mod;});
};
module.exports.patchPodfile = patchPodfile;
module.exports.patchProject = patchProject;
