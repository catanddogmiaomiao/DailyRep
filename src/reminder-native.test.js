import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
test('actual native reminder reconciliation preserves future requests on failure and verifies the installed queue',{skip:process.platform!=='darwin'},()=>{
 const native=readFileSync('modules/dailyrep-native/ios/DailyRepModule.swift','utf8');
 const block=native.split('AsyncFunction("syncReminders")')[1].split('AsyncFunction("cancelReminders")')[0];
 const body=block.slice(block.indexOf('      let center'),block.lastIndexOf('\n    }'));
 const dir=mkdtempSync(path.join(tmpdir(),'dailyrep-reminder-'));
 try {
  writeFileSync(path.join(dir,'test.swift'),String.raw`
import Foundation
struct Sound {static let \`default\` = Sound()}
class UNMutableNotificationContent {var title="";var body="";var sound:Sound?;var userInfo:[String:String]=[:]}
struct UNCalendarNotificationTrigger {let dateMatching:DateComponents;let repeats:Bool}
struct UNNotificationRequest {let identifier:String;let content:UNMutableNotificationContent;let trigger:UNCalendarNotificationTrigger}
class UNUserNotificationCenter {
 static let instance=UNUserNotificationCenter()
 static func current()->UNUserNotificationCenter {instance}
 var saved:[String:UNNotificationRequest]=[:];var failAt=0;var additions=0;var removals=0
 func pendingNotificationRequests() async->[UNNotificationRequest] {Array(saved.values)}
 func add(_ request:UNNotificationRequest) async throws {additions+=1;if failAt==additions {throw NSError(domain:"test",code:1)};saved[request.identifier]=request}
 func removePendingNotificationRequests(withIdentifiers ids:[String]) {removals+=ids.count;for id in ids {saved.removeValue(forKey:id)}}
}
class Scheduler {
 func status() async->String {"authorized"}
 func sync(_ rows:[[String:String]]) async throws->[String:Any] {
` .replaceAll('\\`','`')+body+String.raw`
 }
}
@main struct Test {
 static func main() async throws {
  let c=UNUserNotificationCenter.current(),scheduler=Scheduler()
  let old=UNNotificationRequest(identifier:"dailyrep.old.2030-01-01",content:UNMutableNotificationContent(),trigger:UNCalendarNotificationTrigger(dateMatching:DateComponents(),repeats:false))
  c.saved[old.identifier]=old
  let rows=(1...4).map {i in ["id":"dailyrep.plan.2030-01-0\(i)","at":"2030-01-0\(i)T11:00:00.000Z","planId":"plan","sport":"abs"]}
  c.failAt=2
  do {_ = try await scheduler.sync(rows);fatalError("Expected scheduling failure")}catch{}
  precondition(c.saved[old.identifier] != nil && c.removals==0,"Failure must preserve old reminders")
  c.failAt=0;c.additions=0
  let result=try await scheduler.sync(rows)
  precondition(result["scheduled"] as? Int == 4 && c.saved.count==4)
  precondition(result["through"] as? String == "2030-01-04T11:00:00.000Z")
  for r in c.saved.values {precondition(r.trigger.dateMatching.timeZone?.secondsFromGMT()==0 && !r.trigger.repeats)}
  let before=c.saved.count
  do {_ = try await scheduler.sync([["id":"dailyrep.bad","at":"bad"]]);fatalError("Expected validation failure")}catch{}
  precondition(c.saved.count==before,"Invalid replacements must not erase working reminders")
  print("PASS")
 }
}
`.replaceAll('\\`','`'));
  execFileSync('/usr/bin/xcrun',['swiftc','-parse-as-library','-module-cache-path',path.join(dir,'modules'),path.join(dir,'test.swift'),'-o',path.join(dir,'test')],{env:{...process.env,DEVELOPER_DIR:'/Applications/Xcode.app/Contents/Developer'},stdio:'pipe'});
  assert.match(execFileSync(path.join(dir,'test'),{encoding:'utf8'}),/PASS/);
 }finally {rmSync(dir,{recursive:true,force:true});}
});
