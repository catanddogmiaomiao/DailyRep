import ExpoModulesCore
import UserNotifications
import WidgetKit
import UIKit
import AVFoundation

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
    AsyncFunction("widgetDiagnostics") { () async throws -> [String:Any] in
      var result=try WidgetSnapshotStore.diagnostics()
      let widgets:[WidgetInfo] = try await withCheckedThrowingContinuation { continuation in
        WidgetCenter.shared.getCurrentConfigurations { result in
          continuation.resume(with:result)
        }
      }
      result["currentWidgetInstalled"]=widgets.contains{$0.kind == "DailyRepPlansV3" || $0.kind == "DailyRepProgress"}
      result["modernWidgetInstalled"]=widgets.contains{$0.kind == "DailyRepPlansV3"}
      result["legacyWidgetInstalled"]=widgets.contains{$0.kind == "DailyRepProgress"}
      return result
    }
    AsyncFunction("playInteraction") { (kind:String) in CheckinFeedback.shared.interact(kind) }.runOnQueue(.main)
    AsyncFunction("playCheckinSuccess") { CheckinFeedback.shared.play() }.runOnQueue(.main)
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

// A short original two-hit sound, generated locally; no network or bundled media needed.
enum CheckinSound {
  static func wav(kind:String="success") -> Data {
    let rate = 22050
    let hits:[(Double,Double,Double)]
    let duration:Double
    let decay:Double
    switch kind {
    case "tap": hits=[(0,330,0.42)];duration=0.085;decay=45
    case "selection": hits=[(0,490,0.34)];duration=0.065;decay=60
    case "confirm": hits=[(0,246,0.48),(0.09,370,0.52)];duration=0.24;decay=30
    case "delete": hits=[(0,150,0.52)];duration=0.14;decay=30
    case "error": hits=[(0,220,0.48),(0.11,165,0.48)];duration=0.30;decay=30
    default: hits=[(0,146,0.65),(0.18,116,0.78)];duration=0.54;decay=19
    }
    let count = Int(Double(rate) * duration)
    var pcm = Data(capacity:count * 2)
    for i in 0..<count {
      let t = Double(i) / Double(rate)
      var value = 0.0
      for (start, frequency, gain) in hits {
        let x = t - start
        let tail = min(0.30,duration - start)
        if x >= 0 && x < tail {
          let attack = min(1,x / 0.006)
          let release = min(1,(tail - x) / min(0.035,tail / 3))
          let envelope = attack * release * exp(-x * decay)
          let phase = 2 * Double.pi * (frequency * x + 16 * (1 - exp(-x * 35)) / 35)
          value += gain * envelope * (sin(phase) + 0.22 * sin(2 * phase) + 0.08 * sin(3 * phase))
        }
      }
      var sample = Int16(max(-0.95,min(0.95,value)) * Double(Int16.max)).littleEndian
      withUnsafeBytes(of:&sample) {pcm.append(contentsOf:$0)}
    }
    var data = Data()
    func text(_ value:String) {data.append(contentsOf:value.utf8)}
    func u16(_ value:UInt16) {var v=value.littleEndian;withUnsafeBytes(of:&v) {data.append(contentsOf:$0)}}
    func u32(_ value:UInt32) {var v=value.littleEndian;withUnsafeBytes(of:&v) {data.append(contentsOf:$0)}}
    text("RIFF");u32(UInt32(36 + pcm.count));text("WAVEfmt ");u32(16)
    u16(1);u16(1);u32(UInt32(rate));u32(UInt32(rate * 2));u16(2);u16(16)
    text("data");u32(UInt32(pcm.count));data.append(pcm)
    return data
  }
}

