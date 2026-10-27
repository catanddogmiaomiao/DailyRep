# 验证记录 · 2026-10-24

已在本地实际执行并通过：

- `npm run typecheck`：TypeScript 无错误。
- `npm test`：移动端日历分组与运动隔离测试通过。
- `EXPO_NO_TELEMETRY=1 EXPO_NO_CACHE=1 npx expo export --platform ios`：成功生成 iOS Hermes JavaScript bundle（792模块）及21项静态资源，包含图标和海岸背景。
- 图标：正方形1254×1254、不透明PNG。Expo在原生构建时生成iOS要求的尺寸。

尚未完成：Apple开发者账号签名、原生Xcode编译、iPhone真机上的相机／相册／日期选择验收，以及TestFlight或App Store发布。资源打包通过不代表已生成可安装IPA。

后端部署与账号、App的 `EXPO_PUBLIC_API_URL` 仍需按README配置。未配置后端时无法登录读取真实记录。

## 更新 · 2026-10-26：原生编译已通过

- CocoaPods1.17.0安装成功，79个Pod安装完成，`ios/dailyRep.xcworkspace`已生成。
- 在Xcode27.1、iPhoneOS27.1 SDK下，实际运行Release设备构建，`CODE_SIGNING_ALLOWED=NO`，结果为 `BUILD SUCCEEDED`。
- 生成arm64设备版 `dailyRep.app`，包含约2.3MB的内嵌Hermes JavaScript bundle；最低系统为iOS15.1。
- 修复react-native-svg资源包旧部署目标（iOS12.4）在新Xcode下的构建错误。修复通过Expo配置插件持久化，配置补丁的幂等与模板检查测试通过。
- 仍未进行Apple账号签名、IPA分发、真机安装与权限验收；未配置或部署真实后端。

先前“尚未完成原生Xcode编译”的说明已由本次实际构建结果更新。未签名 `.app` 不可直接安装到普通iPhone。


## 2026-10-27：iPhone 启动黑屏排查

- 用户运行日志的致命错误为 `Cannot find native module 'ExpoFontLoader'`。
- `@expo/vector-icons` 在界面初始化时加载字体。原依赖未直接声明 `expo-font`，npm 解析出顶层 58.0.10 与 Expo SDK 54 内嵌 14.0.12 两个版本；原 Podfile.lock 和 ExpoModulesProvider 中均无 ExpoFont。
- 显式添加 SDK 54 对应的 `expo-font ~14.0.12`，更新锁文件并消除重复版本。
- 重新 pod install 成功：80 Pods；Podfile.lock 已包含 ExpoFont 14.0.12，ExpoModulesProvider 注册 FontLoaderModule 与 FontUtilsModule。
- 类型检查、3 项测试通过；新增字体依赖版本与解析一致性回归检查。
- iPhone arm64 Release 无签名原生构建通过（BUILD SUCCEEDED）。仍需在 Xcode 用用户账号签名并重新安装，真机启动结果待用户确认。
- 用户提供的 695 行构建警告中，主要为依赖库的空值标注、弃用接口及 JS 全局变量静态分析告警；该文件不包含 error:。未通过全局禁用警告或修改第三方依赖源码来掩盖问题。


## 2026-10-27：连接 Cloudflare 服务

- 本机 .env 配置 https://dailyrep.catanddogmiaomiao.workers.dev，不包含 /api 后缀。
- App 登录页支持服务端开启时显示首次注册，填写邮箱、密码、确认密码与邀请码；请求15秒超时，连接失败显示可理解的错误。
- 线上health/setup及未登录保护已验证；Safari实测网页登录和注册表单。
- 类型检查及3项测试通过；含线上URL的新 iPhone arm64 Release 无签名构建通过。用户需在Xcode重新Run签名安装才会更新手机上的旧包。


## 2026-10-27：iPhone相册照片上传

- 根因：上传表单把所有图片标为JPEG，但相册可能返回PNG或HEIC原始内容。
- 显式安装SDK54匹配的expo-image-manipulator 14.0.8与expo-file-system 19.0.24；选图后解码并保存真实JPEG，长边最多2400像素且保持比例，不放大小图，按转换后文件检查8MB限制。原始相册照片不修改。
- 新增处理中提示，处理期间禁用重复选图和提交；失败显示可理解的照片错误。
- 已核对ExpoModulesProvider注册ImageManipulatorModule；4项测试及TypeScript检查通过。
- 后端真实Workers运行时已覆盖PNG被标成JPEG仍正确保存读取，以及伪造图片拒绝。后端修复已上线。
- 当前未使用用户的私人照片进行真机验证；HEIC转换效果需用户更新后重新选择照片确认。
- 含图片转换模块的iPhone arm64 Release无签名原生编译通过（BUILD SUCCEEDED）。


## 2026-10-27：背景渐变与边角按钮

- 渐变改为无内边距的绝对定位独立容器，SVG使用明确viewBox并覆盖完整背景，避免父级padding造成矩形边界；遮罩不接收触摸事件。底色渐变到页面同色。
- 返回、退出、上一/下一周期等图标触控框改为48×48，边角独立控件增加触控扩展；记录行相邻按钮不使用重叠的扩展。图标尺寸和主要打卡按钮尺寸不变。
- 取消、完成、日期时间与移除照片操作至少48高；照片关闭按钮留出边缘间距。
- 登录标题由JSX直接文字改为字符串表达式，修正字面量反斜杠n；首页标题原本即为字符串表达式。
- TypeScript检查通过，iPhone arm64 Release无签名原生构建通过。未取得更新后的真机截图，最终视觉与触控效果需安装后确认。

## 2026-10-27：原生警告第一轮修复

- 用户附件962行，382条带源位置警告，按文件/行/正文去重215条，另有21条空目标文件归档提示。
- 最终全新目录clean build成功：带源位置警告106条，去重106条，归档提示21条，0编译错误。
- 31份依赖源码的版本校验补丁：补齐旧接口空值声明，修正可变字典、上传任务类型、动态Data类型判断、Swift泛型遮蔽、C++初始化顺序和变长数组、WebP变量初始化、CoreGraphics枚举位运算及过期Geometry聚合头。
- Hermes静态分析39条降到3条；未使用全局关闭警告的开关。
- 补丁幂等与版本漂移、Pod hook、签名设置保留测试通过；6项测试、TypeScript和Expo prebuild配置检查通过。重复Pod安装验证补丁仍有效，图片库版本已固定。
- 曾尝试补全旧桥接头导入，导致React预编译模块增加255条聚合头提示，已撤回该补丁，最终完整构建无此新增类别。
- 剩余SVG父类调用、旧接口弃用及少量SDK提示保留。检查SVG15.16.0源码后同类实现仍存在，未盲目改动渲染逻辑。
- 本轮未读取或改动线上账号、运动记录和照片；没有新增真机业务回归结果。
