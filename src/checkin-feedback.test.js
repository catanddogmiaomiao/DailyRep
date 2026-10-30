import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('actual Swift check-in sound produces two bounded low-tone hits and a silent tail', {skip:process.platform!=='darwin'},()=>{
 const source=readFileSync('modules/dailyrep-native/ios/DailyRepModule.swift','utf8');
 const sound=source.slice(source.indexOf('enum CheckinSound {'),source.indexOf('private final class CheckinFeedback'));
 const dir=mkdtempSync(path.join(tmpdir(),'dailyrep-sound-'));
 try {
  writeFileSync(path.join(dir,'main.swift'),'import Foundation\n'+sound+'\ntry CheckinSound.wav().write(to:URL(fileURLWithPath:CommandLine.arguments[1]))\n');
  execFileSync('/usr/bin/xcrun',['swiftc','-module-cache-path',path.join(dir,'modules'),path.join(dir,'main.swift'),'-o',path.join(dir,'sound')],{env:{...process.env,DEVELOPER_DIR:'/Applications/Xcode.app/Contents/Developer'},stdio:'pipe'});
  execFileSync(path.join(dir,'sound'),[path.join(dir,'sound.wav')]);
  const wav=readFileSync(path.join(dir,'sound.wav'));
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  assert.equal(wav.readUInt32LE(4),wav.length-8);
  assert.equal(wav.readUInt32LE(24),22050);
  assert.equal(wav.readUInt16LE(22),1);
  const samples=Array.from({length:(wav.length-44)/2},(_,i)=>wav.readInt16LE(44+i*2)/32768);
  const rms=(a,b)=>Math.sqrt(samples.slice(Math.floor(a*22050),Math.floor(b*22050)).reduce((sum,x)=>sum+x*x,0)/Math.floor((b-a)*22050));
  assert.ok(rms(0.01,0.06)>0.15);
  assert.ok(rms(0.19,0.24)>0.15);
  assert.ok(rms(0.14,0.17)<rms(0.19,0.24)/3);
  assert.ok(samples.every(x=>Math.abs(x)<0.96));
  assert.ok(samples.slice(Math.floor(0.49*22050)).every(x=>x===0));
  // Optional exact-source audio preview for listening during development.
  if(process.env.DAILYREP_SOUND_PREVIEW) {mkdirSync(path.dirname(process.env.DAILYREP_SOUND_PREVIEW),{recursive:true});writeFileSync(process.env.DAILYREP_SOUND_PREVIEW,wav);}
 }finally {rmSync(dir,{recursive:true,force:true});}
});