private final class CheckinFeedback {
  static let shared = CheckinFeedback()
  private var player: AVAudioPlayer?
  private var sounds:[String:AVAudioPlayer] = [:]
  private var lastInteraction:TimeInterval = -1
  private let selection = UIImpactFeedbackGenerator(style:.rigid)
  private let tap = UIImpactFeedbackGenerator(style:.medium)
  private let notification = UINotificationFeedbackGenerator()
  private let first = UIImpactFeedbackGenerator(style:.heavy)
  private let second = UIImpactFeedbackGenerator(style:.rigid)
  private var lastPlayed: TimeInterval = -1
  private var pending: DispatchWorkItem?
  func play() {
    guard UIApplication.shared.applicationState == .active else {return}
    let now = ProcessInfo.processInfo.systemUptime
    guard now - lastPlayed > 0.6 else {return}
    lastPlayed = now
    pending?.cancel()
    first.prepare();second.prepare()
    sound("success",volume:0.95)
    first.impactOccurred(intensity:0.9)
    let followup = DispatchWorkItem { [weak self] in
      guard UIApplication.shared.applicationState == .active else {return}
      self?.second.impactOccurred(intensity:1.0)
    }
    pending = followup
    DispatchQueue.main.asyncAfter(deadline:.now()+0.18,execute:followup)
  }
  func interact(_ kind:String) {
    guard ["tap","selection","confirm","delete","error"].contains(kind),
      UIApplication.shared.applicationState == .active else {return}
    let now = ProcessInfo.processInfo.systemUptime
    // Coalesce nested presses/rapid picker events, and preserve the full success flourish.
    guard now - lastPlayed > 0.6 else {return}
    if ["tap","selection"].contains(kind),now - lastInteraction <= 0.085 {return}
    lastInteraction = now
    switch kind {
    case "selection": selection.prepare();selection.impactOccurred(intensity:0.65)
    case "confirm": notification.notificationOccurred(.success)
    case "error": notification.notificationOccurred(.error)
    case "delete": first.prepare();first.impactOccurred(intensity:0.75)
    default: tap.prepare();tap.impactOccurred(intensity:0.8)
    }
    sound(kind,volume:kind == "selection" ? 0.75 : 0.9)
  }
  private func sound(_ kind:String,volume:Float) {
    do {
      // Ambient respects Silent mode and mixes with music/podcasts.
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.ambient,mode:.default,options:[.mixWithOthers])
      try session.setActive(true)
      if sounds[kind] == nil {sounds[kind] = try AVAudioPlayer(data:CheckinSound.wav(kind:kind))}
      player?.stop()
      player = sounds[kind]
      player?.currentTime = 0
      player?.volume = volume
      player?.prepareToPlay()
      player?.play()
    } catch { /* Feedback cannot affect saving or navigation. Haptics still work. */ }
  }

}

// WIDGET_SNAPSHOT_STORE
import Foundation
import Security

// Both targets explicitly share only this snapshot, never the app's login token.
enum WidgetSnapshotStore {
  private static let service = "dailyrep.widget.snapshot"
  private static func query(account:String="plans") throws -> [String: Any] {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "DailyRepWidgetKeychainGroup") as? String,
          !group.isEmpty, !group.contains("$(") else {
      throw NSError(domain:"DailyRepWidget",code:1,userInfo:[NSLocalizedDescriptionKey:"小组件共享配置缺失，请重新安装更新版本"])
    }
    return [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,
            kSecAttrAccount as String:account,kSecAttrAccessGroup as String:group]
  }
  static func save(_ data: Data, account:String="plans") throws {
    let key = try query(account:account)
    let changes: [String:Any] = [kSecValueData as String:data,kSecAttrAccessible as String:kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    var status = SecItemUpdate(key as CFDictionary,changes as CFDictionary)
    if status == errSecItemNotFound {status = SecItemAdd(key.merging(changes){_,new in new} as CFDictionary,nil)}
    guard status == errSecSuccess else {throw failure(status)}
  }
  static func read(account:String="plans") throws -> Data? {
    var key = try query(account:account); key[kSecReturnData as String] = true;key[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(key as CFDictionary,&result)
    if status == errSecItemNotFound {return nil}
    guard status == errSecSuccess else {throw failure(status)}
    return result as? Data
  }
  static func clear() throws {
    let status = SecItemDelete(try query() as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {throw failure(status)}
    SecItemDelete(try query(account:"widget-health") as CFDictionary)
  }
  static func recordRead(state:String,count:Int) {
    let value:[String:Any] = ["state":state,"count":count,"readAt":ISO8601DateFormatter().string(from:Date())]
    if let bytes = try? JSONSerialization.data(withJSONObject:value) {try? save(bytes,account:"widget-health")}
  }
  static func diagnostics() throws -> [String:Any] {
    var result:[String:Any] = ["appPlanCount":0]
    if let data=try read(),let json=try JSONSerialization.jsonObject(with:data) as? [String:Any] {
      result["appPlanCount"]=(json["plans"] as? [[String:Any]])?.count ?? 0
      result["savedAt"]=json["updatedAt"]
    }
    if let data=try read(account:"widget-health"),let json=try JSONSerialization.jsonObject(with:data) as? [String:Any] {result["widgetRead"]=json}
    return result
  }
  private static func failure(_ status: OSStatus) -> NSError {
    NSError(domain:"DailyRepWidget",code:Int(status),userInfo:[NSLocalizedDescriptionKey:status == errSecInteractionNotAllowed ? "请解锁iPhone并打开dailyRep同步小组件" : "小组件同步失败（\(status)），请重新安装更新版本并打开App"])
  }
}
