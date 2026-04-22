'use client';

import { useState, useRef, useEffect } from 'react';
import useFocusStore from '../lib/store';
import { getSectionsForInput } from '../lib/siteSections';

const SENSITIVITIES = [
  { id: 'low',    label: 'Low',    desc: 'Warn after 3 visits' },
  { id: 'medium', label: 'Medium', desc: 'Warn on first visit' },
  { id: 'high',   label: 'High',   desc: 'Always warn'         },
];

export default function SettingsPanel() {
  const { focusSettings, updateFocusSettings, addBlocked, removeBlocked, addProductive, removeProductive } = useFocusStore();
  const { blockedSites, productiveDomains = [], sensitivity, allowContinue } = focusSettings;

  // PRODUCTIVE SITES STATE
  const [newProdSite,       setNewProdSite]       = useState('');
  const [addProdErr,        setAddProdErr]        = useState('');
  const [prodSuggestions,   setProdSuggestions]   = useState([]);
  const [prodDropdownOpen,  setProdDropdownOpen]  = useState(false);
  const prodInputRef  = useRef(null);
  const prodWrapRef   = useRef(null);

  // BLOCKED SITES STATE
  const [newBlockedSite,       setNewBlockedSite]       = useState('');
  const [addBlockedErr,        setAddBlockedErr]        = useState('');
  const [blockedSuggestions,   setBlockedSuggestions]   = useState([]);
  const [blockedDropdownOpen,  setBlockedDropdownOpen]  = useState(false);
  const blockedInputRef  = useRef(null);
  const blockedWrapRef   = useRef(null);

  // ─── EFFECTS ─────────────────────────────────────────────────────────────────
  
  // Productive Suggestions
  useEffect(() => {
    const s = getSectionsForInput(newProdSite);
    setProdSuggestions(s);
    setProdDropdownOpen(s.length > 0 && newProdSite.trim().length > 0);
  }, [newProdSite]);

  useEffect(() => {
    function onOutside(e) {
      if (prodWrapRef.current && !prodWrapRef.current.contains(e.target)) {
        setProdDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // Blocked Suggestions
  useEffect(() => {
    const s = getSectionsForInput(newBlockedSite);
    setBlockedSuggestions(s);
    setBlockedDropdownOpen(s.length > 0 && newBlockedSite.trim().length > 0);
  }, [newBlockedSite]);

  useEffect(() => {
    function onOutside(e) {
      if (blockedWrapRef.current && !blockedWrapRef.current.contains(e.target)) {
        setBlockedDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // ─── HANDLERS ────────────────────────────────────────────────────────────────

  function handleAddProductiveSite(e) {
    e?.preventDefault();
    const raw = newProdSite.trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    if (!raw) { setAddProdErr('Enter a valid domain or URL path'); return; }
    
    if (productiveDomains.includes(raw)) { setAddProdErr('Already in list'); return; }
    addProductive(raw);
    setNewProdSite('');
    setAddProdErr('');
    setProdDropdownOpen(false);
  }

  function handleProdSuggestionClick(path) {
    if (productiveDomains.includes(path)) {
      setAddProdErr(`${path} is already productive`);
      setProdDropdownOpen(false);
      setNewProdSite('');
      return;
    }
    addProductive(path);
    setNewProdSite('');
    setAddProdErr('');
    setProdDropdownOpen(false);
  }

  function handleAddBlockedSite(e) {
    e?.preventDefault();
    const raw = newBlockedSite.trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    if (!raw) { setAddBlockedErr('Enter a valid domain or URL path'); return; }
    
    if (blockedSites.includes(raw)) { setAddBlockedErr('Already in list'); return; }
    addBlocked(raw);
    setNewBlockedSite('');
    setAddBlockedErr('');
    setBlockedDropdownOpen(false);
  }

  function handleBlockedSuggestionClick(path) {
    if (blockedSites.includes(path)) {
      setAddBlockedErr(`${path} is already blocked`);
      setBlockedDropdownOpen(false);
      setNewBlockedSite('');
      return;
    }
    addBlocked(path);
    setNewBlockedSite('');
    setAddBlockedErr('');
    setBlockedDropdownOpen(false);
  }

  return (
    <div className="settings-panel">

      {/* ── Warning Sensitivity ── */}
      <div className="card">
        <div className="card-label">Warning Sensitivity</div>
        <p className="card-sub">How quickly Focus Mode intervenes when you visit a distracting site</p>
        <div className="sensitivity-grid">
          {SENSITIVITIES.map(s => (
            <button
              key={s.id}
              className={`sensitivity-card${sensitivity === s.id ? ' sensitivity-active' : ''}`}
              onClick={() => updateFocusSettings({ sensitivity: s.id })}
            >
              <span className="sensitivity-label">{s.label}</span>
              <span className="sensitivity-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Productive Sites ── */}
      <div className="card">
        <div className="card-label">PRODUCTIVE SITES</div>
        <p className="card-sub">
          Sites you add here will never trigger a warning, even if they appear on the distraction list.
        </p>

        {/* Add site form */}
        <form className="add-site-form" onSubmit={handleAddProductiveSite} autoComplete="off">
          <div className="site-input-wrap" ref={prodWrapRef}>
            <input
              ref={prodInputRef}
              className="site-input"
              type="text"
              value={newProdSite}
              onChange={e => { setNewProdSite(e.target.value); setAddProdErr(''); }}
              onFocus={() => { if (prodSuggestions.length > 0) setProdDropdownOpen(true); }}
              placeholder="e.g. github.com or paste a URL"
              aria-label="Domain or URL path to add as productive"
              aria-expanded={prodDropdownOpen}
              aria-haspopup="listbox"
            />

            {/* Smart Suggestions Dropdown */}
            {prodDropdownOpen && prodSuggestions.length > 0 && (
              <div className="site-suggestions" role="listbox">
                <div className="suggestions-header">
                  <span>📋 Select a section to allow</span>
                </div>
                {prodSuggestions.map(s => (
                  <button
                    key={s.path}
                    type="button"
                    className={`suggestion-item${productiveDomains.includes(s.path) ? ' suggestion-item--blocked' : ''}`}
                    onClick={() => handleProdSuggestionClick(s.path)}
                    role="option"
                    aria-selected={productiveDomains.includes(s.path)}
                  >
                    <span className="suggestion-icon">{s.icon}</span>
                    <span className="suggestion-text">
                      <span className="suggestion-label">{s.label}</span>
                      <span className="suggestion-path">{s.path}</span>
                    </span>
                    <span className={`suggestion-badge ${s.distracting ? 'badge-distracting' : 'badge-productive'}`}>
                      {s.distracting ? '⚡ Distracting' : '✓ Productive'}
                    </span>
                    {productiveDomains.includes(s.path)
                      ? <span className="suggestion-blocked-tag">Added</span>
                      : <span className="suggestion-add-tag">+ Add</span>
                    }
                  </button>
                ))}
                <div className="suggestions-footer">
                  <button type="submit" className="suggestions-custom-btn">
                    Add "{newProdSite.trim()}" as custom entry instead →
                  </button>
                </div>
              </div>
            )}
          </div>

          {(!prodDropdownOpen || prodSuggestions.length === 0) && (
            <button className="btn btn-primary btn-sm" type="submit" style={{ background: 'var(--productive)' }}>Add</button>
          )}
        </form>

        {addProdErr && <p className="input-err">{addProdErr}</p>}

        {/* Productive list */}
        {productiveDomains.length > 0 ? (
          <ul className="blocked-list">
            {productiveDomains.map(site => {
              const isPath = site.includes('/');
              const domain = isPath ? site.split('/')[0] : site;
              return (
                <li key={site} className="blocked-item">
                  <img
                    className="site-favicon"
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                    alt="" aria-hidden
                    onError={e => { e.target.style.visibility = 'hidden'; }}
                  />
                  <span className="blocked-domain">
                    {site}
                    {isPath && <span className="path-tag">path</span>}
                  </span>
                  <button
                    className="remove-btn"
                    onClick={() => removeProductive(site)}
                    aria-label={`Remove ${site}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state" style={{ paddingTop: '16px', paddingBottom: '8px' }}>
            No productive sites added.
          </p>
        )}
      </div>

      {/* ── Blocked Sites ── */}
      <div className="card">
        <div className="card-label">BLOCKED SITES</div>
        <p className="card-sub">
          Block an entire site or just specific sections. Paste any URL — we'll suggest what to block.
        </p>

        {/* Add site form */}
        <form className="add-site-form" onSubmit={handleAddBlockedSite} autoComplete="off">
          <div className="site-input-wrap" ref={blockedWrapRef}>
            <input
              ref={blockedInputRef}
              className="site-input"
              type="text"
              value={newBlockedSite}
              onChange={e => { setNewBlockedSite(e.target.value); setAddBlockedErr(''); }}
              onFocus={() => { if (blockedSuggestions.length > 0) setBlockedDropdownOpen(true); }}
              placeholder="e.g. reddit.com or paste a YouTube URL"
              aria-label="Domain or URL path to block"
              aria-expanded={blockedDropdownOpen}
              aria-haspopup="listbox"
            />

            {/* Smart Suggestions Dropdown */}
            {blockedDropdownOpen && blockedSuggestions.length > 0 && (
              <div className="site-suggestions" role="listbox">
                <div className="suggestions-header">
                  <span>📋 Select a section to block</span>
                </div>
                {blockedSuggestions.map(s => (
                  <button
                    key={s.path}
                    type="button"
                    className={`suggestion-item${blockedSites.includes(s.path) ? ' suggestion-item--blocked' : ''}`}
                    onClick={() => handleBlockedSuggestionClick(s.path)}
                    role="option"
                    aria-selected={blockedSites.includes(s.path)}
                  >
                    <span className="suggestion-icon">{s.icon}</span>
                    <span className="suggestion-text">
                      <span className="suggestion-label">{s.label}</span>
                      <span className="suggestion-path">{s.path}</span>
                    </span>
                    <span className={`suggestion-badge ${s.distracting ? 'badge-distracting' : 'badge-productive'}`}>
                      {s.distracting ? '⚡ Distracting' : '✓ Productive'}
                    </span>
                    {blockedSites.includes(s.path)
                      ? <span className="suggestion-blocked-tag">Blocked</span>
                      : <span className="suggestion-add-tag">+ Add</span>
                    }
                  </button>
                ))}
                <div className="suggestions-footer">
                  <button type="submit" className="suggestions-custom-btn">
                    Add "{newBlockedSite.trim()}" as custom entry instead →
                  </button>
                </div>
              </div>
            )}
          </div>

          {(!blockedDropdownOpen || blockedSuggestions.length === 0) && (
            <button className="btn btn-primary btn-sm" type="submit">Add</button>
          )}
        </form>

        {addBlockedErr && <p className="input-err">{addBlockedErr}</p>}

        {/* Blocked list */}
        {blockedSites.length > 0 ? (
          <ul className="blocked-list">
            {blockedSites.map(site => {
              const isPath = site.includes('/');
              const domain = isPath ? site.split('/')[0] : site;
              return (
                <li key={site} className="blocked-item">
                  <img
                    className="site-favicon"
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                    alt="" aria-hidden
                    onError={e => { e.target.style.visibility = 'hidden'; }}
                  />
                  <span className="blocked-domain">
                    {site}
                    {isPath && <span className="path-tag">path</span>}
                  </span>
                  <button
                    className="remove-btn"
                    onClick={() => removeBlocked(site)}
                    aria-label={`Remove ${site}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-state" style={{ paddingTop: '16px', paddingBottom: '8px' }}>
            No blocked sites. Paste a URL above to get started.
          </p>
        )}
      </div>

      {/* ── Override Control ── */}
      <div className="card">
        <div className="card-label">Override Control</div>
        <div className="toggle-row">
          <div>
            <div className="toggle-title">Allow "Continue" button on warnings</div>
            <div className="toggle-desc">
              If off, users cannot bypass warnings — they must end the session or go back.
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={allowContinue}
              onChange={e => updateFocusSettings({ allowContinue: e.target.checked })}
            />
            <span className="switch-track"><span className="switch-thumb" /></span>
          </label>
        </div>
      </div>
    </div>
  );
}
