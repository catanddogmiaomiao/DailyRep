import {test} from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('native widget diagnostics use the callback signature supported by the actual iPhoneOS SDK',{skip:process.platform!=='darwin'},()=>{
 const source=readFileSync('modules/dailyrep-native/ios/DailyRepModule.swift','utf8');
 const call=source.slice(source.indexOf('      let widgets'),source.indexOf('      result["currentWidgetInstalled"]'));
 const dir=mkdtempSync(path.join(tmpdir(),'dailyrep-widget-api-'));
 try {
  writeFileSync(path.join(dir,'check.swift'),'import WidgetKit\nfunc verifyConfigurations() async throws -> [WidgetInfo] {\n'+call+'\nreturn widgets\n}\n');
  execFileSync('/usr/bin/xcrun',['swiftc','-typecheck','-parse-as-library','-target','arm64-apple-ios15.1','-sdk','/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS.sdk','-module-cache-path',path.join(dir,'modules'),path.join(dir,'check.swift')],{env:{...process.env,DEVELOPER_DIR:'/Applications/Xcode.app/Contents/Developer'},stdio:'pipe'});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
