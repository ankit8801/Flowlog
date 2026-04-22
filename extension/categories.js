/**
 * categories.js
 * Domain → category classification map.
 * Used by both the extension background worker and the dashboard.
 */

const PRODUCTIVE_DOMAINS = [
  "github.com", "gitlab.com", "bitbucket.org",
  "stackoverflow.com", "stackexchange.com",
  "developer.mozilla.org", "docs.google.com",
  "notion.so", "obsidian.md", "roamresearch.com",
  "figma.com", "sketch.com", "adobe.com",
  "coursera.org", "udemy.com", "edx.org", "khanacademy.org",
  "leetcode.com", "hackerrank.com", "codewars.com",
  "medium.com", "dev.to", "hashnode.com",
  "vercel.com", "netlify.com", "heroku.com",
  "npmjs.com", "pypi.org",
  "wikipedia.org", "britannica.com",
  "linear.app", "jira.atlassian.com", "trello.com", "asana.com",
  "google.com", "google.co.in",
  "chat.openai.com", "claude.ai", "gemini.google.com",
  "replit.com", "codesandbox.io", "codepen.io",
  "vscode.dev", "github.dev",
  "digitalocean.com", "aws.amazon.com", "console.cloud.google.com",
];

const DISTRACTING_DOMAINS = [
  "youtube.com", "youtu.be",
  "twitter.com", "x.com",
  "instagram.com",
  "facebook.com", "fb.com",
  "reddit.com",
  "tiktok.com",
  "snapchat.com",
  "pinterest.com",
  "twitch.tv",
  "netflix.com", "primevideo.com", "hotstar.com", "hulu.com",
  "9gag.com", "buzzfeed.com",
  "tumblr.com",
  "discord.com",
  "whatsapp.com", "web.whatsapp.com",
  "telegram.org", "web.telegram.org",
  "gaming.amazon.com", "steampowered.com",
  "espn.com", "sportsbettingdime.com",
  "ebay.com", "amazon.com", "flipkart.com", "myntra.com",
  "quora.com",
  "buzzfeed.com", "dailymail.co.uk",
];

/**
 * Helper to match domains taking into account subdomains.
 */
function isMatch(domain, pattern) {
  if (!domain || !pattern) return false;
  const cleanDomain = domain.replace(/^www\./, "").toLowerCase();
  const cleanPattern = pattern.replace(/^www\./, "").toLowerCase();
  return cleanDomain === cleanPattern || cleanDomain.endsWith("." + cleanPattern);
}

/**
 * Returns the category for a given hostname.
 * EXACT priority gates.
 */
function resolveCategory(domain, userSettings = {}) {
  const clean = domain ? domain.replace(/^www\./, "").toLowerCase() : "";
  
  const productive = userSettings?.productiveDomains ?? [];
  const blocked = userSettings?.blockedDomains ?? [];

  // Gate 1 — user blocked list wins absolutely, even if the site is also productive.
  if (blocked.some(d => isMatch(clean, d))) return "blocked";

  // Gate 2 — user productive list
  if (productive.some(d => isMatch(clean, d))) return "productive";

  // Gate 3 — system default productive
  if (PRODUCTIVE_DOMAINS.some(d => isMatch(clean, d))) return "productive";

  // Gate 4 — system default distracting
  if (DISTRACTING_DOMAINS.some(d => isMatch(clean, d))) return "distracting";

  // Gate 5 — fallback
  return "neutral";
}

// Export for use in extension modules (background.js, popup.js)
if (typeof module !== "undefined") {
  module.exports = { resolveCategory, PRODUCTIVE_DOMAINS, DISTRACTING_DOMAINS };
}
