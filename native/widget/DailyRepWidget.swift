import WidgetKit
import SwiftUI
import AppIntents

struct DailyRepConfiguration: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "健身坚持"
  static var description = IntentDescription("自动显示dailyRep中已同步的全部计划，无需填写连接码。")
}
struct PlanData: Decodable, Identifiable {
  var id: String { planId }
  let planId: String
  let title: String
  let sport: String
  let status: String
  let timeZone: String?
  let progress: Progress
  let updatedAt: String
  struct Progress: Decodable {
    let today: String?
    let completedDays: Int
    let streak: Int
    let elapsedDays: Int
    let goalDays: Int
    let dueToday: Bool
    let doneToday: Bool
    let ended: Bool
  }
}
struct ProgressData: Decodable {
  let plans: [PlanData]

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
    do {
      guard let bytes = try WidgetSnapshotStore.read() else {
        return DailyRepEntry(date:.now,data:nil,message:"打开dailyRep并登录\n计划会自动同步到这里",stale:false)
      }
      let data = try JSONDecoder().decode(ProgressData.self,from:bytes)
      return DailyRepEntry(date:.now,data:data,message:nil,stale:false)
    } catch {
      return DailyRepEntry(date:.now,data:nil,message:"请打开dailyRep同步计划\n"+error.localizedDescription,stale:false)
    }
  }
}
struct DailyRepWidgetView: View {
  let entry: DailyRepEntry
  @Environment(\.widgetFamily) private var family
  private let gold = Color(red: 0.776, green: 0.655, blue: 0.369)
  private let beige = Color(red: 0.910, green: 0.863, blue: 0.784)
  private var capacity: Int { family == .systemLarge ? 4 : family == .systemMedium ? 2 : 1 }
  private var plansLink: URL { URL(string:"dailyrep://plans")! }
  private func checkinLink(_ plan: PlanData) -> URL {
    guard plan.status == "active" && !plan.progress.ended else { return plansLink }
    var url = URLComponents(string:"dailyrep://checkin")!
    url.queryItems = [URLQueryItem(name:"sport",value:plan.sport),URLQueryItem(name:"planId",value:plan.planId)]
    return url.url ?? plansLink
  }
  private func status(_ plan: PlanData) -> String {
    let formatter=DateFormatter();formatter.locale=Locale(identifier:"en_US_POSIX");formatter.dateFormat="yyyy-MM-dd"
    formatter.timeZone=TimeZone(identifier:plan.timeZone ?? "Asia/Shanghai")
    if let day=plan.progress.today,day != formatter.string(from:entry.date),plan.status == "active" {return "打开App更新今日进度"}
    return plan.status == "paused" ? "已暂停" : plan.status == "finished" ? "已结束" : plan.progress.ended ? "阶段到站" : plan.progress.doneToday ? "今天已完成 ✓" : plan.progress.dueToday ? "今天待打卡" : "今天休息"
  }
  private func action(_ plan: PlanData) -> String {
    plan.status == "paused" || plan.status == "finished" ? "查看" : plan.progress.ended ? "续期" : plan.progress.doneToday ? "再打卡" : "打卡"
  }
  var body: some View {
    VStack(alignment: .leading, spacing: family == .systemLarge ? 12 : 6) {
      HStack {
        Text("dailyRep").font(.system(size:14,weight:.bold)).foregroundStyle(gold)
        Spacer()
        if let data = entry.data { Text("\(data.plans.count) 项计划").font(.caption2).foregroundStyle(beige.opacity(0.8)) }
      }
      if let data = entry.data, !data.plans.isEmpty {
        ForEach(Array(data.plans.prefix(capacity))) { plan in
          HStack(spacing: 10) {
            VStack(alignment:.leading,spacing:3) {
              Text(plan.title).font(.system(size:13,weight:.semibold)).lineLimit(1).foregroundStyle(beige)
              Text("已训练\(plan.progress.completedDays)天 · \(status(plan))").font(.system(size:10)).lineLimit(1).foregroundStyle(gold)
              if family == .systemLarge {
                ProgressView(value:Double(plan.progress.elapsedDays),total:Double(max(1,plan.progress.goalDays))).tint(gold)
                Text("计划第\(plan.progress.elapsedDays)/\(plan.progress.goalDays)天").font(.system(size:9)).foregroundStyle(beige.opacity(0.7))
              }
            }
            .frame(maxWidth:.infinity,alignment:.leading)
            if family != .systemSmall {
              Link(destination:checkinLink(plan)) {
                Text(action(plan)).font(.system(size:12,weight:.bold)).foregroundStyle(Color(red:0.08,green:0.13,blue:0.22))
                  .frame(minWidth:48,minHeight:40).background(gold,in:RoundedRectangle(cornerRadius:10))
              }.buttonStyle(.plain).accessibilityLabel("\(plan.title)，\(action(plan))")
            }
          }
          .frame(maxHeight:.infinity)
        }
        if data.plans.count > capacity {
          Link("还有\(data.plans.count-capacity)项 · 查看全部",destination:plansLink).font(.system(size:10)).foregroundStyle(beige)
        }
      } else {
        Spacer(minLength:0)
        Text(entry.data == nil ? (entry.message ?? "每天进步一点点") : "还没有计划\n点按设置一个长期目标").font(.caption).foregroundStyle(beige).lineLimit(4)
        Spacer(minLength:0)
      }
      if entry.stale { Text("离线 · 显示上次进度").font(.system(size:9)).foregroundStyle(beige.opacity(0.65)) }
    }
    .frame(maxWidth:.infinity,maxHeight:.infinity,alignment:.leading)
    .containerBackground(for:.widget) {
      LinearGradient(colors:[Color(red:0.08,green:0.13,blue:0.22),Color(red:0.17,green:0.24,blue:0.34)],startPoint:.topLeading,endPoint:.bottomTrailing)
    }
    .widgetURL(family == .systemSmall ? (entry.data?.plans.first.map(checkinLink) ?? plansLink) : plansLink)
  }
}
@main struct DailyRepWidget: Widget {
  var body: some WidgetConfiguration {
    AppIntentConfiguration(kind:"DailyRepProgress",intent:DailyRepConfiguration.self,provider:Provider()) {entry in DailyRepWidgetView(entry:entry)}
      .configurationDisplayName("健身坚持")
      .description("计划提醒列表：大号展示四项计划，点右侧打卡打开对应训练。")
      .supportedFamilies([.systemSmall,.systemMedium,.systemLarge])
  }
}
