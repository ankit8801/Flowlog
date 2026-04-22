/**
 * db.js — IndexedDB wrapper (v2)
 * Schema v2 adds: sessions, focus_events, settings, user_labels
 * Shared between Chrome extension and dashboard.
 */

const DB_NAME = 'focus_tracker_db';
const DB_VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const prev = e.oldVersion;

      // v1: activity_log
      if (prev < 1) {
        const log = db.createObjectStore('activity_log', { keyPath: 'id', autoIncrement: true });
        log.createIndex('timestamp', 'timestamp');
        log.createIndex('site', 'site');
        log.createIndex('category', 'category');
      }

      // v2: sessions, focus_events, settings, user_labels
      if (prev < 2) {
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          s.createIndex('startTime', 'startTime');
          s.createIndex('site', 'site');
          s.createIndex('category', 'category');
        }
        if (!db.objectStoreNames.contains('focus_events')) {
          const fe = db.createObjectStore('focus_events', { keyPath: 'id', autoIncrement: true });
          fe.createIndex('type', 'type');
          fe.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('user_labels')) {
          db.createObjectStore('user_labels', { keyPath: 'site' });
        }
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    fn(t, resolve, reject);
    t.onerror = () => { db.close(); reject(t.error); };
    t.oncomplete = () => db.close();
  });
}

// ─── Activity Log (existing) ───────────────────────────────────────────────

export async function addLog(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('activity_log', 'readwrite');
    t.objectStore('activity_log').add(entry);
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

async function getAllLogs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('activity_log', 'readonly');
    const req = t.objectStore('activity_log').getAll();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getLogsByDateRange(startDate, endDate) {
  const all = await getAllLogs();
  return all.filter((log) => {
    const t = new Date(log.timestamp).getTime();
    return t >= startDate.getTime() && t <= endDate.getTime();
  });
}

export async function getTodayLogs() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return getLogsByDateRange(start, end);
}

export async function getLast7DaysLogs() {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
  return getLogsByDateRange(start, end);
}

export async function getLast30DaysLogs() {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0);
  return getLogsByDateRange(start, end);
}

export async function getLogCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('activity_log', 'readonly');
    const req = t.objectStore('activity_log').count();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function clearAllLogs() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('activity_log', 'readwrite');
    t.objectStore('activity_log').clear();
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

/**
 * Delete only the demo-seeded entries (source === 'demo').
 * Real extension data is preserved.
 */
export async function clearDemoData() {
  const all = await getAllLogs();
  const demoLogIds = all.filter(l => l.source === 'demo').map(l => l.id);

  // Also clear demo sessions
  const db = await openDB();
  const allSessions = await new Promise((resolve, reject) => {
    const t = db.transaction('sessions', 'readonly');
    const req = t.objectStore('sessions').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  const demoSessionIds = allSessions.filter(s => s.source === 'demo').map(s => s.id);

  return new Promise((resolve, reject) => {
    const t = db.transaction(['activity_log', 'sessions'], 'readwrite');
    demoLogIds.forEach(id => t.objectStore('activity_log').delete(id));
    demoSessionIds.forEach(id => t.objectStore('sessions').delete(id));
    t.oncomplete = () => { db.close(); resolve(demoLogIds.length + demoSessionIds.length); };
    t.onerror    = () => { db.close(); reject(t.error); };
  });
}

/**
 * Returns true if ANY activity_log entry was NOT created by the demo seeder.
 * Used to detect real extension data.
 */
export async function hasRealData() {
  const all = await getAllLogs();
  return all.some(l => l.source !== 'demo');
}


// ─── Sessions ──────────────────────────────────────────────────────────────

export async function addSession(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('sessions', 'readwrite');
    // Strip any pre-existing string id (from extension crypto.randomUUID) so
    // the dashboard's autoIncrement keyPath generates a clean numeric key.
    const { id: _drop, ...rest } = session;
    const req = t.objectStore('sessions').add(rest);
    t.oncomplete = () => { db.close(); resolve(req.result); };
    t.onerror = () => { db.close(); console.error('[DB] addSession error:', t.error); reject(t.error); };
  });
}

export async function updateSessionLabel(id, userLabel) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = db.transaction('sessions', 'readwrite').objectStore('sessions');
    const get = store.get(id);
    get.onsuccess = () => {
      const rec = get.result;
      if (!rec) { db.close(); resolve(); return; }
      rec.userLabel = userLabel;
      const put = store.put(rec);
      put.onsuccess = () => { db.close(); resolve(); };
      put.onerror = () => { db.close(); reject(put.error); };
    };
    get.onerror = () => { db.close(); reject(get.error); };
  });
}

export async function getRecentSessions(limit = 30) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('sessions', 'readonly');
    const req = t.objectStore('sessions').getAll();
    req.onsuccess = () => {
      const sorted = (req.result || [])
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, limit);
      db.close();
      resolve(sorted);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ─── Focus Events ──────────────────────────────────────────────────────────

export async function addFocusEvent(event) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('focus_events', 'readwrite');
    t.objectStore('focus_events').add({ ...event, timestamp: new Date().toISOString() });
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function getEventStats() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('focus_events', 'readonly');
    const req = t.objectStore('focus_events').getAll();
    req.onsuccess = () => {
      let events = req.result || [];
      events = events.filter(e => e.type !== 'cfs_snapshot'); // exclude cognitive snapshots from standard stats
      db.close();
      resolve({
        warnings:  events.filter(e => e.type === 'warning_shown').length,
        continues: events.filter(e => e.type === 'continue_clicked').length,
        blocks:    events.filter(e => e.type === 'site_blocked').length,
        total: events.length,
      });
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getCfsSnapshotsByDateRange(startDate, endDate) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('focus_events', 'readonly');
    const req = t.objectStore('focus_events').getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      const snapshots = all.filter(e => {
        if (e.type !== 'cfs_snapshot') return false;
        const tTime = new Date(e.timestamp).getTime();
        return tTime >= startDate.getTime() && tTime <= endDate.getTime();
      });
      db.close();
      resolve(snapshots);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────

export async function getSetting(key, defaultValue = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('settings', 'readonly');
    const req = t.objectStore('settings').get(key);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ? req.result.value : defaultValue);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function setSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('settings', 'readwrite');
    t.objectStore('settings').put({ key, value });
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function getAllSettings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('settings', 'readonly');
    const req = t.objectStore('settings').getAll();
    req.onsuccess = () => {
      const map = {};
      (req.result || []).forEach(r => { map[r.key] = r.value; });
      db.close();
      resolve(map);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ─── User Labels ───────────────────────────────────────────────────────────

export async function setUserLabel(site, label) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('user_labels', 'readwrite');
    t.objectStore('user_labels').put({ site, label, updatedAt: new Date().toISOString() });
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export async function getUserLabel(site) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('user_labels', 'readonly');
    const req = t.objectStore('user_labels').get(site);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ? req.result.label : null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getAllUserLabels() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('user_labels', 'readonly');
    const req = t.objectStore('user_labels').getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function removeUserLabel(site) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('user_labels', 'readwrite');
    t.objectStore('user_labels').delete(site);
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}
