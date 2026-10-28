export const DELETE_ACTION_WIDTH = 88;
export const isHorizontalSwipe = (dx, dy) => Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5;
export const clampSwipe = position => Math.max(-DELETE_ACTION_WIDTH, Math.min(0, position));
export const shouldRevealDelete = (position, velocity) => {
  if (velocity > 0.5) return false;
  if (velocity < -0.5) return true;
  return position <= -DELETE_ACTION_WIDTH * 0.45;
};
