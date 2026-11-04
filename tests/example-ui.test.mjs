import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../example/example.js', import.meta.url), 'utf8');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeNode {
  constructor(id = '') {
    this.id = id;
    this.textContent = '';
    this.innerHTML = '';
    this.checked = false;
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.parent = new FakeNodeListItem();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this, ...event });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  closest(selector) {
    return selector === 'li' ? this.parent : null;
  }
}

class FakeNodeListItem {
  constructor() {
    this.classList = new FakeClassList();
  }
}

function currentDateKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function createPage({ initialStorage = {}, storageBlocked = false, online = true } = {}) {
  const ids = [
    'today-date', 'connection-status', 'connection-label', 'shift-toggle', 'shift-state',
    'shift-footnote', 'task-count', 'task-progress', 'task-progress-fill',
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode(id)]));
  const checklist = Object.fromEntries(
    ['handover', 'briefing', 'priorities'].map((id) => [id, new FakeNode('task-' + id)]),
  );
  const storage = new Map(Object.entries(initialStorage));
  const notifications = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const document = {
    getElementById(id) {
      return nodes[id] || null;
    },
    querySelector(selector) {
      if (selector === '.panel-footnote') return nodes.checklistFootnote;
      const match = /^\[data-checklist-item="([^"]+)"\]$/.exec(selector);
      return match ? checklist[match[1]] || null : null;
    },
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) || [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    },
  };
  nodes.checklistFootnote = new FakeNode('checklist-footnote');

  const localStorage = {
    getItem(key) {
      if (storageBlocked) throw new Error('storage disabled');
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      if (storageBlocked) throw new Error('storage disabled');
      storage.set(key, String(value));
    },
  };
  const window = {
    localStorage,
    PWA: { notify: (message) => notifications.push(message) },
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
  };
  const navigator = { onLine: online };
  vm.runInNewContext(source, { window, document, navigator, Intl, Date, String, Boolean });
  for (const listener of documentListeners.get('DOMContentLoaded') || []) listener();

  return { nodes, checklist, storage, notifications, windowListeners, navigator };
}

test('Staff Space initializes date and connection status, and check-in toggles and persists', () => {
  const page = createPage();
  assert.ok(page.nodes['today-date'].textContent.length > 0);
  assert.equal(page.nodes['connection-label'].textContent, 'Connected');
  assert.equal(page.nodes['shift-state'].textContent, 'Not checked in');
  assert.equal(page.nodes['shift-toggle'].getAttribute('aria-pressed'), 'false');

  page.nodes['shift-toggle'].dispatch('click');
  assert.equal(page.nodes['shift-state'].textContent, 'On shift');
  assert.equal(page.nodes['shift-toggle'].getAttribute('aria-pressed'), 'true');
  assert.match(page.nodes['shift-toggle'].innerHTML, /End sample shift/);
  assert.equal(page.storage.get('staff-space-example:check-in:' + currentDateKey()), '1');
  assert.match(page.nodes['shift-footnote'].textContent, /saved on this device/);

  page.nodes['shift-toggle'].dispatch('click');
  assert.equal(page.nodes['shift-state'].textContent, 'Not checked in');
  assert.equal(page.storage.get('staff-space-example:check-in:' + currentDateKey()), '0');
  assert.equal(page.notifications.length, 2);
});

test('checklist restores stored values, updates progress, and reacts to connection changes', () => {
  const today = currentDateKey();
  const page = createPage({
    initialStorage: { ['staff-space-example:checklist:' + today + ':handover']: '1' },
  });
  assert.equal(page.checklist.handover.checked, true);
  assert.equal(page.nodes['task-count'].textContent, '1 of 3 done');
  assert.equal(page.nodes['task-progress'].getAttribute('aria-valuenow'), '1');

  page.checklist.briefing.checked = true;
  page.checklist.briefing.dispatch('change');
  assert.equal(page.nodes['task-count'].textContent, '2 of 3 done');
  assert.equal(page.nodes['task-progress'].getAttribute('aria-valuenow'), '2');
  assert.equal(page.nodes['task-progress-fill'].style.width, (2 / 3) * 100 + '%');
  assert.equal(page.checklist.briefing.parent.classList.contains('is-complete'), true);
  assert.equal(page.storage.get('staff-space-example:checklist:' + today + ':briefing'), '1');

  page.navigator.onLine = false;
  page.windowListeners.get('offline')[0]();
  assert.equal(page.nodes['connection-label'].textContent, 'Working offline');
  assert.equal(page.nodes['connection-status'].getAttribute('aria-label'), 'You are offline');
  page.navigator.onLine = true;
  page.windowListeners.get('online')[0]();
  assert.equal(page.nodes['connection-label'].textContent, 'Connected');
});

test('storage failures are reported instead of claiming sample changes were saved', () => {
  const page = createPage({ storageBlocked: true });
  assert.match(page.nodes['shift-footnote'].textContent, /storage is unavailable/i);
  assert.match(page.nodes.checklistFootnote.textContent, /may not persist/i);

  page.nodes['shift-toggle'].dispatch('click');
  page.checklist.priorities.checked = true;
  page.checklist.priorities.dispatch('change');
  assert.match(page.nodes['shift-footnote'].textContent, /may not persist/i);
  assert.match(page.nodes.checklistFootnote.textContent, /may not persist/i);
  assert.equal(page.nodes['task-count'].textContent, '1 of 3 done');
});
