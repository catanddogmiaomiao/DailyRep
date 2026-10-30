import {FeedbackPressable as Pressable} from "./src/FeedbackPressable";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  ImageBackground,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  AppState,
  Linking,
} from "react-native";
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import DateTimePicker from "@react-native-community/datetimepicker";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { report, movePeriod } from "./src/stats";
import {PlansPanel, PlanSummary} from "./src/PlansPanel";
import {dateInZone, isDue, matchesPlan, planProgress} from "./src/plans";
import {syncReminders, restoreCachedReminders, clearDeviceReminders, syncWidgetSnapshot, clearWidgetSnapshot, listenToNotifications, lastNotification, playCheckinSuccess, playInteraction} from "./src/nativeReminders";
import {SetEditor} from "./src/SetEditor";
import {SwipeableRecord, RecordThumbnail} from "./src/SwipeableRecord";
import {RecordShareActions} from "./src/RecordShareActions";
import {subtypeOptions, subtypeLabel, matchesSubtype, recordDetails, projectRecord, recordUnit, formatSets} from "./src/subtypes";
type Sport = "running" | "swimming" | "pushups" | "abs";
type Period = "week" | "month" | "year";
type RecordItem = {
  id: string;
  sport: Sport;
  subtype?: string | null;
  quantityUnit?: string | null;
  planId?: string | null;
  details?: {subtype: string | null; value: number; duration: number; sets?: number[]}[] | null;
  value: number;
  duration: number;
  occurredAt: string;
  photo: string | null;
};
const sports: Record<
  Sport,
  {
    name: string;
    unit: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
  }
