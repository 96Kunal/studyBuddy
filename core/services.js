/**
 * StudyBuddy Nexus Services & Modular Architecture (Nest.js + Express/Fastify)
 * Sets up dependency injection tokens, REST API routes, and state persistence.
 */

import {
  nestApp,
  mockServer,
  globalEventBus,
  SpacedRepetitionEngine,
  AngularPipes
} from './engine.js';

const STORAGE_KEY = 'studybuddy_nexus_state_v2';

export const INITIAL_HABITS = [
  { id: 'h1', title: 'Deep Work Sprint', completed: false, streak: 5 },
  { id: 'h2', title: 'Active Recall Practice', completed: false, streak: 3 },
  { id: 'h3', title: 'Hydrate & Posture Reset', completed: false, streak: 7 },
  { id: 'h4', title: 'Review Daily Notes', completed: false, streak: 4 }
];

export const INITIAL_FLASHCARDS = [
  {
    id: 'fc_1',
    deck: 'Computer Science',
    front: 'What is the primary difference between Virtual DOM diffing (React) and Fine-Grained Reactivity (Solid.js)?',
    back: 'Virtual DOM computes differences between trees before applying DOM updates, whereas Fine-Grained Signals update only the specific DOM text nodes directly with 0 reconciliation overhead.',
    repetition: 2,
    interval: 6,
    easeFactor: 2.5,
    nextDueDate: new Date().toISOString().slice(0, 10)
  },
  {
    id: 'fc_2',
    deck: 'Cognitive Science',
    front: 'How does the SuperMemo SM-2 algorithm calculate the next review interval after successful recall?',
    back: 'I(1) = 1 day, I(2) = 6 days, then I(n) = I(n-1) * EF. The Easiness Factor (EF) adapts based on user recall grade (0-5).',
    repetition: 1,
    interval: 1,
    easeFactor: 2.5,
    nextDueDate: new Date().toISOString().slice(0, 10)
  },
  {
    id: 'fc_3',
    deck: 'Backend Architecture',
    front: 'Why is Fastify significantly faster than standard Express for high-concurrency APIs?',
    back: 'Fastify compiles JSON schemas ahead of time using fast-json-stringify and employs a radix tree router with optimized request context objects.',
    repetition: 0,
    interval: 1,
    easeFactor: 2.5,
    nextDueDate: new Date().toISOString().slice(0, 10)
  }
];

export const INITIAL_NOTES = [
  {
    id: 'note_1',
    title: 'Distributed Systems & Consistency Models',
    tags: ['Architecture', 'CS'],
    content: `# Distributed Systems Notes\n\n- **CAP Theorem**: In any asynchronous network partition, choose between Consistency and Availability.\n- **PACELC Theorem**: Extends CAP: if partition (P), choose Availability (A) or Consistency (C); else (E), choose Latency (L) or Consistency (C).\n- **Eventual Consistency**: Replicas converge over time if no new updates are made.`,
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'note_2',
    title: 'Memory Consolidation During Deep Study',
    tags: ['Learning', 'Productivity'],
    content: `# Deep Learning Principles\n\n1. **Spaced Retrieval**: Testing memory before forgetting cements neural pathways.\n2. **Interleaving**: Mixing related problem types yields superior transfer compared to blocked practice.\n3. **Feynman Technique**: Explain concepts without jargon to uncover hidden cognitive gaps.`,
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  }
];

