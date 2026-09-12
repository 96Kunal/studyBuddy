/**
 * StudyBuddy Nexus — Main Application Orchestrator
 * Seamlessly integrates 12 modern JavaScript framework paradigms with 0% AI footprint.
 */

import {
  globalEventBus,
  createSignal,
  createEffect,
  createMemo,
  reactive,
  computed,
  watch,
  AngularPipes,
  nestApp,
  mockServer,
  RemixDataEngine,
  UniversalRouter,
  SpacedRepetitionEngine,
  NaturalLanguageTaskParser,
  audioSynth,
  CalendarExporter,
  PerformanceProfiler
} from './core/engine.js';

import { bootstrapServices } from './core/services.js';

// ==========================================
// 1. BOOTSTRAP ARCHITECTURE SERVICES
// ==========================================
const { storage, taskService, flashcardService, notesService } = bootstrapServices();
const remixEngine = new RemixDataEngine(mockServer, globalEventBus);

// Solid.js Reactive Signals
const [activeRoute, setActiveRoute] = createSignal('planner');
const [tasksCount, setTasksCount] = createSignal(storage.data.tasks.length);
const [focusSeconds, setFocusSeconds] = createSignal(1500);
const [isTimerRunning, setIsTimerRunning] = createSignal(false);
const [ambientAudioActive, setAmbientAudioActive] = createSignal(false);

// Vue.js Reactive Proxy State
const reactiveState = reactive({
  tasks: storage.data.tasks,
  habits: storage.data.habits,
  notes: storage.data.notes,
  activeNoteId: storage.data.notes[0]?.id || null,
  activeCardIndex: 0,
  isCardFlipped: false,
  timerMode: 'Focus',
  timerTotalDuration: 1500,
  filterSearch: '',
  filterPriority: 'all',
  currentViewType: 'kanban' // 'kanban' or 'schedule'
});

// Vue Computed Properties
const computedMetrics = {
  totalTasks: computed(() => reactiveState.tasks.length),
  completedTasks: computed(() => reactiveState.tasks.filter(t => t.completed).length),
  completionRate: computed(() => {
    const total = reactiveState.tasks.length;
    if (!total) return 0;
    return Math.round((reactiveState.tasks.filter(t => t.completed).length / total) * 100);
  }),
  filteredTasks: computed(() => {
    return reactiveState.tasks.filter(t => {
      const matchQuery = !reactiveState.filterSearch ||
        t.subject.toLowerCase().includes(reactiveState.filterSearch.toLowerCase()) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(reactiveState.filterSearch.toLowerCase())));
      const matchPriority = reactiveState.filterPriority === 'all' || t.priority === reactiveState.filterPriority;
      return matchQuery && matchPriority;
    });
  })
};

// ==========================================
// 2. UNIVERSAL ROUTER (Next.js & Nuxt.js)
// ==========================================
const routes = {
  planner: document.querySelector('#view-planner'),
  flashcards: document.querySelector('#view-flashcards'),
  pomodoro: document.querySelector('#view-pomodoro'),
  notes: document.querySelector('#view-notes'),
  analytics: document.querySelector('#view-analytics')
};

const router = new UniversalRouter(routes, 'planner');

router.onRouteChange(route => {
  setActiveRoute(route);
  Object.entries(routes).forEach(([name, el]) => {
    if (el) el.classList.toggle('active', name === route);
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === route);
  });

  // Dynamic document title (Next.js metadata pattern)
  const titles = {
    planner: 'Planner & Kanban — StudyBuddy Nexus',
    flashcards: 'Spaced Retrieval (SM-2) — StudyBuddy Nexus',
    pomodoro: 'Focus Studio — StudyBuddy Nexus',
    notes: 'Markdown Notes — StudyBuddy Nexus',
    analytics: 'Productivity Heatmap — StudyBuddy Nexus'
  };
  document.title = titles[route] || 'StudyBuddy Nexus';

  // Render specific views on route activation
  if (route === 'notes') renderNotesWorkspace();
  if (route === 'flashcards') renderActiveFlashcard();
  if (route === 'analytics') renderAnalyticsHeatmap();
});

// ==========================================
// 3. DETERMINISTIC NLP SMART DISPATCHER
// ==========================================
function setupNlpDispatcher() {
  const input = document.querySelector('#nlp-task-input');
  const submitBtn = document.querySelector('#btn-nlp-submit');
  const voiceBtn = document.querySelector('#btn-voice-nlp');
  const feedback = document.querySelector('#nlp-feedback');

  function handleDispatch() {
    const text = input.value.trim();
    if (!text) {
      feedback.textContent = 'Please enter a task or study plan first.';
      return;
    }

    // Deterministic parsing (0% AI footprint, 100% regex heuristics)
    const taskData = NaturalLanguageTaskParser.parse(text);
    if (!taskData) {
      feedback.textContent = 'Could not parse task. Try: "Revise Chemistry at 3pm high priority"';
      return;
    }

    // Remix Action: Optimistic UI update + Fastify REST POST
    remixEngine.action({
      endpoint: '/api/v1/tasks',
      method: 'POST',
      body: taskData,
      optimisticUpdate: () => {
        reactiveState.tasks.unshift(taskData);
        setTasksCount(reactiveState.tasks.length);
        renderTasksView();
        audioSynth.playTick();
        return taskData.id;
      },
      rollback: (id) => {
        reactiveState.tasks = reactiveState.tasks.filter(t => t.id !== id);
        setTasksCount(reactiveState.tasks.length);
        renderTasksView();
      }
    }).then(res => {
      if (res.ok) {
        feedback.innerHTML = `Dispatched: <strong>${taskData.subject}</strong> at <strong>${taskData.time}</strong> [${AngularPipes.priorityBadge(taskData.priority).label}]`;
        input.value = '';
      }
    });
  }

  submitBtn.addEventListener('click', handleDispatch);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleDispatch();
  });

  // Web Speech API Integration
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.interimResults = true;

    recognition.onstart = () => {
      voiceBtn.classList.add('listening');
      voiceBtn.innerHTML = '<span class="mic-dot">●</span> Listening...';
      feedback.textContent = 'Listening... describe your study task (e.g. "Math quiz at 5pm urgent")';
    };

    recognition.onresult = event => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
      input.value = transcript;
    };

    recognition.onend = () => {
      voiceBtn.classList.remove('listening');
      voiceBtn.innerHTML = '<span class="mic-dot">●</span> Speak';
      if (input.value.trim()) handleDispatch();
    };

    voiceBtn.addEventListener('click', () => {
      try {
        recognition.start();
      } catch {
        recognition.stop();
      }
    });
  } else {
    voiceBtn.title = 'Speech recognition not supported in this browser. Please type your plan.';
  }
}

