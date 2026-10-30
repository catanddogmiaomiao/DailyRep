import {recordDetails,recordUnit,subtypeLabel} from './subtypes.js';
const names={running:'跑步',swimming:'游泳',pushups:'俯卧撑',abs:'腹肌训练'};
const number=n=>Number(Number(n).toFixed(2)).toLocaleString('zh-CN',{useGrouping:false});
const duration=seconds=>`${Math.floor(seconds/60)}分${seconds%60?`${seconds%60}秒`:''}`;
export function recordShareText(record) {
 const date=new Date(record.occurredAt).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
 const lines=[`${date} ${names[record.sport]}打卡 ✓`,`${number(record.value)}${recordUnit(record)} · ${duration(record.duration)}`];
 if(['swimming','abs','pushups'].includes(record.sport))for(const detail of recordDetails(record)) {
  const label=record.sport==='pushups'?'俯卧撑':subtypeLabel(record.sport,detail.subtype);
  lines.push(`${label} ${detail.sets?detail.sets.join('/')+recordUnit(record):number(detail.value)+recordUnit(record)} · ${duration(detail.duration)}`);
 }
 // Conservative bound for ordinary X posts, including wide Chinese characters.
 const chars=Array.from(lines.join('\n'));return (chars.length>125?chars.slice(0,124).join('')+'…':chars.join(''))+'\n#dailyRep';
}
export const xComposerURL=record=>'https://twitter.com/intent/tweet?text='+encodeURIComponent(recordShareText(record));
