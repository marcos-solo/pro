import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadProfile,
  markChallengeSolved,
  markLessonComplete,
  recordQuizAnswer,
  saveProfile,
} from '../src/progressStore.js';

function installStorage() {
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  };
  return values;
}

test('tracks lesson, quiz, and challenge progress', () => {
  installStorage();
  let profile = loadProfile();

  profile = markLessonComplete(profile, 'ip-address');
  profile = recordQuizAnswer(profile, 'ip-address', true);
  profile = markChallengeSolved(profile, 'ch-1');
  saveProfile(profile);

  const restored = loadProfile();
  assert.deepEqual(restored.completedLessons, ['ip-address']);
  assert.equal(restored.quizScores['ip-address'], true);
  assert.deepEqual(restored.solvedChallenges, ['ch-1']);
  assert.equal(restored.xp, 85);
  assert.equal(restored.streak, 1);
});

test('does not award duplicate lesson or challenge XP', () => {
  installStorage();
  let profile = loadProfile();
  profile = markLessonComplete(profile, 'dns-resolution');
  profile = markLessonComplete(profile, 'dns-resolution');
  profile = markChallengeSolved(profile, 'ch-2');
  profile = markChallengeSolved(profile, 'ch-2');

  assert.equal(profile.completedLessons.length, 1);
  assert.equal(profile.solvedChallenges.length, 1);
  assert.equal(profile.xp, 70);
});
