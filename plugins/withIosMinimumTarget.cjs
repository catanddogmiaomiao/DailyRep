const { withPodfile } = require('expo/config-plugins');
const marker = '# dailyRep: align older Pod resource bundles with the supported iOS target';
function patchPodfile(contents) {
  if (contents.includes(marker)) return contents;
  const hook = /(react_native_post_install\([\s\S]*?\n\s*\))(\n\s*end)/;
  if (!hook.test(contents)) throw new Error('Cannot find React Native post-install hook for iOS target configuration');
  const patch = `\n\n    ${marker}
    installer.pods_project.targets.each do |pod_target|
      pod_target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || (Gem::Version.correct?(current.to_s) && Gem::Version.new(current.to_s) < Gem::Version.new('15.1'))
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end`;
  return contents.replace(hook, (_, call, ending) => call + patch + ending);
}
module.exports = config => withPodfile(config, mod => {
  mod.modResults.contents = patchPodfile(mod.modResults.contents);
  return mod;
});
module.exports.patchPodfile = patchPodfile;
