import {test} from 'node:test';
import assert from 'node:assert/strict';
import {widgetSnapshot} from './widgetSnapshot.js';
import {makePlan} from './plans.js';
const now=new Date('2026-10-30T10:00:00Z');
const plan=(id,status='active')=>({id,...makePlan({title:'计划'+id,sport:'abs',startDate:'2026-10-30',goalDays:100,timeZone:'Asia/Shanghai'},now),status,email:'private@example.com',token:'secret',photo:'private-photo'});
test('automatic widget snapshot covers all visible plans, prioritizes due work and excludes credentials/photos',()=>{
 const plans=[plan('done'),plan('pause','paused'),plan('hidden','archived'),plan('due')];
 const rows=[{id:'private-record',sport:'abs',planId:'done',occurredAt:now.toISOString(),photo:'secret-photo',details:[{sets:[20]}]}];
 const snapshot=widgetSnapshot(plans,rows,now);
 assert.deepEqual(snapshot.plans.map(p=>p.planId),['due','done','pause']);
 assert.equal(snapshot.plans[1].progress.doneToday,true);assert.equal(snapshot.plans[1].progress.completedDays,1);
 assert.equal(snapshot.plans[0].progress.today,'2026-10-30');
 for(const value of ['secret','private@example.com','private-record','details','photo'])assert.ok(!JSON.stringify(snapshot).includes(value));
 assert.deepEqual(widgetSnapshot([],[],now).plans,[]);
});
