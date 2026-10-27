# 第二轮原生兼容修复说明

本轮基于用户最新的 Xcode 警告记录继续修复。补丁保存在 `patches/native-compat.json`，由既有的 npm postinstall 和 CocoaPods post-install 钩子应用；没有新增关闭警告的编译选项。

## 修改范围

- 文件选择器：项目及 Pods 最低支持 iOS 15.1，移除 iOS 13 的文件／目录选择器分支和旧 UTI 转换函数。保留当前支持系统上的 MIME 回退规则、文件复制方式及目录访问方式。
- 图片解码：三个解码路径通过 UniformTypeIdentifiers 查询文件扩展名，保留对动态类型的过滤；RAW 类型判断改用现代类型继承判断。WebP 色彩配置继续复制 ICC 数据，使用受支持的 ICCData 接口。
- 架构判断：按照依赖编译器给出的替代方式，使用 RCTIsNewArchEnabled，保留原有工厂存在性检查。
- 钥匙串：iPhone 的认证提示通过 LAContext.localizedReason 和 kSecUseAuthenticationContext 传递，保持密码存储属性不变。保留原依赖的 tvOS 条件编译分支。
- Swift／Objective-C：删除无用局部变量和无用模式绑定；弱引用闭包改用显式弱捕获；空事件参数显式表示为 NSNull。

## 保留的行为与提示

SVG 更新属性的父类调用、旧照片库兼容路径、后台获取回调及 Swift 并发隔离未在本轮改动。图片库的私有宏头文件仍保持私有，聚合头提示没有计入代码修复成果；这类提示会随模块缓存而变化。

此轮没有切换 Expo／React Native 大版本，没有重新生成签名配置。命令行验证为未签名的 iPhone arm64 Release 编译，不能替代真机运行、相册选择与生物识别认证验收。

完整构建的数量与剩余位置见 `ios-warnings.md`。
