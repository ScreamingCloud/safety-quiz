import { pickQuestion, recordAnswer, mistakeRate } from './scheduler.mjs';

const STORAGE_KEY = 'safety-quiz-progress-v1';
const $ = id => document.getElementById(id);
const state = { data: null, progress: {}, current: null, recent: [], answered: false, displayChoices: [], sessionTotal: 0, sessionCorrect: 0 };

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
  } catch { /* A damaged local record should not stop the quiz from opening. */ }
  return {};
}

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress)); }
  catch { $('settings-message').textContent = '無法儲存紀錄；請檢查瀏覽器儲存空間。'; }
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function setView(name) {
  for (const view of ['quiz', 'progress', 'settings']) {
    $(`${view}-view`).hidden = view !== name;
    const button = document.querySelector(`[data-view="${view}"]`);
    button.classList.toggle('active', view === name);
    if (view === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (name === 'progress') renderProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showEmpty(title, message) {
  const area = $('question-area');
  area.replaceChildren();
  const box = element('div', 'empty-state');
  box.append(element('div', 'empty-icon', '✦'), element('h2', '', title), element('p', '', message));
  const button = element('button', 'button primary', '返回智能抽題');
  button.type = 'button';
  button.addEventListener('click', () => { $('mode-select').value = 'smart'; nextQuestion(); });
  box.append(button);
  area.append(box);
}

function nextQuestion(preselected = null) {
  if (!state.data) return;
  const topic = Number($('topic-select').value);
  const mode = $('mode-select').value;
  const question = preselected || pickQuestion(state.data.questions, state.progress, { topic, mode, recent: state.recent });
  if (!question) {
    showEmpty(mode === 'mistakes' ? '暫時沒有錯題' : '這個範圍已完成', mode === 'mistakes' ? '先做幾題，答錯的題目便會在這裏出現。' : '選另一個主題或練習方式，繼續溫習。');
    return;
  }
  state.current = question;
  state.answered = false;
  state.displayChoices = shuffle([0, 1, 2]);
  state.recent.push(question.id);
  state.recent = state.recent.slice(-12);
  renderQuestion();
}

function renderQuestion() {
  const q = state.current;
  const area = $('question-area');
  area.replaceChildren();
  const meta = element('div', 'question-meta');
  meta.append(element('span', 'question-tag', state.data.topics[q.topic - 1]), element('span', '', `手冊題號 ${q.id}`));
  const record = state.progress[q.id];
  if (record?.attempts) meta.append(element('span', 'question-count', `曾做 ${record.attempts} 次 · 錯 ${record.wrong} 次`));
  area.append(meta, element('h2', '', q.question));
  const choices = element('div', 'choices');
  for (let displayIndex = 0; displayIndex < 3; displayIndex++) {
    const originalIndex = state.displayChoices[displayIndex];
    const button = element('button', 'choice');
    button.type = 'button';
    button.append(element('span', 'choice-letter', 'ABC'[displayIndex]), element('span', '', q.choices[originalIndex]));
    button.addEventListener('click', () => answerQuestion(originalIndex, button));
    choices.append(button);
  }
  area.append(choices);
  const actions = element('div', 'question-actions');
  actions.append(element('span', 'source-ref', `來源：2025 手冊 · PDF 第 ${q.page} 頁`));
  area.append(actions);
}

function answerQuestion(selectedIndex, selectedButton) {
  if (state.answered) return;
  state.answered = true;
  const q = state.current;
  const correct = selectedIndex === q.answer;
  state.progress = recordAnswer(state.progress, q.id, correct);
  saveProgress();
  state.sessionTotal++;
  state.sessionCorrect += Number(correct);
  $('session-total').textContent = state.sessionTotal;
  $('session-correct').textContent = state.sessionCorrect;
  const choiceButtons = [...$('question-area').querySelectorAll('.choice')];
  choiceButtons.forEach((button, i) => {
    button.disabled = true;
    if (state.displayChoices[i] === q.answer) button.classList.add('correct');
  });
  if (!correct) selectedButton.classList.add('incorrect');
  const feedback = element('div', `feedback ${correct ? 'good' : 'bad'}`);
  feedback.setAttribute('role', 'status');
  feedback.append(element('strong', '', correct ? '答對了！' : '再記一次這題。'), element('span', '', `手冊答案：${q.choices[q.answer]}`));
  const actions = $('question-area').querySelector('.question-actions');
  actions.before(feedback);
  const next = element('button', 'button primary', '下一題 →');
  next.type = 'button';
  next.addEventListener('click', () => nextQuestion());
  actions.append(next);
  next.focus({ preventScroll: true });
}

function renderProgress() {
  if (!state.data) return;
  const all = state.data.questions;
  const records = state.progress;
  const seen = all.filter(q => records[q.id]?.attempts);
  const attempts = seen.reduce((sum, q) => sum + records[q.id].attempts, 0);
  const correct = seen.reduce((sum, q) => sum + records[q.id].correct, 0);
  const missed = seen.filter(q => records[q.id].wrong);
  $('stat-seen').textContent = seen.length.toLocaleString('zh-HK');
  $('stat-accuracy').textContent = attempts ? `${Math.round(100 * correct / attempts)}%` : '—';
  $('stat-missed').textContent = missed.length.toLocaleString('zh-HK');

  const topicProgress = $('topic-progress');
  topicProgress.replaceChildren();
  state.data.topics.forEach((name, index) => {
    const count = all.filter(q => q.topic === index + 1).length;
    const done = seen.filter(q => q.topic === index + 1).length;
    const row = element('div', 'topic-row');
    row.append(element('span', 'topic-name', `${index + 1}. ${name}`), element('span', 'topic-fraction', `${done} / ${count}`));
    const meter = element('div', 'meter');
    const fill = element('span');
    fill.style.width = `${100 * done / count}%`;
    meter.append(fill);
    row.append(meter);
    topicProgress.append(row);
  });

  const hard = $('hard-list');
  hard.replaceChildren();
  missed.sort((a, b) => mistakeRate(records[b.id]) - mistakeRate(records[a.id]) || records[b.id].wrong - records[a.id].wrong || a.id.localeCompare(b.id, 'en', { numeric: true }));
  if (!missed.length) { hard.append(element('p', 'muted', '尚未有錯題紀錄。')); return; }
  for (const q of missed.slice(0, 20)) {
    const row = element('button', 'hard-row');
    row.type = 'button';
    const title = element('span');
    title.append(element('strong', '', q.question), element('small', '', `${q.id} · ${state.data.topics[q.topic - 1]} · 錯 ${records[q.id].wrong} / ${records[q.id].attempts} 次`));
    row.append(title, element('span', 'rate-pill', `${Math.round(100 * mistakeRate(records[q.id]))}% 錯題率`));
    row.addEventListener('click', () => { setView('quiz'); nextQuestion(q); });
    hard.append(row);
  }
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), progress: state.progress }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `safety-quiz-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importProgress(file) {
  if (!file) return;
  try {
    const saved = JSON.parse(await file.text());
    if (saved.version !== 1 || !saved.progress || typeof saved.progress !== 'object' || Array.isArray(saved.progress)) throw new Error('格式不正確');
    const ids = new Set(state.data.questions.map(q => q.id));
    const cleaned = {};
    for (const [id, record] of Object.entries(saved.progress)) {
      if (!ids.has(id) || !record || !['attempts', 'correct', 'wrong'].every(key => Number.isSafeInteger(record[key]) && record[key] >= 0) || record.correct + record.wrong !== record.attempts) throw new Error('紀錄內容不正確');
      cleaned[id] = { attempts: record.attempts, correct: record.correct, wrong: record.wrong, lastWrong: Boolean(record.lastWrong), lastSeen: Number.isFinite(record.lastSeen) ? record.lastSeen : 0 };
    }
    state.progress = cleaned;
    saveProgress();
    $('settings-message').textContent = `已匯入 ${Object.keys(cleaned).length} 題紀錄。`;
    nextQuestion();
  } catch (error) { $('settings-message').textContent = `匯入失敗：${error.message}`; }
  $('import-input').value = '';
}

async function init() {
  state.progress = loadProgress();
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('topic-select').addEventListener('change', () => nextQuestion());
  $('mode-select').addEventListener('change', () => nextQuestion());
  $('export-button').addEventListener('click', exportProgress);
  $('import-input').addEventListener('change', event => importProgress(event.target.files[0]));
  $('reset-button').addEventListener('click', () => {
    if (!confirm('確定清除這部裝置的所有練習紀錄？建議先下載備份。')) return;
    state.progress = {};
    saveProgress();
    $('settings-message').textContent = '練習紀錄已清除。';
    nextQuestion();
  });
  try {
    const response = await fetch('data/questions.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!Array.isArray(state.data.questions) || !Array.isArray(state.data.topics)) throw new Error('題庫格式不正確');
    state.data.topics.forEach((topic, index) => {
      const option = document.createElement('option');
      option.value = String(index + 1);
      option.textContent = `${index + 1}. ${topic}`;
      $('topic-select').append(option);
    });
    nextQuestion();
  } catch {
    $('question-area').replaceChildren(element('p', 'loading', '題庫載入失敗，請重新整理頁面，或檢查網絡連線。'));
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
