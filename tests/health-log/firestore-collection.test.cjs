const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the production hook with an explicit render/effect scheduler and
// controllable Firestore listeners, including callbacks arriving after cleanup.
function mount() {
  const slots = [];
  const listeners = [];
  let index = 0;
  let effects = [];
  let hook;
  const same = (a, b) => a && b.length === a.length && b.every((x, i) => Object.is(x, a[i]));
  const slot = () => { const i = index++; return slots[i] || (slots[i] = {}); };
  const context = {
    useState(initial) {
      const item = slot();
      if (!('value' in item)) item.value = initial;
      return [item.value, value => { item.value = value; }];
    },
    useMemo(fn, deps) {
      const item = slot();
      if (!same(item.deps, deps)) { item.value = fn(); item.deps = deps; }
      return item.value;
    },
    useEffect(fn, deps) {
      const item = slot();
      if (!same(item.deps, deps)) {
        item.deps = deps;
        effects.push(() => { item.cleanup?.(); item.cleanup = fn(); });
      }
    },
    collection(db, location) { if (location === 'invalid') throw new Error('invalid collection'); return location; },
    query: location => location, orderBy() {},
    onSnapshot(location, success, error) {
      const listener = { location, success, error, stopped: false };
      listeners.push(listener);
      return () => { listener.stopped = true; };
    },
    expose(value) { hook = value; },
  };
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/hooks/useFirestoreCollection.js'), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export const', 'const');
  vm.runInNewContext(source + '\nexpose(useFirestoreCollection);', context);
  return {
    listeners,
    render(props) { index = 0; return hook(props); },
    flush() { const pending = effects; effects = []; pending.forEach(fn => fn()); },
    unmount() { slots.forEach(item => item.cleanup?.()); },
  };
}
const snapshot = id => ({ docs: [{ id, data: () => ({ name: id, id: 'untrusted-id' }) }] });

test('switching or disabling a collection hides stale data before effects and ignores old callbacks', () => {
  const app = mount();
  const props = { firestore: {}, path: 'plants/a', enabled: true };
  assert.equal(app.render(props).isLoading, true);
  app.flush();
  app.listeners[0].success(snapshot('a'));
  assert.equal(app.render(props).documents[0].id, 'a');
  const next = { ...props, path: 'plants/b' };
  assert.equal(app.render(next).documents.length, 0);
  app.flush();
  assert.equal(app.listeners[0].stopped, true);
  app.listeners[0].success(snapshot('late'));
  assert.equal(app.render(next).documents.length, 0);
  app.listeners[1].success(snapshot('b'));
  assert.equal(app.render(next).documents[0].id, 'b');
  const disabled = { ...next, enabled: false };
  assert.equal(app.render(disabled).documents.length, 0);
  assert.equal(app.render(disabled).isLoading, false);
  app.flush();
  assert.equal(app.listeners[1].stopped, true);
  app.listeners[1].error(new Error('late error'));
  assert.equal(app.render(disabled).error, null);
  app.unmount();
});

test('new subscriptions clear errors and successful snapshots recover loading state', () => {
  const app = mount();
  const props = { firestore: {}, path: 'plants/a', enabled: true };
  app.render(props); app.flush();
  const failure = new Error('permission denied');
  app.listeners[0].error(failure);
  assert.equal(app.render(props).error, failure);
  const next = { ...props, path: 'plants/b' };
  assert.equal(app.render(next).error, null);
  app.flush();
  app.listeners[1].success(snapshot('b'));
  assert.equal(app.render(next).error, null);
  assert.equal(app.render(next).isLoading, false);
  app.unmount();
});

test('synchronous subscription errors become hook errors rather than crashing an effect', () => {
  const app = mount();
  const props = { firestore: {}, path: 'invalid', enabled: true };
  app.render(props); app.flush();
  assert.match(app.render(props).error.message, /invalid collection/);
  assert.equal(app.render(props).isLoading, false);
  app.unmount();
});
