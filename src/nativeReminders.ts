import {requireOptionalNativeModule} from "expo-modules-core";
import {File,Paths} from "expo-file-system";
import {reminderQueue} from "./plans";
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
    return await syncReminders(saved.plans,saved.records);
  }catch{return null;}
}
