'use client';

/**
 * store.js — Zustand Global State (v2)
 *
 * KEY BEHAVIORS:
 * - `demoActive`: persisted in IndexedDB settings — survives page refreshes
 * - `hasRealData`: true when extension has logged at least one real session
 * - clearDemo(): deletes ONLY source:'demo' entries, preserves real data
 * - Auto-refresh: polls IndexedDB every 30s when extension is expected to be active
 */

import { create } from 'zustand';
import {
  getTodayLogs, getLast7DaysLogs, getLast30DaysLogs, getLogCount,
  clearDemoData, hasRealData as checkRealData,
  getSetting, setSetting,
  addLog, addSession,
} from './db';
import { processLogs } from './engine';
import { generateReport } from './insights';
import { seedMockData } from './mockData';
import { computeBaseline, evaluate as evalCognitiveState } from './cognitiveEngine';
import {
  loadFocusSettings, saveFocusSettings,
  startFocusSession, endFocusSession,
  addBlockedSite, removeBlockedSite,
  addProductiveDomain, removeProductiveDomain,
  setUserLabel, removeUserLabel,
  getRecentSessions, getEventStats,
  getElapsedSeconds,
} from './focusMode';

let autoRefreshTimer = null;

const useFocusStore = create((set, get) => ({
  // ── Analytics ──────────────────────────────────────────────────────────────
  range:      'today',
  data:       null,
  report:     null,
  isLoading:  true,
  /** true when demo data is present in the DB (persisted across reloads) */
  demoActive: false,
  /** true when at least one real extension-tracked log exists */
  hasRealData: false,

  // ── Cognitive State (Advanced) ─────────────────────────────────────────────
  cognitiveState: 'FOCUSED',
  cfs: 100,
  cfsTimeline: [],
  _cognitiveBaseline: null,
  _cognitiveInterval: null,
  _lastStateInfo: null,

  // ── Focus Mode ─────────────────────────────────────────────────────────────
  focusSettings: {
    focusEnabled:    false,
    blockedSites:    [],
    productiveDomains: [],
    sensitivity:     'medium',
    sessionDuration: 25,
    allowContinue:   true,
    sessionStart:    null,
  },
  sessionElapsed: 0,
  sessionHistory: [],
  eventStats:     { warnings: 0, continues: 0, blocks: 0, total: 0 },

  // ── UI ─────────────────────────────────────────────────────────────────────
  darkMode:  true,
  activeTab: 'dashboard',

  // ════════════════════════════════════════════════════════════════════════════
  // Init
  // ════════════════════════════════════════════════════════════════════════════

  init: async () => {
    set({ isLoading: true });

    try {
      // 1. Check seeding state (persisted across reloads)
      const demoSeeded = await getSetting('demoDataSeeded', false);
      const count      = await getLogCount();

      if (count === 0 && !demoSeeded) {
        // Fresh install — seed demo data
        await seedMockData();
        await setSetting('demoDataSeeded', true);
        set({ demoActive: true, hasRealData: false });
      } else if (demoSeeded) {
        // Previously seeded — check if sessions store is empty (needs reseed after schema update)
        const { getRecentSessions: getRS } = await import('./focusMode');
        const existingSessions = await getRS(1);
        if (existingSessions.length === 0) {
          // Session store empty — reseed to populate Session History
          await seedMockData();
        }
        const realData = await checkRealData();
        set({ demoActive: true, hasRealData: realData });
      } else {
        // Never seeded (or was cleared) — only real data
        set({ demoActive: false, hasRealData: count > 0 });
      }

      // 2. Load everything in parallel
      await Promise.all([
        get().loadData(),
        get().loadFocusState(),
      ]);

      // 3. Start auto-refresh (polls every 30s so new extension data shows up)
      get()._startAutoRefresh();

      // 4. Start Cognitive Engine (evaluates every 15s)
      get()._startCognitiveEngine();

      // 4. Listen for data forwarded by the extension's bridge.js content script
      get()._startBridgeListener();

    } catch (err) {
      console.error('[Store] init error:', err);
      set({ isLoading: false });
    }
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Data loading
  // ════════════════════════════════════════════════════════════════════════════

  loadData: async () => {
    set({ isLoading: true });
    try {
      const range = get().range;
      const logs  =
        range === 'today' ? await getTodayLogs()      :
        range === '7d'    ? await getLast7DaysLogs()   :
                            await getLast30DaysLogs();

      // Load matching CFS timeline
      const endDate = new Date();
      let startDate = new Date();
      if (range === 'today') { startDate.setHours(0,0,0,0); }
      else if (range === '7d') { startDate.setDate(startDate.getDate() - 7); startDate.setHours(0,0,0,0); }
      else { startDate.setDate(startDate.getDate() - 30); startDate.setHours(0,0,0,0); }
      
      const { getCfsSnapshotsByDateRange } = await import('./db');
      const cfsTimeline = await getCfsSnapshotsByDateRange(startDate, endDate);

      const data   = processLogs(logs);
      const report = generateReport(data, cfsTimeline);
      set({ data, report, cfsTimeline, isLoading: false });

      // Re-check if real data arrived since last load
      if (get().demoActive) {
        const realData = await checkRealData();
        set({ hasRealData: realData });
      }
    } catch (err) {
      console.error('[Store] loadData error:', err);
      set({ isLoading: false });
    }
  },

  setRange: async (range) => {
    set({ range });
    await get().loadData();
  },

  refresh: async () => { await get().loadData(); },

  // ════════════════════════════════════════════════════════════════════════════
  // Demo data management
  // ════════════════════════════════════════════════════════════════════════════

  clearDemo: async () => {
    set({ isLoading: true });
    try {
      await clearDemoData();
      await setSetting('demoDataSeeded', false);
      const count = await getLogCount();
      set({ demoActive: false, hasRealData: count > 0 });
      await get().loadData();
    } catch (err) {
      console.error('[Store] clearDemo error:', err);
      set({ isLoading: false });
    }
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Focus Mode
  // ════════════════════════════════════════════════════════════════════════════

  loadFocusState: async () => {
    const [settings, history, stats] = await Promise.all([
      loadFocusSettings(),
      getRecentSessions(20),
      getEventStats(),
    ]);
    set({ focusSettings: settings, sessionHistory: history, eventStats: stats });

    if (settings.focusEnabled && settings.sessionStart) {
      get()._startTimer(settings.sessionStart);
    }
  },

  updateFocusSettings: async (partial) => {
    await saveFocusSettings(partial);
    const updated = await loadFocusSettings();
    set({ focusSettings: updated });
  },

  startSession: async (overrides = {}) => {
    const current = get().focusSettings;
    const merged  = { ...current, ...overrides };
    const startTime = await startFocusSession(merged);
    const updated   = await loadFocusSettings();
    set({ focusSettings: updated });
    get()._startTimer(startTime);
  },

  endSession: async () => {
    get()._stopTimer();
    await endFocusSession();
    const [updated, stats, history] = await Promise.all([
      loadFocusSettings(),
      getEventStats(),
      getRecentSessions(20),
    ]);
    set({ focusSettings: updated, eventStats: stats, sessionHistory: history, sessionElapsed: 0 });
  },

  addBlocked: async (domain) => {
    await addBlockedSite(domain);
    const updated = await loadFocusSettings();
    set({ focusSettings: updated });
  },

  removeBlocked: async (domain) => {
    await removeBlockedSite(domain);
    const updated = await loadFocusSettings();
    set({ focusSettings: updated });
  },

  addProductive: async (domain) => {
    await addProductiveDomain(domain);
    const updated = await loadFocusSettings();
    set({ focusSettings: updated });
  },

  removeProductive: async (domain) => {
    await removeProductiveDomain(domain);
    const updated = await loadFocusSettings();
    set({ focusSettings: updated });
  },

  labelSite: async (site, label) => {
    await setUserLabel(site, label);
    const history = await getRecentSessions(20);
    set({ sessionHistory: history });
  },

  removeLabel: async (site) => {
    await removeUserLabel(site);
    const history = await getRecentSessions(20);
    set({ sessionHistory: history });
  },

  refreshHistory: async () => {
    const [history, stats] = await Promise.all([
      getRecentSessions(20),
      getEventStats(),
    ]);
    set({ sessionHistory: history, eventStats: stats });
  },

  // ── Internal timers ────────────────────────────────────────────────────────

  _timerRef: null,

  _startTimer: (startTime) => {
    get()._stopTimer();
    const tick = () => set({ sessionElapsed: getElapsedSeconds(startTime) });
    tick();
    const ref = setInterval(tick, 1000);
    set({ _timerRef: ref });
  },

  _stopTimer: () => {
    const ref = get()._timerRef;
    if (ref) { clearInterval(ref); set({ _timerRef: null }); }
  },

  _startAutoRefresh: () => {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(async () => {
      // Silently reload data in background — no loading spinner
      const range = get().range;
      try {
        const logs =
          range === 'today' ? await getTodayLogs()     :
          range === '7d'    ? await getLast7DaysLogs()  :
                              await getLast30DaysLogs();
        const data   = processLogs(logs);
        const report = generateReport(data);
        set({ data, report });

        if (get().demoActive) {
          const realData = await checkRealData();
          // Auto-clear demo the moment the first real extension data arrives
          if (realData && !get().hasRealData) {
            await get().clearDemo();
          } else if (realData !== get().hasRealData) {
            set({ hasRealData: realData });
          }
        }
      } catch {}
    }, 30000); // every 30 seconds
  },

  _startCognitiveEngine: () => {
    let interval = get()._cognitiveInterval;
    if (interval) clearInterval(interval);

    interval = setInterval(async () => {
      try {
        let baseline = get()._cognitiveBaseline;
        if (!baseline) {
          const logs7d = await getLast7DaysLogs();
          const sessions7d = await getRecentSessions(200); // approx week
          baseline = computeBaseline(logs7d, sessions7d);
          set({ _cognitiveBaseline: baseline });
        }

        const snapshot = await evalCognitiveState(baseline, get()._lastStateInfo);
        
        let deeplyDistractedTime = get()._deeplyDistractedStart || 0;
        if (snapshot.state === 'DEEPLY_DISTRACTED') {
          if (deeplyDistractedTime === 0) deeplyDistractedTime = Date.now();
          
          if (Date.now() - deeplyDistractedTime > 60000) {
             // Surface escalated intervention
             if (typeof window !== 'undefined' && window.electronBridge?.onDistractionPopup) {
                 // Trigger via UI event or custom logic
                 window.dispatchEvent(new CustomEvent('ft:escalated_intervention', { detail: snapshot }));
             }
             deeplyDistractedTime = 0; // reset
          }
        } else {
          deeplyDistractedTime = 0;
        }

        set({
          cognitiveState: snapshot.state,
          cfs: snapshot.cfs,
          _lastStateInfo: { state: snapshot.state, consecutiveTicks: snapshot.consecutiveTicks },
          _deeplyDistractedStart: deeplyDistractedTime
        });

      } catch (err) {
        console.error('[Cognitive Engine] error:', err);
      }
    }, 15000); // evaluate every 15s

    set({ _cognitiveInterval: interval });
  },

  _startBridgeListener: () => {
    if (typeof window === 'undefined') return;
    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;
      const msg = event.data;
      if (!msg || msg.source !== 'focus_tracker_bridge') return;

      try {
        if (msg.type === 'SESSIONS' && Array.isArray(msg.payload)) {
          for (const session of msg.payload) {
            // Normalise schema: extension sends {domain, durationMs, type:"background"}
            // dashboard db just needs it stored — SessionHistory reads both field names
            await addSession(session);
          }
          console.log('[Store] Bridge: received', msg.payload.length, 'session(s) from extension');
        }

        if (msg.type === 'LOGS' && Array.isArray(msg.payload)) {
          for (const log of msg.payload) {
            await addLog(log);
          }
          console.log('[Store] Bridge: received', msg.payload.length, 'log(s) from extension');
        }

        // Reload data + check if demo should be auto-cleared
        await get().loadData();
        await get().loadFocusState();
      } catch (err) {
        console.error('[Store] Bridge listener error:', err);
      }
    });
  },

  // ── UI ────────────────────────────────────────────────────────────────────
  setActiveTab:   async (activeTab) => {
    set({ activeTab });
    if (activeTab === 'history') {
      const { getRecentSessions } = await import('./db');
      const history = await getRecentSessions(20);
      set({ sessionHistory: history });
    }
  },
  refreshHistory: async () => {
    const { getRecentSessions } = await import('./db');
    const history = await getRecentSessions(20);
    set({ sessionHistory: history });
  },
  toggleDarkMode: ()          => set(s => ({ darkMode: !s.darkMode })),
}));

export default useFocusStore;
