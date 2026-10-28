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
