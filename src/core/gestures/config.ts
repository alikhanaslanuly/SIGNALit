/** Initial thresholds; tune with labeled recordings split by participant. */
export const DEFAULT_CLASSIFIER_CONFIG = {
  minConfidence: 0.72,
  minMargin: 0.12,
} as const;
