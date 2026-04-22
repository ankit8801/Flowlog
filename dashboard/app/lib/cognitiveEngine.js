/**
 * cognitiveEngine.js — Real-Time Cognitive Focus Detection System
 *
 * Computes a Cognitive Focus Score (CFS) over a rolling 10-minute window
 * using adaptive baselines derived from 7-day historical data.
 * Manages state transitions and persists snapshots to IndexedDB
 */

import { getLogsByDateRange, getRecentSessions, addFocusEvent, getCfsSnapshotsByDateRange } from './db';

// Weight configuration
const WEIGHTS = {
  tabSwitchRate: 0.25,
  interactionDensity: 0.20,
  durationConsistency: 0.20,
  categoryTrajectory: 0.20,
  idlePenalty: 0.15,
};

// State thresholds
const THRESHOLDS = {
  FOCUSED:           { entry: 75, exit: 65 },
  DRIFTING:          { entry: 65, exit: 40 },
  DISTRACTED:        { entry: 40, exit: 20 },
  DEEPLY_DISTRACTED: { entry: 20, exit: 35 },
};

function determineState(cfs, currentState, consecutiveTicks) {
  // Check FOCUSED
  if (currentState !== 'FOCUSED') {
    if (cfs >= THRESHOLDS.FOCUSED.entry) return 'FOCUSED';
  } else {
    if (cfs < THRESHOLDS.FOCUSED.exit && consecutiveTicks >= 2) return 'DRIFTING';
    return 'FOCUSED';
  }

  // Check DRIFTING
  if (currentState !== 'DRIFTING') {
    if (cfs >= THRESHOLDS.DRIFTING.entry) return 'DRIFTING'; // Recovery from distracted
  } else {
    if (cfs >= THRESHOLDS.FOCUSED.entry) return 'FOCUSED'; // Escalate up
    if (cfs < THRESHOLDS.DRIFTING.exit && consecutiveTicks >= 2) return 'DISTRACTED'; // Escalate down
    return 'DRIFTING';
  }

  // Check DISTRACTED
  if (currentState !== 'DISTRACTED') {
    if (cfs >= THRESHOLDS.DISTRACTED.entry) return 'DISTRACTED'; 
  } else {
    if (cfs >= THRESHOLDS.DRIFTING.entry) return 'DRIFTING';
    if (cfs < THRESHOLDS.DISTRACTED.exit && consecutiveTicks >= 2) return 'DEEPLY_DISTRACTED';
    return 'DISTRACTED';
  }

  // Check DEEPLY_DISTRACTED
  if (currentState !== 'DEEPLY_DISTRACTED') {
     // Handled by fall-through from above or initial forced state, but typically we only land here if CFS < 20
     if (cfs < THRESHOLDS.DEEPLY_DISTRACTED.entry) return 'DEEPLY_DISTRACTED';
  } else {
    if (cfs > THRESHOLDS.DEEPLY_DISTRACTED.exit) return 'DISTRACTED'; // recovery
    return 'DEEPLY_DISTRACTED';
  }

  // Fallback map
  if (cfs >= 75) return 'FOCUSED';
  if (cfs >= 45) return 'DRIFTING';
  if (cfs >= 20) return 'DISTRACTED';
  return 'DEEPLY_DISTRACTED';
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Compute standard baseline
export function computeBaseline(logs7d, sessions7d) {
  const defaults = { tabSwitchesPer10m: 10, interactionsPer10m: 100, sessionDepthSec: 120 };
  
  if (!logs7d || logs7d.length === 0) return defaults;
  
  let totalLogs = logs7d.length;
  let tabSwitches = 0;
  let interactions = 0;
  
  if (sessions7d && sessions7d.length > 0) {
    for (const s of sessions7d) {
      tabSwitches += (s.tabSwitches || 0);
      interactions += (s.interactions || 0);
    }
  }

  const timespanMs = new Date(logs7d[logs7d.length-1].timestamp).getTime() - new Date(logs7d[0].timestamp).getTime();
  const timespan10m = Math.max(1, timespanMs / (10 * 60 * 1000));

  return {
    tabSwitchesPer10m: tabSwitches > 0 ? (tabSwitches / timespan10m) : defaults.tabSwitchesPer10m,
    interactionsPer10m: interactions > 0 ? (interactions / timespan10m) : defaults.interactionsPer10m,
    sessionDepthSec: defaults.sessionDepthSec, // simplifying for now
  };
}

export async function evaluate(baseline, lastStateInfo = null) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago

  // 1. Fetch 10 min window data
  const logs = await getLogsByDateRange(windowStart, now);
  // Fetch sessions roughly in the last 10 minutes by filtering recent ones
  const recentSessions = (await getRecentSessions(50)).filter(s => {
      const st = new Date(s.startTime).getTime();
      return st >= windowStart.getTime() || (st + s.duration * 1000) >= windowStart.getTime();
  });

  // Calculate raw signals
  let tabSwitches = 0;
  let interactions = 0;
  for (const s of recentSessions) {
    tabSwitches += (s.tabSwitches || 0);
    interactions += (s.interactions || 0);
  }

  let prodTime = 0;
  let distTime = 0;
  let neutTime = 0;
  for (const log of logs) {
    if (log.category === 'productive') prodTime += log.duration;
    else if (log.category === 'distracting') distTime += log.duration;
    else neutTime += log.duration;
  }
  const totalTime = prodTime + distTime + neutTime;

  // Session duration consistency: avg length of productive sessions vs distracting
  let sessionConsistencyRaw = totalTime > 0 ? (prodTime / totalTime) : 0.5;

  // Normalize signals to [0,1]
  
  // Tab Switch Rate (inverse): more switches = lower score
  const baseTabs = baseline.tabSwitchesPer10m || 10;
  const tabSwitchScore = clamp(1 - (tabSwitches / (baseTabs * 2)), 0, 1);

  // Interaction Density: 
  const baseInteractions = baseline.interactionsPer10m || 100;
  const interactionScore = clamp(interactions / baseInteractions, 0, 1);

  // Consistency
  const consistencyScore = clamp(sessionConsistencyRaw, 0, 1);

  // Category Trajectory
  const categoryScore = totalTime > 0 ? clamp(((prodTime - distTime) / totalTime + 1) / 2, 0, 1) : 0.5;

  // Idle penalty: for simplicity, we derive it inversely from interactions if real idle events aren't available broadly
  const idlePenaltyScore = interactionScore < 0.2 ? 0.3 : 1.0; 

  const cfsRaw = (
    tabSwitchScore * WEIGHTS.tabSwitchRate +
    interactionScore * WEIGHTS.interactionDensity +
    consistencyScore * WEIGHTS.durationConsistency +
    categoryScore * WEIGHTS.categoryTrajectory +
    idlePenaltyScore * WEIGHTS.idlePenalty
  ) * 100;

  const cfs = Math.round(cfsRaw);
  
  // Evaluate state machine transitions
  const currentState = lastStateInfo?.state || 'FOCUSED';
  let consecutiveTicks = lastStateInfo?.consecutiveTicks || 0;
  
  // If we are evaluating a potential drop in state, increment ticks
  if (
    (currentState === 'FOCUSED' && cfs < THRESHOLDS.FOCUSED.exit) ||
    (currentState === 'DRIFTING' && cfs < THRESHOLDS.DRIFTING.exit) ||
    (currentState === 'DISTRACTED' && cfs < THRESHOLDS.DISTRACTED.exit)
  ) {
    consecutiveTicks += 1;
  } else {
    consecutiveTicks = 0;
  }

  const newState = determineState(cfs, currentState, consecutiveTicks);
  
  // If state changed, reset ticks
  if (newState !== currentState) {
    consecutiveTicks = 0;
  }

  const snapshot = {
    type: 'cfs_snapshot',
    state: newState,
    cfs: cfs,
    signals: {
      tabSwitchRate: Math.round(tabSwitchScore * 100) / 100,
      interactionScore: Math.round(interactionScore * 100) / 100,
      sessionDepth: Math.round(consistencyScore * 100) / 100,
      categoryScore: Math.round(categoryScore * 100) / 100,
      idlePenalty: Math.round(idlePenaltyScore * 100) / 100,
    },
    consecutiveTicks, // transient data useful for engine
    source: 'cognitive-engine',
  };

  // Persist snapshot to db
  await addFocusEvent(snapshot);

  return snapshot;
}
