import ExpoModulesCore
import UserNotifications
import WidgetKit
import UIKit

private final class ReminderDelegate: NSObject, UNUserNotificationCenterDelegate {
  static let shared = ReminderDelegate()
  weak var previous: UNUserNotificationCenterDelegate?
  var onResponse: (([String: String]) -> Void)?
  func install() {
    let center = UNUserNotificationCenter.current()
    if center.delegate !== self { previous = center.delegate; center.delegate = self }
  }
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    if notification.request.identifier.hasPrefix("dailyrep.") { completionHandler([.banner, .list, .sound]) }
    else if let previous = previous, previous.responds(to: #selector(userNotificationCenter(_:willPresent:withCompletionHandler:))) { previous.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler) }
    else { completionHandler([]) }
  }
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    if response.notification.request.identifier.hasPrefix("dailyrep.") {
      let info = response.notification.request.content.userInfo
      let payload = ["sport": info["sport"] as? String ?? "", "planId": info["planId"] as? String ?? ""]
      UserDefaults.standard.set(payload, forKey: "dailyrep.lastNotification")
      DispatchQueue.main.async { self.onResponse?(payload) }
      completionHandler()
    } else if let previous = previous, previous.responds(to: #selector(userNotificationCenter(_:didReceive:withCompletionHandler:))) { previous.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler) }
    else { completionHandler() }
  }
}

public class DailyRepAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func subscriberDidRegister() {ReminderDelegate.shared.install()}
  public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    ReminderDelegate.shared.install()
    return true
  }
}

public class DailyRepModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DailyRepNative")
    Events("notificationResponse")
    OnCreate { [weak self] in
      ReminderDelegate.shared.install()
      ReminderDelegate.shared.onResponse = { [weak self] payload in self?.sendEvent("notificationResponse", payload) }
    }
    AsyncFunction("notificationStatus") { () async -> String in
      await self.status()
    }
    AsyncFunction("requestPermission") { () async throws -> String in
      _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
      return await self.status()
    }
    AsyncFunction("syncReminders") { (json: String) async throws -> [String: Any] in
      guard let data = json.data(using: .utf8), let rows = try JSONSerialization.jsonObject(with: data) as? [[String: String]], rows.count <= 60 else {
        throw NSError(domain: "DailyRep", code: 1, userInfo: [NSLocalizedDescriptionKey: "提醒数据无效"])
      }
      let center = UNUserNotificationCenter.current()
      let pending = await center.pendingNotificationRequests()
      center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.identifier.hasPrefix("dailyrep.") }.map(\.identifier))
      let permission = await self.status()
      guard permission == "authorized" || permission == "provisional" else { return ["status": permission, "scheduled": 0] }
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      var count = 0
      var last = ""
      for row in rows {
        guard let id = row["id"], id.hasPrefix("dailyrep."), let at = row["at"], let date = formatter.date(from: at), date.timeIntervalSinceNow > 0 else { continue }
        let content = UNMutableNotificationContent()
        content.title = row["title"] ?? "今天也给自己一点时间"
        content.body = row["body"] ?? "完成训练后记得打卡。"
        content.sound = .default
        content.userInfo = ["sport": row["sport"] ?? "", "planId": row["planId"] ?? ""]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, date.timeIntervalSinceNow), repeats: false)
        try await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        count += 1
        last = at
      }
      return ["status": permission, "scheduled": count, "through": last]
    }
    AsyncFunction("cancelReminders") { () async in
      let center = UNUserNotificationCenter.current()
      let pending = await center.pendingNotificationRequests()
      center.removePendingNotificationRequests(withIdentifiers: pending.filter { $0.identifier.hasPrefix("dailyrep.") }.map(\.identifier))
    }
    AsyncFunction("lastNotification") { () -> [String: String]? in
      let payload = UserDefaults.standard.dictionary(forKey: "dailyrep.lastNotification") as? [String: String]
      UserDefaults.standard.removeObject(forKey: "dailyrep.lastNotification")
      return payload
    }
    AsyncFunction("syncWidgetSnapshot") { (json: String) throws -> Void in
      guard let bytes = json.data(using:.utf8), bytes.count <= 262144,
            let payload = try JSONSerialization.jsonObject(with:bytes) as? [String:Any],
            payload["plans"] is [[String:Any]] else {
        throw NSError(domain:"DailyRepWidget",code:2,userInfo:[NSLocalizedDescriptionKey:"小组件计划数据无效"])
      }
      try WidgetSnapshotStore.save(bytes)
      WidgetCenter.shared.reloadAllTimelines()
    }
    AsyncFunction("clearWidgetSnapshot") { () throws -> Void in
      try WidgetSnapshotStore.clear()
      WidgetCenter.shared.reloadAllTimelines()
    }
    AsyncFunction("refreshWidgets") { WidgetCenter.shared.reloadAllTimelines() }
    AsyncFunction("copyString") { (text: String) in UIPasteboard.general.string = text }.runOnQueue(.main)
    AsyncFunction("openNotificationSettings") {
      if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }.runOnQueue(.main)
  }
  private func status() async -> String {
    switch await UNUserNotificationCenter.current().notificationSettings().authorizationStatus {
    case .authorized: return "authorized"
    case .provisional: return "provisional"
    case .denied: return "denied"
    default: return "undetermined"
    }
  }
}

// WIDGET_SNAPSHOT_STORE
import Foundation
import Security

// Both targets explicitly share only this snapshot, never the app's login token.
enum WidgetSnapshotStore {
  private static let service = "dailyrep.widget.snapshot"
  private static func query() throws -> [String: Any] {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "DailyRepWidgetKeychainGroup") as? String,
          !group.isEmpty, !group.contains("$(") else {
      throw NSError(domain:"DailyRepWidget",code:1,userInfo:[NSLocalizedDescriptionKey:"小组件共享配置缺失，请重新安装更新版本"])
    }
    return [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,
            kSecAttrAccount as String:"plans",kSecAttrAccessGroup as String:group]
  }
  static func save(_ data: Data) throws {
    let key = try query()
    let changes: [String:Any] = [kSecValueData as String:data,kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    var status = SecItemUpdate(key as CFDictionary,changes as CFDictionary)
    if status == errSecItemNotFound {status = SecItemAdd(key.merging(changes){_,new in new} as CFDictionary,nil)}
    guard status == errSecSuccess else {throw failure(status)}
  }
  static func read() throws -> Data? {
    var key = try query(); key[kSecReturnData as String] = true;key[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(key as CFDictionary,&result)
    if status == errSecItemNotFound {return nil}
    guard status == errSecSuccess else {throw failure(status)}
    return result as? Data
  }
  static func clear() throws {
    let status = SecItemDelete(try query() as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {throw failure(status)}
  }
  private static func failure(_ status: OSStatus) -> NSError {
    NSError(domain:"DailyRepWidget",code:Int(status),userInfo:[NSLocalizedDescriptionKey:status == errSecInteractionNotAllowed ? "请解锁iPhone并打开dailyRep同步小组件" : "小组件同步失败（\(status)），请重新安装更新版本并打开App"])
  }
}
