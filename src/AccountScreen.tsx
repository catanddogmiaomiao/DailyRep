import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Image,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {ImageManipulator,SaveFormat} from 'expo-image-manipulator';
import {Ionicons} from '@expo/vector-icons';
import {playInteraction} from './nativeReminders';

type Api=(route:string,options?:RequestInit)=>Promise<any>;
export type Profile={email:string;nickname?:string;avatar?:string;avatarImage?:string|null;emailVerified?:boolean;emailAvailable?:boolean;hasRecoveryCode?:boolean};
type Session={id:string;device:string;createdAt:number|null;current:boolean};
const avatars={wave:'🌊',sun:'☀️',mountain:'⛰️',bolt:'⚡'};
const avatarNames={wave:'海浪',sun:'太阳',mountain:'山峰',bolt:'闪电'};
type Avatar=keyof typeof avatars;
const sections={profile:'昵称与头像',password:'修改密码',email:'验证或更换邮箱',sessions:'已登录设备',recovery:'密码恢复码',delete:'删除账号'};
type Section=keyof typeof sections;
const send=(api:Api,path:string,body:object={})=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const c={cream:'#e8dcc8',gold:'#c6a75e',base:'#132138',panel:'#23324b',muted:'#aab4c6',red:'#ffa6a4'};
type FieldType='email'|'current-password'|'new-password'|'one-time-code'|'off';
function Field({label,value,change,type='off',maxLength,editable}:{
  label:string;value:string;change:(text:string)=>void;type?:FieldType;maxLength?:number;editable:boolean;
}){
  const secret=type==='current-password'||type==='new-password';
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} style={styles.input}
    editable={editable} autoCapitalize="none" autoCorrect={false} autoComplete={type} keyboardType={type==='email'?'email-address':'default'}
    secureTextEntry={secret} maxLength={maxLength??(secret?1024:254)}/></View>;
}
function Button({title,onPress,busy=false,tone='outline'}:{title:string;onPress:()=>void;busy?:boolean;tone?:'outline'|'gold'|'danger'}){
  return <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.button,tone==='gold'&&styles.gold,tone==='danger'&&styles.danger,busy&&{opacity:.55}]}>
    <Text style={[styles.buttonText,tone==='gold'&&{color:c.base},tone==='danger'&&{color:c.red}]}>{title}</Text>
  </Pressable>;
}
function Status({busy,error,notice}:{busy:boolean;error:string;notice:string}){
  return <>{busy&&<ActivityIndicator color={c.gold}/>}
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}</>;
}
function checkPassword(password:string,confirm:string){
  if(password.length<8)throw new Error('新密码至少需要8位');
  if(password!==confirm)throw new Error('两次输入的密码不一致');
}
export function AccountScreen({api,onClose,onSignedOut,onProfile}:{api:Api;onClose:()=>void;onSignedOut:()=>Promise<void>;onProfile:(profile:Profile)=>void}){
  const insets=useSafeAreaInsets();
  const [profile,setProfile]=useState<Profile|null>(null),[panel,setPanel]=useState<Section|''>('');
  const [sessions,setSessions]=useState<Session[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [nickname,setNickname]=useState(''),[avatar,setAvatar]=useState<Avatar>('wave');
  const [current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [email,setEmail]=useState(''),[target,setTarget]=useState(''),[code,setCode]=useState(''),[recovery,setRecovery]=useState('');
  function update(data:Profile){setProfile(data);onProfile(data);}
  async function run(work:()=>Promise<void>,sound=true){
    if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{await work();if(sound)void playInteraction('confirm');}
    catch(e:any){if(e.status===401){await onSignedOut();return;}setError(e.message);void playInteraction('error');}
    finally{setBusy(false);}
  }
  const load=()=>run(async()=>update(await api('/me')),false);
  useEffect(()=>{void load();},[]);
  function open(next:Section|''){
    setPanel(next);setError('');setNotice('');setCurrent('');setPassword('');setConfirm('');setCode('');setTarget('');setRecovery('');
    setNickname(profile?.nickname||'');setAvatar((profile?.avatar as Avatar)||'wave');setEmail(next==='delete'?'':profile?.email||'');
    if(next==='sessions')void run(async()=>setSessions(await api('/account/sessions')),false);
  }
  async function uploadAvatar() {
    const picked=await ImagePicker.launchImageLibraryAsync({
      mediaTypes:["images"],allowsEditing:true,aspect:[1,1],
    });
    if(picked.canceled)return;
    const image=ImageManipulator.manipulate(picked.assets[0].uri);
    image.resize({width:240});
    const rendered=await image.renderAsync();
    const result=await rendered.saveAsync({format:SaveFormat.JPEG,compress:0.75,base64:true});
    if(!result.base64)throw new Error("无法读取这张照片，请重新选择。");
    update(await send(api,"/account/avatar",{image:result.base64}));
    setNotice("头像已更新。");
  }
  const currentField=<Field label="当前密码" value={current} change={setCurrent} type="current-password" editable={!busy}/>;
  const newFields=<><Field label="新密码（至少8位）" value={password} change={setPassword} type="new-password" editable={!busy}/><Field label="确认新密码" value={confirm} change={setConfirm} type="new-password" editable={!busy}/></>;
  const revoke=(id:string)=>void run(async()=>{await send(api,'/account/sessions/revoke',{id});setSessions(await api('/account/sessions'));setNotice('已退出所选设备。');});
  return <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>{if(!busy)onClose();}}>
    {/* Apply the app window's insets on the first frame of the native modal. */}
    <View style={[styles.safe,{
      paddingTop:insets.top,
      paddingBottom:insets.bottom,
      paddingLeft:insets.left,
      paddingRight:insets.right,
    }]}>
      <View style={styles.top}><Text style={styles.title}>账号管理</Text><Pressable accessibilityRole="button" accessibilityLabel="关闭账号管理" onPress={onClose} disabled={busy} style={styles.close}><Ionicons name="close" size={26} color={c.cream}/></Pressable></View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {!!profile&&<View style={styles.profile}>{profile.avatarImage?<Image accessibilityIgnoresInvertColors source={{uri:"data:image/jpeg;base64,"+profile.avatarImage}} style={styles.uploadedAvatar}/>:<Text style={styles.avatar}>{avatars[profile.avatar as Avatar]||avatars.wave}</Text>}<View style={{flex:1}}><Text style={styles.heading}>{profile.nickname||'我的账号'}</Text><Text style={styles.label}>{profile.email}</Text><Text style={styles.muted}>{profile.emailVerified?'邮箱已验证':'邮箱未验证'}</Text></View></View>}
        {!panel&&profile&&<>{(Object.keys(sections) as Section[]).map(key=><Button key={key} title={sections[key]} busy={busy} onPress={()=>open(key)}/>)}<Button title="退出登录" busy={busy} onPress={()=>void run(async()=>{await send(api,'/logout');await onSignedOut();},false)}/></>}
        {!!panel&&<><Button title="‹ 返回账号管理" busy={busy} onPress={()=>open('')}/><Text style={styles.heading}>{sections[panel]}</Text></>}
        {panel==='profile'&&<><Field label="昵称（可留空）" value={nickname} change={setNickname} maxLength={24} editable={!busy}/>
          <Button title="从相册上传头像" busy={busy} onPress={()=>void run(uploadAvatar,false)}/>
          {profile?.avatarImage&&<Button title="移除上传的头像" busy={busy} onPress={()=>void run(async()=>{
            update(await send(api,"/account/avatar",{image:null}));setNotice("已恢复预设头像。");
          })}/>}
          {profile?.avatarImage&&<Text style={styles.muted}>移除照片后会显示预设头像。</Text>}
          <View style={styles.avatarRow}>{(Object.keys(avatars) as Avatar[]).map(key=><Pressable accessibilityLabel={avatarNames[key]} accessibilityRole="button" accessibilityState={{selected:avatar===key}} key={key} disabled={busy} onPress={()=>setAvatar(key)} style={[styles.avatarChoice,avatar===key&&{borderColor:c.gold}]}><Text style={{fontSize:24}}>{avatars[key]}</Text></Pressable>)}</View>
          <Button title="保存资料" tone="gold" busy={busy} onPress={()=>void run(async()=>{update(await send(api,'/account/profile',{nickname,avatar}));setNotice('资料已保存。');})}/></>}
        {panel==='password'&&<><Text style={styles.muted}>修改后，其他设备需要重新登录。</Text>{currentField}{newFields}
          <Button title="修改密码" tone="gold" busy={busy} onPress={()=>void run(async()=>{checkPassword(password,confirm);await send(api,'/account/password',{currentPassword:current,newPassword:password});setCurrent('');setPassword('');setConfirm('');setNotice('密码已修改，其他设备已退出。');})}/></>}
        {panel==='email'&&(!profile?.emailAvailable?<Text style={styles.muted}>邮件验证码暂未启用。请在「密码恢复码」中生成恢复码并妥善保存。</Text>:target?
          <><Text style={styles.muted}>验证码已发送到 {target}，10 分钟内有效。</Text><Field label="邮箱验证码" value={code} change={setCode} type="one-time-code" maxLength={24} editable={!busy}/>{currentField}
          <Button title="确认邮箱" tone="gold" busy={busy} onPress={()=>void run(async()=>{update(await send(api,'/account/email/confirm',{email:target,code,currentPassword:current}));setCurrent('');setCode('');setTarget('');setNotice('邮箱已验证。请用这个邮箱登录。');})}/>
          <Button title="返回或重发" busy={busy} onPress={()=>{setCode('');setTarget('');setCurrent('');}}/></>:
          <><Text style={styles.muted}>换绑后，其他设备需要用新邮箱重新登录。</Text><Field label="要验证的邮箱" value={email} change={setEmail} type="email" editable={!busy}/>{currentField}
          <Button title="发送验证码" tone="gold" busy={busy} onPress={()=>void run(async()=>{await send(api,'/account/email/send',{email,currentPassword:current});setTarget(email.trim().toLowerCase());setCurrent('');})}/></>)}
        {panel==='sessions'&&<>{sessions.map(device=><View key={device.id} style={styles.device}><View style={{flex:1}}><Text style={styles.label}>{device.device}{device.current?'（当前）':''}</Text><Text style={styles.muted}>{device.createdAt?'登录于 '+new Date(device.createdAt).toLocaleString('zh-CN'):'登录时间未记录'}</Text></View>{!device.current&&<Button title="退出" busy={busy} onPress={()=>revoke(device.id)}/>}</View>)}
          {sessions.some(d=>!d.current)&&<Button title="退出其他所有设备" busy={busy} onPress={()=>revoke('others')}/>}
          <Button title="刷新设备列表" busy={busy} onPress={()=>void run(async()=>setSessions(await api('/account/sessions')),false)}/></>}
        {panel==='recovery'&&(recovery?<><Text style={styles.muted}>请把恢复码保存到密码管理器。关闭后无法再次查看，使用一次后失效。</Text><Text selectable style={styles.code}>{recovery}</Text><Button title="保存恢复码…" busy={busy} onPress={()=>void Share.share({message:recovery}).catch(()=>setError('无法打开分享菜单。可以长按恢复码复制。'))}/></>:
          <><Text style={styles.muted}>忘记密码时，可在登录页用恢复码重设密码。重新生成会使旧码失效。</Text>{currentField}
          <Button title={profile?.hasRecoveryCode?'重新生成恢复码':'生成恢复码'} tone="gold" busy={busy} onPress={()=>void run(async()=>{const result=await send(api,'/account/recovery-code',{currentPassword:current});setRecovery(result.code);setCurrent('');if(profile)update({...profile,hasRecoveryCode:true});})}/></>)}
        {panel==='delete'&&<><Text style={styles.error}>会永久删除账号、打卡、照片和训练计划，并退出所有设备。需要保留记录时，请先在网页报告页导出 Excel。</Text>
          <Field label="输入当前登录邮箱以确认" value={email} change={setEmail} type="email" editable={!busy}/>{currentField}
          <Button title="永久删除账号" tone="danger" busy={busy} onPress={()=>void run(async()=>{if(email.trim()!==profile?.email)throw new Error('请输入当前登录邮箱以确认删除');await send(api,'/account/delete',{confirmEmail:email.trim(),currentPassword:current});await onSignedOut();},false)}/></>}
        <Status busy={busy} error={error} notice={notice}/>
        {!profile&&!busy&&<Button title="重试" onPress={()=>void load()}/>}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
export function AccountReset({api,initialEmail,emailAvailable,onBack,onDone}:{api:Api;initialEmail:string;emailAvailable:boolean;onBack:()=>void;onDone:()=>void}){
  const [email,setEmail]=useState(initialEmail),[code,setCode]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [byEmail,setByEmail]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setNotice('');try{await work();void playInteraction('confirm');}catch(e:any){setError(e.message);void playInteraction('error');}finally{setBusy(false);}}
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>重设密码</Text>
    <Text style={styles.muted}>{byEmail?'用已验证的邮箱接收验证码。':'输入之前在账号管理中保存的一次性恢复码。'}</Text>
    <Field label="登录邮箱" value={email} change={setEmail} type="email" editable={!busy}/>
    {byEmail&&<Button title="发送验证码" busy={busy} onPress={()=>void run(async()=>{await send(api,'/password-reset/email',{email});setNotice('如果该邮箱已验证，你会收到验证码。');})}/>}
    <Field label={byEmail?'邮件验证码':'恢复码'} value={code} change={setCode} type="one-time-code" maxLength={80} editable={!busy}/>
    <Field label="新密码（至少8位）" value={password} change={setPassword} type="new-password" editable={!busy}/>
    <Field label="确认新密码" value={confirm} change={setConfirm} type="new-password" editable={!busy}/>
    <Button title="重设密码" tone="gold" busy={busy} onPress={()=>void run(async()=>{checkPassword(password,confirm);await send(api,'/password-reset',{email,code,newPassword:password,method:byEmail?'email':'recovery'});onDone();})}/>
    {emailAvailable&&<Button title={byEmail?'改用恢复码':'改用邮件验证码'} busy={busy} onPress={()=>{setByEmail(!byEmail);setCode('');setError('');setNotice('');}}/>}
    <Button title="返回登录" busy={busy} onPress={onBack}/><Status busy={busy} error={error} notice={notice}/>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:c.base},body:{padding:22,gap:14},
  top:{paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  close:{width:48,height:48,alignItems:'center',justifyContent:'center'},title:{fontSize:28,fontWeight:'700',color:c.cream},
  heading:{fontSize:20,fontWeight:'700',color:c.cream},muted:{fontSize:14,lineHeight:22,color:c.muted},label:{fontSize:15,color:c.cream},
  field:{gap:7},input:{minHeight:48,padding:12,borderRadius:12,backgroundColor:c.panel,color:c.cream,fontSize:16},
  button:{minHeight:48,padding:12,justifyContent:'center',alignItems:'center',borderRadius:12,borderWidth:1,borderColor:'#e8dcc849'},
  buttonText:{fontWeight:'600',fontSize:16,color:c.cream},gold:{backgroundColor:c.gold,borderColor:c.gold},danger:{borderColor:c.red},
  error:{color:c.red,lineHeight:23},notice:{color:c.gold,lineHeight:23},profile:{flexDirection:'row',gap:14,alignItems:'center',paddingBottom:8},
  uploadedAvatar:{width:56,height:56,borderRadius:28},
  avatar:{fontSize:27,padding:12,backgroundColor:c.panel,borderRadius:14},avatarRow:{flexDirection:'row',gap:10},avatarChoice:{borderWidth:1,borderColor:c.panel,backgroundColor:c.panel,borderRadius:12,width:48,height:48,alignItems:'center',justifyContent:'center'},
  device:{flexDirection:'row',gap:10,alignItems:'center',backgroundColor:c.panel,padding:12,borderRadius:12},
  code:{fontFamily:'Menlo',fontSize:16,lineHeight:24,padding:12,backgroundColor:c.panel,color:c.cream,borderRadius:12},
});
