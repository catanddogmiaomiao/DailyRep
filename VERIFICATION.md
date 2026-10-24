# 验证记录 · 2026-10-24

已在本地实际执行并通过：

- `npm run typecheck`：TypeScript 无错误。
- `npm test`：移动端日历分组与运动隔离测试通过。
- `EXPO_NO_TELEMETRY=1 EXPO_NO_CACHE=1 npx expo export --platform ios`：成功生成 iOS Hermes JavaScript bundle（792模块）及21项静态资源，包含图标和海岸背景。
- 图标：正方形1254×1254、不透明PNG。Expo在原生构建时生成iOS要求的尺寸。

尚未完成：Apple开发者账号签名、原生Xcode编译、iPhone真机上的相机／相册／日期选择验收，以及TestFlight或App Store发布。资源打包通过不代表已生成可安装IPA。

后端部署与账号、App的 `EXPO_PUBLIC_API_URL` 仍需按README配置。未配置后端时无法登录读取真实记录。
