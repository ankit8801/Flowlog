'use client';

import { useEffect, useState, useCallback } from 'react';
import useFocusStore from './lib/store';

import Header           from './components/Header';
import FocusScoreCard   from './components/FocusScoreCard';
import CategoryBreakdown from './components/CategoryBreakdown';
import UsageGraph       from './components/UsageGraph';
import TopSites         from './components/TopSites';
import InsightAssistant from './components/InsightAssistant';
import FocusModePanel   from './components/FocusModePanel';
import SettingsPanel    from './components/SettingsPanel';
import SessionHistory   from './components/SessionHistory';
import ProductivityPet  from './components/ProductivityPet';

function Loader() {
  return (
    <div className="loader-screen">
      <div className="loader-content">
        <div className="loader-bar"><div className="loader-fill" /></div>
        <p className="loader-text">Loading focus data…</p>
      </div>
    </div>
  );
}

// ─── [ADDED] Distraction Popup ────────────────────────────────────────────────
// Rendered at the root of the page shell so it always sits above all content.
// Wires into window.electronBridge.onDistractionPopup (set up by preload.js).
// Dismiss: user clicks "Got it" or "Start Focus Session".
// Does NOT modify any store, component, or dashboard logic.
function DistractionPopup({ data, onDismiss, onFocus }) {
  if (!data) return null;
  return (
    <div className="distraction-overlay" role="dialog" aria-modal="true" aria-label="Distraction alert">
      <div className="distraction-popup">
        <div className="distraction-popup-header">
          <div className="distraction-popup-icon">⚠️</div>
          <div className="distraction-popup-titles">
            <div className="distraction-popup-title">Distraction Detected</div>
            <div className="distraction-popup-subtitle">
              You just opened{' '}
              <span className="distraction-popup-site">{data.label}</span>
            </div>
          </div>
        </div>

        <div className="distraction-popup-body">
          {data.isEscalated ? (
            <>
              <p>
                <strong>System Intervention — Focus Collapsing</strong><br/>
                Your Cognitive Focus Score has dropped to <strong>{data.cfs}/100</strong>.
              </p>
              <div className="cfs-breakdown" style={{ marginTop: '12px', fontSize: '13px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <span>Tab Switches: {Math.round((1 - data.signals?.tabSwitchRate) * 100)}% penalty</span>
                  <span>Interactions: {Math.round(data.signals?.interactionScore * 100)}% of baseline</span>
                  <span>Consistency: {Math.round(data.signals?.sessionDepth * 100)}%</span>
                  <span>Idle penalty: {Math.round((1 - data.signals?.idlePenalty) * 100)}%</span>
                </div>
              </div>
            </>
          ) : (
            <p>
              <strong>{data.label}</strong> is classified as a distracting site.
              Stay focused — close this tab and get back to what matters.
            </p>
          )}
        </div>

        <div className="distraction-popup-footer">
          <button className="distraction-popup-dismiss" onClick={onDismiss}>
            {data.isEscalated ? 'I Understand' : 'Got it'}
          </button>
          <button className="distraction-popup-focus" onClick={onFocus}>
            ⚡ Start Focus Session
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── [END ADDED] ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'focus',     label: '⚡ Focus Session' },
  { id: 'history',   label: 'Session History' },
];

export default function DashboardPage() {
  const {
    data, report, range, isLoading,
    demoActive, hasRealData,
    focusSettings, darkMode, activeTab, setActiveTab, init, refresh, clearDemo,
  } = useFocusStore();

  // ─── [ADDED] Popup state ──────────────────────────────────────────────────
  const [popupData, setPopupData] = useState(null);

  const handleDismiss = useCallback(() => setPopupData(null), []);

  const handleFocus = useCallback(() => {
    setPopupData(null);
    setActiveTab('focus');
  }, [setActiveTab]);

  useEffect(() => {
    // Only subscribe if running inside Electron
    if (typeof window === 'undefined') return;
    if (!window.electronBridge?.onDistractionPopup) return;

    window.electronBridge.onDistractionPopup((data) => {
      setPopupData(data);
    });

    // Also listen for cognitive engine escalated interventions
    const handleEscalated = (e) => {
      const snap = e.detail;
      setPopupData({
        label: 'Cognitive Decline',
        isEscalated: true,
        cfs: snap.cfs,
        signals: snap.signals
      });
    };
    window.addEventListener('ft:escalated_intervention', handleEscalated);
    return () => window.removeEventListener('ft:escalated_intervention', handleEscalated);
  }, []);
  // ─── [END ADDED] ──────────────────────────────────────────────────────────

  useEffect(() => { init(); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode);
  }, [darkMode]);

  if (isLoading || !data) return <Loader />;

  const { focusEnabled } = focusSettings;

  return (
    <div className="app">
      {/* [ADDED] Distraction popup — rendered above everything, zero impact on layout */}
      <DistractionPopup data={popupData} onDismiss={handleDismiss} onFocus={handleFocus} />

      <Header />

      {/* Active session banner */}
      {focusEnabled && (
        <div className="session-banner" role="status">
          <span className="session-banner-dot" />
          <span>Focus session is <strong>active</strong> — the extension is monitoring your browsing.</span>
          <button className="text-btn ml-auto" onClick={() => setActiveTab('focus')}>
            View →
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="tab-bar">
        <div className="tab-list">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn${activeTab === t.id ? ' tab-btn--active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="main">
        {/* ═══ TAB: Dashboard ═══ */}
        {activeTab === 'dashboard' && (
          <>
            {/* Smart demo notice */}
            {demoActive && hasRealData && (
              <div className="notice notice-warn">
                <span>⚠</span>
                <span>
                  <strong>Demo data is mixed with your real browsing data.</strong>{' '}
                  Clear it to see only your actual activity from the extension.
                </span>
                <button className="notice-btn notice-btn-danger" onClick={clearDemo}>
                  Clear Demo Data
                </button>
              </div>
            )}

            {demoActive && !hasRealData && (
              <div className="notice">
                <span>📊</span>
                <span>
                  Showing <strong>demo data</strong> — install and use the Chrome extension, then click{' '}
                  <strong>Clear Demo Data</strong> to see your real activity.
                </span>
                <button className="notice-btn" onClick={clearDemo}>
                  Clear Demo Data
                </button>
                <button className="notice-icon-btn" onClick={refresh} title="Refresh data">↻</button>
              </div>
            )}


            <div className="grid-2" style={{ alignItems: 'start' }}>
              <FocusScoreCard data={data} />
              <ProductivityPet />
            </div>

            <div className="grid-2">
              <CategoryBreakdown data={data} />
              <UsageGraph data={data} range={range} />
            </div>

            <div className="grid-2">
              <TopSites data={data} />
              <InsightAssistant report={report} data={data} />
            </div>
               {/* SEO anchor — visible to Google, hidden from UI */}
            <div style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }} aria-hidden="true">
                <h1>Flowlog – Focus Tracker with Real-Time Intervention</h1>
                     <p>
                      Flowlog is a real-time distraction detection and behavioral intervention system.
                      It measures focus quality, detects distracting websites, triggers popup interventions,
                      and gamifies productivity with a live focus score. Not just a time tracker —
                      a focus correction tool.
                     </p>
            </div>
            {/* Setup guide */}
            {/* Setup guide */}
            {/* Setup guide */}
            <section id="setup" className="install-card card" style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Flowlog – Focus Tracker with Real-Time Intervention</h2>
                <p style={{ color: 'var(--fg-dim)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
                  Since we're not on the Chrome Web Store yet, follow these 3 quick steps to install the beta:
                </p>
              </div>

              <a 
                href="/focus-tracker-extension.zip" 
                download 
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '1.1rem', background: '#3b82f6', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download Extension
              </a>

              <div className="install-steps-simple" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginTop: '32px', textAlign: 'left' }}>
                <div className="install-step" style={{ background: 'var(--bg-card-hover)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '8px' }}>Step 1</div>
                  Download the <code>.zip</code> file using the button above.
                </div>
                <div className="install-step" style={{ background: 'var(--bg-card-hover)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '8px' }}>Step 2</div>
                  Open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong> (top right).
                </div>
                <div className="install-step" style={{ background: 'var(--bg-card-hover)', padding: '16px', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 'bold', color: '#3b82f6', marginBottom: '8px' }}>Step 3</div>
                  <strong>Drag & drop</strong> the downloaded <code>.zip</code> file onto the page!
                </div>
              </div>
            </section>
          </>
        )}

        {/* ═══ TAB: Focus Session ═══ */}
        {activeTab === 'focus' && (
          <div className="focus-tab-layout">
            <div className="focus-main">
              <FocusModePanel />
            </div>
            <div className="focus-side">
              <SettingsPanel />
            </div>
          </div>
        )}

        {/* ═══ TAB: History ═══ */}
        {activeTab === 'history' && (
          <SessionHistory />
        )}
      </main>

      <footer className="footer">
        <span>⚡ Flowlog</span>
        <span>Privacy-first · All data stored locally · No servers</span>
      </footer>
    </div>
  );
}
