import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

export class GameState {
  constructor() {
    this.reset();
    this.listeners = {};
  }

  reset() {
    this.state = 'menu'; // menu | driverSelect | mapSelect | playing | paused | complete
    this.currentLane = 1;
    this.platesHit = 0;
    this.currentCharge = 0;
    this.lampPostsLit = 0;
    this.selectedDriver = 0;
    this.selectedMap = 0;
    this.speed = 0;
    this.elapsed = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
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
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // Score: base 100 + combo bonus
    const comboMultiplier = Math.min(this.combo, 10);
    this.score += 100 + (comboMultiplier - 1) * 25;

    this.emit('plateHit', {
      platesHit: this.platesHit,
      currentCharge: this.currentCharge,
      combo: this.combo,
      score: this.score,
    });

    if (this.isBarFull()) {
      this.currentCharge = 0;
      this.lampPostsLit++;
      this.score += 500; // lamp bonus
      this.emit('lampLit', { lampPostsLit: this.lampPostsLit, score: this.score });

      if (this.isComplete()) {
        this.transition('complete');
      }
    }
  }

  missPlate() {
    if (this.combo > 0) {
      this.combo = 0;
      this.emit('comboBreak', { combo: 0 });
    }
  }

  isBarFull() {
    return this.currentCharge >= PLATES_TO_FILL_BAR;
  }

  isComplete() {
    return this.lampPostsLit >= TOTAL_LAMP_POSTS;
  }
}
