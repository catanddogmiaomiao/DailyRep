import {FeedbackPressable as Pressable} from "./FeedbackPressable";
import React, {useEffect,useState} from "react";
import {Alert,ActivityIndicator,RefreshControl,ScrollView,StyleSheet,Switch,Text,TextInput,View} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {Ionicons} from "@expo/vector-icons";
import {addDays,dayDistance,SPORT_NAMES,repeatLabel,dateInZone} from "./plans";
import {requestReminderPermission,notificationStatus,openNotificationSettings,getWidgetDiagnostics,refreshWidgets,playInteraction} from "./nativeReminders";
export type TrainingPlan = any;
export type PlanAPI = (route:string,options?:RequestInit)=>Promise<any>;
const sportName=(key:string)=>(SPORT_NAMES as Record<string,string>)[key];
const keyOf=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const button=(label:string,onPress:()=>void,chosen=false,disabled=false)=><Pressable feedback="selection" key={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[p.button,chosen&&p.chosen,disabled&&{opacity:0.4}]}><Text style={chosen?p.chosenText:p.text}>{label}</Text></Pressable>;
function planStatus(plan:TrainingPlan) {
  if(plan.status==="finished")return "已结束";
  if(plan.status==="paused")return "已暂停";
  if(plan.progress.ended)return "阶段完成";
  if(plan.progress.today<plan.startDate)return "待开始";
  if(plan.progress.doneToday)return "今日已打卡";
  return plan.progress.dueToday?"今日待打卡":"今日休息";
}
function planPriority(plan:TrainingPlan) {
  if(plan.status==="paused")return 3;
  if(plan.progress.ended)return 2;
  return plan.progress.dueToday&&!plan.progress.doneToday?0:1;
}
function Disclosure({label,expanded,onPress}:{label:string;expanded:boolean;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={onPress} style={[p.row,p.disclosure]}>
    <Text style={p.text}>{label}</Text>
    <Ionicons name={expanded?"chevron-up":"chevron-down"} color="#a9b4c6" size={16}/>
  </Pressable>;
}
export function PlansPanel({visible,plans,api,onChanged,onPlanSaved,onCheckin,coverage}:{visible:boolean;plans:TrainingPlan[];api:PlanAPI;onChanged:()=>Promise<void>;onPlanSaved:(plan:any)=>void;onCheckin:(sport:string,planId:string)=>void;coverage:any}) {
  const [editing,setEditing]=useState<TrainingPlan|undefined|null>(undefined),[busy,setBusy]=useState(false),[error,setError]=useState(''),[permission,setPermission]=useState('undetermined'),[widgetInfo,setWidgetInfo]=useState<any>(null);
  useEffect(()=>{if(visible)notificationStatus().then(setPermission).catch(()=>setPermission('unavailable'));},[visible,coverage]);
  async function inspectWidget() {
    try {await refreshWidgets();setWidgetInfo(await getWidgetDiagnostics());}
    catch(e:any){setWidgetInfo({error:e.message});}
  }
  const [expandedPlan,setExpandedPlan]=useState<string|null>(null);
  const [showHistory,setShowHistory]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [checkingWidget,setCheckingWidget]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const active=plans.filter(plan=>plan.status==="active"||plan.status==="paused")
    .sort((a,b)=>planPriority(a)-planPriority(b));
  const finished=plans.filter(plan=>plan.status==="finished");

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {await onChanged();}
    catch(e:any){setError(e.message);}
    finally {setRefreshing(false);}
  }
  async function action(plan:TrainingPlan,body:any) {
    if(busy)return;setBusy(true);setError('');
    try {const saved=await api('/plans/'+plan.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,revision:plan.revision})});onPlanSaved(saved);void playInteraction("confirm");await onChanged();}
    catch(e:any){void playInteraction("error");setError(e.message);}finally{setBusy(false);}
  }
  function card(plan:TrainingPlan) {
    const progress=plan.progress;
    const expanded=expandedPlan===plan.id;
    const isActive=plan.status==="active";
    const canCheckIn=isActive&&!progress.ended&&progress.today>=plan.startDate;
    const due=canCheckIn&&progress.dueToday&&!progress.doneToday;
    const atMilestone=isActive&&progress.ended;
    const extend=(goalDays:number)=>action(plan,{action:"extend",goalDays});
    return <View key={plan.id} style={p.card}>
      <View style={p.row}>
        <Text style={p.muted}>{sportName(plan.sport)}</Text>
        <Text style={due?p.dueBadge:p.badge}>{planStatus(plan)}</Text>
      </View>
      <Text accessibilityRole="header" style={p.cardTitle}>{plan.title}</Text>
      <View style={p.row}>
        <Text style={p.big}>{progress.completedDays}<Text style={p.muted}> 天已训练</Text></Text>
        <Text style={p.muted}>第 {progress.elapsedDays} / {progress.goalDays} 天</Text>
      </View>
      <View style={p.track}><View style={[p.fill,{width:`${Math.min(100,progress.elapsedDays/Math.max(1,progress.goalDays)*100)}%`}]}/></View>
      <View style={[p.row,p.cardActions]}>
        <Disclosure label="详情" expanded={expanded} onPress={()=>setExpandedPlan(expanded?null:plan.id)}/>
        {due&&button("去打卡",()=>onCheckin(plan.sport,plan.id),true,busy)}
        {plan.status==="paused"&&button("恢复计划",()=>action(plan,{action:"resume"}),false,busy)}
        {atMilestone&&progress.nextGoals.length>0&&button(`继续到 ${progress.nextGoals[0]} 天`,()=>extend(progress.nextGoals[0]),true,busy)}
      </View>
      {expanded&&<View style={p.details}>
        <Text style={p.text}>{plan.startDate} 至 {plan.endDate}</Text>
        <Text style={p.muted}>{repeatLabel(plan.repeat)} · {plan.reminderEnabled?plan.reminderTime+" 提醒":"未设置提醒"}</Text>
        <Text style={p.muted}>连续完成 {progress.streak} 个训练日</Text>
        <View style={p.wrap}>
          {canCheckIn&&!due&&button("记录训练",()=>onCheckin(plan.sport,plan.id),false,busy)}
          {isActive&&button("调整安排",()=>setEditing(plan),false,busy)}
          {isActive&&!progress.ended&&button("暂停计划",()=>Alert.alert("暂停计划","暂停期间不发送提醒，恢复后结束日期会顺延。",[
            {text:"取消",style:"cancel"},{text:"暂停",onPress:()=>action(plan,{action:"pause"})},
          ]),false,busy)}
          {atMilestone&&progress.nextGoals.slice(1).map((goal:number)=>button(`继续到 ${goal} 天`,()=>extend(goal),false,busy))}
          {plan.status!=="paused"&&plan.goalDays<3650&&button("自定下一阶段",()=>Alert.prompt(
            "下一阶段","输入新的总目标天数。",text=>extend(Number(text)),"plain-text",String(Math.min(3650,plan.goalDays+30)),"number-pad",
          ),false,busy)}
          {isActive&&button("结束计划",()=>Alert.alert("结束计划","结束后停止提醒，已有打卡和进度保留。",[
            {text:"取消",style:"cancel"},{text:"结束",style:"destructive",onPress:()=>action(plan,{action:"finish"})},
          ]),false,busy)}
          {plan.status==="finished"&&button("隐藏计划",()=>action(plan,{action:"archive"}),false,busy)}
        </View>
      </View>}
    </View>;
  }

  return <View style={p.screen}>
    <View style={[p.row,p.header]}>
      {editing!==undefined&&<Pressable accessibilityRole="button" accessibilityLabel="返回计划列表" disabled={busy} style={p.iconButton}
        onPress={()=>{setEditing(undefined);setError("");}}><Ionicons name="chevron-back" size={23} color="#e8dcc8"/></Pressable>}
      <Text accessibilityRole="header" style={p.pageTitle}>{editing===undefined?"长期计划":editing?"调整计划":"新建计划"}</Text>
      {editing===undefined&&<Pressable accessibilityRole="button" disabled={busy} style={p.newPlan}
        onPress={()=>{setError("");setEditing(null);}}><Text style={p.newText}>＋ 新建</Text></Pressable>}
    </View>
    <ScrollView key={editing===undefined?"list":"form"} keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets contentContainerStyle={p.content}
      refreshControl={editing===undefined?<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()} tintColor="#c6a75e"/>:undefined}>
      {error!==""&&<Text accessibilityRole="alert" style={p.error}>{error}</Text>}
      {editing!==undefined?<PlanForm key={editing?.id||"new"} plan={editing} busy={busy} onSave={async input=>{
        setBusy(true);setError("");
        try {
          if(input.reminderEnabled)setPermission(await requestReminderPermission());
          const saved=await api(editing?"/plans/"+editing.id:"/plans",{
            method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify(editing?{...input,action:"edit",revision:editing.revision}:input),
          });
          onPlanSaved(saved);setEditing(undefined);void playInteraction("confirm");await onChanged();
        }catch(e:any){void playInteraction("error");setError(e.message);}
        finally{setBusy(false);}
      }}/>:<>
        {active.length>0?<><Text accessibilityRole="header" style={p.sectionTitle}>当前计划</Text>{active.map(card)}</>:
          <View style={p.card}>
            <Text style={p.cardTitle}>暂无当前计划</Text>
            <Text style={p.muted}>选一个训练项目，设下你想坚持的目标。</Text>
          </View>}
        {finished.length>0&&<View style={p.secondary}>
          <Disclosure label={`已结束（${finished.length}）`} expanded={showHistory} onPress={()=>setShowHistory(!showHistory)}/>
          {showHistory&&finished.map(card)}
        </View>}
        <View style={p.secondary}>
          <Disclosure label="提醒与小组件" expanded={showSettings} onPress={()=>setShowSettings(!showSettings)}/>
          {showSettings&&<View style={p.details}>
            {permission==="denied"?<>
              <Text style={p.muted}>系统通知未开启。</Text>
              {button("打开通知设置",()=>openNotificationSettings())}
            </>:permission==="unavailable"?<Text style={p.muted}>此版本无法使用系统提醒。</Text>:
              coverage?.scheduled>0?<Text style={p.muted}>已安排 {coverage.scheduled} 条提醒，至 {new Date(coverage.through).toLocaleDateString("zh-CN")}。</Text>:
              <Text style={p.muted}>在计划里可设置训练提醒。</Text>}
            <Text style={p.muted}>在 iPhone 主屏幕添加「健身计划列表」，即可查看当前计划。</Text>
            {button(checkingWidget?"正在检查…":"检查小组件",async()=>{
              setCheckingWidget(true);
              try {await inspectWidget();}finally{setCheckingWidget(false);}
            },false,checkingWidget)}
            {widgetInfo&&(widgetInfo.unavailable?<Text style={p.muted}>此版本无法检查小组件。</Text>:
              widgetInfo.error?<Text style={p.error}>{widgetInfo.error}</Text>:<>
                <Text style={p.muted}>已同步 {widgetInfo.appPlanCount} 项计划。</Text>
                <Text style={p.muted}>{widgetInfo.modernWidgetInstalled||widgetInfo.legacyWidgetInstalled?"已检测到小组件。":"尚未检测到小组件。"}</Text>
                {widgetInfo.widgetRead&&<Text style={p.muted}>最近读取：{widgetInfo.widgetRead.state==="loaded"?widgetInfo.widgetRead.count+" 项计划":widgetInfo.widgetRead.state==="empty"?"暂无数据":"读取失败"}</Text>}
              </>)}
          </View>}
        </View>
      </>}
      {busy&&<ActivityIndicator color="#c6a75e"/>}
    </ScrollView>
  </View>;
}
function PlanForm({plan,busy,onSave}:{plan:any;busy:boolean;onSave:(data:any)=>void}) {
  const zone=plan?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [sport,setSport]=useState(plan?.sport||'abs'),[title,setTitle]=useState(plan?.title||''),[start,setStart]=useState(plan?.startDate||dateInZone(new Date(),zone)),[days,setDays]=useState(String(plan?.goalDays||100)),[endMode,setEndMode]=useState('days'),[end,setEnd]=useState(plan?.endDate||addDays(dateInZone(new Date(),zone),99)),[repeat,setRepeat]=useState(plan?.repeat||{frequency:'daily',interval:1,weekdays:[new Date().getDay()],monthMode:'date'}),[time,setTime]=useState(plan?.reminderTime||'19:00'),[remind,setRemind]=useState(plan?.reminderEnabled??true),[picker,setPicker]=useState<string|null>(null);
  const count=endMode==='date'?dayDistance(start,end)+1:Number(days), computedEnd=endMode==='date'?end:Number.isInteger(count)&&count>0&&count<=3650?addDays(start,count-1):'请选择有效天数';
  const date=picker==='time'?new Date(`${start}T${time}:00`):new Date((picker==='end'?end:start)+'T12:00:00');
    const pickerControl=picker&&<View>{button('完成选择',()=>setPicker(null))}<DateTimePicker mode={picker==='time'?'time':'date'} display="spinner" themeVariant="dark" value={date} onChange={(event,value)=>{if(value&&event.type==="set"){void playInteraction("selection");if(picker==='time')setTime(`${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`);else if(picker==='end')setEnd(keyOf(value));else setStart(keyOf(value));}}}/></View>;
  return <>
    <View style={p.formSection}>
    <Text accessibilityRole="header" style={p.cardTitle}>基本信息</Text>
    <Text style={p.label}>训练项目</Text><View style={p.wrap}>{Object.entries(SPORT_NAMES).map(([key,name])=>button(String(name),()=>setSport(key),key===sport,!!plan))}</View>
    <Text style={p.label}>名称（可选）</Text><TextInput style={p.input} value={title} onChangeText={setTitle} placeholder={`${sportName(sport)}${count||100}天计划`} placeholderTextColor="#8895a9" maxLength={60}/>
    </View>
    {!plan&&<View style={p.formSection}><Text accessibilityRole="header" style={p.cardTitle}>训练周期</Text><Text style={p.label}>开始日期</Text>{button(start,()=>setPicker('start'))}
      {picker==="start"&&pickerControl}<View style={p.wrap}>{button('坚持多少天',()=>setEndMode('days'),endMode==='days')}{button('直接选结束日期',()=>setEndMode('date'),endMode==='date')}</View>
      {endMode==='days'?<><View style={p.wrap}>{[30,100,150].map(n=>button(n+'天',()=>setDays(String(n)),days===String(n)))}</View><TextInput accessibilityLabel="坚持天数" style={p.input} value={days} keyboardType="number-pad" onChangeText={setDays}/></>:button(end,()=>setPicker('end'))}
      {endMode==='date'&&picker==='end'&&pickerControl}
      <Text style={p.muted}>含开始当天，共 {count>0?count:'—'} 天，结束于 {computedEnd}。</Text></View>}
    {plan&&<Text style={p.muted}>调整重复与提醒时间从明天生效。开始日期、历史安排和打卡保留；延长期限请使用“下一阶段”。</Text>}
    <View style={p.formSection}>
    <Text accessibilityRole="header" style={p.cardTitle}>重复频率</Text><View style={p.wrap}>{[['daily','每天'],['weekly','每周'],['monthly','每月'],['yearly','每年']].map(([key,label])=>button(label,()=>setRepeat({...repeat,frequency:key}),repeat.frequency===key))}</View>
    <View style={p.row}><Text style={p.text}>每隔</Text><TextInput accessibilityLabel="重复间隔" style={[p.input,{width:90}]} keyboardType="number-pad" value={String(repeat.interval)} onChangeText={v=>setRepeat({...repeat,interval:v===''?'':Number(v)})}/><Text style={p.text}>{({daily:'天',weekly:'周',monthly:'月',yearly:'年'} as Record<string,string>)[repeat.frequency]}</Text></View>
    {repeat.frequency==='weekly'&&<View style={p.wrap}>{[1,2,3,4,5,6,0].map(day=>button('周'+'日一二三四五六'[day],()=>setRepeat({...repeat,weekdays:repeat.weekdays.includes(day)?repeat.weekdays.filter((d:number)=>d!==day):[...repeat.weekdays,day]}),repeat.weekdays.includes(day)))}</View>}
    {repeat.frequency==='monthly'&&<><View style={p.wrap}>{[['date','同起始日'],['last','每月末日'],['ordinal','同序号星期']].map(([key,label])=>button(label,()=>setRepeat({...repeat,monthMode:key}),repeat.monthMode===key))}</View><Text style={p.muted}>同起始日遇到不存在的日期会跳过，例如每月31日不会在2月触发。</Text></>}
    </View>
    <View style={p.formSection}>
    <View style={p.row}><Text accessibilityRole="header" style={p.cardTitle}>系统提醒</Text><Switch value={remind} onValueChange={value=>{void playInteraction("selection");setRemind(value);}} trackColor={{true:'#c6a75e'}}/></View>
    {remind&&button(time,()=>setPicker('time'))}
    {remind&&picker==='time'&&pickerControl}
    <Text style={p.muted}>以 {zone} 的日期和时间执行。提醒会提前安排到系统，打开App或打卡后自动续排。</Text>
    </View>
    {button('保存计划',()=>onSave({sport,title:title.trim()||`${sportName(sport)}${count}天计划`,titleAuto:!title.trim()||!!(plan?.titleAuto&&title===plan.title),startDate:start,endDate:end,endMode,goalDays:count,repeat,reminderTime:time,reminderEnabled:remind,timeZone:zone}),true,busy)}
  </>;
}
const p=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#132138"},
  header:{paddingHorizontal:20,paddingTop:10,paddingBottom:8},
  pageTitle:{flex:1,fontSize:30,fontWeight:"700",color:"#e8dcc8"},
  iconButton:{width:44,minHeight:44,justifyContent:"center",alignItems:"center"},
  newPlan:{minHeight:44,justifyContent:"center",paddingHorizontal:14,borderRadius:12,backgroundColor:"#c6a75e22"},
  newText:{color:"#e5c979",fontWeight:"700"},
  content:{paddingHorizontal:20,paddingBottom:24,paddingTop:12,gap:12},
  formSection:{backgroundColor:"#24334a",borderRadius:16,padding:16,gap:9},
  sectionTitle:{fontSize:14,fontWeight:"600",color:"#a9b4c6"},
  cardTitle:{fontSize:20,fontWeight:"700",color:"#e8dcc8"},
  badge:{color:"#d0d7e2",fontSize:12},
  dueBadge:{color:"#e5c979",fontSize:12,fontWeight:"700"},
  disclosure:{minHeight:44,justifyContent:"flex-start",gap:8},
  cardActions:{flexWrap:"wrap"},
  details:{gap:10,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"#e8dcc855"},
  secondary:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"#e8dcc855",gap:10},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
  card:{padding:18,gap:10,borderRadius:18,backgroundColor:'#24334a',borderWidth:1,borderColor:'#c6a75e33'},
  title:{fontSize:17,fontWeight:'600',color:'#e8dcc8'},big:{fontSize:28,fontWeight:'700',color:'#c6a75e'},text:{color:'#e8dcc8',fontSize:14,lineHeight:21},muted:{color:'#a9b4c6',fontSize:12,lineHeight:19},gold:{color:'#c6a75e',fontSize:12},
  label:{fontSize:15,color:'#e8dcc8',marginTop:10},button:{minHeight:48,paddingHorizontal:14,paddingVertical:12,borderRadius:12,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#c6a75e55'},chosen:{backgroundColor:'#c6a75e'},chosenText:{color:'#1f2a44',fontWeight:'600'},input:{minHeight:50,color:'#e8dcc8',backgroundColor:'#24334a',borderRadius:12,padding:14,fontSize:16},track:{height:5,borderRadius:3,backgroundColor:'#ffffff16',overflow:'hidden'},fill:{height:'100%',backgroundColor:'#c6a75e'},error:{color:'#ffd0bd',backgroundColor:'#6b393955',padding:12,borderRadius:10},
});
