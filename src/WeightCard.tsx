import React, {useEffect, useRef, useState} from "react";
import {Modal, ScrollView, StyleSheet, Text, TextInput, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Ionicons} from "@expo/vector-icons";
import Svg, {Circle, Line, Polyline, Text as SvgText} from "react-native-svg";
import {FeedbackPressable as Pressable} from "./FeedbackPressable";

export type WeightEntry = {day: string; kg: number};
type Api = (route: string, options?: RequestInit) => Promise<any>;

export function localWeightDay(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function WeightTrend({entries}: {entries: WeightEntry[]}) {
  const ordered = [...entries].reverse();
  const weights = ordered.map(entry => entry.kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const step = Math.max(0.5, Math.ceil((max - min) / 1.5) / 2);
  const low = Math.floor(min / step) * step - step;
  const high = Math.ceil(max / step) * step + step;
  const first = Date.parse(ordered[0].day);
  const span = Date.parse(ordered[ordered.length-1].day) - first;
  const y = (kg: number) => 133 - (kg - low) * 111 / (high - low);
  const points = ordered.map(entry => ({
    x:span ? 45 + (Date.parse(entry.day) - first) * 258 / span : 174,
    y:y(entry.kg),
  }));
  const change = Number((weights[weights.length-1] - weights[0]).toFixed(3));
  return <View style={styles.trend}>
    <Text accessibilityRole="header" style={styles.heading}>体重趋势</Text>
    <Text style={styles.text}>{span ? `这段时间 ${change>0?"+":""}${change} kg` : "再记录一次，就能看到变化。"}</Text>
    <View accessible accessibilityLabel={span ? `体重从 ${weights[0]} 公斤变化至 ${weights[weights.length-1]} 公斤` : `目前一笔记录，${weights[0]} 公斤`}>
      <Svg viewBox="0 0 320 151" width="100%" height={154} accessible={false}>
        {[high,(high+low)/2,low].map(value=><React.Fragment key={value}>
          <Line x1={45} x2={303} y1={y(value)} y2={y(value)} stroke="#e8dcc833"/>
          <SvgText x={37} y={y(value)+4} fill="#aab4c6" textAnchor="end" fontSize={11}>{Number(value.toFixed(2))}</SvgText>
        </React.Fragment>)}
        {span>0&&<Polyline points={points.map(point=>`${point.x},${point.y}`).join(" ")} fill="none" stroke="#e5c979" strokeWidth={2}/>}
        {(points.length>30?[points[points.length-1]]:points).map((point,index)=><Circle key={index} cx={point.x} cy={point.y} r={3} fill="#e5c979"/>)}
      </Svg>
    </View>
    <View style={styles.entry}><Text style={styles.text}>{ordered[0].day}</Text><Text style={styles.text}>{span?ordered[ordered.length-1].day+" · kg":"kg"}</Text></View>
  </View>;
}

export function WeightScreen({api,onClose,onTodayChange}: {
  api: Api;
  onClose: () => void;
  onTodayChange: (entry: WeightEntry | null) => void;
}) {
  const insets=useSafeAreaInsets();
  const [entries, setEntries] = useState<WeightEntry[] | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef(false);

  async function load() {
    setError("");
    try {
      const data: WeightEntry[] = await api("/account/weight");
      if (active.current) {
        setEntries(data);
        onTodayChange(data.find(entry => entry.day === localWeightDay()) ?? null);
      }
    } catch (e: any) {
      if (active.current) setError(e.status===404?"体重服务尚未更新，请稍后再试。":e.message);
    }
  }

  useEffect(() => {
    active.current = true;
    void load();
    return () => {active.current = false;};
  }, []);

  const today = localWeightDay();
  const todayEntry = entries?.find(entry => entry.day === today);

  async function save() {
    const normalized = input.trim().replace(",", ".");
    const kg = Number(normalized);
    if (!/^\d+(?:\.\d{1,3})?$/.test(normalized) || kg < 1 || kg > 1000) {
      setError("请输入 1 到 1000 公斤之间的体重，最多三位小数。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const entry: WeightEntry = await api("/account/weight", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({day: localWeightDay(), kg}),
      });
      if (!active.current) return;
      onTodayChange(entry);
      setEntries(previous => [entry, ...(previous ?? []).filter(item => item.day !== entry.day)]
        .sort((a, b) => b.day.localeCompare(a.day)).slice(0, 90));
      setEditing(false);
      setNotice("体重已保存");
    } catch (e: any) {
      if (active.current) setError(e.message);
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>{if(!busy)onClose();}}>
    <View style={[styles.screen,{paddingTop:insets.top,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right}]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.pageTitle}>体重记录</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭体重记录" style={styles.close} disabled={busy} onPress={onClose}>
          <Ionicons name="close" color="#e8dcc8" size={26}/>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    {!!entries?.length && <WeightTrend entries={entries}/>}
    <View style={styles.card}>
    <Text style={styles.heading}>今日体重</Text>
    <Text style={styles.text}>{todayEntry ? `今日 ${todayEntry.kg} kg` : entries ? "今天还没有记录" : "正在读取体重记录…"}</Text>
    {entries && (editing ? <>
      <TextInput accessibilityLabel="体重（公斤）" style={styles.input} keyboardType="decimal-pad" placeholder="输入体重（kg）"
        placeholderTextColor="#aab4c6" value={input} onChangeText={setInput} editable={!busy} maxLength={8} />
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => {setEditing(false);setError("");}}>
          <Text style={styles.text}>取消</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.button,styles.gold]} onPress={() => void save()}>
          <Text style={styles.goldText}>{busy ? "保存中…" : "保存体重"}</Text>
        </Pressable>
      </View>
    </> : <Pressable accessibilityRole="button" style={[styles.button,styles.gold]} onPress={() => {
      setInput(todayEntry ? String(todayEntry.kg) : "");setNotice("");setEditing(true);
    }}><Text style={styles.goldText}>{todayEntry ? "修改今日体重" : "记录今日体重"}</Text></Pressable>)}
    {!!notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
    {!!error && <Text accessibilityRole="alert" style={{color:"#ffa6a4"}}>{error}</Text>}
    {!entries && !!error && <Pressable style={styles.button} onPress={() => void load()}><Text style={styles.text}>重新读取</Text></Pressable>}
    {!!entries?.length && <Pressable accessibilityRole="button" accessibilityState={{expanded}} style={styles.button} onPress={() => setExpanded(!expanded)}>
      <Text style={styles.text}>{expanded ? "收起体重记录" : "查看近期体重记录"}</Text>
    </Pressable>}
    {expanded && entries?.map(entry => <View key={entry.day} style={styles.entry}>
      <Text style={styles.text}>{entry.day}</Text><Text style={styles.text}>{entry.kg} kg</Text>
    </View>)}
    </View>
    </ScrollView>
    </View>
  </Modal>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#132138"},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:20},
  pageTitle:{color:"#e8dcc8",fontSize:28,fontWeight:"700"},
  close:{width:48,height:48,alignItems:"center",justifyContent:"center"},
  content:{padding:20,gap:14},
  trend:{backgroundColor:"#23324b",borderRadius:18,padding:16,gap:8},
  card:{backgroundColor:"#23324b",borderRadius:18,padding:16,gap:10},
  heading:{color:"#e8dcc8",fontSize:20,fontWeight:"700"},
  text:{color:"#e8dcc8"},
  input:{minHeight:48,padding:12,borderRadius:10,color:"#e8dcc8",backgroundColor:"#132138"},
  actions:{flexDirection:"row",gap:12},
  button:{minHeight:44,justifyContent:"center",alignItems:"center",paddingHorizontal:14,borderRadius:10,borderWidth:1,borderColor:"#e8dcc849"},
  gold:{backgroundColor:"#c6a75e",borderColor:"#c6a75e"},
  goldText:{color:"#132138",fontWeight:"700"},
  entry:{flexDirection:"row",justifyContent:"space-between",paddingVertical:5},
});
