import WidgetKit
import SwiftUI
import AppIntents

struct DailyRepConfiguration: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "健身坚持"
  static var description = IntentDescription("在 dailyRep 的计划页面复制连接码，再粘贴到这里。连接码仅允许读取计划进度。")
  @Parameter(title: "计划连接码") var connectionCode: String?
}
struct ProgressData: Decodable {
  let planId: String
  let title: String
  let sport: String
  let status: String
  let progress: Progress
  let updatedAt: String
  struct Progress: Decodable {
    let completedDays: Int
    let streak: Int
    let elapsedDays: Int
    let goalDays: Int
    let dueToday: Bool
    let doneToday: Bool
    let ended: Bool
  }
}
struct DailyRepEntry: TimelineEntry {
  let date: Date
  let data: ProgressData?
  let message: String?
  let stale: Bool
}
struct Provider: AppIntentTimelineProvider {
  func placeholder(in context: Context) -> DailyRepEntry { DailyRepEntry(date: .now, data: nil, message: "每天进步一点点", stale: false) }
  func snapshot(for configuration: DailyRepConfiguration, in context: Context) async -> DailyRepEntry {
    if context.isPreview { return placeholder(in: context) }
    return await load(configuration)
  }
  func timeline(for configuration: DailyRepConfiguration, in context: Context) async -> Timeline<DailyRepEntry> {
    let entry = await load(configuration)
    return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(1800)))
  }
  private func load(_ configuration: DailyRepConfiguration) async -> DailyRepEntry {
    let code = (configuration.connectionCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard code.count == 12 else { return DailyRepEntry(date: .now, data: nil, message: "长按小组件 → 编辑小组件\n粘贴计划连接码", stale: false) }
    let api = Bundle.main.object(forInfoDictionaryKey: "DailyRepAPIURL") as? String ?? ""
    guard let url = URL(string: api + "/api/widget-state") else {return DailyRepEntry(date: .now, data: nil, message: "服务地址未配置", stale: false)}
    var request = URLRequest(url: url)
    request.timeoutInterval = 15
    request.setValue(code, forHTTPHeaderField: "X-DailyRep-Widget-Key")
    let cacheKey = "dailyrep.snapshot." + code
    do {
      let (bytes, response) = try await URLSession.shared.data(for: request)
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      if status == 401 || status == 404 {
        UserDefaults.standard.removeObject(forKey: cacheKey)
        return DailyRepEntry(date: .now, data: nil, message: "连接已失效\n请在App重新生成连接码", stale: false)
      }
      guard status == 200 else {throw URLError(.badServerResponse)}
      let data = try JSONDecoder().decode(ProgressData.self, from: bytes)
      UserDefaults.standard.set(bytes, forKey: cacheKey)
      return DailyRepEntry(date: .now, data: data, message: nil, stale: false)
    } catch {
      let cached = UserDefaults.standard.data(forKey: cacheKey).flatMap {try? JSONDecoder().decode(ProgressData.self, from: $0)}
      return DailyRepEntry(date: .now, data: cached, message: cached == nil ? "暂时无法连接\n点按打开App" : nil, stale: true)
    }
  }
}
struct DailyRepWidgetView: View {
  let entry: DailyRepEntry
  @Environment(\.widgetFamily) private var family
  private let gold = Color(red: 0.776, green: 0.655, blue: 0.369)
  private let beige = Color(red: 0.910, green: 0.863, blue: 0.784)
  private var link: URL? {
    guard let data = entry.data else {return URL(string:"dailyrep://plans")}
    var url = URLComponents(string:"dailyrep://checkin")!
    url.queryItems = [URLQueryItem(name:"sport",value:data.sport),URLQueryItem(name:"planId",value:data.planId)]
    return url.url
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let data = entry.data {
        Text(data.title).font(.system(size: 13, weight: .medium)).lineLimit(1).foregroundStyle(beige)
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text("\(data.progress.completedDays)").font(.system(size: family == .systemSmall ? 36 : 48, weight: .bold, design: .rounded)).foregroundStyle(gold)
          Text("天 · 累计训练").font(.caption).foregroundStyle(beige)
        }
        ProgressView(value: Double(data.progress.elapsedDays), total: Double(max(1,data.progress.goalDays))).tint(gold)
        Text("计划第 \(data.progress.elapsedDays) / \(data.progress.goalDays) 天").font(.caption2).foregroundStyle(beige)
        Text(data.status == "finished" ? "计划已结束 · 记录一直都在" : data.status == "paused" ? "已暂停，休息也有节奏" : data.progress.ended ? "阶段到站 · 点按继续下一程" : data.progress.doneToday ? "今天已打卡 ✓" : data.progress.dueToday ? "今天留一点时间给自己 →" : "今天休息，为下一次蓄力")
          .font(.system(size: family == .systemSmall ? 10 : 11,weight:.medium)).foregroundStyle(gold).lineLimit(2)
        if entry.stale {Text("离线 · 显示上次进度").font(.system(size:9)).foregroundStyle(beige.opacity(0.65))}
      } else {
        Text("dailyRep").font(.headline).foregroundStyle(gold)
        Text(entry.message ?? "每天进步一点点").font(.caption).foregroundStyle(beige).lineLimit(4)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .containerBackground(for: .widget) {
      LinearGradient(colors:[Color(red:0.08,green:0.13,blue:0.22),Color(red:0.17,green:0.24,blue:0.34)],startPoint:.topLeading,endPoint:.bottomTrailing)
    }
    .widgetURL(link)
  }
}
@main struct DailyRepWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind:"DailyRepProgress",intent:DailyRepConfiguration.self,provider:Provider()) {entry in DailyRepWidgetView(entry:entry)}
      .configurationDisplayName("健身坚持")
      .description("看见长期计划的进度，把今天的一点努力坚持下去。")
      .supportedFamilies([.systemSmall,.systemMedium])
  }
}
