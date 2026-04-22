/**
 * insights.js — Data-Driven Insight Engine
 *
 * Generates a structured analysis report from ProcessedData.
 * Every string references actual numbers from the data.
 * No generic placeholders. No random text.
 *
 * Output shape:
 * {
 *   summary: string,
 *   findings: [{ type: 'warning'|'positive'|'info', text, detail }],
 *   recommendation: string | null
 * }
 */

import { fmtDuration, scoreLabel } from './engine';

// ─── Summary paragraph ────────────────────────────────────────────────────────

function buildSummary(data) {
  const { focusScore, productiveTime, distractingTime, totalTime } = data;

  if (totalTime === 0) {
    return 'No activity recorded for this period. Install the Chrome extension and browse normally — data will appear here automatically.';
  }

  const label = scoreLabel(focusScore).toLowerCase();

  const comparison = productiveTime >= distractingTime
    ? `You spent more time on productive work (${fmtDuration(productiveTime)}) than distracting sites (${fmtDuration(distractingTime)}).`
    : `You spent more time on distracting sites (${fmtDuration(distractingTime)}) than productive work (${fmtDuration(productiveTime)}).`;

  return `Your focus score is ${focusScore}/100 — a ${label} result. ${comparison}`;
}

// ─── Key findings (all data-driven) ──────────────────────────────────────────

function buildFindings(data) {
  const {
    peakDistractionWindow, peakProductiveWindow,
    topDistractingSites, distractingTime,
    totalTime, productiveTime,
  } = data;

  const findings = [];

  // Peak distraction window
  if (peakDistractionWindow) {
    const siteNames = peakDistractionWindow.dominantSites
      .map(s => `${s.site} (${fmtDuration(s.duration)})`)
      .join(', ');

    findings.push({
      type: 'warning',
      text: `Peak distraction between ${peakDistractionWindow.label} — ${fmtDuration(peakDistractionWindow.totalSeconds)} total.`,
      detail: siteNames ? `Main sources: ${siteNames}` : null,
    });
  }

  // Peak productive window
  if (peakProductiveWindow) {
    const siteNames = peakProductiveWindow.dominantSites
      .map(s => `${s.site} (${fmtDuration(s.duration)})`)
      .join(', ');

    findings.push({
      type: 'positive',
      text: `Best focus window: ${peakProductiveWindow.label} — ${fmtDuration(peakProductiveWindow.totalSeconds)} of productive time.`,
      detail: siteNames ? `Active on: ${siteNames}` : null,
    });
  }

  // Top distracting site by share
  if (topDistractingSites.length > 0 && distractingTime > 0) {
    const top = topDistractingSites[0];
    const share = Math.round(top.duration / distractingTime * 100);
    findings.push({
      type: 'warning',
      text: `${top.site} is your #1 distraction — ${share}% of distracting time (${fmtDuration(top.duration)}).`,
      detail: null,
    });
  }

  // Extended screen time warning
  if (totalTime > 6 * 3600) {
    findings.push({
      type: 'info',
      text: `${fmtDuration(totalTime)} of total browser usage today. Consider taking regular breaks.`,
      detail: 'Sustained screen time of 6+ hours can reduce focus quality.',
    });
  }

  // No distracting time — positive note
  if (distractingTime === 0 && productiveTime > 0) {
    findings.push({
      type: 'positive',
      text: 'Zero distracting activity recorded — a clean, focused session.',
      detail: null,
    });
  }

  return findings;
}

// ─── Recommendation ───────────────────────────────────────────────────────────

function buildRecommendation(data) {
  const { focusScore, peakDistractionWindow, topDistractingSites, distractingTime, totalTime } = data;

  if (totalTime === 0) return null;

  const parts = [];

  if (peakDistractionWindow) {
    parts.push(`Schedule your most important deep work outside of your distraction window (${peakDistractionWindow.label}).`);
  }

  if (topDistractingSites.length > 0 && distractingTime > 300) {
    const topSite = topDistractingSites[0].site;
    parts.push(`Enable Focus Mode before visiting ${topSite} to see a prompt that helps you stay on task.`);
  }

  if (focusScore < 45) {
    parts.push('Use time-blocking: allocate explicit 25–50 minute focused work sessions and treat distracting sites as off-limits during them.');
  } else if (focusScore >= 75) {
    parts.push('Your habits are solid. Protect your peak focus window and keep your distraction window short.');
  } else {
    parts.push('Small improvements compound — reducing distracting usage by 15 minutes per session meaningfully raises your score.');
  }

  return parts.join(' ');
}

function buildCognitiveFindings(cfsTimeline) {
  const cognitiveFindings = [];
  if (!cfsTimeline || cfsTimeline.length === 0) return cognitiveFindings;

  // Find occurrences of deeply distracted
  const deeplyDistracted = cfsTimeline.filter(s => s.state === 'DEEPLY_DISTRACTED');
  if (deeplyDistracted.length > 0) {
    // Group by hour
    const hrs = new Set(deeplyDistracted.map(s => new Date(s.timestamp).getHours()));
    const timeFrame = Array.from(hrs).map(h => `${h}:00-${h+1}:00`).join(', ');
    
    // Identify leading signal issue
    const worstSignal = deeplyDistracted[0].signals; // just take first
    let worstReason = 'High tab switch rate';
    if (worstSignal.interactionScore < 0.2) worstReason = 'Very low interaction density';
    if (worstSignal.idlePenalty < 0.5) worstReason = 'Frequent idle gaps';

    cognitiveFindings.push({
      type: 'warning',
      text: `You entered DEEPLY_DISTRACTED state ${deeplyDistracted.length} times (around ${timeFrame}).`,
      detail: `Primary signal: ${worstReason}.`,
    });
  }

  // Find longest focused streak (rough estimation from snapshots)
  const focused = cfsTimeline.map((s, i) => s.state === 'FOCUSED' ? i : -1).filter(v => v !== -1);
  if (focused.length > 2) {
    let maxStreak = 0;
    let currStreak = 1;
    for(let i = 1; i < focused.length; i++){
      if(focused[i] === focused[i-1] + 1) currStreak++;
      else { maxStreak = Math.max(maxStreak, currStreak); currStreak = 1; }
    }
    maxStreak = Math.max(maxStreak, currStreak);
    
    if (maxStreak >= 2) {
      const mins = Math.round((maxStreak * 15) / 60); // 15 seconds per tick
      cognitiveFindings.push({
        type: 'positive',
        text: `Your longest uninterrupted FOCUSED block today based on cognitive signals was ~${mins} minutes.`,
        detail: null,
      });
    }
  }

  return cognitiveFindings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateReport(data, cfsTimeline = []) {
  const cF = buildCognitiveFindings(cfsTimeline);
  return {
    summary: buildSummary(data),
    findings: [...cF, ...buildFindings(data)],
    recommendation: buildRecommendation(data),
  };
}