// ==========================================
// STORAGE SERVICE (NestJS @Injectable)
// ==========================================
export class StorageService {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            tasks: parsed.tasks || this._defaultTasks(),
            habits: parsed.habits || INITIAL_HABITS,
            flashcards: parsed.flashcards || INITIAL_FLASHCARDS,
            notes: parsed.notes || INITIAL_NOTES,
            history: parsed.history || this._generateMockHistory(),
            streak: parsed.streak || 3,
            theme: parsed.theme || 'dark'
          };
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed, using defaults', e);
    }
    return {
      tasks: this._defaultTasks(),
      habits: INITIAL_HABITS,
      flashcards: INITIAL_FLASHCARDS,
      notes: INITIAL_NOTES,
      history: this._generateMockHistory(),
      streak: 3,
      theme: 'dark'
    };
  }

  save() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  }

  _defaultTasks() {
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    return [
      {
        id: 'task_1',
        subject: 'Algorithms & Dynamic Programming Review',
        time: `${pad(today.getHours())}:30`,
        priority: 'high',
        completed: false,
        column: 'in-progress',
        tags: ['Computer Science', 'Exam Prep'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'task_2',
        subject: 'Read Neuroplasticity & Memory Formation (Ch. 3)',
        time: `${pad((today.getHours() + 1) % 24)}:00`,
        priority: 'medium',
        completed: false,
        column: 'todo',
        tags: ['Science'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'task_3',
        subject: 'Linear Algebra: Eigenvalues & Vector Spaces',
        time: `${pad((today.getHours() + 3) % 24)}:15`,
        priority: 'high',
        completed: false,
        column: 'todo',
        tags: ['Mathematics'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'task_4',
        subject: 'Daily Synthesis & Summary Notes',
        time: `${pad((today.getHours() + 5) % 24)}:45`,
        priority: 'low',
        completed: true,
        column: 'done',
        tags: ['Focus'],
        createdAt: new Date().toISOString()
      }
    ];
  }

  _generateMockHistory() {
    // Generate 30 days of study completion for the heatmap
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const intensity = Math.floor(Math.sin(i * 0.8) * 3) + 2; // realistic varied activity
      days.push({
        date: dateStr,
        count: Math.max(1, intensity),
        focusMinutes: Math.max(15, intensity * 25)
      });
    }
    return days;
  }
}

// ==========================================
// TASK CONTROLLER & SERVICE (NestJS Pattern)
// ==========================================
export class TaskService {
  constructor(storageService) {
    this.storage = storageService;
  }

  getAll() {
    return this.storage.data.tasks;
  }

  create(dto) {
    const task = {
      id: dto.id || 'task_' + Math.random().toString(36).substring(2, 9),
      subject: dto.subject.trim(),
      time: dto.time || '12:00',
      priority: dto.priority || 'medium',
      completed: !!dto.completed,
      column: dto.column || 'todo',
      tags: dto.tags || ['Study'],
      createdAt: new Date().toISOString()
    };
    this.storage.data.tasks.unshift(task);
    this.storage.save();
    globalEventBus.emit('tasks:created', task);
    return task;
  }

  update(id, updates) {
    const idx = this.storage.data.tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    const task = { ...this.storage.data.tasks[idx], ...updates };
    this.storage.data.tasks[idx] = task;
    this.storage.save();
    globalEventBus.emit('tasks:updated', task);
    return task;
  }

  delete(id) {
    const initialLen = this.storage.data.tasks.length;
    this.storage.data.tasks = this.storage.data.tasks.filter(t => t.id !== id);
    this.storage.save();
    globalEventBus.emit('tasks:deleted', { id });
    return this.storage.data.tasks.length < initialLen;
  }
}

// ==========================================
// FLASHCARD SERVICE (SM-2 Integration)
// ==========================================
export class FlashcardService {
  constructor(storageService) {
    this.storage = storageService;
  }

  getAll() {
    return this.storage.data.flashcards;
  }

  getDueCards() {
    const today = new Date().toISOString().slice(0, 10);
    return this.storage.data.flashcards.filter(c => !c.nextDueDate || c.nextDueDate <= today);
  }

  create(card) {
    const newCard = {
      id: 'fc_' + Math.random().toString(36).substring(2, 9),
      deck: card.deck || 'General Study',
      front: card.front.trim(),
      back: card.back.trim(),
      repetition: 0,
      interval: 1,
      easeFactor: 2.5,
      nextDueDate: new Date().toISOString().slice(0, 10)
    };
    this.storage.data.flashcards.unshift(newCard);
    this.storage.save();
    globalEventBus.emit('flashcards:created', newCard);
    return newCard;
  }

  review(id, quality) {
    const card = this.storage.data.flashcards.find(c => c.id === id);
    if (!card) return null;
    const result = SpacedRepetitionEngine.review(card, quality);
    Object.assign(card, result);
    this.storage.save();
    globalEventBus.emit('flashcards:reviewed', { id, quality, card });
    return card;
  }
}

// ==========================================
// NOTES SERVICE
// ==========================================
export class NotesService {
  constructor(storageService) {
    this.storage = storageService;
  }

  getAll() {
    return this.storage.data.notes;
  }

  saveNote(note) {
    const idx = this.storage.data.notes.findIndex(n => n.id === note.id);
    if (idx !== -1) {
      this.storage.data.notes[idx] = {
        ...this.storage.data.notes[idx],
        ...note,
        updatedAt: new Date().toISOString()
      };
    } else {
      this.storage.data.notes.unshift({
        id: note.id || 'note_' + Math.random().toString(36).substring(2, 9),
        title: note.title || 'Untitled Note',
        tags: note.tags || ['Notes'],
        content: note.content || '',
        updatedAt: new Date().toISOString()
      });
    }
    this.storage.save();
    globalEventBus.emit('notes:updated', note);
    return note;
  }

  delete(id) {
    this.storage.data.notes = this.storage.data.notes.filter(n => n.id !== id);
    this.storage.save();
    globalEventBus.emit('notes:deleted', { id });
  }
}

// ==========================================
// REGISTER WITH NEST.JS CONTAINER & REST API
// ==========================================
export function bootstrapServices() {
  const storage = new StorageService();
  const taskService = new TaskService(storage);
  const flashcardService = new FlashcardService(storage);
  const notesService = new NotesService(storage);

  nestApp.registerService('StorageService', storage);
  nestApp.registerService('TaskService', taskService);
  nestApp.registerService('FlashcardService', flashcardService);
  nestApp.registerService('NotesService', notesService);

  nestApp.registerModule('AppModule', {
    imports: ['TaskModule', 'FlashcardModule', 'NotesModule', 'AnalyticsModule'],
    providers: ['StorageService', 'TaskService', 'FlashcardService', 'NotesService']
  });

  // REST API: Fastify / Express endpoints
  mockServer.get('/api/v1/tasks', (req, res) => {
    res.json(taskService.getAll());
  });

  mockServer.post('/api/v1/tasks', {
    schema: {
      body: {
        required: ['subject'],
        properties: {
          subject: { type: 'string', minLength: 2 },
          priority: { type: 'string' },
          time: { type: 'string' }
        }
      }
    }
  }, (req, res) => {
    const task = taskService.create(req.body);
    res.status(201).json(task);
  });

  mockServer.patch('/api/v1/tasks/:id', (req, res) => {
    const updated = taskService.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    res.json(updated);
  });

  mockServer.delete('/api/v1/tasks/:id', (req, res) => {
    const deleted = taskService.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, id: req.params.id });
  });

  mockServer.get('/api/v1/flashcards', (req, res) => {
    res.json(flashcardService.getAll());
  });

  mockServer.post('/api/v1/flashcards', {
    schema: {
      body: {
        required: ['front', 'back'],
        properties: {
          front: { type: 'string', minLength: 3 },
          back: { type: 'string', minLength: 3 }
        }
      }
    }
  }, (req, res) => {
    const card = flashcardService.create(req.body);
    res.status(201).json(card);
  });

  mockServer.post('/api/v1/flashcards/:id/review', {
    schema: {
      body: {
        required: ['quality']
      }
    }
  }, (req, res) => {
    const card = flashcardService.review(req.params.id, req.body.quality);
    if (!card) return res.status(404).json({ error: 'Card not found' });
    res.json(card);
  });

  mockServer.get('/api/v1/notes', (req, res) => {
    res.json(notesService.getAll());
  });

  mockServer.post('/api/v1/notes', (req, res) => {
    const note = notesService.saveNote(req.body);
    res.json(note);
  });

  mockServer.delete('/api/v1/notes/:id', (req, res) => {
    notesService.delete(req.params.id);
    res.json({ success: true, id: req.params.id });
  });

  mockServer.get('/api/v1/analytics', (req, res) => {
    const tasks = storage.data.tasks;
    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const rate = total ? Math.round((completed / total) * 100) : 0;
    res.json({
      totalTasks: total,
      completedTasks: completed,
      completionRate: rate,
      streak: storage.data.streak,
      history: storage.data.history
    });
  });

  return { storage, taskService, flashcardService, notesService };
}