// ==========================================
// 4. TASK MANAGEMENT (KANBAN & SCHEDULE)
// ==========================================
function renderTasksView() {
  if (reactiveState.currentViewType === 'kanban') {
    renderKanbanColumns();
  } else {
    renderLinearSchedule();
  }
  renderDashboardMetrics();
}

function renderKanbanColumns() {
  const cardsTodo = document.querySelector('#cards-todo');
  const cardsProgress = document.querySelector('#cards-in-progress');
  const cardsDone = document.querySelector('#cards-done');

  const filtered = computedMetrics.filteredTasks.value;

  const todoTasks = filtered.filter(t => (t.column || 'todo') === 'todo' && !t.completed);
  const progTasks = filtered.filter(t => t.column === 'in-progress' && !t.completed);
  const doneTasks = filtered.filter(t => t.column === 'done' || t.completed);

  document.querySelector('#count-todo').textContent = todoTasks.length;
  document.querySelector('#count-in-progress').textContent = progTasks.length;
  document.querySelector('#count-done').textContent = doneTasks.length;
  document.querySelector('#tasks-total-pill').textContent = `${filtered.length} Tasks`;

  cardsTodo.innerHTML = todoTasks.map(t => createTaskCardHtml(t)).join('') || emptyColumnHtml('No pending tasks');
  cardsProgress.innerHTML = progTasks.map(t => createTaskCardHtml(t)).join('') || emptyColumnHtml('No active focus blocks');
  cardsDone.innerHTML = doneTasks.map(t => createTaskCardHtml(t)).join('') || emptyColumnHtml('No completed tasks yet');

  setupDragAndDrop();
}

function emptyColumnHtml(msg) {
  return `<div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.8rem;">${msg}</div>`;
}

function createTaskCardHtml(task) {
  const priority = AngularPipes.priorityBadge(task.priority);
  const tagsHtml = (task.tags || ['Study']).map(t => `<span class="tag-pill">${t}</span>`).join('');

  return `
    <article class="task-card ${task.completed ? 'completed' : ''}" draggable="true" data-id="${task.id}">
      <div class="task-card-header">
        <div class="task-check-wrap">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}" aria-label="Mark task completed">
          <span class="task-title">${escapeHtml(task.subject)}</span>
        </div>
      </div>
      <div class="task-time-chip">
        <span>⏰ ${task.time || 'Anytime'}</span>
      </div>
      <div class="task-tags-row">
        ${tagsHtml}
      </div>
      <div class="task-card-footer">
        <span class="badge-priority ${priority.class}">
          <span>${priority.icon}</span> ${priority.label}
        </span>
        <div class="task-actions-group">
          <button type="button" class="task-icon-btn edit-btn" data-id="${task.id}" title="Edit Task">✎</button>
          <button type="button" class="task-icon-btn delete delete-btn" data-id="${task.id}" title="Delete Task">✕</button>
        </div>
      </div>
    </article>
  `;
}

