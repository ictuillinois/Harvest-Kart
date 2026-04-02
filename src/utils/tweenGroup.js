import { Group } from '@tweenjs/tween.js';

// Shared tween group — all game tweens must use this.
// tween.js v25 requires an explicit Group for update() to work.
export const tweenGroup = new Group();
