import { GESTURES, type GestureId, type Recognition } from '../../core/gestures';
import type { Hint } from '../../core/errors';

export interface TrainingState {
  currentGesture: GestureId;
  currentIndex: number;
  total: number;
  startedAt: number;
  gestureStartedAt: number;
  hintsShown: number;
  correctedErrors: number;
  completed: boolean;
}
export interface TrainingResult {
  startedAt: number;
  finishedAt: number;
  totalGestures: number;
  completedGestures: number;
  hintsShown: number;
  correctedErrors: number;
  averageReactionMs: number;
}

export class TrainingSession {
  readonly state: TrainingState;
  result: TrainingResult | null = null;
  private reactions: number[] = [];
  private lastHintCode: string | null = null;
  private hadCorrection = false;
  private readonly sequence: readonly GestureId[];

  constructor(startedAt: number, sequence: readonly GestureId[] = GESTURES) {
    if (!sequence.length) throw new RangeError('Training sequence cannot be empty');
    this.sequence = [...sequence];
    this.state = { currentGesture: sequence[0], currentIndex: 0, total: sequence.length, startedAt,
      gestureStartedAt: startedAt, hintsShown: 0, correctedErrors: 0, completed: false };
  }

  update(recognition: Recognition, hint: Hint | null, nowMs: number): TrainingState {
    if (this.state.completed) return { ...this.state };
    if (hint && hint.code !== this.lastHintCode) { this.state.hintsShown++; this.hadCorrection = true; }
    this.lastHintCode = hint?.code ?? null;
    if (recognition.state === 'confirmed' && recognition.gesture === this.state.currentGesture) {
      this.reactions.push(Math.max(0, nowMs - this.state.gestureStartedAt));
      if (this.hadCorrection) this.state.correctedErrors++;
      this.hadCorrection = false;
      this.lastHintCode = null;
      this.state.currentIndex++;
      this.state.gestureStartedAt = nowMs;
      if (this.state.currentIndex >= this.state.total) {
        this.state.completed = true;
        this.result = { startedAt: this.state.startedAt, finishedAt: nowMs, totalGestures: this.state.total,
          completedGestures: this.state.total, hintsShown: this.state.hintsShown,
          correctedErrors: this.state.correctedErrors,
          averageReactionMs: this.reactions.reduce((sum, value) => sum + value, 0) / this.reactions.length };
      } else this.state.currentGesture = this.sequence[this.state.currentIndex];
    }
    return { ...this.state };
  }
}

export function chooseBestTrainingResult(previous: TrainingResult | null, current: TrainingResult): TrainingResult {
  if (!previous || current.completedGestures > previous.completedGestures) return current;
  if (current.completedGestures < previous.completedGestures) return previous;
  return current.averageReactionMs < previous.averageReactionMs ? current : previous;
}

export const TRAINING_RESULT_KEY = 'signal.training.best.v1';
export function saveBestTrainingResult(result: TrainingResult, storage: Pick<Storage, 'getItem' | 'setItem'>): TrainingResult {
  let previous: TrainingResult | null = null;
  try { previous = JSON.parse(storage.getItem(TRAINING_RESULT_KEY) ?? 'null') as TrainingResult | null; } catch { /* Ignore malformed old data. */ }
  const best = chooseBestTrainingResult(previous, result);
  try { storage.setItem(TRAINING_RESULT_KEY, JSON.stringify(best)); } catch { /* Private mode may block storage. */ }
  return best;
}