> = {
  running: { name: "跑步", unit: "km", icon: "walk-outline" },
  swimming: { name: "游泳", unit: "m", icon: "water-outline" },
  pushups: { name: "俯卧撑", unit: "次", icon: "barbell-outline" },
  abs: { name: "腹肌训练", unit: "个", icon: "fitness-outline" },
};
const API = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
const fmt = (n: number) => Number(n.toFixed(2)).toLocaleString("zh-CN");
function Fade() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#132138" stopOpacity=".12" />
            <Stop offset="45%" stopColor="#132138" stopOpacity=".28" />
            <Stop offset="75%" stopColor="#132138" stopOpacity=".78" />
            <Stop offset="100%" stopColor="#132138" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={100} height={100} fill="url(#fade)" />
      </Svg>
    </View>
  );
}
function App() {
  const photoInsets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null),
    [initializing, setInitializing] = useState(true),
    [email, setEmail] = useState(""),
    [records, setRecords] = useState<RecordItem[]>([]),
    [plans,setPlans] = useState<any[]>([]),
    [plansVisible,setPlansVisible] = useState(false),
    [initialPlanId,setInitialPlanId] = useState(""),
    [dataReady,setDataReady] = useState(false),
    [coverage,setCoverage] = useState<any>(null),
    [page, setPage] = useState<Sport | "home">("home"),
    [period, setPeriod] = useState<Period>("week"),
    [subtype, setSubtype] = useState(""),
    [planFilter,setPlanFilter] = useState(""),
    [anchor, setAnchor] = useState(new Date()),
    [form, setForm] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [photo, setPhoto] = useState<string | null>(null),
    [openRecordId, setOpenRecordId] = useState<string | null>(null);
  useEffect(() => {setOpenRecordId(null);}, [page, token, photo, form, subtype, period, anchor]);
  function confirmDelete(record: RecordItem) {
    setOpenRecordId(null);
    Alert.alert("删除记录", record.photo ? "删除这次打卡的全部明细和照片？" : "删除这次打卡的全部明细？", [
      {text: "取消", style: "cancel"},
      {text: "删除", style: "destructive", onPress: async () => {
        try {
          await api("/records/" + record.id, {method: "DELETE"});
          void playInteraction("delete");
          const next=records.filter(r=>r.id!==record.id);setRecords(next);setPlans(previous=>previous.map(p=>({...p,progress:planProgress(p,next)})));
          await refresh();
        } catch (e: any) {void playInteraction("error");setError(e.message);}
      }},
    ]);
  }
  const swipeActive=useRef(false);
  const [scrollEnabled,setScrollEnabled]=useState(true);
  const generation = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { scrollRef.current?.scrollTo({y: 0, animated: false}); }, [page, token]);
  async function api(route: string, options: RequestInit = {}, auth = token) {
    if (!API) throw new Error("服务地址尚未配置，请更新到已连接服务的新版本");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try { res = await fetch(API + "/api" + route, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        ...(auth ? { Authorization: "Bearer " + auth } : {}),
      },
    }); } catch { throw new Error("暂时无法连接服务，请检查网络后重试"); }
    finally { clearTimeout(timeout); }
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "网络请求失败" }));
      const err = Object.assign(new Error(data.error || "请求失败"), {
        status: res.status,
      });
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  async function clear() {
    generation.current++;
    await SecureStore.deleteItemAsync("dailyrep_token");
    setToken(null);
    setRecords([]);
    setPlans([]);setDataReady(false);setPlansVisible(false);
    await Promise.all([clearDeviceReminders(),clearWidgetSnapshot()]);
    setPhoto(null);
  }
  async function refresh(auth = token, propagate = false) {
    const version = generation.current;
    setLoading(true);
    try {
      const [rows, planRows] = await Promise.all([api("/records", {}, auth),api("/plans",{},auth)]);
      if (version === generation.current) {setRecords(rows);setPlans(planRows);setDataReady(true);}
    } catch (e: any) {
      if (e.status === 401) await clear();
      else setError(e.message);
      if(propagate)throw e;
    } finally {
      setLoading(false);
    }
  }
  const pendingLaunch=useRef<any>(null), routeHandler=useRef<(request:any)=>void>(()=>{});
  routeHandler.current=(request:any)=>{
    if(!token||!dataReady){pendingLaunch.current=request;return;}
    if(request.plans){setPlansVisible(true);return;}
    if(!Object.hasOwn(sports,request.sport))return;
    const plan=plans.find(p=>p.id===request.planId);
    if(request.planId&&(!plan||plan.status!=="active"||plan.progress.ended)){setPlansVisible(true);return;}
    go(request.sport as Sport);setInitialPlanId(request.planId||"");setForm(true);
  };
  useEffect(()=>{
    const handleURL=(url:string|null)=>{if(!url)return;try{const parsed=new URL(url);if(parsed.protocol!=="dailyrep:")return;routeHandler.current(parsed.hostname==="plans"?{plans:true}:{sport:parsed.searchParams.get("sport"),planId:parsed.searchParams.get("planId")});}catch{}};
    Linking.getInitialURL().then(handleURL);
    const link=Linking.addEventListener("url",event=>handleURL(event.url));
    const notification=listenToNotifications(data=>routeHandler.current(data));
    lastNotification().then(data=>{if(data)routeHandler.current(data);});
    return()=>{link.remove();notification?.remove();};
  },[]);
  useEffect(()=>{if(token&&dataReady&&pendingLaunch.current){const request=pendingLaunch.current;pendingLaunch.current=null;routeHandler.current(request);}},[token,dataReady,plans]);
  useEffect(()=>{
    if(!token||!dataReady)return;
    let active=true;
    syncReminders(plans,records).then(result=>{if(active)setCoverage(result);}).catch((e:any)=>{if(active)setError("提醒同步失败："+e.message);});
    syncWidgetSnapshot(plans,records).catch((e:any)=>{if(active)setError("小组件同步失败："+e.message);});
    return()=>{active=false;};
  },[token,dataReady,plans,records]);
  useEffect(()=>{if(!token)return;const sub=AppState.addEventListener("change",state=>{if(state==="active"){refresh();lastNotification().then(data=>{if(data)routeHandler.current(data);});}});return()=>sub.remove();},[token]);
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync("dailyrep_token");
        if (saved) {
          await restoreCachedReminders();
          const me = await api("/me", {}, saved);
          setToken(saved);
          setEmail(me.email);
          await refresh(saved);
        } else {
          await clearWidgetSnapshot().catch(()=>undefined);
        }
      } catch (e: any) {
        if (e.status === 401) await clear();
        else setError(e.message);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);
  const go = (key: Sport | "home") => {
    setPage(key);setPlanFilter("");
    setSubtype("");
    setAnchor(new Date());
    setPeriod("week");
  };
  if (initializing)
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#c6a75e" />
        <Text style={s.muted}>正在打开运动空间…</Text>
      </SafeAreaView>
    );
  if (!token)
    return (
      <Login
        error={error}
        onLogin={async (mail, password, registration) => {
          const data = await api(
            registration ? "/register" : "/login",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: mail, password, ...registration }),
            },
            null,
          );
          await SecureStore.setItemAsync("dailyrep_token", data.token);
          setToken(data.token);
          setEmail(data.email);
          setError("");
          await refresh(data.token);
        }}
      />
    );
  const selected = page === "home" ? null : sports[page],
    stat = page === "home" ? null : report(records.filter(r=>matchesPlan(r,planFilter)), page, period, anchor, subtype);
  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        directionalLockEnabled
        onScrollBeginDrag={() => {if(!swipeActive.current)setOpenRecordId(null);}}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => refresh()}
            tintColor="#c6a75e"
          />
        }
      >
        <ImageBackground
          source={require("./assets/coast.jpg")}
          style={s.hero}
          imageStyle={{ opacity: 0.75 }}
        >
          <Fade />
          <View style={s.topline}>
            {selected ? (
              <Pressable
                accessibilityLabel="返回首页"
                onPress={() => go("home")}
                accessibilityRole="button"
                hitSlop={8}
                style={s.iconBtn}
              >
                <Ionicons name="chevron-back" color="#e8dcc8" size={23} />
              </Pressable>
            ) : (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
              >
                <Image
                  source={require("./assets/icon.png")}
                  style={{ width: 30, height: 30, borderRadius: 8 }}
                />
                <Text style={s.brand}>dailyRep</Text>
              </View>
            )}
            <Pressable
              accessibilityLabel="退出登录"
              onPress={() =>
                Alert.alert("退出登录", email, [
                  { text: "取消", style: "cancel" },
                  {
                    text: "退出",
                    onPress: async () => {
                      try {
                        await api("/logout", { method: "POST" });
                        await clear();
                      } catch (e: any) {
                        setError(e.message);
                      }
                    },
                  },
                ])
              }
              accessibilityRole="button"
              hitSlop={8}
              style={s.iconBtn}
            >
              <Ionicons name="log-out-outline" size={22} color="#e8dcc8" />
            </Pressable>
          </View>
          <Text style={s.eyebrow}>MAKE EVERY DAY COUNT</Text>
          <Text style={s.title}>
            {selected ? selected.name + "报告" : "今天，\n也向前一步"}
          </Text>
          <Text style={s.subtitle}>
            {selected
              ? "让每一份坚持，都清晰可见。"
              : new Date().toLocaleDateString("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
          </Text>
        </ImageBackground>
        {error ? (
          <Pressable onPress={() => setError("")}>
            <Text accessibilityRole="alert" style={s.error}>
              {error}　×
            </Text>
          </Pressable>
        ) : null}
        {!selected ? (
          <>
            <View style={s.beige}>
              <Text style={s.darkLabel}>本周打卡</Text>
              <View style={s.row}>
                <Text style={s.darkBig}>
                  {
                    records.filter(
                      (r) =>
                        new Date(r.occurredAt) >=
                        report([], "running", "week").start,
                    ).length
                  }
                  <Text style={s.darkUnit}> 次</Text>
                </Text>
                <Ionicons name="water-outline" size={52} color="#b2965c" />
              </View>
              <Text style={s.darkHint}>把今天的努力，留给未来的自己。</Text>
            </View>
            <Text style={s.sectionTitle}>选择今天的运动</Text>
            <View style={s.sportGrid}>
              {(Object.keys(sports) as Sport[]).map((key) => {
                const sport = sports[key],
                  st = report(records, key, "week");
                return (
                  <Pressable
                    key={key}
                    onPress={() => go(key)}
                    style={s.sportCard}
                  >
                    <View style={s.row}>
                      <Ionicons name={sport.icon} size={33} color="#c6a75e" />
                      <Ionicons
                        name="arrow-up-outline"
                        size={17}
                        color="#a9b4c6"
                        style={{ transform: [{ rotate: "45deg" }] }}
                      />
                    </View>
                    <Text style={s.sportName}>{sport.name}</Text>
                    <Text style={s.sportValue}>
                      {fmt(st.total)}
                      <Text style={s.unit}> {sport.unit}</Text>
                    </Text>
                    <Text style={s.small}>
                      本周累计 · {st.rows.length} 次打卡
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{marginBottom:20,gap:12}}>
              <View style={s.row}><Text style={s.sectionTitle}>长期计划</Text><Pressable accessibilityRole="button" style={s.textAction} onPress={()=>setPlansVisible(true)}><Text style={{color:'#c6a75e'}}>管理计划</Text></Pressable></View>
              {plans.filter(p=>p.status==='active'||p.status==='paused').map(plan=><PlanSummary key={plan.id} plan={plan} onPress={()=>setPlansVisible(true)}/>)}
              {!plans.some(p=>p.status==='active'||p.status==='paused')&&<Pressable style={s.record} accessibilityRole="button" onPress={()=>setPlansVisible(true)}><Text style={s.tabText}>设置一个100天目标，也可以继续自由打卡 →</Text></Pressable>}
            </View>
            <Text style={s.footer}>私人空间 · 记录只属于你</Text>
          </>
        ) : (
          stat && (
            <>
              <Pressable style={s.gold} onPress={() => {setInitialPlanId("");setForm(true);}}>
                <Ionicons name="add" size={21} color="#1f2a44" />
                <Text style={s.goldText}>{selected.name}打卡</Text>
              </Pressable>
              {plans.some(p=>p.sport===page)&&<View style={{marginTop:14}}><Text style={s.fieldLabel}>统计范围</Text><CategoryPicker options={[{value:'',label:'全部记录'},{value:'free',label:'自由打卡'},...plans.filter(p=>p.sport===page).map(p=>({value:p.id,label:p.title}))]} value={planFilter} onChange={setPlanFilter}/></View>}
              {subtypeOptions(page).length > 0 && (
                <View style={{marginTop: 20}}>
                  <Text style={s.fieldLabel}>按类型统计</Text>
                  <CategoryPicker options={[{value: "", label: "全部类型"}, ...subtypeOptions(page), {value: "unclassified", label: "未分类（旧记录）"}]} value={subtype} onChange={setSubtype} />
                </View>
              )}
              <Pressable accessibilityRole="button" style={[s.row,{minHeight:48,marginTop:8}]} onPress={()=>setPlansVisible(true)}><Text style={s.small}>{plans.find(p=>p.sport===page&&(p.status==='active'||p.status==='paused'))?.title||'未设长期计划 · 自由打卡也很好'}</Text><Text style={{color:'#c6a75e'}}>管理计划 →</Text></Pressable>
              <View style={s.tabs}>
                {(["week", "month", "year"] as Period[]).map((p, i) => (
                  <Pressable
                    key={p}
                    feedback="selection"
                    style={[s.tab, p === period && s.activeTab]}
                    onPress={() => {
                      setPeriod(p);
                      setAnchor(new Date());
                    }}
                  >
                    <Text style={p === period ? s.activeText : s.tabText}>
                      {["周", "月", "年"][i]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={[s.row, { marginVertical: 20 }]}>
                <Pressable
                  feedback="selection" accessibilityLabel="上一周期"
                  accessibilityRole="button"
                  hitSlop={8}
                  style={s.iconBtn}
                  onPress={() => setAnchor(movePeriod(anchor, period, -1))}
                >
                  <Ionicons name="chevron-back" size={19} color="#e8dcc8" />
                </Pressable>
                <Text style={s.muted}>
                  {period === "year"
                    ? stat.start.getFullYear() + "年"
                    : period === "month"
                      ? stat.start.toLocaleDateString("zh-CN", {
                          year: "numeric",
                          month: "long",
                        })
                      : stat.start.toLocaleDateString("zh-CN", {
                          month: "long",
                          day: "numeric",
                        }) +
                        " — " +
                        new Date(stat.end.getTime() - 1).toLocaleDateString(
                          "zh-CN",
                          { month: "long", day: "numeric" },
                        )}
                </Text>
                <Pressable
                  feedback="selection" accessibilityLabel="下一周期"
                  accessibilityRole="button"
                  hitSlop={8}
                  style={s.iconBtn}
                  onPress={() => setAnchor(movePeriod(anchor, period, 1))}
                >
                  <Ionicons name="chevron-forward" size={19} color="#e8dcc8" />
                </Pressable>
              </View>
              <View style={s.beige}>
                <Text style={s.darkLabel}>
                  本
                  {period === "week" ? "周" : period === "month" ? "月" : "年"}
                  运动量
                </Text>
                <Text style={s.darkBig}>
                  {fmt(stat.total)}
                  <Text style={s.darkUnit}> {selected.unit}</Text>
                </Text>
                <View
                  style={[
                    s.row,
                    {
                      marginTop: 16,
                      borderTopWidth: 1,
                      borderTopColor: "#1f2a4420",
                      paddingTop: 16,
                    },
                  ]}
                >
                  <Text style={s.darkLabel}>{stat.setCount > 0 ? stat.setCount + "组 · " : ""}{stat.rows.length} 次打卡</Text>
                  <Text style={s.darkLabel}>
                    {Math.floor(stat.duration / 3600)}小时{" "}
                    {Math.floor((stat.duration % 3600) / 60)}分
                  </Text>
                </View>
              </View>
              {stat.legacyCount > 0 && <Text style={[s.small,{marginTop:12}]}>本周期含 {stat.legacyCount} 条旧版腹肌计时记录：时长保留，分钟数不计入个数统计。原记录见下方。</Text>}
              {!subtype && stat.breakdown.length > 0 && (
                <View style={{marginTop: 16, gap: 10}}>
                  {stat.breakdown.map(group => (
                    <Pressable key={group.value} accessibilityRole="button" accessibilityLabel={`查看${group.label}统计`} style={[s.record, {minHeight: 64}]} onPress={() => setSubtype(group.value)}>
                      <View><Text style={s.tabText}>{group.label}</Text><Text style={s.small}>{group.setCount > 0 ? group.setCount + "组 · " : ""}{group.count} 次打卡 · {Math.floor(group.duration / 60)}分{group.duration % 60}秒</Text></View>
                      <Text style={s.recordValue}>{fmt(group.total)} {selected.unit}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Text style={s.sectionTitle}>
                运动量趋势 <Text style={s.small}>（{selected.unit}）</Text>
              </Text>
              <BarChart bars={stat.bars} unit={selected.unit} />
              {stat.rows.length === 0 && (
                <Text
                  style={[s.small, { textAlign: "center", marginVertical: 16 }]}
                >
                  这个周期还没有记录，开始第一次打卡吧。
                </Text>
              )}
              <Text style={s.sectionTitle}>最近记录</Text>
              {records
                .filter((r) => r.sport === page && matchesSubtype(r, subtype) && matchesPlan(r,planFilter))
                .map(r => projectRecord(r, subtype))
                .map((r) => (
                  <SwipeableRecord key={r.id}
                    open={openRecordId === r.id}
                    onGestureActive={active=>{swipeActive.current=active;setScrollEnabled(!active);}}
                    onOpen={() => setOpenRecordId(r.id)}
                    onClose={() => setOpenRecordId(current => current === r.id ? null : current)}
                    onDelete={() => confirmDelete(r)}
                  >
                    <Pressable style={{flex: 1, minWidth: 0}}
                      onPress={() => setOpenRecordId(null)}
                      accessibilityActions={[{name: "delete", label: "删除记录"}]}
                      onAccessibilityAction={event => {if (event.nativeEvent.actionName === "delete") confirmDelete(r);}}
                    >
                      <Text style={s.small}>
                        {new Date(r.occurredAt).toLocaleString("zh-CN", {
                          hour12: false,
                        })}
                      </Text>
                      {(subtypeOptions(page).length > 0 || page === "pushups") && <Text style={[s.small, {color: "#c6a75e", marginTop: 6}]}>{recordDetails(r).map(d => `${page === "pushups" ? "俯卧撑" : subtypeLabel(page,d.subtype)} ${d.sets ? formatSets(d.sets,recordUnit(r)) : fmt(d.value)+recordUnit(r)} · ${Math.floor(d.duration/60)}分${d.duration%60}秒`).join("\n")}</Text>}
                      <Text style={s.recordValue}>
                        {fmt(r.value)} {recordUnit(r)}{" "}
                        <Text style={s.small}>
                          {" "}
                          · {Math.floor(r.duration / 60)}分{r.duration % 60}秒
                        </Text>
                      </Text>
                      <RecordShareActions record={records.find(item=>item.id===r.id)||r} apiURL={API} token={token}/>
                    </Pressable>
                    <RecordThumbnail
                      uri={r.photo ? API + "/api/photos/" + r.photo : null}
                      token={token}
                      onPress={() => {setOpenRecordId(null); setPhoto(r.photo);}}
                    />
                  </SwipeableRecord>
                ))}
              <Text style={s.footer}>dailyRep · 每天进步一点点</Text>
            </>
          )
        )}
      </ScrollView>
      {form && page !== "home" && (
        <Checkin
          sport={page}
          plans={plans}
          initialPlanId={initialPlanId}
          onClose={() => setForm(false)}
          onSave={async (data) => {
            const created=await api("/records", { method: "POST", body: data });
            void playCheckinSuccess();
            const next=[created,...records.filter(r=>r.id!==created.id)];
            setRecords(next);setPlans(previous=>previous.map(p=>({...p,progress:planProgress(p,next)})));
            setForm(false);
            setAnchor(new Date());
            await refresh();
          }}
        />
      )}
      <PlansPanel visible={plansVisible} plans={plans} api={api} onChanged={async()=>{await refresh(token,true);}} onPlanSaved={saved=>setPlans(previous=>[{...saved,progress:planProgress(saved,records)},...previous.filter(p=>p.id!==saved.id)])} onClose={()=>setPlansVisible(false)} coverage={coverage} onCheckin={(sport,planId)=>{setPlansVisible(false);go(sport as Sport);setInitialPlanId(planId);setForm(true);}}/>
      <Modal
        visible={!!photo}
        transparent
        presentationStyle="overFullScreen"
        animationType="fade"
        onRequestClose={() => setPhoto(null)}
      >
        {/* Modal creates a separate native view tree. Use the measured React
            context insets from the first frame, without native ancestor lookup. */}
        <View style={[s.photoModal, {
          paddingTop: photoInsets.top,
          paddingBottom: photoInsets.bottom,
          paddingLeft: photoInsets.left,
          paddingRight: photoInsets.right,
        }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭照片" hitSlop={8} onPress={() => setPhoto(null)} style={[s.iconBtn, s.photoClose]}>
            <Ionicons name="close" size={30} color="#e8dcc8" />
          </Pressable>
          {photo && (
            <Image
              source={{
                uri: API + "/api/photos/" + photo,
                headers: { Authorization: "Bearer " + token },
              }}
              resizeMode="contain"
              style={{ flex: 1, width: "100%" }}
              accessibilityLabel="运动打卡照片"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function Login({
  onLogin,
  error,
}: {
  onLogin: (email: string, password: string, registration?: {setupCode: string}) => Promise<void>;
  error: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [register, setRegister] = useState(false),
    [confirmPassword, setConfirmPassword] = useState(""),
    [setupCode, setSetupCode] = useState(""),
    [registrationAvailable, setRegistrationAvailable] = useState(false);
  useEffect(() => {
    if (!API) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch(API + '/api/setup', {signal: controller.signal})
      .then(res => res.ok ? res.json() : null)
      .then(data => setRegistrationAvailable(!!data?.registrationAvailable))
      .catch(() => {}).finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);
  return (
    <SafeAreaView style={s.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <ImageBackground
            source={require("./assets/coast.jpg")}
            style={[s.hero, { height: 310, marginHorizontal: 0 }]}
          >
            <Fade />
            <Text style={[s.brand, { marginBottom: 35 }]}>≋ dailyRep</Text>
            <Text style={s.title}>{"每一次坚持，\n都有回响。"}</Text>
            <Text style={s.subtitle}>一片只属于你的运动空间。</Text>
          </ImageBackground>
          <View style={{ padding: 28 }}>
            <Text style={[s.sectionTitle, { marginTop: 0 }]}>{register ? '创建个人账号' : '欢迎回来'}</Text>
            <Text style={s.muted}>{register ? '注册后开始记录你的第一场运动' : '登录后查看你的个人运动记录'}</Text>
            <Text style={s.fieldLabel}>邮箱</Text>
            <TextInput
              accessibilityLabel="邮箱"
              style={s.loginInput}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="你的邮箱"
              placeholderTextColor="#7c899e"
            />
            <Text style={s.fieldLabel}>密码</Text>
            <TextInput
              accessibilityLabel="密码"
              style={s.loginInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={register ? 'new-password' : 'current-password'}
              maxLength={1024}
              placeholder={register ? '设置密码，至少8位' : '输入密码'}
              placeholderTextColor="#7c899e"
            />
            {register && <>
              <Text style={s.fieldLabel}>确认密码</Text>
              <TextInput accessibilityLabel="确认密码" style={s.loginInput} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" placeholder="再次输入密码" placeholderTextColor="#7c899e" />
              <Text style={s.fieldLabel}>首次注册邀请码</Text>
              <TextInput accessibilityLabel="首次注册邀请码" style={s.loginInput} value={setupCode} onChangeText={setSetupCode} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="输入服务所有者的邀请码" placeholderTextColor="#7c899e" />
            </>}
            {err || error ? <Text style={s.error}>{err || error}</Text> : null}
            <Pressable
              disabled={busy}
              style={[s.gold, { marginTop: 28, opacity: busy ? 0.6 : 1 }]}
              onPress={async () => {
                if (!email.trim() || !password) {
                  void playInteraction("error");
                  setErr("请输入邮箱和密码");
                  return;
                }
                if (register && (password.length < 8 || password !== confirmPassword || !setupCode.trim())) {
                  void playInteraction("error");
                  setErr('请设置至少8位密码，确认两次输入一致，并填写邀请码');
                  return;
                }
                setBusy(true);
                setErr("");
                try {
                  await onLogin(email.trim(), password, register ? {setupCode: setupCode.trim()} : undefined);
                  void playInteraction("confirm");
                } catch (e: any) {
                  void playInteraction("error");
                  setErr(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <ActivityIndicator color="#1f2a44" />
              ) : (
                <Text style={s.goldText}>{register ? '注册并进入' : '登录查看数据'}</Text>
              )}
            </Pressable>
            {(registrationAvailable || register) && <Pressable disabled={busy} onPress={() => {setRegister(!register); setErr('');}} style={{padding: 16, alignItems: 'center'}}>
              <Text style={{color: '#c6a75e'}}>{register ? '已有账号？返回登录' : '首次使用？创建个人账号'}</Text>
            </Pressable>}
            <Text style={s.footer}>个人账号 · 数据私密保存</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function BarChart({
  bars,
  unit,
}: {
  bars: { label: string; value: number }[];
  unit: string;
}) {
  const ceiling = Math.ceil(Math.max(...bars.map((b) => b.value), 1) / 3) * 3;
  return (
    <View style={s.chartCard}>
      <View style={{ flexDirection: "row" }}>
        <View style={s.axis}>
          {[ceiling, (ceiling * 2) / 3, ceiling / 3, 0].map((n) => (
            <Text key={n} style={s.axisText}>
              {fmt(n)}
            </Text>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={bars.length > 12}
        >
          <View
            style={{
              width:
                bars.length > 12
                  ? bars.length * 27
                  : Math.max(260, bars.length * 32),
              height: 215,
            }}
          >
            <View style={s.grid}>
              {[0, 1, 2, 3].map((n) => (
                <View key={n} style={s.gridLine} />
              ))}
            </View>
            <View style={s.bars}>
              {bars.map((b, i) => (
                <View
                  key={i}
                  style={s.column}
                  accessibilityLabel={`${b.label}，${fmt(b.value)}${unit}`}
                >
                  <View style={s.barSpace}>
                    <View
                      style={[
                        s.bar,
                        {
                          height: (b.value / ceiling) * 180,
                          backgroundColor:
                            b.value === Math.max(...bars.map((b) => b.value))
                              ? "#dcc185"
                              : "#b49b62",
                        },
                      ]}
                    >
                      {b.value > 0 && bars.length <= 12 && (
                        <Text style={s.barValue}>{fmt(b.value)}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={s.axisText}>
                    {bars.length === 7 ? "周" : ""}
                    {b.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
function CategoryPicker({options, value, onChange, disabled = false}: {
  options: {value: string; label: string}[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <View style={{marginTop: 10}}>
    <Pressable accessibilityRole="button" accessibilityLabel="选择运动类型" accessibilityState={{expanded: open, disabled}} disabled={disabled} onPress={() => setOpen(!open)} style={[s.row, {minHeight: 52, paddingHorizontal: 16, backgroundColor: "#26334a", borderRadius: 12, borderWidth: 1, borderColor: "#c6a75e66"}]}>
      <Text style={s.tabText}>{options.find(o => o.value === value)?.label || "请选择类型"}</Text>
      <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color="#c6a75e" />
    </Pressable>
    {open && !disabled && <View style={{backgroundColor: "#26334a", borderRadius: 12, marginTop: 4}}>
      {options.map(option => <Pressable feedback="selection" key={option.value} accessibilityRole="button" accessibilityState={{selected: option.value === value}} onPress={() => {onChange(option.value); setOpen(false);}} style={[s.row, {minHeight: 52, paddingHorizontal: 16}]}>
        <Text style={{color: option.value === value ? "#c6a75e" : "#e8dcc8", fontSize: 16}}>{option.label}</Text>
        {option.value === value && <Ionicons name="checkmark" size={20} color="#c6a75e" />}
      </Pressable>)}
    </View>}
  </View>;
}
function Checkin({
  sport,
  plans,
  initialPlanId,
  onClose,
  onSave,
}: {
  sport: Sport;
  plans: any[];
  initialPlanId: string;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
}) {
  const [time, setTime] = useState(new Date()),
    [picker, setPicker] = useState<"date" | "time" | null>(null),
    [value, setValue] = useState(""),
    [details, setDetails] = useState([{subtype: subtypeOptions(sport)[0]?.value || "", value: "", minutes: "", seconds: "0", sets: [""]}]),
    [pushupSets, setPushupSets] = useState([""]),
    [minutes, setMinutes] = useState("30"),
    [seconds, setSeconds] = useState("0"),
    [photo, setPhoto] = useState<{uri: string} | null>(null),
    [processingPhoto, setProcessingPhoto] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [planId,setPlanId]=useState(initialPlanId||plans.find(p=>p.sport===sport&&p.status==='active'&&isDue(p,dateInZone(time,p.timeZone)))?.id||"");
  const eligiblePlans=plans.filter(p=>p.sport===sport&&p.status!=='archived'&&dateInZone(time,p.timeZone)>=p.startDate&&dateInZone(time,p.timeZone)<=p.endDate);
  useEffect(()=>{if(planId&&!eligiblePlans.some(p=>p.id===planId))setPlanId("");},[time,plans,planId]);
  const sp = sports[sport];
  const hasDetails = subtypeOptions(sport).length > 0;
  const changeDetail = (index: number, patch: Partial<(typeof details)[number]>) => setDetails(rows => rows.map((row,i) => i === index ? {...row,...patch} : row));
  async function choose(camera: boolean) {
    if (busy || processingPhoto) return;
    setProcessingPhoto(true);
    try {
      const permission = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          camera
            ? "需要相机权限才能拍照，可前往系统设置开启。"
            : "需要相册权限才能选择照片。",
        );
        return;
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
          });
      if (!result.canceled) {
        const asset = result.assets[0];
        const context = ImageManipulator.manipulate(asset.uri);
        let image: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
        try {
          // Decode the source (including HEIC) and actually encode a new JPEG.
          // Limit the long edge without enlarging small photos or changing ratio.
          if (Math.max(asset.width, asset.height) > 2400) {
            context.resize(asset.width >= asset.height ? {width: 2400} : {height: 2400});
          }
          image = await context.renderAsync();
          const converted = await image.saveAsync({format: SaveFormat.JPEG, compress: 0.82});
          const file = new File(converted.uri);
          if (!file.exists || !file.size) throw new Error("照片处理失败，请重新选择照片");
          if (file.size > 8 * 1024 * 1024) {
            file.delete();
            throw new Error("照片处理后仍超过8MB，请选择较小的照片");
          }
          setPhoto({uri: converted.uri});
          setError("");
        } finally {
          image?.release();
          context.release();
        }
      }
    } catch (e: any) {
      setError(e.message?.includes('照片') ? e.message : "无法处理这张照片，请确认照片已从 iCloud 下载后重试。");
    } finally {
      setProcessingPhoto(false);
    }
  }
  async function save() {
    if (processingPhoto || busy) return;
    const detailValues = details.map(d => ({subtype: d.subtype, value: sport === "abs" ? d.sets.reduce((sum,v) => sum+Number(v),0) : Number(d.value), duration: Number(d.minutes) * 60 + Number(d.seconds), ...(sport === "abs" ? {sets: d.sets.map(Number)} : {})}));
    const v = hasDetails ? detailValues.reduce((sum,d) => sum+d.value,0) : sport === "pushups" ? pushupSets.reduce((sum,v) => sum+Number(v),0) : Number(value),
      m = Number(minutes), sec = Number(seconds),
      duration = hasDetails ? detailValues.reduce((sum,d) => sum+d.duration,0) : m * 60 + sec;
    if (
      (hasDetails && details.some(d => (sport === "abs" ? d.sets.some(v => !Number.isInteger(Number(v)) || Number(v) < 1) : !Number.isFinite(Number(d.value)) || Number(d.value) <= 0) || !Number.isInteger(Number(d.minutes)) || Number(d.minutes) < 0 || !Number.isInteger(Number(d.seconds)) || Number(d.seconds) < 0 || Number(d.seconds) > 59 || Number(d.minutes)*60+Number(d.seconds) < 1)) ||
      (sport === "pushups" && pushupSets.some(v => !Number.isInteger(Number(v)) || Number(v) < 1)) ||
      !Number.isFinite(v) ||
      v <= 0 ||
      v > 100000 ||
      (sport === "pushups" && !Number.isInteger(v)) ||
      !Number.isInteger(m) ||
      !Number.isInteger(sec) ||
      m < 0 ||
      sec < 0 ||
      sec > 59 ||
      duration < 1 ||
      duration > 86400 ||
      time > new Date()
    ) {
      void playInteraction("error");
      setError("请检查运动量、时长及时间，不能选择未来时间");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("sport", sport);
      if(planId)data.append("planId",planId);
      if (hasDetails) data.append("details", JSON.stringify(detailValues));
      else if (sport === "pushups") data.append("details", JSON.stringify([{subtype:null,sets:pushupSets.map(Number),duration,value:v}]));
      data.append("value", String(v));
      data.append("duration", String(duration));
      data.append("occurredAt", time.toISOString());
      if (photo)
        data.append("photo", {
          uri: photo.uri,
          name: "checkin.jpg",
          type: "image/jpeg",
        } as any);
      await onSave(data);
    } catch (e: any) {
      void playInteraction("error");
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={s.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.formHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="关闭打卡窗口" hitSlop={8} style={s.textAction} disabled={busy} onPress={onClose}>
              <Text style={s.muted}>取消</Text>
            </Pressable>
            <Text style={s.sportName}>{sp.name}打卡</Text>
            <View style={{ width: 48 }} />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={s.formBeige}>
              <Text style={s.darkLabel}>运动时间</Text>
              <View style={[s.row, { marginTop: 16 }]}>
                <Pressable accessibilityRole="button" hitSlop={4} style={s.textAction} onPress={() => setPicker("date")}>
                  <Text style={s.darkLabel}>
                    ▦ {time.toLocaleDateString("zh-CN")}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" hitSlop={4} style={s.textAction} onPress={() => setPicker("time")}>
                  <Text style={s.darkLabel}>
                    {time.toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}{" "}
                    ✎
                  </Text>
                </Pressable>
              </View>
              <Text style={s.darkHint}>默认当前时间，可修改补打卡</Text>
            </View>
            {picker && (
              <View>
                {Platform.OS === "ios" && (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    style={[s.textAction, {alignSelf: "flex-end"}]}
                    onPress={() => setPicker(null)}
                  >
                    <Text style={{ color: "#c6a75e" }}>完成</Text>
                  </Pressable>
                )}
                <DateTimePicker
                  value={time}
                  mode={picker}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  themeVariant="dark"
                  onChange={(event, date) => {
                    if (Platform.OS === "android") setPicker(null);
                    if (date && event.type === "set") {void playInteraction("selection");setTime(date);}
                  }}
                />
              </View>
            )}
            <View style={{marginBottom:20}}><Text style={s.fieldLabel}>关联长期计划（可选）</Text><CategoryPicker options={[{value:'',label:'自由打卡，不关联计划'},...eligiblePlans.map(p=>({value:p.id,label:p.title+(isDue(p,dateInZone(time,p.timeZone))?' · 当天计划':' · 额外训练')}))]} value={planId} onChange={setPlanId} disabled={busy}/><Text style={s.small}>同一天打卡多次仍只算一个训练日；补打卡按所选运动日期计算。</Text></View>
            {hasDetails ? <View style={{marginBottom: 20, gap: 12}}>
              <Text style={s.fieldLabel}>{sport === "swimming" ? "本次游泳明细" : "本次训练明细"}</Text>
              <Text style={s.small}>同一次运动可添加多种类型，共用日期和照片，保存后算一次打卡。</Text>
              {details.map((detail,index) => <View key={index} style={{padding: 16, borderRadius: 16, backgroundColor: "#26334a", gap: 12}}>
                <View style={s.row}><Text style={s.tabText}>明细 {index+1}</Text>
                  {details.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`移除明细${index+1}`} style={s.iconBtn} disabled={busy} onPress={() => setDetails(rows => rows.filter((_,i) => i !== index))}><Ionicons name="close" size={22} color="#e8dcc8" /></Pressable>}
                </View>
                <CategoryPicker options={subtypeOptions(sport).filter(option => option.value === detail.subtype || !details.some(d => d.subtype === option.value))} value={detail.subtype} onChange={subtype => changeDetail(index,{subtype})} disabled={busy} />
                {sport === "abs" ? <SetEditor values={detail.sets} onChange={sets => changeDetail(index,{sets})} disabled={busy} /> : <>
                <Text style={s.tabText}>{sport === "swimming" ? "距离" : "训练量"}（{sp.unit}）</Text>
                <TextInput accessibilityLabel={`${subtypeLabel(sport,detail.subtype)}运动量`} style={[s.formInput,{backgroundColor:"#e8dcc8",paddingHorizontal:12,marginTop:0}]} keyboardType="decimal-pad" value={detail.value} onChangeText={value => changeDetail(index,{value})} placeholder="0" placeholderTextColor="#777" editable={!busy} />
                </>}
                <Text style={s.tabText}>时长</Text>
                <View style={[s.row,{gap:8}]}>
                  <TextInput accessibilityLabel={`${subtypeLabel(sport,detail.subtype)}分钟数`} style={[s.formInput,{flex:1,backgroundColor:"#e8dcc8",paddingHorizontal:12,marginTop:0}]} keyboardType="number-pad" value={detail.minutes} onChangeText={minutes => changeDetail(index,{minutes})} placeholder="0" placeholderTextColor="#777" editable={!busy} /><Text style={s.tabText}>分</Text>
                  <TextInput accessibilityLabel={`${subtypeLabel(sport,detail.subtype)}秒数`} style={[s.formInput,{flex:1,backgroundColor:"#e8dcc8",paddingHorizontal:12,marginTop:0}]} keyboardType="number-pad" value={detail.seconds} onChangeText={seconds => changeDetail(index,{seconds})} editable={!busy} /><Text style={s.tabText}>秒</Text>
                </View>
              </View>)}
              {details.length < subtypeOptions(sport).length && <Pressable accessibilityRole="button" disabled={busy} style={[s.outline,{minHeight:52}]} onPress={() => {
                const next = subtypeOptions(sport).find(option => !details.some(d => d.subtype === option.value));
                if (next) setDetails(rows => [...rows,{subtype:next.value,value:"",minutes:"",seconds:"0",sets:[""]}]);
              }}><Ionicons name="add" size={20} color="#c6a75e" /><Text style={s.tabText}>{sport === "swimming" ? "添加泳姿" : "添加训练项目"}</Text></Pressable>}
              <Text style={s.tabText}>本次合计：{fmt(details.reduce((sum,d) => sum+(sport === "abs" ? d.sets.reduce((n,v) => n+(Number(v)||0),0) : (Number(d.value)||0)),0))} {sp.unit} · {Math.floor(details.reduce((sum,d) => sum+(Number(d.minutes)||0)*60+(Number(d.seconds)||0),0)/60)} 分钟 · 1 次打卡</Text>
            </View> : <>
            <View style={s.formBeige}>
              <Text style={s.darkLabel}>
                {sport === "running"
                  ? "跑量"
                  : sport === "swimming"
                    ? "游泳距离"
                    : sport === "pushups"
                      ? "俯卧撑次数"
                      : "训练时长"}
                （{sp.unit}）
              </Text>
              {sport === "pushups" ? <View style={{padding:12,backgroundColor:"#26334a",borderRadius:12,marginTop:12}}><SetEditor values={pushupSets} onChange={setPushupSets} disabled={busy} /></View> : (
              <TextInput
                accessibilityLabel="运动量"
                style={s.formInput}
                keyboardType="decimal-pad"
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor="#8b8b8b"
              />              )}

            </View>
            <View style={s.formBeige}>
              <Text style={s.darkLabel}>运动时长</Text>
              <View style={[s.row, { gap: 12, marginTop: 12 }]}>
                <TextInput
                  accessibilityLabel="运动分钟数"
                  style={[s.formInput, { flex: 1, marginTop: 0 }]}
                  keyboardType="number-pad"
                  value={minutes}
                  onChangeText={setMinutes}
                />
                <Text style={s.darkLabel}>分</Text>
                <TextInput
                  accessibilityLabel="运动秒数"
                  style={[s.formInput, { flex: 1, marginTop: 0 }]}
                  keyboardType="number-pad"
                  value={seconds}
                  onChangeText={setSeconds}
                />
                <Text style={s.darkLabel}>秒</Text>
              </View>
            </View>
            </>}
            <Text style={s.fieldLabel}>
              打卡照片 <Text style={s.small}>（可选 · 最大8MB）</Text>
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <Pressable disabled={busy || processingPhoto} style={s.outline} onPress={() => choose(true)}>
                <Ionicons name="camera-outline" size={20} color="#e8dcc8" />
                <Text style={s.tabText}>拍照</Text>
              </Pressable>
              <Pressable disabled={busy || processingPhoto} style={s.outline} onPress={() => choose(false)}>
                <Ionicons name="image-outline" size={20} color="#e8dcc8" />
                <Text style={s.tabText}>从相册选择</Text>
              </Pressable>
            </View>
            {processingPhoto && <View style={[s.row, {gap: 8, marginTop: 16}]}>
              <ActivityIndicator color="#c6a75e" /><Text style={s.small}>正在处理照片…</Text>
            </View>}
            {photo && (
              <View style={{ marginTop: 16 }}>
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: 180, height: 130, borderRadius: 12 }}
                />
                <Pressable accessibilityRole="button" hitSlop={8} style={[s.textAction, {alignSelf: 'flex-start'}]} onPress={() => setPhoto(null)}>
                  <Text style={[s.small, { marginTop: 10 }]}>移除照片</Text>
                </Pressable>
              </View>
            )}
            {error ? <Text style={s.error}>{error}</Text> : null}
            <Pressable
              disabled={busy || processingPhoto}
              onPress={save}
              style={[s.gold, { marginTop: 30, opacity: busy || processingPhoto ? 0.6 : 1 }]}
            >
              {busy ? (
                <ActivityIndicator color="#1f2a44" />
              ) : (
                <Text style={s.goldText}>保存打卡</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#132138" },
  center: {
    flex: 1,
    backgroundColor: "#132138",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  content: { padding: 20, paddingTop: 0 },
  hero: {
    marginHorizontal: -20,
    padding: 25,
    height: 280,
    justifyContent: "flex-end",
    marginBottom: 8,
    overflow: "hidden",
  },
  topline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "absolute",
    left: 16,
    right: 16,
    top: 10,
    zIndex: 2,
  },
  brand: { color: "#e8dcc8", fontWeight: "600", fontSize: 23 },
  eyebrow: {
    color: "#dbc490",
    fontSize: 8,
    letterSpacing: 2.5,
    marginBottom: 14,
  },
  title: {
    color: "#e8dcc8",
    fontWeight: "600",
    fontSize: 34,
    lineHeight: 48,
    letterSpacing: 1,
  },
  subtitle: { color: "#d7d4ce", fontSize: 12, marginTop: 12 },
  iconBtn: {
    width: 48,
    height: 48,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  textAction: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  beige: {
    backgroundColor: "#e8dcc8",
    padding: 24,
    borderRadius: 17,
    marginTop: 8,
  },
  darkLabel: { color: "#1f2a44", fontSize: 13 },
  darkBig: { fontSize: 47, color: "#1f2a44", fontWeight: "600", marginTop: 10 },
  darkUnit: { fontSize: 18, fontWeight: "400" },
  darkHint: { color: "#77716a", fontSize: 10, marginTop: 13 },
  sectionTitle: {
    fontSize: 18,
    color: "#e8dcc8",
    fontWeight: "500",
    marginTop: 28,
    marginBottom: 20,
  },
  sportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  sportCard: {
    width: "48%",
    padding: 20,
    borderWidth: 1,
    borderColor: "#e8dcc827",
    borderRadius: 15,
    backgroundColor: "#28374c",
  },
  sportName: {
    fontSize: 16,
    color: "#e8dcc8",
    fontWeight: "500",
    marginTop: 12,
  },
  sportValue: { fontSize: 29, color: "#f3eadc", marginTop: 17 },
  unit: { fontSize: 12 },
  small: { fontSize: 10, color: "#a4b0c1", marginTop: 10 },
  footer: {
    color: "#8a9aaf",
    fontSize: 10,
    textAlign: "center",
    marginTop: 32,
    marginBottom: 16,
    letterSpacing: 1,
  },
  gold: {
    backgroundColor: "#c6a75e",
    minHeight: 50,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  goldText: { color: "#1f2a44", fontSize: 15, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#25344b",
    padding: 4,
    borderRadius: 11,
    marginTop: 24,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  activeTab: { backgroundColor: "#c6a75e" },
  activeText: { fontSize: 13, color: "#1f2a44" },
  tabText: { fontSize: 13, color: "#e8dcc8" },
  muted: { fontSize: 12, color: "#b0bac9" },
  chartCard: {
    backgroundColor: "#17263c",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8dcc81a",
    paddingTop: 35,
  },
  axis: { width: 28, height: 180, justifyContent: "space-between" },
  axisText: { fontSize: 9, color: "#a8b4c6" },
  grid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    justifyContent: "space-between",
  },
  gridLine: { height: 1, backgroundColor: "#e8dcc81c" },
  bars: { height: 215, flexDirection: "row" },
  column: { flex: 1, alignItems: "center", gap: 12 },
  barSpace: {
    height: 180,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "46%",
    maxWidth: 30,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barValue: {
    position: "absolute",
    top: -21,
    left: -8,
    right: -8,
    textAlign: "center",
    fontSize: 10,
    color: "#e8dcc8",
  },
  record: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#24334a",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  recordValue: { color: "#e8dcc8", fontSize: 20, marginTop: 10 },
  error: {
    backgroundColor: "#6b393955",
    color: "#ffd0bd",
    padding: 14,
    borderRadius: 9,
    fontSize: 12,
    lineHeight: 20,
    marginVertical: 12,
  },
  fieldLabel: { color: "#e8dcc8", fontSize: 13, marginTop: 24 },
  loginInput: {
    borderWidth: 1,
    borderColor: "#e8dcc830",
    borderRadius: 10,
    padding: 15,
    color: "#e8dcc8",
    marginTop: 10,
    fontSize: 15,
    backgroundColor: "#e8dcc808",
  },
  formHeader: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e8dcc815",
  },
  formBeige: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: "#e8dcc8",
    marginBottom: 16,
  },
  formInput: {
    backgroundColor: "#f4eadb",
    color: "#1f2a44",
    fontSize: 25,
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  outline: {
    borderWidth: 1,
    borderColor: "#e8dcc840",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  photoModal: { flex: 1, backgroundColor: "#080f1d" },
  photoClose: { alignSelf: "flex-end", marginTop: 8, marginRight: 16, marginBottom: 8 },
});
export default function Root() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <App />
    </SafeAreaProvider>
  );
}