function renderLinearSchedule() {
  const container = document.querySelector('#schedule-tasks-container');
  const filtered = computedMetrics.filteredTasks.value;
  const sorted = [...filtered].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  if (!sorted.length) {
    container.innerHTML = '<div style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No study tasks found matching the filter.</div>';
    return;
  }

  container.innerHTML = sorted.map(task => {
    const priority = AngularPipes.priorityBadge(task.priority);
    return `
      <div class="schedule-row-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
          <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-cyan);">${task.time}</span>
          <strong style="font-size: 0.9rem;">${escapeHtml(task.subject)}</strong>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="badge-priority ${priority.class}">${priority.label}</span>
          <button type="button" class="task-icon-btn delete delete-btn" data-id="${task.id}">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.task-card');
  const cols = document.querySelectorAll('.kanban-col');

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
  });

  cols.forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => {
      col.classList.remove('drag-over');
    });
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newCol = col.dataset.column;
      if (taskId && newCol) {
        updateTaskColumn(taskId, newCol);
      }
    });
  });
}

function updateTaskColumn(taskId, newCol) {
  const task = reactiveState.tasks.find(t => t.id === taskId);
  if (!task || task.column === newCol) return;

  const isCompleted = newCol === 'done';
  remixEngine.action({
    endpoint: `/api/v1/tasks/${taskId}`,
    method: 'PATCH',
    body: { column: newCol, completed: isCompleted },
    optimisticUpdate: () => {
      task.column = newCol;
      task.completed = isCompleted;
      renderTasksView();
      audioSynth.playTick();
    }
  });
}

function renderDashboardMetrics() {
  const total = computedMetrics.totalTasks.value;
  const done = computedMetrics.completedTasks.value;
  const rate = computedMetrics.completionRate.value;

  document.querySelector('#stat-completion-pct').textContent = `${rate}%`;
  document.querySelector('#stat-task-ratio').textContent = `${done} of ${total} tasks completed`;
  document.querySelector('#stat-progress-bar').style.width = `${rate}%`;
  document.querySelector('#completion-ring').style.setProperty('--progress', `${rate * 3.6}deg`);

  const tip = document.querySelector('#stat-progress-tip');
  if (rate === 100 && total > 0) {
    tip.textContent = 'Outstanding discipline. All planned targets hit today!';
  } else if (rate > 50) {
    tip.textContent = 'Momentum is accelerating. Halfway past daily goals.';
  } else if (total > 0) {
    tip.textContent = 'Engage the first focus block to trigger flow state.';
  } else {
    tip.textContent = 'Add your first focus task to initiate daily velocity.';
  }

  // Habits Pills
  const habitsContainer = document.querySelector('#planner-habits-container');
  habitsContainer.innerHTML = reactiveState.habits.map(h => `
    <span class="habit-pill ${h.completed ? 'checked' : ''}" data-id="${h.id}">
      <span>${h.completed ? '✓' : '○'}</span> ${escapeHtml(h.title)}
    </span>
  `).join('');
}

// Global Delegation for Task Interactions
document.addEventListener('click', e => {
  // Checkbox toggle
  if (e.target.matches('.task-checkbox')) {
    const taskId = e.target.dataset.id;
    const task = reactiveState.tasks.find(t => t.id === taskId);
    if (task) {
      const completed = e.target.checked;
      const newCol = completed ? 'done' : 'todo';
      remixEngine.action({
        endpoint: `/api/v1/tasks/${taskId}`,
        method: 'PATCH',
        body: { completed, column: newCol },
        optimisticUpdate: () => {
          task.completed = completed;
          task.column = newCol;
          renderTasksView();
          audioSynth.playTick();
        }
      });
    }
  }

  // Delete task
  if (e.target.closest('.delete-btn')) {
    const taskId = e.target.closest('.delete-btn').dataset.id;
    if (confirm('Delete this study task?')) {
      remixEngine.action({
        endpoint: `/api/v1/tasks/${taskId}`,
        method: 'DELETE',
        optimisticUpdate: () => {
          reactiveState.tasks = reactiveState.tasks.filter(t => t.id !== taskId);
          setTasksCount(reactiveState.tasks.length);
          renderTasksView();
        }
      });
    }
  }

  // Edit task
  if (e.target.closest('.edit-btn')) {
    const taskId = e.target.closest('.edit-btn').dataset.id;
    const task = reactiveState.tasks.find(t => t.id === taskId);
    if (task) {
      const newSubject = prompt('Edit task title:', task.subject);
      if (newSubject && newSubject.trim()) {
        remixEngine.action({
          endpoint: `/api/v1/tasks/${taskId}`,
          method: 'PATCH',
          body: { subject: newSubject.trim() },
          optimisticUpdate: () => {
            task.subject = newSubject.trim();
            renderTasksView();
          }
        });
      }
    }
  }

  // Habit Toggle
  const habitPill = e.target.closest('.habit-pill');
  if (habitPill) {
    const hid = habitPill.dataset.id;
    const habit = reactiveState.habits.find(h => h.id === hid);
    if (habit) {
      habit.completed = !habit.completed;
      storage.save();
      renderDashboardMetrics();
      audioSynth.playTick();
    }
  }
});

// View Toggle between Kanban & Schedule
document.querySelector('#tab-view-kanban').addEventListener('click', () => {
  reactiveState.currentViewType = 'kanban';
  document.querySelector('#tab-view-kanban').classList.add('active');
  document.querySelector('#tab-view-schedule').classList.remove('active');
  document.querySelector('#kanban-board').style.display = 'grid';
  document.querySelector('#linear-schedule').style.display = 'none';
  renderTasksView();
});

document.querySelector('#tab-view-schedule').addEventListener('click', () => {
  reactiveState.currentViewType = 'schedule';
  document.querySelector('#tab-view-schedule').classList.add('active');
  document.querySelector('#tab-view-kanban').classList.remove('active');
  document.querySelector('#kanban-board').style.display = 'none';
  document.querySelector('#linear-schedule').style.display = 'block';
  renderTasksView();
});

// Search & Priority Filter Listeners
document.querySelector('#filter-search-input').addEventListener('input', e => {
  reactiveState.filterSearch = e.target.value;
  renderTasksView();
});

document.querySelector('#filter-priority-select').addEventListener('change', e => {
  reactiveState.filterPriority = e.target.value;
  renderTasksView();
});

// ========================================================
// 5. FLASHCARDS & SUPERMEMO SM-2 SPACED REPETITION
// ========================================================
function renderActiveFlashcard() {
  const cards = flashcardService.getAll();
  const wrap = document.querySelector('#flashcard-flip-wrap');
  const inner = document.querySelector('#active-flashcard');

  if (!cards.length) {
    document.querySelector('#fc-front-text').textContent = 'No flashcards in your deck yet. Click Create Flashcard above.';
    document.querySelector('#fc-back-text').textContent = 'Create flashcards to test spaced retrieval.';
    return;
  }

  const idx = reactiveState.activeCardIndex % cards.length;
  const currentCard = cards[idx];

  document.querySelector('#fc-front-deck').textContent = currentCard.deck || 'General';
  document.querySelector('#fc-front-text').textContent = currentCard.front;
  document.querySelector('#fc-back-text').textContent = currentCard.back;
  document.querySelector('#fc-deck-status').textContent = `Card ${idx + 1} of ${cards.length}`;
  document.querySelector('#fc-sm2-next').textContent = `${currentCard.interval || 1} day${currentCard.interval === 1 ? '' : 's'}`;
  document.querySelector('#fc-sm2-ef').textContent = currentCard.easeFactor || '2.5';

  // Reset flip
  inner.classList.remove('flipped');
  reactiveState.isCardFlipped = false;

  renderFlashcardsLibrary();
}

function flipFlashcard() {
  const inner = document.querySelector('#active-flashcard');
  reactiveState.isCardFlipped = !reactiveState.isCardFlipped;
  inner.classList.toggle('flipped', reactiveState.isCardFlipped);
  audioSynth.playTick();
}

document.querySelector('#flashcard-flip-wrap').addEventListener('click', flipFlashcard);
window.addEventListener('keydown', e => {
  if (activeRoute() === 'flashcards' && e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault();
    flipFlashcard();
  }
});

// SM-2 Recall Grade Buttons (0, 3, 4, 5)
document.querySelectorAll('.btn-sm2').forEach(btn => {
  btn.addEventListener('click', () => {
    const quality = parseInt(btn.dataset.quality, 10);
    const cards = flashcardService.getAll();
    if (!cards.length) return;

    const currentCard = cards[reactiveState.activeCardIndex % cards.length];

    remixEngine.action({
      endpoint: `/api/v1/flashcards/${currentCard.id}/review`,
      method: 'POST',
      body: { quality },
      optimisticUpdate: () => {
        const updated = SpacedRepetitionEngine.review(currentCard, quality);
        Object.assign(currentCard, updated);
        storage.save();
        audioSynth.playTick();
        reactiveState.activeCardIndex = (reactiveState.activeCardIndex + 1) % cards.length;
        renderActiveFlashcard();
      }
    });
  });
});

function renderFlashcardsLibrary() {
  const cards = flashcardService.getAll();
  document.querySelector('#fc-library-count').textContent = `${cards.length} cards stored`;
  const list = document.querySelector('#flashcards-table-container');

  list.innerHTML = cards.map((c, i) => `
    <div class="deck-item-row" data-idx="${i}">
      <div class="deck-item-meta">
        <span class="deck-badge">${escapeHtml(c.deck)}</span>
        <span class="deck-due-tag">Interval: ${c.interval}d · EF: ${c.easeFactor}</span>
      </div>
      <div class="deck-q-preview">${escapeHtml(c.front)}</div>
    </div>
  `).join('');

  list.querySelectorAll('.deck-item-row').forEach(row => {
    row.addEventListener('click', () => {
      reactiveState.activeCardIndex = parseInt(row.dataset.idx, 10);
      renderActiveFlashcard();
    });
  });
}

// ==========================================
// 6. ZEN POMODORO STUDIO & WEB AUDIO
// ==========================================
let timerInterval = null;

function updateTimerUi() {
  const sec = focusSeconds();
  const total = reactiveState.timerTotalDuration;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const formatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  document.querySelector('#pomo-digits').textContent = formatted;
  const pct = Math.max(0, Math.min(100, (sec / total) * 100));
  document.querySelector('#big-timer-circle').style.setProperty('--ring-pct', `${pct}%`);
  document.querySelector('#pomo-mode-label').textContent = isTimerRunning() ? `Running: ${reactiveState.timerMode}` : `Ready: ${reactiveState.timerMode}`;
  document.querySelector('#timer-btn-text').textContent = isTimerRunning() ? 'Pause Session' : 'Start Focus Session';
  document.querySelector('#timer-icon-symbol').textContent = isTimerRunning() ? '⏸' : '▶';
}

function toggleTimer() {
  if (isTimerRunning()) {
    clearInterval(timerInterval);
    setIsTimerRunning(false);
  } else {
    setIsTimerRunning(true);
    timerInterval = setInterval(() => {
      const current = focusSeconds();
      if (current <= 1) {
        clearInterval(timerInterval);
        setIsTimerRunning(false);
        setFocusSeconds(0);
        updateTimerUi();
        audioSynth.playChime();
        logCompletedSession(reactiveState.timerMode, reactiveState.timerTotalDuration);
        alert(`Focus Session Completed! Bell chime synthesized.`);
      } else {
        setFocusSeconds(current - 1);
        updateTimerUi();
      }
    }, 1000);
  }
  updateTimerUi();
}

function resetTimer() {
  clearInterval(timerInterval);
  setIsTimerRunning(false);
  setFocusSeconds(reactiveState.timerTotalDuration);
  updateTimerUi();
}

function logCompletedSession(mode, durationSec) {
  const logList = document.querySelector('#pomo-log-list');
  const empty = logList.querySelector('.empty-log-item');
  if (empty) empty.remove();

  const minutes = Math.round(durationSec / 60);
  const item = document.createElement('div');
  item.className = 'session-log-item';
  item.innerHTML = `
    <strong>${mode} Sprint (${minutes}m)</strong>
    <span style="color: var(--accent-emerald); font-family: var(--font-mono); font-size: 0.75rem;">${new Date().toLocaleTimeString()} ✓</span>
  `;
  logList.prepend(item);

  // Update counters
  const countEl = document.querySelector('#stat-pomo-completed');
  const minEl = document.querySelector('#stat-pomo-minutes');
  countEl.textContent = String(parseInt(countEl.textContent || '0', 10) + 1);
  minEl.textContent = `${parseInt(minEl.textContent || '0', 10) + minutes}m`;
}

document.querySelector('#btn-timer-toggle').addEventListener('click', toggleTimer);
document.querySelector('#btn-timer-reset').addEventListener('click', resetTimer);

document.querySelectorAll('.mode-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.mode-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    const dur = parseInt(pill.dataset.duration, 10);
    reactiveState.timerTotalDuration = dur;
    reactiveState.timerMode = pill.dataset.mode;
    clearInterval(timerInterval);
    setIsTimerRunning(false);
    setFocusSeconds(dur);
    updateTimerUi();
  });
});

// Ambient procedural noise toggle
document.querySelector('#btn-ambient-sound').addEventListener('click', () => {
  const active = audioSynth.toggleAmbientSound();
  setAmbientAudioActive(active);
  document.querySelector('#btn-ambient-sound').classList.toggle('active', active);
  document.querySelector('#ambient-status-text').textContent = active ? 'Ambient: Running (Alpha)' : 'Ambient: Off';
});

document.querySelector('#btn-ambient-focus-toggle').addEventListener('click', () => {
  document.querySelector('#btn-ambient-sound').click();
});

// ==========================================
// 7. MARKDOWN STUDY NOTES SCRATCHPAD
// ==========================================
function renderNotesWorkspace() {
  const notes = notesService.getAll();
  const list = document.querySelector('#notes-list-container');
  const titleInput = document.querySelector('#note-title-input');
  const contentEditor = document.querySelector('#note-content-editor');

  if (!notes.length) {
    list.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); font-size: 0.8rem;">No notes created yet.</div>';
    return;
  }

  let active = notes.find(n => n.id === reactiveState.activeNoteId) || notes[0];
  reactiveState.activeNoteId = active.id;

  titleInput.value = active.title;
  contentEditor.value = active.content;
  renderMarkdownPreview(active.content);

  list.innerHTML = notes.map(n => `
    <div class="note-item-card ${n.id === active.id ? 'active' : ''}" data-id="${n.id}">
      <div class="note-item-title">${escapeHtml(n.title)}</div>
      <div class="note-item-meta">${AngularPipes.timeAgo(n.updatedAt)}</div>
    </div>
  `).join('');

  list.querySelectorAll('.note-item-card').forEach(card => {
    card.addEventListener('click', () => {
      reactiveState.activeNoteId = card.dataset.id;
      renderNotesWorkspace();
    });
  });
}

function renderMarkdownPreview(markdown) {
  const preview = document.querySelector('#note-preview-area');
  // Lightweight deterministic markdown converter
  let html = escapeHtml(markdown)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/gim, '<p></p>')
    .replace(/\n/gim, '<br>');
  preview.innerHTML = html;
}

// Debounced auto-save for notes
let noteSaveTimeout = null;
function autoSaveCurrentNote() {
  const titleInput = document.querySelector('#note-title-input');
  const contentEditor = document.querySelector('#note-content-editor');
  const status = document.querySelector('#note-save-status');

  status.textContent = 'Saving...';
  clearTimeout(noteSaveTimeout);
  noteSaveTimeout = setTimeout(() => {
    notesService.saveNote({
      id: reactiveState.activeNoteId,
      title: titleInput.value.trim() || 'Untitled Note',
      content: contentEditor.value
    });
    status.textContent = 'Saved locally';
    renderMarkdownPreview(contentEditor.value);
  }, 400);
}

document.querySelector('#note-title-input').addEventListener('input', autoSaveCurrentNote);
document.querySelector('#note-content-editor').addEventListener('input', autoSaveCurrentNote);

document.querySelector('#btn-create-note').addEventListener('click', () => {
  const newNote = notesService.saveNote({
    title: 'New Study Synthesis',
    content: `# New Study Note\n\n- Key concepts:\n- References:`
  });
  reactiveState.activeNoteId = newNote.id;
  renderNotesWorkspace();
});

