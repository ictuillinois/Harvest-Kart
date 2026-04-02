import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

export class GameState {
  constructor() {
    this.reset();
    this.listeners = {};
  }

  reset() {
    this.state = 'menu'; // menu | characterSelect | playing | complete
    this.currentLane = 1; // 0, 1, 2 (start center)
    this.platesHit = 0;
    this.currentCharge = 0;
    this.lampPostsLit = 0;
    this.selectedVariant = 0;
    this.speed = 0;
    this.elapsed = 0;
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  transition(newState) {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChange', { from: oldState, to: newState });
  }

  hitPlate() {
    this.platesHit++;
    this.currentCharge++;
    this.emit('plateHit', { platesHit: this.platesHit, currentCharge: this.currentCharge });

    if (this.isBarFull()) {
      this.currentCharge = 0;
      this.lampPostsLit++;
      this.emit('lampLit', { lampPostsLit: this.lampPostsLit });

      if (this.isComplete()) {
        this.transition('complete');
      }
    }
  }

  isBarFull() {
    return this.currentCharge >= PLATES_TO_FILL_BAR;
  }

  isComplete() {
    return this.lampPostsLit >= TOTAL_LAMP_POSTS;
  }
}
