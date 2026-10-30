import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isHorizontalSwipe,clampSwipe,shouldRevealDelete,DELETE_ACTION_WIDTH} from './swipe.js';

test('scrolling and tapping do not claim the destructive row gesture',()=>{
  assert.equal(isHorizontalSwipe(3,1),false);
  assert.equal(isHorizontalSwipe(8,80),false);
  assert.equal(isHorizontalSwipe(20,25),false);
  assert.equal(isHorizontalSwipe(-40,4),true);
  assert.equal(isHorizontalSwipe(40,4),true);
});
test('left swipes only reveal a bounded action; rightward drag cannot move the card past closed',()=>{
  assert.equal(clampSwipe(-500),-DELETE_ACTION_WIDTH);
  assert.equal(clampSwipe(100),0);
  assert.equal(shouldRevealDelete(clampSwipe(-500),-1),true);
  assert.equal(shouldRevealDelete(-15,0),false);
  assert.equal(shouldRevealDelete(-60,0),true);
  assert.equal(shouldRevealDelete(-60,1),false);
});

test('horizontal drag holds responder until release, keeps delete visible, and restores scrolling',async()=>{
 const {createSwipeGesture}=await import('./swipe.js');
 let position=0,reveal=false;const events=[];
 const gesture=createSwipeGesture({getPosition:()=>position,stopAnimation:()=>events.push('stop'),move:v=>{position=v;},open:()=>{reveal=true;},close:()=>{reveal=false;},active:value=>events.push(value),settle:value=>{position=value?-DELETE_ACTION_WIDTH:0;}});
 assert.equal(gesture.onPanResponderTerminationRequest(),true);
 gesture.onPanResponderGrant();gesture.onPanResponderMove(null,{dx:-70,dy:2});
 assert.equal(position,-70);assert.equal(gesture.isDragging(),true);assert.equal(gesture.onPanResponderTerminationRequest(),false,'scroll view cannot steal a held horizontal drag');
 assert.equal(reveal,true);assert.deepEqual(events,['stop',true]);
 gesture.onPanResponderRelease(null,{dx:-70,vx:0});
 assert.equal(position,-DELETE_ACTION_WIDTH);assert.equal(reveal,true);assert.equal(gesture.isDragging(),false);assert.equal(events.at(-1),false);
 gesture.onPanResponderGrant();gesture.onPanResponderMove(null,{dx:65,dy:0});gesture.onPanResponderRelease(null,{dx:65,vx:1});
 assert.equal(position,0);assert.equal(reveal,false);
 gesture.onPanResponderGrant();gesture.onPanResponderMove(null,{dx:-80,dy:0});gesture.onPanResponderTerminate();
 assert.equal(position,-DELETE_ACTION_WIDTH,'a system interruption preserves a substantially revealed action');assert.equal(events.at(-1),false);
});