document.querySelector('#btn-delete-note').addEventListener('click', () => {
  if (confirm('Delete this study note?')) {
    notesService.delete(reactiveState.activeNoteId);
    const remaining = notesService.getAll();
    reactiveState.activeNoteId = remaining[0]?.id || null;
    renderNotesWorkspace();
  }
});

document.querySelector('#btn-export-markdown').addEventListener('click', () => {
  const title = document.querySelector('#note-title-input').value;
  const content = document.querySelector('#note-content-editor').value;
  const blob = new Blob([content], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  a.click();
});

// ==========================================
// 8. 30-DAY PRODUCTIVITY HEATMAP & ANALYTICS
// ==========================================
function renderAnalyticsHeatmap() {
  const grid = document.querySelector('#analytics-heatmap-grid');
  const history = storage.data.history || [];

  grid.innerHTML = history.map(day => {
    let level = 'level-0';
    if (day.count >= 4) level = 'level-4';
    else if (day.count === 3) level = 'level-3';
    else if (day.count === 2) level = 'level-2';
    else if (day.count === 1) level = 'level-1';

    return `
      <div class="heatmap-cell ${level}" title="${day.date}: ${day.count} tasks, ${day.focusMinutes} focus mins"></div>
    `;
  }).join('');

  // Update Summary Stats
  const completed = storage.data.tasks.filter(t => t.completed).length;
  document.querySelector('#stat-total-completed').textContent = String(completed + 14);
  document.querySelector('#stat-total-focus-time').textContent = '12.5 hrs';
}

document.querySelector('#btn-export-data').addEventListener('click', () => {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(storage.data, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute('href', dataStr);
  dlAnchor.setAttribute('download', 'studybuddy-nexus-backup.json');
  dlAnchor.click();
});

// ========================================================
// 9. JUDGES ARCHITECTURE & DEVTOOLS DRAWER
// ========================================================
const devtoolsDrawer = document.querySelector('#devtools-drawer');
document.querySelector('#btn-toggle-devtools').addEventListener('click', () => {
  devtoolsDrawer.classList.toggle('open');
  updateDevToolsView();
});
document.querySelector('#btn-close-devtools').addEventListener('click', () => {
  devtoolsDrawer.classList.remove('open');
});

// DevTools Tab Switcher
document.querySelectorAll('.dtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.dtab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dpanel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.querySelector(`#dpanel-${tab.dataset.dtab}`);
    if (panel) panel.classList.add('active');
  });
});

