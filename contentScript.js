let findings = [];

const regexPatterns = [
  { pattern: /\bonly\s+\d+\s+(left|remaining|items|in stock)\b/gi, reason: "Scarcity claim" },
  { pattern: /\blimited\b/gi, reason: "Urgency tactic" },
  { pattern: /\bhurry\s*(up)?\b/gi, reason: "Urgency tactic" },
  { pattern: /\bact\s+now\b/gi, reason: "Urgency tactic" },
  { pattern: /\blast\s+chance\b/gi, reason: "Urgency tactic" },
  { pattern: /\bdiscount\b/gi, reason: "Discount pressure" },
  { pattern: /\bsale\b/gi, reason: "Discount pressure" },
  { pattern: /\bfree\s+trial\b/gi, reason: "Free trial hook" },
  { pattern: /\b(auto\s*-?renew|renewal\s+required)\b/gi, reason: "Auto-renewal trap" },
  { pattern: /\bcountdown\b|\b\d{1,2}:\d{2}:\d{2}\b/gi, reason: "Countdown timer" },
  { pattern: /\bsubscribe\s+now\b/gi, reason: "Push to subscribe" },
  { pattern: /\bexclusive\s+deal\b/gi, reason: "Exclusive deal pressure" }
];

// Check if element is visible
function isVisible(el) {
  if (!(el instanceof Element)) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         el.offsetParent !== null;
}

function isInProtectedTag(el) {
  while (el) {
    const tag = el.tagName && el.tagName.toLowerCase();
    if (["script", "style", "noscript", "iframe"].includes(tag)) return true;
    el = el.parentElement;
  }
  return false;
}

// Safe highlight by splitting text node
function highlightMatch(node, matchText, id) {
  const text = node.nodeValue;
  const idx = text.toLowerCase().indexOf(matchText.toLowerCase());
  if (idx === -1) return null;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + matchText.length);
  const after = text.slice(idx + matchText.length);

  const span = document.createElement('span');
  span.className = 'dark-pattern-highlight';
  span.setAttribute('data-dark-pattern-id', id);
  span.textContent = match;

  const parent = node.parentNode;
  if (!parent) {
    console.warn('Skipping highlight: node has no parent', node);
    return null;
  }

  try {
    if (before) parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(span, node);
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);
  } catch (e) {
    console.error('Error during highlightMatch DOM manipulation:', e);
    return null;
  }

  return span;
}



function detectDarkPatterns() {
  let idCounter = 1;
  let results = [];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.nodeValue.length > 500) return NodeFilter.FILTER_REJECT;
        if (!isVisible(node.parentElement)) return NodeFilter.FILTER_REJECT;
        if (isInProtectedTag(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue;
    regexPatterns.forEach(({ pattern, reason }) => {
      pattern.lastIndex = 0; // reset regex state
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const snippet = match[0];
        console.log(`Matched: "${snippet}" Reason: ${reason}`);  // Debug log
        const id = idCounter++;
        const span = highlightMatch(node, snippet, id);
        if (span) {
          results.push({
            id,
            reason,
            snippet,
          });
        }
      }
    });
  }

  return results;
}

function clearHighlights() {
  document.querySelectorAll(".dark-pattern-highlight").forEach(span => {
    const parent = span.parentNode;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });
}

function runDetection() {
  console.log("Running detection...");
  clearHighlights();
  findings = detectDarkPatterns();
  console.log(`Found ${findings.length} dark patterns.`);
}

window.addEventListener('load', () => {
  runDetection();
});

// Mutation observer still disabled for safety
// const observer = new MutationObserver(() => {
//   runDetection();
// });
// observer.observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getFindings") {
    sendResponse({ findings });
  } else if (msg.action === "rescan") {
    runDetection();
    sendResponse({ findings });
  } else if (msg.action === "focus" && msg.id) {
    const el = document.querySelector(`[data-dark-pattern-id="${msg.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('dark-pattern-focus');
      setTimeout(() => el.classList.remove('dark-pattern-focus'), 2000);
      sendResponse({ ok: true });
    } else {
      sendResponse({ ok: false });
    }
  }
});
