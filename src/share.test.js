import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordShareText,xComposerURL} from './share.js';
const base={id:'secret-record-id',sport:'running',occurredAt:'2026-10-30T08:00:00Z',value:8,duration:3000,photo:'private-photo-id',email:'private@example.com',planId:'private-plan'};
test('X composer encodes only the selected training summary, without private identifiers',()=>{
 const text=recordShareText(base);assert.match(text,/跑步/);assert.match(text,/8km/);assert.match(text,/50分/);
 const url=new URL(xComposerURL(base));assert.equal(url.hostname,'twitter.com');assert.equal(url.searchParams.get('text'),text);
 for(const value of ['secret-record-id','private-photo-id','private@example.com','private-plan','/api/','Bearer'])assert.ok(!text.includes(value));
});
test('share one session with all swim strokes and individual muscle sets; bound long posts',()=>{
 const swim={...base,sport:'swimming',value:1500,details:[{subtype:'breaststroke',value:400,duration:300},{subtype:'butterfly',value:100,duration:100},{subtype:'freestyle',value:1000,duration:900}]};
 const text=recordShareText(swim);for(const value of ['蛙泳','蝶泳','自由泳','1500m'])assert.ok(text.includes(value));
 const abs={...base,sport:'abs',quantityUnit:'reps',value:55,details:[{subtype:'situps',sets:[20,20,15],value:55,duration:600}]};
 assert.match(recordShareText(abs),/20\/20\/15个/);
 abs.details[0].sets=Array(100).fill(20);assert.ok(Array.from(recordShareText(abs)).length<=135);
 assert.match(recordShareText({...abs,quantityUnit:'minutes',details:null}),/分钟/);
});
