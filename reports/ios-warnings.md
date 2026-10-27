# iPhone 编译警告核对

统计的是含源文件位置的诊断；空目标文件的归档警告另列。没有关闭全局编译警告。

| 项目 | 用户提供记录 | 最终完整构建 |
| --- | ---: | ---: |
| 带位置的警告 | 110 | 75 |
| 按文件、行号与正文去重 | 108 | 73 |
| 空目标文件归档提示 | 21 | 21 |

## 剩余警告分类

| 警告正文 | 次数 |
| --- | ---: |
| method possibly missing a [super updateProps:oldProps:] call | 27 |
| 'referenceURL' was deprecated in iOS 11.0: Will be removed in a future release, use PHPicker. | 4 |
| 'fetchAssets(withALAssetURLs:options:)' was deprecated in iOS 11: Will be removed in a future release | 3 |
| 'application(_:performFetchWithCompletionHandler:)' was deprecated in iOS 13.0: Use a BGAppRefreshTask in the BackgroundTasks framework instead | 2 |
| 'Constants' is deprecated: Use `Constant` or `Property` instead | 2 |
| 'weak' ownership of capture 'self' differs from implicitly-captured strong reference in outer scope | 2 |
| umbrella header for module 'SDWebImageWebPCoder' does not include header 'SDInternalMacros.h' | 2 |
| umbrella header for module 'SDWebImageWebPCoder' does not include header 'SDmetamacros.h' | 2 |
| auto property synthesis will not synthesize property 'hitTestEdgeInsets'; it will be implemented by its superclass, use @dynamic to acknowledge intention | 1 |
| use '#selector' instead of explicitly constructing a 'Selector' | 1 |
| conformance of 'URLProtocol' to 'Sendable' is unavailable in iOS; this is an error in the Swift 6 language mode | 1 |
| category is implementing a method which will also be implemented by its primary class | 1 |
| 'new' is deprecated: Expo modules are now being automatically registered. You can remove this method call. | 1 |
| method definition for 'createClass:constructor:' not found | 1 |
| 'keyWindow' is deprecated: first deprecated in iOS 13.0 - Should not be used for applications that support multiple scenes as it returns a key window across all connected scenes | 1 |
| null passed to a callee that requires a non-null argument | 1 |
| cannot find protocol definition for 'RCTBridgeModule' | 1 |
| 'kSecAttrAccessibleAlways' was deprecated in iOS 12.0: Use an accessibility level that provides some user protection, such as kSecAttrAccessibleAfterFirstUnlock | 1 |
| 'kSecAttrAccessibleAlwaysThisDeviceOnly' was deprecated in iOS 12.0: Use an accessibility level that provides some user protection, such as kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly | 1 |
| 'isStatusBarHidden' was deprecated in iOS 13.0: Use the statusBarManager property of the window scene instead. | 1 |
| reference to type 'JavaScriptRuntime' broken by a context change; 'JavaScriptRuntime' was expected to be in 'ExpoModulesCore', but now a candidate is found only in 'ExpoFileSystem' | 1 |
| reference to type 'JavaScriptTypedArray' broken by a context change; 'JavaScriptTypedArray' was expected to be in 'ExpoModulesCore', but now a candidate is found only in 'ExpoFileSystem' | 1 |
| reference to type 'RCTBridge' broken by a context change; 'RCTBridge' was expected to be in 'React', but now a candidate is found only in 'Expo' | 1 |
| reference to type 'JavaScriptRuntime' broken by a context change; 'JavaScriptRuntime' was expected to be in 'ExpoModulesCore', but now a candidate is found only in 'Expo' | 1 |
| 'statusBarFrame' is deprecated: first deprecated in iOS 13.0 - Use the statusBarManager property of the window scene instead. | 1 |
| method definition for 'deviceYear' not found | 1 |
| class 'EXConstantsService' does not conform to protocol 'EXConstantsInterface' | 1 |
| implementing deprecated class | 1 |
| auto property synthesis will not synthesize property 'dependencyProvider' declared in protocol 'RCTReactNativeFactoryDelegate' | 1 |
| incompatible pointer types sending 'UIView *' to parameter of type 'RCTRootView * _Nonnull' | 1 |
| class 'EXAppDelegateWrapper' does not conform to protocols 'RCTJSRuntimeConfiguratorProtocol', 'RCTReactNativeFactoryDelegate', 'RCTUIConfiguratorProtocol', ... | 1 |
| implementing deprecated method | 1 |
| 'application:performFetchWithCompletionHandler:' is deprecated: first deprecated in iOS 13.0 - Use a BGAppRefreshTask in the BackgroundTasks framework instead | 1 |
| cannot find protocol definition for 'EXAppDelegateSubscriberProtocol' | 1 |
| 'CC_MD5' is deprecated: first deprecated in iOS 13.0 - This function is cryptographically broken and should not be used in security contexts. Clients should migrate to SHA256 (or stronger). | 1 |
| 'fetchAssetsWithALAssetURLs:options:' is deprecated: first deprecated in iOS 11 - Will be removed in a future release | 1 |
| Direct call to eval(), but lexical scope is not supported. | 1 |
| the variable "VirtualViewMode" was not declared in arrow function "handleModeChange" | 1 |
| the variable "VirtualViewRenderState" was not declared in function "VirtualView" | 1 |

