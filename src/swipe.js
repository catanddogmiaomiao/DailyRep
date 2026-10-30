export const DELETE_ACTION_WIDTH = 88;
export const isHorizontalSwipe = (dx, dy) => Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5;
export const clampSwipe = position => Math.max(-DELETE_ACTION_WIDTH, Math.min(0, position));
export const shouldRevealDelete = (position, velocity) => {
  if (velocity > 0.5) return false;
  if (velocity < -0.5) return true;
  return position <= -DELETE_ACTION_WIDTH * 0.45;
};

// Own a horizontal gesture until release, including forced system cancellation.
export function createSwipeGesture({getPosition,stopAnimation,move,open,close,active,settle}) {
  let dragging=false,start=0;
  const finish=(position,velocity)=>{
    dragging=false;
    const reveal=shouldRevealDelete(clampSwipe(position),velocity);
    if(reveal)open();else close();
    settle(reveal);active(false);
  };
  return {
    isDragging:()=>dragging,
    onMoveShouldSetPanResponder:(_,g)=>isHorizontalSwipe(g.dx,g.dy),
    onMoveShouldSetPanResponderCapture:(_,g)=>isHorizontalSwipe(g.dx,g.dy),
    onPanResponderGrant:()=>{dragging=true;start=getPosition();stopAnimation();active(true);open();},
    onPanResponderMove:(_,g)=>move(clampSwipe(start+g.dx)),
    onPanResponderRelease:(_,g)=>finish(start+g.dx,g.vx),
    onPanResponderTerminationRequest:()=>!dragging,
    onPanResponderTerminate:()=>finish(getPosition(),0),
    onShouldBlockNativeResponder:()=>true,
  };
}
