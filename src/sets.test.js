import {test} from 'node:test';
import assert from 'node:assert/strict';
import {report} from './stats.js';
test('new repetition records and old minute records never mix volume units',()=>{
  const date=new Date(2026,9,20,10).toISOString();
  const rows=[
    {sport:'abs',quantityUnit:'reps',value:83,duration:900,occurredAt:date,details:[{subtype:'situps',sets:[20,20,15],value:55,duration:600},{subtype:'abwheel',sets:[10,10,8],value:28,duration:300}]},
    {sport:'abs',subtype:'situps',value:10,duration:600,occurredAt:date},
  ];
  for(const period of ['week','month','year']) {
    const all=report(rows,'abs',period,new Date(2026,9,22));
    assert.equal(all.rows.length,2);assert.equal(all.setCount,6);assert.equal(all.total,83);assert.equal(all.duration,1500);assert.equal(all.legacyCount,1);
    assert.equal(all.bars.reduce((sum,b)=>sum+b.value,0),83);
    const situps=report(rows,'abs',period,new Date(2026,9,22),'situps');
    assert.equal(situps.total,55);assert.equal(situps.setCount,3);assert.equal(situps.duration,1200);
    assert.equal(situps.rows.length,2);assert.equal(situps.legacyCount,1);
  }
});
