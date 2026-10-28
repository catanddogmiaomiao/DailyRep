Pod::Spec.new do |s|
  s.name = 'DailyRepNative'
  s.version = '1.0.0'
  s.summary = 'Local training notifications and WidgetKit refresh'
  s.description = s.summary
  s.license = 'MIT'
  s.author = 'dailyRep'
  s.homepage = 'https://github.com/catanddogmiaomiao/dailyRep'
  s.platform = :ios, '15.1'
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UserNotifications', 'WidgetKit', 'UIKit'
  s.source_files = '**/*.swift'
end
