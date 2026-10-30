import {FeedbackPressable as Pressable} from "./FeedbackPressable";
import React,{useRef,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Share,StyleSheet,Text,View} from 'react-native';
import {File,Paths} from 'expo-file-system';
import {fetch as expoFetch} from 'expo/fetch';
import {playInteraction} from './nativeReminders';
import {recordShareText,xComposerURL} from './share';

export function RecordShareActions({record,apiURL,token}:{record:any;apiURL:string;token:string}) {
 const [busy,setBusy]=useState(false);const locked=useRef(false);
 async function share(withPhoto=false) {
  if(locked.current)return;locked.current=true;setBusy(true);
  let file:File|undefined;
  try {
   const message=recordShareText(record);
   if(!withPhoto) {
    try {await Linking.openURL(xComposerURL(record));}
    catch {await Share.share({message},{subject:'dailyRep运动打卡'});}
   }else {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
    try {
     const response=await expoFetch(apiURL+'/api/photos/'+encodeURIComponent(record.photo),{headers:{Authorization:'Bearer '+token},signal:controller.signal});
     if(!response.ok)throw Error(response.status===401?'登录已过期，请重新登录后分享照片':'照片暂时无法读取，请稍后重试');
     const mime=(response.headers.get('Content-Type')||'').split(';')[0];
     const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'} as Record<string,string>)[mime];
     if(!extension)throw Error('照片格式暂不支持分享');
     const bytes=new Uint8Array(await response.arrayBuffer());
     if(!bytes.length||bytes.length>8*1024*1024)throw Error('照片过大或内容无效');
     file=new File(Paths.cache,`dailyrep-share-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);file.write(bytes);
    }finally{clearTimeout(timer);}
    await Share.share({message,url:file!.uri},{subject:'dailyRep运动打卡',tintColor:'#c6a75e'});
   }
  }catch(e:any){void playInteraction('error');Alert.alert('分享未完成',e.name==='AbortError'?'照片读取超时，请检查网络后重试':e.message||'请稍后重试');}
  finally{try{if(file?.exists)file.delete();}catch{}locked.current=false;setBusy(false);}
 }
 return <View style={styles.row}>
  <Pressable accessibilityRole="button" accessibilityLabel="分享到X" disabled={busy} style={styles.button} onPress={()=>share()}><Text style={styles.text}>分享到X ↗</Text></Pressable>
  {record.photo&&<Pressable accessibilityRole="button" accessibilityLabel="带照片分享，在系统面板选择X" disabled={busy} style={styles.button} onPress={()=>share(true)}><Text style={styles.text}>带照片分享</Text></Pressable>}
  {busy&&<ActivityIndicator size="small" color="#c6a75e"/>}
 </View>;
}
const styles=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,marginTop:6},button:{minHeight:44,paddingHorizontal:10,justifyContent:'center',borderWidth:1,borderColor:'#c6a75e55',borderRadius:9},text:{fontSize:12,color:'#dfc58a'}});