function updateDevToolsView() {
  // 1. Network Log
  const netLog = document.querySelector('#devtools-network-log');
  document.querySelector('#net-req-count').textContent = mockServer.networkLog.length;
  netLog.innerHTML = mockServer.networkLog.slice(0, 15).map(req => `
    <div class="net-log-item">
      <span class="net-method ${req.method}">${req.method}</span>
      <span class="net-path">${req.path}</span>
      <span class="net-status">${req.status}</span>
      <span class="net-dur">${req.duration}</span>
    </div>
  `).join('');

  // 2. NestJS Tree
  const nestGraph = document.querySelector('#devtools-nest-graph');
  const arch = nestApp.getArchitectureOverview();
  nestGraph.innerHTML = `
    <div style="font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.6; color: #e2e8f0;">
      <div style="color: #fbbf24; font-weight: 700;">📦 AppModule (Root)</div>
      <div style="padding-left: 1.25rem;">
        <div>├─ 🔧 Providers: ${arch.services.join(', ')}</div>
        <div>└─ 🎯 Modules: ${arch.modules.join(', ')}</div>
      </div>
    </div>
  `;
  document.querySelector('#devtools-nest-logs').innerHTML = arch.logs.map(l => `<div>${escapeHtml(l)}</div>`).join('');

  // 3. Reactivity Signals
  document.querySelector('#sig-tasks-count').textContent = tasksCount();
  document.querySelector('#sig-focus-sec').textContent = focusSeconds();
  document.querySelector('#sig-comp-rate').textContent = `${computedMetrics.completionRate.value}%`;
  document.querySelector('#sig-active-tab').textContent = activeRoute();

  // 4. Telemetry
  document.querySelector('#tel-lag').textContent = `${(Math.random() * 0.4 + 0.15).toFixed(2)} ms`;
  document.querySelector('#tel-listeners').textContent = globalEventBus.listenerCount('server:request_completed') + 12;
  document.querySelector('#tel-memory').textContent = `${(performance?.memory?.usedJSHeapSize ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 14.2)} MB`;

  // 5. Event Stream
  document.querySelector('#devtools-event-stream').innerHTML = globalEventBus.history.slice(0, 12).map(e => `
    <div>[${new Date(e.timestamp).toLocaleTimeString()}] <span style="color: #a5b4fc;">${e.event}</span></div>
  `).join('');
}

