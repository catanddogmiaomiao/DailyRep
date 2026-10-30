import {requireOptionalNativeModule} from "expo-modules-core";
import {File,Paths} from "expo-file-system";
import {reminderQueue} from "./plans";
import {widgetSnapshot} from "./widgetSnapshot";
const bridge = requireOptionalNativeModule("DailyRepNative");
export const reminderBridgeAvailable = !!bridge;
export const requestReminderPermission = async () => bridge ? bridge.requestPermission() : "unavailable";
export const notificationStatus = async () => bridge ? bridge.notificationStatus() : "unavailable";
let chain: Promise<any> = Promise.resolve();
export function syncReminders(plans: any[], records: any[]) {
  // Private app container; cache only plan rules and completion dates, no tokens/photos.
  const cache=new File(Paths.document,'training-reminders.json');
  try {cache.write(JSON.stringify({plans,records:records.filter(r=>r.planId).map(r=>({planId:r.planId,sport:r.sport,occurredAt:r.occurredAt}))}));} catch { /* Reminders still work if the optional offline cache cannot be saved. */ }
  const queue = reminderQueue(plans,records);
  chain = chain.catch(()=>undefined).then(()=>bridge ? bridge.syncReminders(JSON.stringify(queue)) : {status:"unavailable",scheduled:0});
  return chain;
}
export async function clearDeviceReminders() {
  chain=chain.catch(()=>undefined).then(()=>bridge?.cancelReminders());await chain;
  try {const cache=new File(Paths.document,'training-reminders.json');if(cache.exists)cache.delete();}catch { /* Logging out must still clear the signed-in UI. */ }
}
export const refreshWidgets = () => bridge?.refreshWidgets();
export const copyWidgetCode = async (code: string) => {if(bridge)await bridge.copyString(code);};
export const openNotificationSettings = () => bridge?.openNotificationSettings();
export const lastNotification = async () => bridge ? bridge.lastNotification() : null;
export const listenToNotifications = (listener: (data:{sport:string;planId:string})=>void) => bridge?.addListener("notificationResponse",async (data:any)=>{await bridge.lastNotification();listener(data);});

export async function restoreCachedReminders() {
  try {
    const cache=new File(Paths.document,'training-reminders.json');if(!cache.exists)return null;
    const saved=JSON.parse(await cache.text());
    if(!Array.isArray(saved.plans)||!Array.isArray(saved.records))return null;
    // Called only when SecureStore still contains this app's signed-in session.
    // Warm the widget from the last local plans even if the API is temporarily offline.
    await syncWidgetSnapshot(saved.plans,saved.records).catch(()=>undefined);
    return await syncReminders(saved.plans,saved.records);
  }catch{return null;}
}

let widgetChain:Promise<any>=Promise.resolve();
export function syncWidgetSnapshot(plans:any[],records:any[]) {
  const json=JSON.stringify(widgetSnapshot(plans,records));
  widgetChain=widgetChain.catch(()=>undefined).then(()=>{
    if(!bridge?.syncWidgetSnapshot)throw new Error("请在Xcode重新安装包含自动同步功能的App");
    return bridge.syncWidgetSnapshot(json);
  });return widgetChain;
}
export function clearWidgetSnapshot() {
  widgetChain=widgetChain.catch(()=>undefined).then(()=>bridge?.clearWidgetSnapshot?.());return widgetChain;
}

export const getWidgetDiagnostics = async () => bridge?.widgetDiagnostics ? bridge.widgetDiagnostics() : {unavailable:true};

// Feedback is optional on older installed native builds; it must not affect saving.
export async function playCheckinSuccess() {
  try {await bridge?.playCheckinSuccess?.();} catch { /* The record is already saved. */ }
}
