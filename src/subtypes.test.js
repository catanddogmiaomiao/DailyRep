import {test} from 'node:test';
import assert from 'node:assert/strict';
import {report} from './stats.js';
import {subtypeOptions} from './subtypes.js';
test('week, month and year filter volume, duration, bars and records by subtype without reclassifying legacy data', () => {
  for (const sport of ['swimming','abs']) {
    const [first,second] = subtypeOptions(sport);
    const time = new Date(2026,9,20,10).toISOString();
    const rows = [
      {sport,subtype:first.value,value:100,duration:120,occurredAt:time},
      {sport,subtype:second.value,value:200,duration:240,occurredAt:time},
      {sport,value:50,duration:60,occurredAt:time},
      {sport,subtype:first.value,value:999,duration:999,occurredAt:new Date(2025,0,1).toISOString()},
      {sport:'running',value:9,duration:10,occurredAt:time},
    ];
    for (const period of ['week','month','year']) {
      const all = report(rows,sport,period,new Date(2026,9,22));
      assert.equal(all.total,350); assert.equal(all.duration,420);
      assert.equal(all.breakdown.reduce((sum,g) => sum+g.total,0),350);
      const selected = report(rows,sport,period,new Date(2026,9,22),first.value);
      assert.equal(selected.total,100); assert.equal(selected.duration,120); assert.equal(selected.rows.length,1);
      assert.equal(selected.bars.reduce((sum,b) => sum+b.value,0),100);
      const legacy = report(rows,sport,period,new Date(2026,9,22),'unclassified');
      assert.equal(legacy.total,50); assert.equal(legacy.rows.length,1);
      assert.equal(report([],sport,period,new Date(2026,9,22),second.value).total,0);
    }
  }
});

