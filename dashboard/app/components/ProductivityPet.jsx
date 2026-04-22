'use client';

/**
 * ProductivityPet.jsx — The Focus Tamagotchi
 *
 * Reads from Zustand store analytics data:
 *  - data.focusScore: 0–100 (Overall productivity score)
 *  - data.productiveTime: seconds spent productively today
 *  - data.totalTime: total tracked time (to detect idle state)
 */

import { useEffect, useRef, useState } from 'react';
import useFocusStore from '../lib/store';

// ─── State config ─────────────────────────────────────────────────────────────
const STATES = {
  thriving: {
    label: 'Excellent 🌟',
    color: '#22c55e',
    bg: 'linear-gradient(160deg, #052e16 0%, #0a1628 100%)',
    leafColor: '#22c55e',
    leafGlow: 'drop-shadow(0 0 8px rgba(34,197,94,0.5))',
    petColor: '#86efac',
    story: '🌱 Your pet is thriving! Deep focus detected — keep it up.',
  },
  drifting: {
    label: 'Good 😐',
    color: '#f59e0b',
    bg: 'linear-gradient(160deg, #1c1309 0%, #0a1628 100%)',
    leafColor: '#ca8a04',
    leafGlow: 'none',
    petColor: '#fde68a',
    story: '🍂 Your pet is doing good. Avoid distractions to get back on track.',
  },
  distracted: {
    label: 'Moderate 😵',
    color: '#f97316',
    bg: 'linear-gradient(160deg, #1a0a00 0%, #0a1628 100%)',
    leafColor: '#ea580c',
    leafGlow: 'none',
    petColor: '#fdba74',
    story: '🥀 Your pet is moderate! Close distracting tabs to help it recover.',
  },
  critical: {
    label: 'Critical 🆘',
    color: '#ef4444',
    bg: 'linear-gradient(160deg, #1a0505 0%, #0a1628 100%)',
    leafColor: '#dc2626',
    leafGlow: 'none',
    petColor: '#fca5a5',
    story: '💔 Your pet is in crisis! Start a Focus Session immediately.',
  },
  idle: {
    label: 'Sleeping 💤',
    color: '#818cf8',
    bg: 'linear-gradient(160deg, #0d0d1a 0%, #0a1628 100%)',
    leafColor: '#6366f1',
    leafGlow: 'none',
    petColor: '#c4b5fd',
    story: '😴 Your pet is resting. Start browsing to wake it up and begin tracking!',
  },
};

function getStateKey(data) {
  if (!data || data.totalTime === 0) return 'idle';
  const score = data.focusScore;
  if (score >= 80) return 'thriving';
  if (score >= 65) return 'drifting';
  if (score >= 45) return 'distracted';
  if (score >= 25) return 'struggling';
  return 'critical';
}

// ─── Leaf positions ───────────────────────────────────────────────────────────
const ALL_LEAF_POS = [
  { x: 100, y: 45 }, { x: 78,  y: 60 }, { x: 122, y: 60 },
  { x: 65,  y: 78 }, { x: 135, y: 78 }, { x: 80,  y: 95 },
  { x: 120, y: 95 }, { x: 58,  y: 112 },{ x: 142, y: 112 },
  { x: 75,  y: 125 },{ x: 125, y: 125 },{ x: 100, y: 130 },
];

