const PROFILE_KEY = 'netwise.profile';

const emptyProfile = () => ({
  completedLessons: [],
  quizScores: {},
  solvedChallenges: [],
  challengeAttempts: {},
  topologySaves: [],
  xp: 0,
  streak: 0,
  lastStudyDate: null,
  timeSpentMinutes: 0,
});

export function loadProfile() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROFILE_KEY) || 'null');
    return saved ? { ...emptyProfile(), ...saved } : emptyProfile();
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(profile) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage is optional; the app remains usable in private mode or with quotas.
  }
  return profile;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function previousDayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function recordStudyActivity(profile, xpAmount = 10) {
  const today = todayKey();
  const isToday = profile.lastStudyDate === today;
  const isYesterday = profile.lastStudyDate === previousDayKey();
  return saveProfile({
    ...profile,
    xp: (profile.xp || 0) + xpAmount,
    streak: isToday ? (profile.streak || 0) : isYesterday ? (profile.streak || 0) + 1 : 1,
    lastStudyDate: today,
  });
}

export function markLessonComplete(profile, lessonId) {
  if (!profile.completedLessons.includes(lessonId)) {
    const updated = recordStudyActivity({
      ...profile,
      completedLessons: [...profile.completedLessons, lessonId],
    }, 20);
    return updated;
  }
  return profile;
}

export function recordQuizAnswer(profile, lessonId, isCorrect) {
  const updated = recordStudyActivity({
    ...profile,
    quizScores: { ...profile.quizScores, [lessonId]: isCorrect },
  }, isCorrect ? 15 : 5);
  return updated;
}

export function markChallengeSolved(profile, challengeId) {
  if (!profile.solvedChallenges.includes(challengeId)) {
    return recordStudyActivity({
      ...profile,
      solvedChallenges: [...profile.solvedChallenges, challengeId],
    }, 50);
  }
  return profile;
}

export function recordChallengeAttempt(profile, challengeId) {
  return recordStudyActivity({
    ...profile,
    challengeAttempts: {
      ...profile.challengeAttempts,
      [challengeId]: (profile.challengeAttempts[challengeId] || 0) + 1,
    },
  }, 2);
}
