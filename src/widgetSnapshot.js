import {planProgress} from './plans.js';
export function widgetSnapshot(plans,records,now=new Date()) {
 const summaries=plans.filter(plan=>plan.status!=='archived').map(plan=>({planId:plan.id,title:plan.title,sport:plan.sport,status:plan.status,timeZone:plan.timeZone,progress:planProgress(plan,records,now)}));
 const rank=p=>p.status==='active'&&!p.progress.ended?(p.progress.dueToday&&!p.progress.doneToday?0:1):p.status==='paused'?2:3;
 summaries.sort((a,b)=>rank(a)-rank(b));
 return {plans:summaries,updatedAt:now.toISOString()};
}