// ─── Tree Scene ───────────────────────────────────────────────────────────────
function TreeScene({ stateKey, score }) {
  const cfg = STATES[stateKey];
  const leafCount = Math.max(2, Math.round(2 + (score / 100) * 10)); // 2–12
  const trunkH    = 55 + (score / 100) * 25;                         // 55–80px trunk height
  const leafPts   = ALL_LEAF_POS.slice(0, leafCount);
  const falling   = stateKey === 'distracted' || stateKey === 'critical';
  const sleeping  = stateKey === 'idle';
  const thriving  = stateKey === 'thriving';

  return (
    <svg viewBox="0 0 200 190" style={{ width: '100%', height: '100%' }}>
      {/* Ground */}
      <rect x="0" y="168" width="200" height="22"
        fill={thriving ? '#14532d' : stateKey === 'critical' ? '#450a0a' : '#1e1b4b'}
        rx="4"
      />

      {/* Trunk */}
      <rect x="93" y={168 - trunkH} width="14" height={trunkH}
        rx="5" fill="#78350f"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
      />
      {/* Trunk grain lines */}
      <line x1="97" y1={168 - trunkH + 10} x2="97" y2="164" stroke="#92400e" strokeWidth="1.5" opacity="0.5" />
      <line x1="103" y1={168 - trunkH + 6} x2="103" y2="164" stroke="#92400e" strokeWidth="1" opacity="0.4" />

      {/* Leaves */}
      {leafPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y}
          r={thriving ? 18 : falling ? 14 - i * 0.3 : 16}
          fill={cfg.leafColor}
          opacity={falling ? Math.max(0.2, 0.9 - i * 0.06) : 0.88}
          style={{
            filter: thriving ? cfg.leafGlow : 'none',
            animation: falling
              ? `leaf-fall-${i % 3} ${2 + i * 0.25}s ease-in ${i * 0.3}s infinite`
              : thriving
              ? `leaf-sway ${2.5 + i * 0.2}s ease-in-out ${i * 0.12}s infinite alternate`
              : `leaf-still ${3 + i * 0.1}s ease-in-out ${i * 0.1}s infinite alternate`,
            transformOrigin: `${p.x}px ${p.y}px`,
          }}
        />
      ))}

      {/* Thriving sparkles */}
      {thriving && [
        {x: 18, y: 28}, {x: 168, y: 22}, {x: 180, y: 55}, {x: 12, y: 65},
      ].map((s, i) => (
        <text key={i} x={s.x} y={s.y} fontSize="11" fill="#fbbf24"
          style={{ animation: `twinkle ${1.2 + i * 0.3}s ease-in-out ${i * 0.25}s infinite alternate` }}>
          ✦
        </text>
      ))}

      {/* Sleeping Zs */}
      {sleeping && (
        <>
          <text x="128" y="72" fontSize="13" fill="#818cf8" style={{ animation: 'float-z 2.2s ease-out infinite' }}>z</text>
          <text x="144" y="54" fontSize="17" fill="#a5b4fc" style={{ animation: 'float-z 2.2s ease-out 0.6s infinite' }}>Z</text>
          <text x="162" y="38" fontSize="11" fill="#6366f1" style={{ animation: 'float-z 2.2s ease-out 1.2s infinite' }}>z</text>
        </>
      )}

      {/* Critical warning */}
      {stateKey === 'critical' && (
        <>
          <text x="22" y="38" fontSize="15" style={{ animation: 'shake-i 0.4s ease-in-out infinite alternate' }}>⚠️</text>
          <text x="162" y="38" fontSize="13" style={{ animation: 'shake-i 0.4s ease-in-out 0.2s infinite alternate' }}>🔴</text>
        </>
      )}
    </svg>
  );
}

