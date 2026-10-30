import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('previous desktop widget kind stays registered alongside the current automatic plan list',()=>{
 const source=readFileSync('native/widget/DailyRepWidget.swift','utf8');
 const kinds=[...source.matchAll(/(?:StaticConfiguration|AppIntentConfiguration)\(kind:"([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(kinds.sort(),['DailyRepPlansV3','DailyRepProgress']);
 assert.match(source,/@main struct DailyRepWidget: WidgetBundle/);
 assert.match(source,/DailyRepLegacyWidget\(\)/);
 const native=readFileSync('modules/dailyrep-native/ios/DailyRepModule.swift','utf8');
 const installed=native.split('result["currentWidgetInstalled"]=')[1].split('\n')[0];
 for(const kind of kinds)assert.ok(installed.includes(kind),'diagnostics must accept supported kind '+kind);
});

test('legacy placements keep their concrete AppIntent type while ignoring the old connection code',()=>{
 const source=readFileSync('native/widget/DailyRepWidget.swift','utf8');
 assert.match(source,/struct DailyRepConfiguration: WidgetConfigurationIntent/);
 assert.match(source,/@Parameter[^\n]*var connectionCode: String\?/);
 assert.match(source,/AppIntentConfiguration\(kind:"DailyRepProgress",intent:DailyRepConfiguration\.self,provider:LegacyProvider\(\)\)/);
 assert.match(source,/StaticConfiguration\(kind:"DailyRepPlansV3",provider:Provider\(\)\)/);
 assert.doesNotMatch(source,/configuration\.connectionCode/);
});