## 剩余位置

- `<build>/ExpoModulesCore/ExpoModulesCore.swiftmodule/arm64-apple-ios.swiftmodule:1` — reference to type 'JavaScriptRuntime' broken by a context change; 'JavaScriptRuntime' was expected to be in 'ExpoModulesCore', but now a candidate is found only in 'Expo'
- `<build>/ExpoModulesCore/ExpoModulesCore.swiftmodule/arm64-apple-ios.swiftmodule:1` — reference to type 'JavaScriptRuntime' broken by a context change; 'JavaScriptRuntime' was expected to be in 'ExpoModulesCore', but now a candidate is found only in 'ExpoFileSystem'
- `<build>/ExpoModulesCore/ExpoModulesCore.swiftmodule/arm64-apple-ios.swiftmodule:1` — reference to type 'JavaScriptTypedArray' broken by a context change; 'JavaScriptTypedArray' was expected to be in 'ExpoModulesCore', but now a candidate is found only in 'ExpoFileSystem'
- `<build>/ExpoModulesCore/ExpoModulesCore.swiftmodule/arm64-apple-ios.swiftmodule:1` — reference to type 'RCTBridge' broken by a context change; 'RCTBridge' was expected to be in 'React', but now a candidate is found only in 'Expo'
- `<build>/main.jsbundle:11181` — Direct call to eval(), but lexical scope is not supported.
- `<build>/main.jsbundle:62168` — the variable "VirtualViewMode" was not declared in arrow function "handleModeChange"
- `<build>/main.jsbundle:62203` — the variable "VirtualViewRenderState" was not declared in function "VirtualView"
- `ios/Pods/SDWebImageWebPCoder/SDWebImageWebPCoder/Module/SDWebImageWebPCoder.h:17` — umbrella header for module 'SDWebImageWebPCoder' does not include header 'SDInternalMacros.h'
- `ios/Pods/SDWebImageWebPCoder/SDWebImageWebPCoder/Module/SDWebImageWebPCoder.h:17` — umbrella header for module 'SDWebImageWebPCoder' does not include header 'SDmetamacros.h'
- `node_modules/@react-native-community/datetimepicker/ios/RNDateTimePickerManager.m:47` — category is implementing a method which will also be implemented by its primary class
- `node_modules/expo-file-system/ios/Legacy/EXFileSystemAssetLibraryHandler.m:117` — 'fetchAssetsWithALAssetURLs:options:' is deprecated: first deprecated in iOS 11 - Will be removed in a future release
- `node_modules/expo-file-system/ios/Legacy/FileSystemLegacyModule.swift:187` — 'weak' ownership of capture 'self' differs from implicitly-captured strong reference in outer scope
- `node_modules/expo-file-system/ios/Legacy/FileSystemLegacyModule.swift:215` — 'weak' ownership of capture 'self' differs from implicitly-captured strong reference in outer scope
- `node_modules/expo-file-system/ios/Legacy/NSData+EXFileSystem.m:11` — 'CC_MD5' is deprecated: first deprecated in iOS 13.0 - This function is cryptographically broken and should not be used in security contexts. Clients should migrate to SHA256 (or stronger).
- `node_modules/expo-image-manipulator/ios/ImageManipulatorUtils.swift:87` — 'fetchAssets(withALAssetURLs:options:)' was deprecated in iOS 11: Will be removed in a future release
- `node_modules/expo-image-picker/ios/ImageUtils.swift:214` — 'referenceURL' was deprecated in iOS 11.0: Will be removed in a future release, use PHPicker.
- `node_modules/expo-image-picker/ios/ImageUtils.swift:219` — 'fetchAssets(withALAssetURLs:options:)' was deprecated in iOS 11: Will be removed in a future release
- `node_modules/expo-image-picker/ios/ImageUtils.swift:259` — 'referenceURL' was deprecated in iOS 11.0: Will be removed in a future release, use PHPicker.
- `node_modules/expo-image-picker/ios/ImageUtils.swift:264` — 'fetchAssets(withALAssetURLs:options:)' was deprecated in iOS 11: Will be removed in a future release
- `node_modules/expo-image-picker/ios/ImageUtils.swift:68` — 'referenceURL' was deprecated in iOS 11.0: Will be removed in a future release, use PHPicker.
- `node_modules/expo-image-picker/ios/StatusBarVisibilityController.swift:13` — 'isStatusBarHidden' was deprecated in iOS 13.0: Use the statusBarManager property of the window scene instead.
- `node_modules/expo-image-picker/ios/VideoUtils.swift:38` — 'referenceURL' was deprecated in iOS 11.0: Will be removed in a future release, use PHPicker.
- `node_modules/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift:401` — 'application(_:performFetchWithCompletionHandler:)' was deprecated in iOS 13.0: Use a BGAppRefreshTask in the BackgroundTasks framework instead
- `node_modules/expo-modules-core/ios/AppDelegates/ExpoAppDelegateSubscriberManager.swift:434` — 'application(_:performFetchWithCompletionHandler:)' was deprecated in iOS 13.0: Use a BGAppRefreshTask in the BackgroundTasks framework instead
- `node_modules/expo-modules-core/ios/DevTools/ExpoRequestInterceptorProtocol.swift:9` — conformance of 'URLProtocol' to 'Sendable' is unavailable in iOS; this is an error in the Swift 6 language mode
- `node_modules/expo-modules-core/ios/Fabric/ExpoFabricView.swift:194` — use '#selector' instead of explicitly constructing a 'Selector'
- `node_modules/expo-modules-core/ios/JSI/EXJavaScriptRuntime.mm:14` — method definition for 'createClass:constructor:' not found
- `node_modules/expo-modules-core/ios/Legacy/EXUtilities.m:49` — 'keyWindow' is deprecated: first deprecated in iOS 13.0 - Should not be used for applications that support multiple scenes as it returns a key window across all connected scenes
- `node_modules/expo-modules-core/ios/Legacy/ModuleRegistryAdapter/EXModuleRegistryHolderReactModule.h:7` — cannot find protocol definition for 'RCTBridgeModule'
- `node_modules/expo-modules-core/ios/Legacy/NativeModulesProxy/EXNativeModulesProxy.mm:107` — 'new' is deprecated: Expo modules are now being automatically registered. You can remove this method call.
- `node_modules/expo-modules-core/ios/Legacy/NativeModulesProxy/NativeModulesProxyModule.swift:9` — 'Constants' is deprecated: Use `Constant` or `Property` instead
- `node_modules/expo-modules-core/ios/RCTComponentData+Privates.m:14` — null passed to a callee that requires a non-null argument
- `node_modules/expo-secure-store/ios/SecureStoreModule.swift:213` — 'kSecAttrAccessibleAlways' was deprecated in iOS 12.0: Use an accessibility level that provides some user protection, such as kSecAttrAccessibleAfterFirstUnlock
- `node_modules/expo-secure-store/ios/SecureStoreModule.swift:219` — 'kSecAttrAccessibleAlwaysThisDeviceOnly' was deprecated in iOS 12.0: Use an accessibility level that provides some user protection, such as kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
- `node_modules/expo/ios/AppDelegates/EXAppDelegateWrapper.mm:11` — auto property synthesis will not synthesize property 'dependencyProvider' declared in protocol 'RCTReactNativeFactoryDelegate'
- `node_modules/expo/ios/AppDelegates/EXAppDelegateWrapper.mm:11` — class 'EXAppDelegateWrapper' does not conform to protocols 'RCTJSRuntimeConfiguratorProtocol', 'RCTReactNativeFactoryDelegate', 'RCTUIConfiguratorProtocol', ...
- `node_modules/expo/ios/AppDelegates/EXAppDelegateWrapper.mm:11` — implementing deprecated class
- `node_modules/expo/ios/AppDelegates/EXAppDelegateWrapper.mm:71` — incompatible pointer types sending 'UIView *' to parameter of type 'RCTRootView * _Nonnull'
- `node_modules/expo/ios/AppDelegates/EXAppDelegatesLoader.m:9` — cannot find protocol definition for 'EXAppDelegateSubscriberProtocol'
- `node_modules/expo/ios/AppDelegates/EXLegacyAppDelegateWrapper.m:106` — 'application:performFetchWithCompletionHandler:' is deprecated: first deprecated in iOS 13.0 - Use a BGAppRefreshTask in the BackgroundTasks framework instead
- `node_modules/expo/ios/AppDelegates/EXLegacyAppDelegateWrapper.m:78` — implementing deprecated method
- `node_modules/expo/node_modules/expo-constants/ios/ConstantsModule.swift:12` — 'Constants' is deprecated: Use `Constant` or `Property` instead
- `node_modules/expo/node_modules/expo-constants/ios/EXConstantsService.m:20` — class 'EXConstantsService' does not conform to protocol 'EXConstantsInterface'
- `node_modules/expo/node_modules/expo-constants/ios/EXConstantsService.m:20` — method definition for 'deviceYear' not found
- `node_modules/expo/node_modules/expo-constants/ios/EXConstantsService.m:67` — 'statusBarFrame' is deprecated: first deprecated in iOS 13.0 - Use the statusBarManager property of the window scene instead.
- `node_modules/react-native-svg/apple/Elements/RNSVGClipPath.mm:51` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGForeignObject.mm:71` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGGroup.mm:56` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGImage.mm:102` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGLinearGradient.mm:87` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGMarker.mm:81` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGMask.mm:75` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGPath.mm:55` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGPattern.mm:89` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGRadialGradient.mm:93` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGSvgView.h:37` — auto property synthesis will not synthesize property 'hitTestEdgeInsets'; it will be implemented by its superclass, use @dynamic to acknowledge intention
- `node_modules/react-native-svg/apple/Elements/RNSVGSymbol.mm:59` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Elements/RNSVGUse.mm:71` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFeBlend.mm:49` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFeColorMatrix.mm:55` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFeComposite.mm:57` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFeFlood.mm:51` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFeGaussianBlur.mm:51` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFeMerge.mm:51` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFeOffset.mm:57` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Filters/RNSVGFilter.mm:72` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Shapes/RNSVGCircle.mm:66` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Shapes/RNSVGEllipse.mm:70` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Shapes/RNSVGLine.mm:70` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Shapes/RNSVGRect.mm:78` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Text/RNSVGTSpan.mm:75` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Text/RNSVGText.mm:62` — method possibly missing a [super updateProps:oldProps:] call
- `node_modules/react-native-svg/apple/Text/RNSVGTextPath.mm:62` — method possibly missing a [super updateProps:oldProps:] call