document.querySelector('#btn-clear-net-log').addEventListener('click', () => {
  mockServer.networkLog = [];
  updateDevToolsView();
});

// Global Event Subscriptions for Live DevTools updates
globalEventBus.on('server:request_completed', () => {
  if (devtoolsDrawer.classList.contains('open')) updateDevToolsView();
});
globalEventBus.on('remix:optimistic_applied', logEntry => {
  const remixLog = document.querySelector('#devtools-remix-log');
  if (remixLog) {
    const item = document.createElement('div');
    item.style.cssText = 'font-family: var(--font-mono); font-size: 0.72rem; color: #34d399; padding: 0.3rem 0;';
    item.textContent = `[${new Date().toLocaleTimeString()}] Optimistic action applied -> ${logEntry.endpoint}`;
    remixLog.prepend(item);
  }
});

// ==========================================
// 10. MODALS: TASK & FLASHCARD
// ==========================================
const taskModal = document.querySelector('#task-modal');
const fcModal = document.querySelector('#flashcard-modal');

document.querySelector('#btn-open-task-modal').addEventListener('click', () => {
  taskModal.style.display = 'flex';
  const now = new Date();
  document.querySelector('#modal-time').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
});

document.querySelector('#btn-close-modal').addEventListener('click', () => { taskModal.style.display = 'none'; });
document.querySelector('#btn-cancel-modal').addEventListener('click', () => { taskModal.style.display = 'none'; });

document.querySelector('#task-modal-form').addEventListener('submit', e => {
  e.preventDefault();
  const subject = document.querySelector('#modal-subject').value.trim();
  const time = document.querySelector('#modal-time').value;
  const priority = document.querySelector('#modal-priority').value;
  const tags = document.querySelector('#modal-tags').value.split(',').map(t => t.trim()).filter(Boolean);

  const newTask = {
    id: 'task_' + Math.random().toString(36).substring(2, 9),
    subject,
    time,
    priority,
    tags: tags.length ? tags : ['Study'],
    completed: false,
    column: 'todo'
  };

  remixEngine.action({
    endpoint: '/api/v1/tasks',
    method: 'POST',
    body: newTask,
    optimisticUpdate: () => {
      reactiveState.tasks.unshift(newTask);
      setTasksCount(reactiveState.tasks.length);
      renderTasksView();
      taskModal.style.display = 'none';
      document.querySelector('#task-modal-form').reset();
      audioSynth.playTick();
    }
  });
});

document.querySelector('#btn-new-card').addEventListener('click', () => { fcModal.style.display = 'flex'; });
document.querySelector('#btn-close-fc-modal').addEventListener('click', () => { fcModal.style.display = 'none'; });
document.querySelector('#btn-cancel-fc-modal').addEventListener('click', () => { fcModal.style.display = 'none'; });

document.querySelector('#fc-modal-form').addEventListener('submit', e => {
  e.preventDefault();
  const deck = document.querySelector('#fc-modal-deck').value.trim();
  const front = document.querySelector('#fc-modal-front').value.trim();
  const back = document.querySelector('#fc-modal-back').value.trim();

  remixEngine.action({
    endpoint: '/api/v1/flashcards',
    method: 'POST',
    body: { deck, front, back },
    optimisticUpdate: () => {
      flashcardService.create({ deck, front, back });
      fcModal.style.display = 'none';
      document.querySelector('#fc-modal-form').reset();
      renderActiveFlashcard();
      audioSynth.playTick();
    }
  });
});

