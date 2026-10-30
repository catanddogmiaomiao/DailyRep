// Offscreen SwiftUI layout regression on macOS. This does not replace device WidgetKit validation.
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {makePlan,dateInZone} from '../src/plans.js';
import {widgetSnapshot} from '../src/widgetSnapshot.js';
if(process.platform!=='darwin')throw Error('Requires macOS and Xcode');
const dir=mkdtempSync(path.join(tmpdir(),'dailyrep-widget-render-'));
const output=path.resolve(process.argv[2]||'../../outputs/widget-render-check');mkdirSync(output,{recursive:true});
try {
 let source=readFileSync('native/widget/DailyRepWidget.swift','utf8').split('@main struct DailyRepWidget:')[0]
  .replace('@Environment(\\.widgetFamily) private var family','private var family:WidgetFamily {CommandLine.arguments[2] == "large" ? .systemLarge : CommandLine.arguments[2] == "medium" ? .systemMedium : .systemSmall}')
  .replace('@Environment(\\.widgetRenderingMode) private var renderingMode','private var renderingMode:WidgetRenderingMode {CommandLine.arguments[4] == "accented" ? .accented : CommandLine.arguments[4] == "vibrant" ? .vibrant : .fullColor}');
 source+=String.raw`
import AppKit
@main struct RenderCheck {
 @MainActor static func main() throws {
  let mode=CommandLine.arguments[3]
  let bytes=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))
  let data=mode == "unavailable" ? nil : try JSONDecoder().decode(ProgressData.self,from:bytes)
  let small=CommandLine.arguments[2] == "small",large=CommandLine.arguments[2] == "large"
  let view=DailyRepWidgetView(entry:DailyRepEntry(date:.now,data:data,message:"打开dailyRep同步计划",stale:false))
    .environment(\.colorScheme,.dark).padding(14).frame(width:small ? 155 : 330,height:large ? 345 : 155).background(Color(red:0.08,green:0.13,blue:0.22))
  let renderer=ImageRenderer(content:view);renderer.scale=2
  guard let image=renderer.cgImage else {throw NSError(domain:"render",code:1)}
  let bitmap=NSBitmapImageRep(cgImage:image)
  var ink=0,unsupportedRed=0
  for y in stride(from:0,to:bitmap.pixelsHigh,by:2) {for x in stride(from:0,to:bitmap.pixelsWide,by:2) {
    guard let c=bitmap.colorAt(x:x,y:y)?.usingColorSpace(.deviceRGB) else {continue}
    if max(c.redComponent,c.greenComponent,c.blueComponent)>0.35 {ink+=1}
    if c.redComponent>0.9 && c.greenComponent<0.35 && c.blueComponent<0.4 {unsupportedRed+=1}
  }}
  guard ink>50 && unsupportedRed==0 else {throw NSError(domain:"blankOrUnsupportedWidgetContent",code:2)}
  try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[5]))
 }
}
`;
 // String.raw preserves a JS-escaped Swift key path; Swift needs a single backslash.
 source=source.replaceAll('\\\\.colorScheme','\\.colorScheme');
 writeFileSync(path.join(dir,'render.swift'),source);
 const helper=readFileSync('modules/dailyrep-native/ios/DailyRepModule.swift','utf8').split('// WIDGET_SNAPSHOT_STORE\n')[1];writeFileSync(path.join(dir,'store.swift'),helper);
 const env={...process.env,DEVELOPER_DIR:'/Applications/Xcode.app/Contents/Developer'};
 execFileSync('/usr/bin/xcrun',['swiftc','-parse-as-library','-target','arm64-apple-macos14.0','-module-cache-path',path.join(dir,'modules'),path.join(dir,'render.swift'),path.join(dir,'store.swift'),'-o',path.join(dir,'render')],{env,stdio:'pipe'});
 const now=new Date(),start=dateInZone(now,'Asia/Shanghai');
 const plans=['running','swimming','pushups','abs'].map((sport,id)=>({id:String(id),...makePlan({sport,title:['跑步100天计划','游泳100天计划','俯卧撑100天计划','腹肌训练100天计划'][id],startDate:start,goalDays:100,timeZone:'Asia/Shanghai'},now)}));
 for(const [family,state,mode] of [['large','plans','fullColor'],['medium','plans','fullColor'],['small','plans','fullColor'],['large','empty','fullColor'],['large','unavailable','fullColor'],['large','plans','accented'],['large','plans','vibrant']]) {
  writeFileSync(path.join(dir,'data.json'),JSON.stringify(widgetSnapshot(state==='empty'?[]:plans,[],now)));
  execFileSync(path.join(dir,'render'),[path.join(dir,'data.json'),family,state,mode,path.join(output,[family,state,mode].join('-')+'.png')],{env,stdio:'pipe'});
  console.log('PASS '+[family,state,mode].join(' / '));
 }
 console.log('Previews: '+output);
}finally{rmSync(dir,{recursive:true,force:true});}
