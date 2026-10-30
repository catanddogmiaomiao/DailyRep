import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {widgetSnapshot} from './widgetSnapshot.js';
import {makePlan} from './plans.js';
test('actual Swift widget models decode the app snapshot without requiring nonexistent per-plan timestamps',{skip:process.platform!=='darwin'},()=>{
 const swift=readFileSync('native/widget/DailyRepWidget.swift','utf8');
 const models=swift.slice(swift.indexOf('struct PlanData:'),swift.indexOf('struct DailyRepEntry:'));
 const dir=mkdtempSync(path.join(tmpdir(),'dailyrep-widget-decode-'));
 try{
  writeFileSync(path.join(dir,'check.swift'),'import Foundation\n'+models+'\nlet bytes=FileHandle.standardInput.readDataToEndOfFile()\nlet snapshot=try JSONDecoder().decode(ProgressData.self,from:bytes)\nprint(snapshot.plans.count)\n');
  execFileSync('/usr/bin/xcrun',['swiftc','-module-cache-path',path.join(dir,'modules'),path.join(dir,'check.swift'),'-o',path.join(dir,'check')],{env:{...process.env,DEVELOPER_DIR:'/Applications/Xcode.app/Contents/Developer'},stdio:'pipe'});
  const now=new Date('2026-10-30T10:00:00Z');
  const plans=['running','swimming','pushups','abs'].map((sport,i)=>({id:String(i),...makePlan({sport,title:sport,startDate:'2026-10-30',goalDays:100,timeZone:'Asia/Shanghai'},now)}));
  for(const items of [plans,[],plans.slice(0,1)])assert.equal(execFileSync(path.join(dir,'check'),{input:JSON.stringify(widgetSnapshot(items,[],now)),encoding:'utf8'}).trim(),String(items.length));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
