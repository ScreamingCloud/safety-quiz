export function mistakeRate(record) {
  return record?.attempts ? record.wrong / record.attempts : 0;
}

export function reviewWeight(record) {
  if (!record?.attempts) return 3;
  return 1 + 9 * mistakeRate(record) + (record.lastWrong ? 1 : 0);
}

function weightedPick(items, progress, random) {
  const total = items.reduce((sum, item) => sum + reviewWeight(progress[item.id]), 0);
  let target = random() * total;
  for (const item of items) {
    target -= reviewWeight(progress[item.id]);
    if (target < 0) return item;
  }
  return items.at(-1);
}

export function pickQuestion(questions, progress, { topic = 0, mode = 'smart', recent = [], random = Math.random } = {}) {
  let pool = topic ? questions.filter(q => q.topic === topic) : questions;
  if (mode === 'new') pool = pool.filter(q => !progress[q.id]?.attempts);
  if (mode === 'mistakes') pool = pool.filter(q => progress[q.id]?.wrong > 0);
  if (!pool.length) return null;

  // Keep the last few questions out of the draw when enough alternatives exist.
  const recentIds = new Set(recent.slice(-5));
  const fresh = pool.filter(q => !recentIds.has(q.id));
  if (fresh.length) pool = fresh;

  if (mode !== 'smart') return weightedPick(pool, progress, random);
  const missed = pool.filter(q => progress[q.id]?.wrong > 0);
  const unseen = pool.filter(q => !progress[q.id]?.attempts);
  const reviewed = pool.filter(q => progress[q.id]?.attempts);
  const draw = random();
  if (missed.length && draw < 0.6) return weightedPick(missed, progress, random);
  if (unseen.length && draw < 0.85) return weightedPick(unseen, progress, random);
  return weightedPick(reviewed.length ? reviewed : pool, progress, random);
}

export function recordAnswer(progress, id, correct, timestamp = Date.now()) {
  const old = progress[id] || { attempts: 0, correct: 0, wrong: 0 };
  return {
    ...progress,
    [id]: {
      attempts: old.attempts + 1,
      correct: old.correct + Number(correct),
      wrong: old.wrong + Number(!correct),
      lastWrong: !correct,
      lastSeen: timestamp,
    },
  };
}
