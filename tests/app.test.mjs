import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickQuestion, recordAnswer, reviewWeight } from '../scheduler.mjs';

const data = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url)));

test('the packaged question module matches the extracted handbook data', async () => {
  const { default: packaged } = await import('../questions.mjs');
  assert.deepEqual(packaged, data);
});

test('handbook data contains the complete, usable question set', () => {
  assert.equal(data.topics.length, 20);
  assert.equal(data.questions.length, 1585);
  assert.equal(new Set(data.questions.map(q => q.id)).size, 1585);
  for (const q of data.questions) {
    assert.ok(q.topic >= 1 && q.topic <= 20);
    assert.ok(q.page >= 6 && q.page <= 337);
    assert.ok(q.question.length > 3);
    assert.equal(q.choices.length, 3);
    assert.ok(q.choices.every(choice => choice.length > 0));
    assert.ok(q.answer >= 0 && q.answer <= 2);
  }
});

test('a higher mistake rate gives a question a higher review weight', () => {
  assert.ok(reviewWeight({ attempts: 10, wrong: 8 }) > reviewWeight({ attempts: 10, wrong: 2 }));
  assert.ok(reviewWeight({ attempts: 10, wrong: 2 }) > reviewWeight({ attempts: 10, wrong: 0 }));
});

test('smart mode revisits mistakes and avoids an immediate repeat', () => {
  const questions = data.questions.slice(0, 3);
  const progress = {
    [questions[0].id]: { attempts: 1, correct: 0, wrong: 1 },
    [questions[1].id]: { attempts: 1, correct: 1, wrong: 0 },
  };
  assert.equal(pickQuestion(questions, progress, { random: () => 0.1 }).id, questions[0].id);
  assert.notEqual(pickQuestion(questions, progress, { recent: [questions[0].id], random: () => 0.1 }).id, questions[0].id);
});

test('topic, new, and mistake filters select the intended questions', () => {
  const questions = [data.questions[0], data.questions.find(q => q.topic === 2)];
  const progress = recordAnswer({}, questions[0].id, false, 1);
  assert.equal(pickQuestion(questions, progress, { topic: 2 }).topic, 2);
  assert.equal(pickQuestion(questions, progress, { mode: 'mistakes' }).id, questions[0].id);
  assert.equal(pickQuestion(questions, progress, { mode: 'new' }).id, questions[1].id);
  assert.equal(pickQuestion(questions, progress, { mode: 'mistakes', topic: 2 }), null);
});