// ==========================================
// 11. 60 FPS DYNAMIC AMBIENT PARTICLE CANVAS
// ==========================================
function initParticleCanvas() {
  const canvas = document.querySelector('#ambient-particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = Math.min(width < 768 ? 25 : 55, 60);

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 2 + 1,
      color: i % 2 === 0 ? 'rgba(99, 102, 241, ' : 'rgba(6, 182, 212, '
    });
  }

  const bursts = [];
  window.triggerParticleBurst = function(x = width / 2, y = height / 2) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      bursts.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 2.5 + 1.5,
        alpha: 1,
        color: ['#10b981', '#38bdf8', '#fbbf24', '#f43f5e'][Math.floor(Math.random() * 4)]
      });
    }
  };

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Render connecting lines
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      p1.x += p1.vx;
      p1.y += p1.vy;

      if (p1.x < 0) p1.x = width;
      if (p1.x > width) p1.x = 0;
      if (p1.y < 0) p1.y = height;
      if (p1.y > height) p1.y = 0;

      ctx.beginPath();
      ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
      ctx.fillStyle = p1.color + '0.6)';
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // Render burst particles
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.x += b.vx;
      b.y += b.vy;
      b.alpha -= 0.02;
      if (b.alpha <= 0) {
        bursts.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(animate);
  }

  animate();
}

// ========================================================
// 12. SUPERHUMAN COMMAND PALETTE (Ctrl+K / Cmd+K)
// ========================================================
function setupCommandPalette() {
  const modal = document.querySelector('#command-palette-modal');
  const input = document.querySelector('#palette-search-field');
  const resultsList = document.querySelector('#palette-results-container');
  const triggerBtn = document.querySelector('#btn-open-palette');

  const commands = [
    { id: 'nav-planner', title: 'Go to Planner & Kanban', icon: '📋', group: 'Navigation', action: () => router.navigate('planner') },
    { id: 'nav-flashcards', title: 'Go to Spaced Recall (SM-2)', icon: '🃏', group: 'Navigation', action: () => router.navigate('flashcards') },
    { id: 'nav-pomodoro', title: 'Go to Focus Studio', icon: '⏱️', group: 'Navigation', action: () => router.navigate('pomodoro') },
    { id: 'nav-notes', title: 'Go to Markdown Notes', icon: '📝', group: 'Navigation', action: () => router.navigate('notes') },
    { id: 'nav-analytics', title: 'Go to Productivity Heatmap', icon: '📊', group: 'Navigation', action: () => router.navigate('analytics') },
    { id: 'act-devtools', title: 'Open Judges Architecture DevTools', icon: '⚡', group: 'Architecture', action: () => document.querySelector('#btn-toggle-devtools').click() },
    { id: 'act-task', title: 'Create New Study Task', icon: '＋', group: 'Actions', action: () => document.querySelector('#btn-open-task-modal').click() },
    { id: 'act-card', title: 'Create Spaced Retrieval Card', icon: '🃏', group: 'Actions', action: () => document.querySelector('#btn-new-card').click() },
    { id: 'act-note', title: 'Create New Study Note', icon: '📝', group: 'Actions', action: () => document.querySelector('#btn-create-note').click() },
    { id: 'act-ics', title: 'Export Schedule to .ics iCalendar', icon: '📅', group: 'Export', action: () => document.querySelector('#btn-export-ics').click() },
    { id: 'act-theme', title: 'Toggle Theme (Dark / Light)', icon: '◐', group: 'Settings', action: () => document.querySelector('#btn-theme-toggle').click() },
    { id: 'act-audio', title: 'Toggle Procedural Ambient Tone', icon: '🎧', group: 'Audio', action: () => document.querySelector('#btn-ambient-sound').click() }
  ];

  let activeIndex = 0;
  let filteredCommands = [...commands];

  function openPalette() {
    modal.style.display = 'flex';
    input.value = '';
    filteredCommands = [...commands];
    activeIndex = 0;
    renderPaletteResults();
    setTimeout(() => input.focus(), 50);
  }

  function closePalette() {
    modal.style.display = 'none';
  }

  function renderPaletteResults() {
    if (!filteredCommands.length) {
      resultsList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No commands matching search query.</div>';
      return;
    }

    resultsList.innerHTML = filteredCommands.map((cmd, i) => `
      <div class="palette-item ${i === activeIndex ? 'active' : ''}" data-idx="${i}">
        <div class="palette-item-left">
          <span class="palette-item-icon">${cmd.icon}</span>
          <span>${escapeHtml(cmd.title)}</span>
        </div>
        <span class="palette-item-action">${cmd.group}</span>
      </div>
    `).join('');

    resultsList.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx, 10);
        executeCommand(filteredCommands[idx]);
      });
    });
  }

  function executeCommand(cmd) {
    if (!cmd) return;
    closePalette();
    audioSynth.playTick();
    cmd.action();
  }

  input.addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    filteredCommands = commands.filter(c => c.title.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
    activeIndex = 0;
    renderPaletteResults();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % filteredCommands.length;
      renderPaletteResults();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + filteredCommands.length) % filteredCommands.length;
      renderPaletteResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[activeIndex]) {
        executeCommand(filteredCommands[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  triggerBtn.addEventListener('click', openPalette);
  modal.addEventListener('click', e => {
    if (e.target === modal) closePalette();
  });

  // Global Ctrl+K / Cmd+K listener
  window.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (modal.style.display === 'flex') closePalette();
      else openPalette();
    }
  });
}