// ─── Pixel Pet ────────────────────────────────────────────────────────────────
function PixelPet({ stateKey }) {
  const cfg = STATES[stateKey];
  const thriving = stateKey === 'thriving';
  const critical = stateKey === 'critical';
  const idle     = stateKey === 'idle';

  const eyeL = critical ? '×' : idle ? '–' : thriving ? '◕' : '•';
  const eyeR = critical ? '×' : idle ? '–' : thriving ? '◕' : '•';

  // Mouth path
  const mouth = thriving
    ? 'M 11 22 Q 20 28 29 22'  // smile
    : critical
    ? 'M 11 26 Q 20 20 29 26'  // frown
    : idle
    ? 'M 13 23 Q 20 23 27 23'  // flat
    : 'M 12 24 Q 20 22 28 24'; // slight frown

  const anim = thriving ? 'pet-bounce 0.7s ease-in-out infinite alternate'
    : idle    ? 'pet-sway 3s ease-in-out infinite alternate'
    : critical ? 'pet-shake 0.3s ease-in-out infinite alternate'
    : 'pet-float 2.5s ease-in-out infinite alternate';

  return (
    <svg viewBox="0 0 40 42" style={{ width: 68, height: 68, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))', animation: anim }}>
      {/* Ears */}
      <rect x="5"  y="4" width="8" height="10" rx="4" fill={cfg.petColor} />
      <rect x="27" y="4" width="8" height="10" rx="4" fill={cfg.petColor} />
      {/* Head */}
      <rect x="7" y="5" width="26" height="22" rx="10" fill={cfg.petColor} />
      {/* Body */}
      <rect x="9" y="22" width="22" height="14" rx="8" fill={cfg.petColor} />
      {/* Eyes */}
      <text x="10" y="20" fontSize="8.5" fill="#0f172a">{eyeL}</text>
      <text x="22" y="20" fontSize="8.5" fill="#0f172a">{eyeR}</text>
      {/* Mouth */}
      <path d={mouth} stroke="#0f172a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Tail */}
      <path d="M 31 28 Q 40 22 36 34" stroke={cfg.petColor} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Cheeks when thriving */}
      {thriving && (
        <>
          <circle cx="11" cy="22" r="3.5" fill="#f9a8d4" opacity="0.55" />
          <circle cx="29" cy="22" r="3.5" fill="#f9a8d4" opacity="0.55" />
        </>
      )}
      {/* Sweat drops when critical */}
      {critical && (
        <>
          <ellipse cx="8" cy="10" rx="2" ry="3" fill="#93c5fd" opacity="0.7" style={{ animation: 'float-z 1s ease-out infinite' }} />
        </>
      )}
    </svg>
  );
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────
function XpBar({ productiveSecs, stateKey }) {
  const totalMins  = Math.floor(productiveSecs / 60);
  const level      = Math.floor(totalMins / 60);
  const xpMins     = totalMins % 60;
  const pct        = Math.round((xpMins / 60) * 100);
  const color      = STATES[stateKey].color;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
        <span style={{ fontWeight: 600, color: '#94a3b8' }}>LV {level} Focus Pet</span>
        <span>{xpMins}m / 60m to next level</span>
      </div>
      <div style={{ height: 7, background: '#1e293b', borderRadius: 99, overflow: 'hidden', border: '1px solid #334155' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 99,
          transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 10px ${color}55`,
        }} />
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4, textAlign: 'right' }}>
        {totalMins}m productive today
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────
export default function ProductivityPet() {
  const { data } = useFocusStore();
  const prevKeyRef = useRef(null);
  const [animTrigger, setAnimTrigger] = useState(0);

  // Correct field — productiveTime is in seconds from processLogs
  const productiveSecs = data?.productiveTime ?? 0;
  const score = data?.focusScore ?? 0;
  const stateKey = getStateKey(data);
  const cfg = STATES[stateKey];

  // Trigger re-render animation on state change
  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== stateKey) {
      setAnimTrigger(n => n + 1);
    }
    prevKeyRef.current = stateKey;
  }, [stateKey]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Keyframe animations — self-contained */}
      <style>{`
        @keyframes leaf-sway     { from{transform:rotate(-7deg)} to{transform:rotate(7deg)} }
        @keyframes leaf-still    { from{transform:rotate(-3deg)} to{transform:rotate(3deg)} }
        @keyframes leaf-fall-0   { 0%{transform:translateY(0) rotate(0deg);opacity:.85} 100%{transform:translateY(50px) rotate(40deg);opacity:0} }
        @keyframes leaf-fall-1   { 0%{transform:translateY(0) rotate(0deg);opacity:.7}  100%{transform:translateY(60px) rotate(-50deg);opacity:0} }
        @keyframes leaf-fall-2   { 0%{transform:translateY(0) rotate(0deg);opacity:.6}  100%{transform:translateY(45px) rotate(30deg);opacity:0} }
        @keyframes twinkle       { from{opacity:.15;transform:scale(.8)} to{opacity:1;transform:scale(1.3)} }
        @keyframes float-z       { 0%{transform:translateY(0) translateX(0);opacity:.5} 100%{transform:translateY(-22px) translateX(8px);opacity:0} }
        @keyframes shake-i       { from{transform:rotate(-12deg)} to{transform:rotate(12deg)} }
        @keyframes pet-bounce    { from{transform:translateY(0)} to{transform:translateY(-9px)} }
        @keyframes pet-float     { from{transform:translateY(0)} to{transform:translateY(-4px)} }
        @keyframes pet-sway      { from{transform:rotate(-6deg)} to{transform:rotate(6deg)} }
        @keyframes pet-shake     { from{transform:translateX(-3px)} to{transform:translateX(3px)} }
        @keyframes badge-pulse   { from{opacity:.8} to{opacity:1} }
      `}</style>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 4px' }}>
        <span className="card-label" style={{ margin: 0 }}>FOCUS PET</span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: cfg.color,
          background: cfg.color + '1a',
          border: `1px solid ${cfg.color}40`,
          borderRadius: 20, padding: '3px 11px',
          animation: 'badge-pulse 2s ease-in-out infinite alternate',
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Scene card */}
      <div style={{
        position: 'relative',
        background: cfg.bg,
        margin: '10px 16px',
        borderRadius: 12,
        height: 188,
        overflow: 'hidden',
        border: '1px solid #1e293b',
        transition: 'background 1.2s ease',
      }}>
        {/* Tree fills background */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <TreeScene stateKey={stateKey} score={score} />
        </div>

        {/* Pet positioned bottom-right */}
        <div style={{ position: 'absolute', bottom: 18, right: 22 }}>
          <PixelPet stateKey={stateKey} />
        </div>

        {/* Productivity Score badge top-left */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.6)',
          border: `1px solid ${cfg.color}40`,
          borderRadius: 8, padding: '4px 10px',
          backdropFilter: 'blur(6px)',
          fontSize: 12, color: cfg.color, fontWeight: 700,
        }}>
          Score {Math.round(score)}/100
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '0 16px 16px' }}>
        <XpBar productiveSecs={productiveSecs} stateKey={stateKey} />
        <p style={{ fontSize: 12, color: '#64748b', marginTop: 10, lineHeight: 1.55, margin: '10px 0 0' }}>
          {cfg.story}
        </p>
      </div>
    </div>
  );
}
