const STORAGE_KEY = 'studybuddy-state';
const habits = ['Revise Notes', 'Sleep 8 hrs', 'Exercise', 'Drink Water'];
const quotes = [
  ['Success is the sum of small efforts, repeated day in and day out.', 'Robert Collier'],
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['It always seems impossible until it is done.', 'Nelson Mandela'],
  ['Great things are done by a series of small things brought together.', 'Vincent van Gogh'],
  ['You do not have to be perfect. You just have to keep going.', 'Unknown']
];

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const todayKey = () => dateKey();
const defaultState = () => ({ tasks: [], habits: [false, false, false, false], streak: 0, lastHabitDate: null, streakCountedDate: null, theme: 'light' });
let state = loadState();
let timer = { seconds: 1500, running: false, mode: 'Focus', interval: null };

function loadState() {
  try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return defaultState(); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function dateLabel() { return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date()); }
function formatTime(value) { if (!value) return 'Anytime'; const [hour, minute] = value.split(':'); const date = new Date(); date.setHours(hour, minute); return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date); }
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }

function handleDayRollover() {
  const currentDay = todayKey();
  if (state.lastHabitDate && state.lastHabitDate !== currentDay) {
    const previousDate = new Date(`${state.lastHabitDate}T00:00:00`);
    const currentDate = new Date(`${currentDay}T00:00:00`);
    const daysElapsed = Math.round((currentDate - previousDate) / 86400000);
    if (daysElapsed !== 1 || !state.habits.every(Boolean)) state.streak = 0;
    state.habits = [false, false, false, false];
    state.streakCountedDate = null;
  }
  state.lastHabitDate = currentDay;
  saveState();
}
function renderTasks() {
  const list = document.querySelector('#task-list');
  const empty = document.querySelector('#empty-state');
  const sorted = [...state.tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || a.time.localeCompare(b.time));
  list.innerHTML = sorted.map(task => `
    <article class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
      <input class="task-checkbox" type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark ${escapeHtml(task.subject)} complete">
      <div><strong class="task-subject">${escapeHtml(task.subject)}</strong><div class="task-time">${formatTime(task.time)}</div></div>
      <span class="priority priority-${task.priority}">${task.priority}</span>
      <div class="task-actions"><button class="task-action edit-task" type="button" aria-label="Edit ${escapeHtml(task.subject)}">✎</button><button class="task-action delete-task" type="button" aria-label="Delete ${escapeHtml(task.subject)}">×</button></div>
    </article>`).join('');
  empty.classList.toggle('visible', state.tasks.length === 0);
  document.querySelector('#task-count').textContent = `${state.tasks.length} ${state.tasks.length === 1 ? 'task' : 'tasks'}`;
  renderProgress();
}
function renderProgress() {
  const total = state.tasks.length;
  const done = state.tasks.filter(task => task.completed).length;
  const percent = total ? Math.round(done / total * 100) : 0;
  document.querySelector('#progress-percent').textContent = `${percent}%`;
  document.querySelector('#task-summary').textContent = `${done} of ${total} tasks completed today`;
  document.querySelector('#progress-bar-fill').style.width = `${percent}%`;
  document.querySelector('#progress-ring').style.setProperty('--progress', `${percent * 3.6}deg`);
  document.querySelector('#progress-ring').setAttribute('aria-label', `${percent} percent of tasks complete`);
  document.querySelector('#progress-message').textContent = percent === 100 && total ? 'You did it. Take a well-earned breath.' : percent > 0 ? 'Every completed task is a vote for your future self.' : 'A clear plan is a kind of self-care.';
}
function renderHabits() {
  const checked = state.habits.filter(Boolean).length;
  document.querySelector('#habit-summary').textContent = `${checked}/${habits.length}`;
  document.querySelector('#streak-count').textContent = state.streak;
  document.querySelector('#habit-list').innerHTML = habits.map((habit, index) => `<div class="habit-item"><input class="habit-checkbox" id="habit-${index}" type="checkbox" ${state.habits[index] ? 'checked' : ''} data-index="${index}"><label for="habit-${index}">${habit}</label></div>`).join('');
}
function addTask(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), subject: data.get('subject').trim(), time: data.get('time'), priority: data.get('priority'), completed: false });
  saveState(); form.reset(); document.querySelector('#priority').value = 'medium'; renderTasks();
}
function editTask(task) {
  const subject = prompt('Update the subject:', task.subject); if (subject === null || !subject.trim()) return;
  const time = prompt('Update the time (HH:MM):', task.time); if (time === null) return;
  task.subject = subject.trim(); task.time = time; saveState(); renderTasks();
}
function handleTaskClick(event) {
  const item = event.target.closest('.task-item'); if (!item) return;
  const task = state.tasks.find(entry => entry.id === item.dataset.id); if (!task) return;
  if (event.target.matches('.task-checkbox')) task.completed = event.target.checked;
  if (event.target.matches('.delete-task')) state.tasks = state.tasks.filter(entry => entry.id !== task.id);
  if (event.target.matches('.edit-task')) editTask(task);
  saveState(); renderTasks();
}
function updateTimerDisplay() { const minutes = String(Math.floor(timer.seconds / 60)).padStart(2, '0'); const seconds = String(timer.seconds % 60).padStart(2, '0'); document.querySelector('#timer-display').textContent = `${minutes}:${seconds}`; document.querySelector('#timer-mode').textContent = timer.mode; document.querySelector('#timer-start').textContent = timer.running ? 'Pause focus' : 'Start focus'; }
function toggleTimer() { timer.running = !timer.running; if (timer.running) timer.interval = setInterval(() => { timer.seconds--; if (timer.seconds <= 0) { clearInterval(timer.interval); timer.running = false; timer.mode = timer.mode === 'Focus' ? 'Break' : 'Focus'; timer.seconds = timer.mode === 'Focus' ? 1500 : 300; alert(`${timer.mode} time starts now.`); } updateTimerDisplay(); }, 1000); else clearInterval(timer.interval); updateTimerDisplay(); }
function resetTimer() { clearInterval(timer.interval); timer = { seconds: timer.mode === 'Focus' ? 1500 : 300, running: false, mode: 'Focus', interval: null }; updateTimerDisplay(); }
function addMinutesToTime(minutes) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function normalizeGeminiTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error('Gemini returned an invalid plan.');
  return tasks.slice(0, 12).filter(task => typeof task.subject === 'string' && task.subject.trim()).map((task, index) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
    subject: task.subject.trim().slice(0, 80),
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(task.time) ? task.time : addMinutesToTime(index * 30),
    priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
    completed: false
  }));
}
function addGeminiPlanContent(content, status) {
  const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ''));
  const tasks = normalizeGeminiTasks(parsed.tasks);
  if (!tasks.length) throw new Error('Gemini did not find any study tasks in that request.');
  state.tasks.push(...tasks); saveState(); renderTasks(); renderCoach();
  document.querySelector('#voice-transcript').value = '';
  status.textContent = `${tasks.length} task${tasks.length === 1 ? '' : 's'} added to your day.`;
}
async function generateGeminiPlan() {
  const transcript = document.querySelector('#voice-transcript').value.trim();
  const status = document.querySelector('#voice-status');
  const button = document.querySelector('#gemini-generate');
  if (!transcript) { status.textContent = 'Speak or type what you want to study first.'; return; }
  button.disabled = true; button.textContent = 'Adding plan...'; status.textContent = 'Keeping your plan on this device...';
  const phrases = transcript.split(/\s+and\s+|[,;]+/i).map(item => item.trim()).filter(Boolean);
  const now = new Date();
  phrases.slice(0, 8).forEach((subject, index) => { const time = new Date(now.getTime() + index * 30 * 60000); state.tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`, subject: subject.replace(/^(plan|add|study|revise|read)\s+/i, '').trim().slice(0, 80) || 'Study block', time: `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`, priority: index === 0 ? 'high' : 'medium', completed: false }); });
  saveState(); renderTasks(); renderCoach(); document.querySelector('#voice-transcript').value = ''; status.textContent = `${phrases.length || 1} private task${phrases.length === 1 ? '' : 's'} added.`; button.disabled = false; button.textContent = 'Add voice plan';
}
async function requestGemini(prompt) {
  return '';
}
function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = document.querySelector('#voice-button');
  const transcript = document.querySelector('#voice-transcript');
  const status = document.querySelector('#voice-status');
  let fallbackRecorder = null;
  let fallbackStream = null;
  let fallbackChunks = [];
  let useDirectRecording = false;
  async function sendAudioToGemini(blob) {
    status.textContent = 'Gemini is listening to your recording...';
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        status.textContent = 'Local audio was recorded. This browser cannot transcribe it offline; type the transcript below to keep data private.';
      } catch (error) { status.textContent = 'Local recording failed. Type your plan below.'; }
    };
    reader.readAsDataURL(blob);
  }
  async function startFallbackRecording() {
    try {
      fallbackStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      fallbackChunks = [];
      fallbackRecorder = new MediaRecorder(fallbackStream);
      fallbackRecorder.ondataavailable = event => { if (event.data.size) fallbackChunks.push(event.data); };
      fallbackRecorder.onstop = () => { fallbackStream.getTracks().forEach(track => track.stop()); sendAudioToGemini(new Blob(fallbackChunks, { type: fallbackRecorder.mimeType || 'audio/webm' })); fallbackRecorder = null; };
      fallbackRecorder.start(); button.classList.add('listening'); button.innerHTML = '<span>●</span> Stop recording'; status.textContent = 'Recording. Click again when you finish speaking.';
    } catch (error) { status.textContent = error.name === 'NotAllowedError' ? 'Microphone access was denied. Allow it for localhost and try again.' : 'Microphone recording could not start.'; }
  }
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US'; recognition.interimResults = true; recognition.continuous = false;
    recognition.onstart = () => { button.classList.add('listening'); button.innerHTML = '<span>●</span> Listening...'; status.textContent = 'I’m listening. Describe your study day.'; };
    recognition.onresult = event => { transcript.value = Array.from(event.results).map(result => result[0].transcript).join(''); };
    recognition.onerror = event => {
      if (event.error === 'network' || event.error === 'service-not-allowed') { useDirectRecording = true; status.textContent = 'Browser speech service unavailable. Click again to use local recording.'; return; }
      const messages = { 'not-allowed': 'Microphone access is blocked. Allow microphone access for this site, then try again.', 'service-not-allowed': 'Speech recognition is blocked. Direct Gemini recording is available on the next click.', 'audio-capture': 'No microphone was found. Connect a microphone and try again.', 'no-speech': 'No speech detected. Try speaking closer to the microphone.' };
      status.textContent = messages[event.error] || `Voice recognition error: ${event.error}. Try again or type your plan.`;
    };
    recognition.onend = () => { button.classList.remove('listening'); button.innerHTML = '<span>●</span> Speak your plan'; if (transcript.value.trim()) { status.textContent = 'Voice captured. Gemini is creating your plan...'; generateGeminiPlan(); } };
    button.addEventListener('click', async () => {
      if (fallbackRecorder) { fallbackRecorder.stop(); button.classList.remove('listening'); button.innerHTML = '<span>●</span> Speak your plan'; return; }
      try { if (useDirectRecording) { await startFallbackRecording(); return; } if (navigator.mediaDevices?.getUserMedia) { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.getTracks().forEach(track => track.stop()); } recognition.start(); }
      catch (error) { if (error.name !== 'InvalidStateError') await startFallbackRecording(); }
    });
  } else {
    button.addEventListener('click', startFallbackRecording);
  }
}
function getCoachAdvice() {
  const total = state.tasks.length;
  const done = state.tasks.filter(task => task.completed).length;
  const remaining = state.tasks.filter(task => !task.completed);
  const habitsDone = state.habits.filter(Boolean).length;
  if (!total) return 'Your day is wide open. I recommend starting with one 25-minute focus block so planning turns into momentum.';
  if (remaining.length === 0) return 'You have completed every task today. Protect the win: take a real break, then review what made this session work.';
  const nextTask = [...remaining].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))[0];
  if (habitsDone < habits.length / 2) return `Your best next move is “${nextTask.subject}”. Pair it with one small habit now, then use a 25-minute focus block to make the start easy.`;
  if (done / total >= 0.5) return `You are past the halfway point. Finish “${nextTask.subject}” next while your momentum is warm, then take a short reset.`;
  return `Start with “${nextTask.subject}” (${nextTask.priority} priority). Keep the first block small and specific: 25 minutes, one clear outcome.`;
}
async function renderCoach() {
  const message = document.querySelector('#coach-message');
  message.textContent = getCoachAdvice();
}
async function planMyDay() {
  const button = document.querySelector('#coach-plan'); button.disabled = true; button.textContent = 'Planning locally...';
  const now = new Date(); now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
  state.tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), subject: 'First focused study block', time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, priority: 'high', completed: false });
  saveState(); renderTasks(); renderCoach(); document.querySelector('#voice-status').textContent = 'Private starter task added.'; button.disabled = false; button.textContent = '✦ Plan my day';
}

handleDayRollover();
document.documentElement.dataset.theme = state.theme;
document.querySelector('#today-label').textContent = dateLabel();
document.querySelector('#footer-year').textContent = new Date().getFullYear();
document.querySelector('#theme-toggle').setAttribute('aria-label', `Switch to ${state.theme === 'light' ? 'dark' : 'light'} mode`);
const quote = quotes[Math.floor(Math.random() * quotes.length)]; document.querySelector('#quote-text').textContent = quote[0]; document.querySelector('#quote-author').textContent = `— ${quote[1]}`;
renderTasks(); renderHabits(); updateTimerDisplay(); renderCoach();
setupVoiceRecognition();
document.querySelector('#task-form').addEventListener('submit', addTask);
document.querySelector('#task-list').addEventListener('click', handleTaskClick);
document.querySelector('#habit-list').addEventListener('change', event => {
  if (!event.target.matches('.habit-checkbox')) return;
  state.habits[Number(event.target.dataset.index)] = event.target.checked;
  const currentDay = todayKey();
  const allComplete = state.habits.every(Boolean);
  if (allComplete && state.streakCountedDate !== currentDay) { state.streak++; state.streakCountedDate = currentDay; }
  if (!allComplete && state.streakCountedDate === currentDay) { state.streak = Math.max(0, state.streak - 1); state.streakCountedDate = null; }
  saveState(); renderHabits();
});
document.querySelector('#theme-toggle').addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = state.theme; document.querySelector('#theme-toggle').setAttribute('aria-label', `Switch to ${state.theme === 'light' ? 'dark' : 'light'} mode`); saveState(); });
document.querySelector('#timer-start').addEventListener('click', toggleTimer);
document.querySelector('#timer-reset').addEventListener('click', resetTimer);
document.querySelector('#coach-refresh').addEventListener('click', renderCoach);
document.querySelector('#coach-plan').addEventListener('click', planMyDay);
document.querySelector('#coach-focus').addEventListener('click', () => { if (!timer.running) toggleTimer(); document.querySelector('#timer-display').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
document.querySelector('#gemini-generate').addEventListener('click', generateGeminiPlan);
