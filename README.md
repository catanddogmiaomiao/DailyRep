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
