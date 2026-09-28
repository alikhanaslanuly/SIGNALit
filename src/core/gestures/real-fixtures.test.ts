/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../tests/fixtures/vision-anonymous-1.json?raw';
import { extractHandFeatures, type HandFrame } from '../vision';
import { classifyGesture } from './classifier';
import { GESTURES, type GestureId } from './types';

interface RecordedPose {
  expected: GestureId;
  participantId: string;
  frame: HandFrame;
}

const poses = JSON.parse(fixtureJson) as RecordedPose[];

describe('real hand landmark fixtures', () => {
  it('contains the six gestures from both hands without recording times', () => {
    expect(poses).toHaveLength(11);
    expect(new Set(poses.map(pose => pose.expected))).toEqual(new Set(GESTURES));
    expect(new Set(poses.map(pose => pose.frame.handedness))).toEqual(new Set(['Left', 'Right']));
    for (const pose of poses) {
      expect(pose.participantId).toBe('anonymous-1');
      expect(pose.frame.landmarks).toHaveLength(21);
      expect(pose.frame.timestampMs).toBe(0);
      expect(pose).not.toHaveProperty('recordedAt');
    }
  });

  it('classifies each stable pose from its saved landmarks', () => {
    for (const pose of poses) {
      const features = extractHandFeatures(pose.frame);
      expect(classifyGesture(features)?.gesture, `${pose.expected} on ${pose.frame.handedness}`).toBe(pose.expected);
    }
  });
});
