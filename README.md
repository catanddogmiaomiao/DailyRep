# dailyRep · 运动打卡 App

以 iPhone 为主要目标的 Expo / React Native 个人健身打卡 App，与 [dailyRep_web](https://github.com/catanddogmiaomiao/dailyRep_web) 共用 API。深海蓝背景、海岸渐变图片、暖米色摘要与输入卡片、柔金色主操作。

## 已实现

- 跑步、游泳、俯卧撑、腹肌训练四个入口；真实数据累计，无假打卡数据。
- 每项报告顶部打卡按钮；按周／月／年查看柱状图和运动量、次数、时长，支持切换周期。
- 时间默认现在，可分别选择日期和时间补打卡；填写运动量与分秒时长。
- 拍摄或从相册选择一张照片，处理权限拒绝和8MB大小限制。
- 邮箱密码登录，Token 保存在系统 SecureStore，所有记录和照片通过鉴权 API 读取。
- 最近记录、照片查看、确认删除、下拉刷新与退出登录。

## 运行

使用 Node.js22 LTS、Expo SDK54。

```sh
npm ci
cp .env.example .env
# 将 EXPO_PUBLIC_API_URL 改成实际 API 地址，不含 /api
npm start
```

先按网页仓库 README 启动 API，账号使用后端首次启动配置的 `OWNER_EMAIL` / `OWNER_PASSWORD`。真机需连接同一网络，地址使用电脑局域网 IP，不能使用 localhost。Android 模拟器可用 `http://10.0.2.2:3001`；正式环境使用 HTTPS。

使用与SDK54匹配的 Expo Go 扫码，或 `npm run ios` / `npm run android`（需要对应模拟器）。修改 `.env` 后重新启动 Metro。

## 验证与打包

```sh
npm run typecheck
npm test
npx expo export --platform ios --platform android
```

`eas.json` 提供开发、预览、生产配置。安装 EAS CLI 并登录自己的 Expo 账号后执行：

```sh
npx eas-cli build --platform android --profile preview
# iOS 需开发者证书与设备注册 / TestFlight 配置
npx eas-cli build --platform ios --profile production
```

构建时在 EAS 对应环境中设置 `EXPO_PUBLIC_API_URL` 为正式 HTTPS API 地址；首次 EAS 初始化会生成你的项目ID。仓库不包含开发者证书、密码或API私密数据。

当前代码提交不等于已生成安装包或上架；原生相机、相册与系统日期选择仍需在你的真机上验收。没有自动采集传感器数据或离线打卡队列。Excel 导出在网页端提供。两端打开或刷新后从同一服务同步记录。

## 统计口径

运动量：跑步 km、游泳 m、俯卧撑次数、腹肌训练分钟。持续时长独立记录。周从周一开始，统计使用查看设备的本地时区，数据库统一保存 UTC。不同时间区查看可能归到不同日期。

图片 `assets/coast.jpg` 来源于 Unsplash 图片端点 `photo-1475924156734-496f6cac6ec1`，随包本地加载。核心颜色：`#1F2A44` / `#E8DCC8` / `#C6A75E`。

## iPhone 安装说明

源码已配置 iPhone 设备目标（不启用iPad），相机／照片用途说明，系统安全区及原生日期时间选择。Expo Go 用于开发预览；正式安装包需由你的 Apple Developer 账号签名。TestFlight 分发需 Apple Developer Program、App Store Connect App 和对应签名凭据。仓库不收集或保存这些凭据。

iPhone 图标为完整不透明方形画布，系统自动裁切圆角；资源放在 `assets/icon.png` 并由 `app.json` 引用。

## 使用 Xcode 直接安装到自己的 iPhone

1. 安装完整 Xcode 和 CocoaPods（`brew install cocoapods`），安装 JavaScript 依赖并配置 `.env` 的后端地址。
2. 执行 `npx expo prebuild --platform ios --no-install`，再进入 `ios` 执行 `pod install`。Maven Central 下载不稳定时，可临时用 `ENTERPRISE_REPOSITORY=https://maven-central.storage-download.googleapis.com/maven2 pod install`。这是 [Google 文档提供的 Maven Central 镜像地址](https://docs.cloud.google.com/docs/buildpacks/java#google_cloud_hosted_maven_central_mirror)。
3. 用 Xcode 打开 `ios/dailyRep.xcworkspace`，不要打开单独的 `.xcodeproj`。
4. 连接并解锁 iPhone，在 Xcode 的 Apple Accounts 登录自己的账号，在 Signing & Capabilities 选择自己的 Team。普通 Apple 账号可使用 Personal Team。
5. 若要脱离 Metro 开发服务独立启动，在 Product → Scheme → Edit Scheme → Run 中将 Build Configuration 设为 Release，然后选择真机点击 Run。

项目已通过 Xcode27.1 / iPhoneOS27.1 SDK 的 Release 原生编译（未签名）。`plugins/withIosMinimumTarget.cjs` 会在生成 Podfile 时，将旧依赖资源包的最低目标统一到至少iOS15.1，兼容当前 Xcode；不修改第三方包源码。

签名、开发者模式与真机相机／相册仍需用户在自己的设备和账号下验收。安装后登录还需要已经启动的后端及正确的 `EXPO_PUBLIC_API_URL`。

### iPhone照片兼容

从相册或相机选择的照片先在设备本地转换成真实JPEG（包含HEIC来源），长边最多2400像素并保持比例。8MB上限按转换后文件计算；不会修改相册原图。新增原生依赖后，已有iOS工程需运行pod install并重新编译安装。

## iOS编译警告维护

`npm ci` 的 postinstall 自动应用 `patches/native-compat.json` 中的原生源码修正，Pod安装阶段还会应用图片编解码依赖补丁。每个文件校验修改前后SHA256；重复执行不会重复修改，源码版本不符会停止并要求重新审查。图片库版本固定，以保证新环境可以重现。不要删除补丁校验或用全局关闭警告替代修复。

Expo配置插件保留签名设置，向Hermes提供编译期全局对象声明，并正确标记每次执行的Hermes构建脚本。全局声明文件不进入App运行代码。

2026-10-27第一轮Release完整构建通过：用户记录382条带位置警告，修改后106条。第二轮按最新记录继续修复：110条降为75条（去重108降为73），21条空目标文件归档提示另计且保持不变。六项测试、类型检查和iPhone arm64 Release清理构建通过，未出现新增警告类别。剩余清单见 `reports/ios-warnings.md`，修复范围见 `reports/native-compat-round2.md`。旧照片接口、SVG父类更新逻辑等仍需框架升级和真机回归，不能视为已经全部消除。


## 2026-10-28：游泳与腹肌训练分类

游泳打卡可下拉选择蛙泳、蝶泳、自由泳；腹肌训练可选择仰卧起坐、腹肌轮。一次打卡可以添加多条类型明细，每条分别记录运动量和时长，共用运动日期、照片和打卡编号。多种类型合计仍为一次打卡。周、月、年报告提供全部／单类型／未分类筛选；全部类型视图显示各类型累计运动量、时长和次数，柱状图和最近记录随筛选更新。

游泳沿用米，腹肌训练沿用现有分钟单位。旧记录和旧版App未提供类型的新记录保留为“未分类”，不推测所属类型。

本次没有新增原生模块或权限。源码更新后，在Xcode现有workspace重新Run安装；手机上原安装包不会自动更新。网页与App共用线上类型字段。
