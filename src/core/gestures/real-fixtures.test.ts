/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import fixture1Json from '../../../tests/fixtures/vision-anonymous-1.json?raw';
import fixture2Json from '../../../tests/fixtures/vision-anonymous-2.json?raw';
import fixture3Json from '../../../tests/fixtures/vision-anonymous-3.json?raw';
import fixture4Json from '../../../tests/fixtures/vision-anonymous-4.json?raw';
import { extractHandFeatures, type HandFrame, type HandFeatures } from '../vision';
import { classifyGesture } from './classifier';
import { GESTURES, type GestureId } from './types';

interface RecordedPose {
  expected: GestureId;
  participantId: string;
  frame: HandFrame;
  features?: HandFeatures;
}

const poses1 = JSON.parse(fixture1Json) as RecordedPose[];
const poses2 = JSON.parse(fixture2Json) as RecordedPose[];
const poses3 = JSON.parse(fixture3Json) as RecordedPose[];
const poses4 = JSON.parse(fixture4Json) as RecordedPose[];
const allPoses = [...poses1, ...poses2, ...poses3, ...poses4];

describe('real hand landmark fixtures across multiple participants', () => {
  it('contains multi-participant fixtures from 4 distinct participants', () => {
    const participants = new Set(allPoses.map(pose => pose.participantId));
    expect(participants).toEqual(new Set(['anonymous-1', 'anonymous-2', 'anonymous-3', 'anonymous-4']));
    expect(new Set(allPoses.map(pose => pose.expected))).toEqual(new Set(GESTURES));
    for (const pose of allPoses) {
      expect(pose.frame.timestampMs).toBe(0);
      expect(pose).not.toHaveProperty('recordedAt');
    }
  });

  it('classifies each stable pose from its saved landmarks or features', () => {
    for (const pose of allPoses) {
      const feat = pose.frame.landmarks?.length === 21 ? extractHandFeatures(pose.frame) : pose.features;
      expect(feat).toBeDefined();
      if (feat) {
        expect(classifyGesture(feat)?.gesture, `${pose.expected} for ${pose.participantId}`).toBe(pose.expected);
      }
    }
  });
});