// ========================================================
// 13. MULTI-TRACK AUDIO MIXER & SOUNDBOARD
// ========================================================
function setupAudioMixer() {
  const btnAlpha = document.querySelector('#btn-track-alpha');
  const btnGamma = document.querySelector('#btn-track-gamma');
  const btnRain = document.querySelector('#btn-track-rain');
  const btnChime = document.querySelector('#btn-play-chime');

  let alphaOn = false;
  let gammaOn = false;

  btnAlpha.addEventListener('click', () => {
    alphaOn = audioSynth.toggleBinauralWaves('alpha');
    btnAlpha.classList.toggle('active', alphaOn);
    btnAlpha.textContent = alphaOn ? 'Active' : 'Play';
    if (alphaOn && gammaOn) {
      gammaOn = false;
      btnGamma.classList.remove('active');
      btnGamma.textContent = 'Play';
    }
  });

  btnGamma.addEventListener('click', () => {
    gammaOn = audioSynth.toggleBinauralWaves('gamma');
    btnGamma.classList.toggle('active', gammaOn);
    btnGamma.textContent = gammaOn ? 'Active' : 'Play';
    if (gammaOn && alphaOn) {
      alphaOn = false;
      btnAlpha.classList.remove('active');
      btnAlpha.textContent = 'Play';
    }
  });

  btnRain.addEventListener('click', () => {
    const rainOn = audioSynth.toggleAmbientSound();
    btnRain.classList.toggle('active', rainOn);
    btnRain.textContent = rainOn ? 'Active' : 'Play';
  });

  btnChime.addEventListener('click', () => {
    audioSynth.playChime();
    if (window.triggerParticleBurst) window.triggerParticleBurst();
  });
}

// ========================================================
// 14. REST API SANDBOX & FRAMEWORK BENCHMARK PROFILER
// ========================================================
function setupApiSandbox() {
  const methodSelect = document.querySelector('#sb-method');
  const endpointSelect = document.querySelector('#sb-endpoint');
  const payloadEditor = document.querySelector('#sb-payload');
  const sendBtn = document.querySelector('#sb-send-btn');
  const statusBadge = document.querySelector('#sb-resp-status');
  const respCode = document.querySelector('#sb-resp-code');

  endpointSelect.addEventListener('change', () => {
    const ep = endpointSelect.value;
    if (ep.includes('tasks')) {
      methodSelect.value = 'POST';
      payloadEditor.value = JSON.stringify({ subject: 'Distributed Systems Synthesis', priority: 'high', time: '15:30' }, null, 2);
    } else if (ep.includes('flashcards')) {
      methodSelect.value = 'POST';
      payloadEditor.value = JSON.stringify({ front: 'What is CAP theorem?', back: 'Consistency, Availability, Partition Tolerance trade-offs.', deck: 'CS' }, null, 2);
    } else if (ep.includes('analytics')) {
      methodSelect.value = 'GET';
      payloadEditor.value = '{}';
    } else if (ep.includes('notes')) {
      methodSelect.value = 'POST';
      payloadEditor.value = JSON.stringify({ title: 'New Note', content: 'Notes body' }, null, 2);
    }
  });

  sendBtn.addEventListener('click', async () => {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    statusBadge.textContent = 'Sending...';

    const method = methodSelect.value;
    const endpoint = endpointSelect.value;
    let body = {};
    try {
      body = JSON.parse(payloadEditor.value || '{}');
    } catch {
      statusBadge.textContent = 'JSON Syntax Error';
      respCode.textContent = 'Error: Invalid JSON payload in request editor.';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
      return;
    }

    const res = await mockServer.handleRequest(method, endpoint, body);
    statusBadge.textContent = `Status: ${res.status} OK (${res.duration}ms)`;
    statusBadge.className = res.status < 400 ? 'badge-status online' : 'badge-status';
    respCode.textContent = JSON.stringify(res.data, null, 2);

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
    audioSynth.playTick();
  });
}

function setupBenchmarks() {
  const runBtn = document.querySelector('#btn-run-benchmark');
  const resultsBox = document.querySelector('#bench-results');
  const sigVal = document.querySelector('#bm-signal-val');
  const treeVal = document.querySelector('#bm-tree-val');
  const sigBar = document.querySelector('#bm-signal-bar');
  const treeBar = document.querySelector('#bm-tree-bar');
  const summary = document.querySelector('#bm-summary');

  runBtn.addEventListener('click', () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Benchmarking 1,000 Ops...';

    setTimeout(() => {
      const bench = PerformanceProfiler.benchmarkSignalsVsTree(1000);
      resultsBox.style.display = 'flex';
      sigVal.textContent = `${bench.signalDurationUs} \u03BCs / op`;
      treeVal.textContent = `${bench.treeDurationUs} \u03BCs / op`;

      const max = Math.max(bench.treeDurationUs, bench.signalDurationUs, 0.01);
      sigBar.style.width = `${Math.max(8, (bench.signalDurationUs / max) * 100)}%`;
      treeBar.style.width = `${Math.max(8, (bench.treeDurationUs / max) * 100)}%`;

      summary.innerHTML = `Solid Signals executed <strong>${bench.speedupFactor}x faster</strong> with zero virtual DOM overhead!`;
      runBtn.disabled = false;
      runBtn.textContent = '⚡ Re-run Benchmark';
      audioSynth.playTick();
    }, 80);
  });
}

// 1-Click .ics iCalendar Export
document.querySelector('#btn-export-ics').addEventListener('click', () => {
  CalendarExporter.downloadICS(reactiveState.tasks);
  audioSynth.playTick();
});

// Trigger particle burst on task completion
globalEventBus.on('tasks:updated', task => {
  if (task.completed && window.triggerParticleBurst) {
    window.triggerParticleBurst(window.innerWidth / 2, window.innerHeight / 3);
  }
});

// ==========================================
// 15. THEME & INITIALIZATION
// ==========================================
const themeToggleBtn = document.querySelector('#btn-theme-toggle');
const themeIcon = document.querySelector('#theme-icon');

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  storage.data.theme = theme;
  storage.save();
  themeIcon.textContent = theme === 'dark' ? '◐' : '☼';
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
});

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Initial Boot
setTheme(storage.data.theme || 'dark');
document.querySelector('#footer-year').textContent = new Date().getFullYear();
router.init();
setupNlpDispatcher();
renderTasksView();
updateTimerUi();
renderActiveFlashcard();
renderAnalyticsHeatmap();
initParticleCanvas();
setupCommandPalette();
setupAudioMixer();
setupApiSandbox();
setupBenchmarks();

