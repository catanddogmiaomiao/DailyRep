import React, {useEffect,useState} from "react";
import {Alert,ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Switch,Text,TextInput,View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import {Ionicons} from "@expo/vector-icons";
import {addDays,dayDistance,SPORT_NAMES,repeatLabel,dateInZone} from "./plans";
import {requestReminderPermission,notificationStatus,openNotificationSettings,reminderBridgeAvailable,getWidgetDiagnostics,refreshWidgets} from "./nativeReminders";
export type TrainingPlan = any;
export type PlanAPI = (route:string,options?:RequestInit)=>Promise<any>;
const sportName=(key:string)=>(SPORT_NAMES as Record<string,string>)[key];
const keyOf=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const button=(label:string,onPress:()=>void,chosen=false,disabled=false)=><Pressable key={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[p.button,chosen&&p.chosen,disabled&&{opacity:0.4}]}><Text style={chosen?p.chosenText:p.text}>{label}</Text></Pressable>;
export function PlanSummary({plan,onPress}:{plan:TrainingPlan;onPress:()=>void}) {
  const progress=plan.progress;
  return <Pressable accessibilityRole="button" onPress={onPress} style={p.card}>
    <View style={p.row}><Text style={p.title}>{plan.title}</Text><Text style={p.gold}>{plan.status==='paused'?'已暂停':plan.status==='finished'?'已结束':progress.ended?'阶段到站':'进行中'}</Text></View>
    <Text style={p.big}>已训练 {progress.completedDays} 天</Text>
    <Text style={p.muted}>计划第 {progress.elapsedDays} / {progress.goalDays} 天 · 连续完成 {progress.streak} 个训练日</Text>
    <View style={p.track}><View style={[p.fill,{width:`${Math.min(100,progress.elapsedDays/Math.max(1,progress.goalDays)*100)}%`}]}/></View>
    <Text style={p.text}>{plan.status==='finished'?'计划已结束，记录已保留':plan.status==='paused'?'恢复时结束日期会顺延':progress.ended?'继续到下一程，或在这里收官':progress.doneToday?'今天已完成 ✓':progress.dueToday?'今天有训练安排':'今天休息，按自己的节奏来'}</Text>
  </Pressable>;
}
export function PlansPanel({visible,plans,api,onChanged,onPlanSaved,onClose,onCheckin,coverage}:{visible:boolean;plans:TrainingPlan[];api:PlanAPI;onChanged:()=>Promise<void>;onPlanSaved:(plan:any)=>void;onClose:()=>void;onCheckin:(sport:string,planId:string)=>void;coverage:any}) {
  const inset=useSafeAreaInsets();
  const [editing,setEditing]=useState<TrainingPlan|undefined|null>(undefined),[busy,setBusy]=useState(false),[error,setError]=useState(''),[permission,setPermission]=useState('undetermined'),[widgetInfo,setWidgetInfo]=useState<any>(null);
  useEffect(()=>{if(visible)notificationStatus().then(setPermission).catch(()=>setPermission('unavailable'));},[visible,coverage]);
  useEffect(()=>{if(!visible){setEditing(undefined);setError('');}},[visible]);
  async function inspectWidget() {
    try {await refreshWidgets();setWidgetInfo(await getWidgetDiagnostics());}
    catch(e:any){setWidgetInfo({error:e.message});}
  }
  useEffect(()=>{if(visible)inspectWidget();},[visible]);
  async function action(plan:TrainingPlan,body:any) {
    if(busy)return;setBusy(true);setError('');
    try {const saved=await api('/plans/'+plan.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,revision:plan.revision})});onPlanSaved(saved);await onChanged();}
    catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={()=>{if(!busy)onClose();}}>
    <View style={{flex:1,backgroundColor:'#132138',paddingTop:inset.top,paddingBottom:inset.bottom,paddingLeft:inset.left,paddingRight:inset.right}}>
      <View style={[p.row,{paddingHorizontal:20,paddingVertical:8}]}>{button(editing===undefined?'关闭':'返回',()=>editing===undefined?onClose():setEditing(undefined),false,busy)}<Text style={p.title}>{editing===undefined?'长期训练计划':editing?'调整计划':'设置长期计划'}</Text><Pressable accessibilityRole="button" accessibilityLabel="刷新计划" disabled={busy} style={{width:48,minHeight:48,alignItems:"center",justifyContent:"center"}} onPress={()=>onChanged().catch((e:any)=>setError(e.message))}><Text style={p.gold}>刷新</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:14}}>
        {error!==''&&<Text accessibilityRole="alert" style={p.error}>{error}</Text>}
        {editing!==undefined ? <PlanForm key={editing?.id||'new'} plan={editing} busy={busy} onSave={async input=>{
          setBusy(true);setError('');try {
            if(input.reminderEnabled)setPermission(await requestReminderPermission());
            const saved=await api(editing?'/plans/'+editing.id:'/plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(editing?{...input,action:'edit',revision:editing.revision}:input)});
            onPlanSaved(saved);setEditing(undefined);await onChanged();
          }catch(e:any){setError(e.message);}finally{setBusy(false);}
        }}/> : <>
          <Text style={p.muted}>计划可设可不设。每个项目可有一个进行中的长期计划，未关联计划的打卡照常统计。</Text>
          {button('＋ 设置长期计划',()=>setEditing(null),true,busy)}
          <Text style={p.muted}>小组件自动显示本App中的计划，无需连接码。更新后添加大号“健身计划列表”，可同时查看四项计划。</Text>
          {button('检查小组件',inspectWidget,false,busy)}
          {widgetInfo&&<View style={p.card}>
            {widgetInfo.unavailable?<Text style={p.text}>当前安装包未包含小组件诊断，请重新Run安装新版。</Text>:widgetInfo.error?<Text style={p.error}>{widgetInfo.error}</Text>:<>
              <Text style={p.text}>App已保存 {widgetInfo.appPlanCount} 项计划供小组件读取。</Text>
              <Text style={p.muted}>{widgetInfo.currentWidgetInstalled?'已检测到新版“健身计划列表”。':widgetInfo.legacyWidgetInstalled?'桌面仍是旧版组件，请移除后添加“健身计划列表”。':'尚未检测到新版小组件，请在主屏幕添加“健身计划列表”。'}</Text>
              <Text style={p.muted}>{widgetInfo.widgetRead?`组件最近读取：${widgetInfo.widgetRead.state==='loaded'?widgetInfo.widgetRead.count+'项计划':widgetInfo.widgetRead.state==='empty'?'暂无同步数据':'读取失败'} · ${new Date(widgetInfo.widgetRead.readAt).toLocaleTimeString('zh-CN')}`:'组件尚未回报读取结果。添加后可再次检查。'}</Text>
            </>}
          </View>}
          {permission==='denied'&&<View style={p.card}><Text style={p.text}>系统通知未开启，计划仍可正常使用。</Text>{button('前往系统设置开启提醒',()=>openNotificationSettings())}</View>}
          {permission==='unavailable'&&<Text style={p.muted}>此安装包尚未包含提醒模块。请在Xcode安装更新后的原生版本。</Text>}
          {coverage?.scheduled>0&&<Text style={p.muted}>系统已安排 {coverage.scheduled} 条提醒，最远至 {new Date(coverage.through).toLocaleDateString('zh-CN')}。每次打开或打卡会自动补齐后续提醒。</Text>}
          {plans.filter(plan=>plan.status!=='archived').map(plan=><View key={plan.id} style={{gap:10}}>
            <PlanSummary plan={plan} onPress={()=>{if(plan.status==='active'&&!plan.progress.ended)onCheckin(plan.sport,plan.id);}}/>
            <Text style={p.muted}>{plan.startDate} — {plan.endDate} · {repeatLabel(plan.repeat)} · {plan.reminderEnabled?plan.reminderTime+'提醒':'不提醒'}</Text>
            {plan.status==='active'&&plan.progress.ended&&<View style={p.card}><Text style={p.title}>{plan.goalDays}天阶段已到站</Text><Text style={p.text}>累计训练 {plan.progress.completedDays} 天，记录和进度会带到下一阶段。</Text><View style={p.wrap}>{plan.progress.nextGoals.map((goal:number)=>button(`继续到${goal}天`,()=>action(plan,{action:'extend',goalDays:goal}),true,busy))}</View></View>}
            <View style={p.wrap}>
              {plan.status==='active'&&!plan.progress.ended&&button('去打卡',()=>onCheckin(plan.sport,plan.id),true,busy)}
              {plan.status==='paused'?button('恢复计划',()=>action(plan,{action:'resume'}),false,busy):plan.status==='active'&&!plan.progress.ended?button('暂停',()=>Alert.alert('暂停计划','暂停时不提醒，恢复后结束日期按暂停天数顺延。已有记录保留。',[{text:'取消'},{text:'暂停',onPress:()=>action(plan,{action:'pause'})}]),false,busy):null}
              {plan.status==='active'&&button('调整安排',()=>setEditing(plan),false,busy)}
              {plan.status!=='paused'&&button('自定下一阶段',()=>Alert.prompt('继续坚持','填写新的总目标天数，例如110或150；保留原计划与打卡。',text=>action(plan,{action:'extend',goalDays:Number(text)}),'plain-text',String(plan.goalDays+30),'number-pad'),false,busy)}
            </View>
            <View style={p.wrap}>
              {plan.status==='active'&&button('结束此计划',()=>Alert.alert('结束计划','结束后停止提醒，已有打卡和进度保留。',[{text:'取消'},{text:'结束',onPress:()=>action(plan,{action:'finish'})}]),false,busy)}
              {plan.status==='finished'&&button('隐藏已结束计划',()=>action(plan,{action:'archive'}),false,busy)}

            </View>
          </View>)}
        </>}
        {busy&&<ActivityIndicator color="#c6a75e"/>}
      </ScrollView>
    </View>
  </Modal>;
}
function PlanForm({plan,busy,onSave}:{plan:any;busy:boolean;onSave:(data:any)=>void}) {
  const zone=plan?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [sport,setSport]=useState(plan?.sport||'abs'),[title,setTitle]=useState(plan?.title||''),[start,setStart]=useState(plan?.startDate||dateInZone(new Date(),zone)),[days,setDays]=useState(String(plan?.goalDays||100)),[endMode,setEndMode]=useState('days'),[end,setEnd]=useState(plan?.endDate||addDays(dateInZone(new Date(),zone),99)),[repeat,setRepeat]=useState(plan?.repeat||{frequency:'daily',interval:1,weekdays:[new Date().getDay()],monthMode:'date'}),[time,setTime]=useState(plan?.reminderTime||'19:00'),[remind,setRemind]=useState(plan?.reminderEnabled??true),[picker,setPicker]=useState<string|null>(null);
  const count=endMode==='date'?dayDistance(start,end)+1:Number(days), computedEnd=endMode==='date'?end:Number.isInteger(count)&&count>0&&count<=3650?addDays(start,count-1):'请选择有效天数';
  const date=picker==='time'?new Date(`${start}T${time}:00`):new Date((picker==='end'?end:start)+'T12:00:00');
  return <>
    <Text style={p.label}>训练项目</Text><View style={p.wrap}>{Object.entries(SPORT_NAMES).map(([key,name])=>button(String(name),()=>setSport(key),key===sport,!!plan))}</View>
    <Text style={p.label}>名称（可选）</Text><TextInput style={p.input} value={title} onChangeText={setTitle} placeholder={`${sportName(sport)}${count||100}天计划`} placeholderTextColor="#8895a9" maxLength={60}/>
    {!plan&&<><Text style={p.label}>开始日期</Text>{button(start,()=>setPicker('start'))}<View style={p.wrap}>{button('坚持多少天',()=>setEndMode('days'),endMode==='days')}{button('直接选结束日期',()=>setEndMode('date'),endMode==='date')}</View>
      {endMode==='days'?<><View style={p.wrap}>{[30,100,150].map(n=>button(n+'天',()=>setDays(String(n)),days===String(n)))}</View><TextInput accessibilityLabel="坚持天数" style={p.input} value={days} keyboardType="number-pad" onChangeText={setDays}/></>:button(end,()=>setPicker('end'))}
      <Text style={p.muted}>含开始当天，共 {count>0?count:'—'} 天，结束于 {computedEnd}。</Text></>}
    {plan&&<Text style={p.muted}>调整重复与提醒时间从明天生效。开始日期、历史安排和打卡保留；延长期限请使用“下一阶段”。</Text>}
    <Text style={p.label}>重复</Text><View style={p.wrap}>{[['daily','每天'],['weekly','每周'],['monthly','每月'],['yearly','每年']].map(([key,label])=>button(label,()=>setRepeat({...repeat,frequency:key}),repeat.frequency===key))}</View>
    <View style={p.row}><Text style={p.text}>每隔</Text><TextInput accessibilityLabel="重复间隔" style={[p.input,{width:90}]} keyboardType="number-pad" value={String(repeat.interval)} onChangeText={v=>setRepeat({...repeat,interval:v===''?'':Number(v)})}/><Text style={p.text}>{({daily:'天',weekly:'周',monthly:'月',yearly:'年'} as Record<string,string>)[repeat.frequency]}（2周即隔周）</Text></View>
    {repeat.frequency==='weekly'&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6}}>{[1,2,3,4,5,6,0].map(day=>button('周'+'日一二三四五六'[day],()=>setRepeat({...repeat,weekdays:repeat.weekdays.includes(day)?repeat.weekdays.filter((d:number)=>d!==day):[...repeat.weekdays,day]}),repeat.weekdays.includes(day)))}</ScrollView>}
    {repeat.frequency==='monthly'&&<><View style={p.wrap}>{[['date','同起始日'],['last','每月末日'],['ordinal','同序号星期']].map(([key,label])=>button(label,()=>setRepeat({...repeat,monthMode:key}),repeat.monthMode===key))}</View><Text style={p.muted}>同起始日遇到不存在的日期会跳过，例如每月31日不会在2月触发。</Text></>}
    <View style={p.row}><Text style={p.label}>系统提醒</Text><Switch value={remind} onValueChange={setRemind} trackColor={{true:'#c6a75e'}}/></View>
    {remind&&button(time,()=>setPicker('time'))}
    <Text style={p.muted}>以 {zone} 的日期和时间执行。提醒会提前安排到系统，打开App或打卡后自动续排。</Text>
    {picker&&<View>{button('完成选择',()=>setPicker(null))}<DateTimePicker mode={picker==='time'?'time':'date'} display="spinner" themeVariant="dark" value={date} onChange={(_,value)=>{if(value){if(picker==='time')setTime(`${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`);else if(picker==='end')setEnd(keyOf(value));else setStart(keyOf(value));}}}/></View>}
    {button('保存计划',()=>onSave({sport,title:title.trim()||`${sportName(sport)}${count}天计划`,titleAuto:!title.trim()||!!(plan?.titleAuto&&title===plan.title),startDate:start,endDate:end,endMode,goalDays:count,repeat,reminderTime:time,reminderEnabled:remind,timeZone:zone}),true,busy)}
  </>;
}
const p=StyleSheet.create({
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
  card:{padding:18,gap:10,borderRadius:18,backgroundColor:'#24334a',borderWidth:1,borderColor:'#c6a75e33'},
  title:{fontSize:17,fontWeight:'600',color:'#e8dcc8'},big:{fontSize:28,fontWeight:'700',color:'#c6a75e'},text:{color:'#e8dcc8',fontSize:14,lineHeight:21},muted:{color:'#a9b4c6',fontSize:12,lineHeight:19},gold:{color:'#c6a75e',fontSize:12},
  label:{fontSize:15,color:'#e8dcc8',marginTop:10},button:{minHeight:48,paddingHorizontal:14,paddingVertical:12,borderRadius:12,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#c6a75e55'},chosen:{backgroundColor:'#c6a75e'},chosenText:{color:'#1f2a44',fontWeight:'600'},input:{minHeight:50,color:'#e8dcc8',backgroundColor:'#24334a',borderRadius:12,padding:14,fontSize:16},track:{height:5,borderRadius:3,backgroundColor:'#ffffff16',overflow:'hidden'},fill:{height:'100%',backgroundColor:'#c6a75e'},error:{color:'#ffd0bd',backgroundColor:'#6b393955',padding:12,borderRadius:10},
});
