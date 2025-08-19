class AzureDevOpsPRStats {
  constructor() {
    this.additionsTotal = 0;
    this.deletionsTotal = 0;
    this.observer = null;
    this.statsElement = null;
    this.lastUpdate = 0;
    this.delay = 500; // 500ms debounce

    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  start() {
    setTimeout(() => {
      this.calculateStats();
      this.injectStats();
      this.setupObserver();
    }, 1000);
  }

  calculateStats() {
    const now = Date.now();
    if (now - this.lastUpdate < this.delay) {
      return;
    }
    this.lastUpdate = now;

    this.additionsTotal = 0;
    this.deletionsTotal = 0;

    const additionSpans = document.querySelectorAll('span.repos-compare-added-lines');
    additionSpans.forEach(span => {
      const text = span.textContent.trim();
      const number = this.extractNumber(text);
      if (number > 0) {
        this.additionsTotal += number;
      }
    });

    const deletionSpans = document.querySelectorAll('span.repos-compare-removed-lines');
    deletionSpans.forEach(span => {
      const text = span.textContent.trim();
      const number = this.extractNumber(text);
      if (number > 0) {
        this.deletionsTotal += number;
      }
    });

    console.log(`PR Stats: +${this.additionsTotal} -${this.deletionsTotal}`);
    this.updateStatsDisplay();
  }

  extractNumber(text) {
    // match +/- followed by one or more digits
    const match = text.match(/[+-]?(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  findFileCountElement() {
    const targetElements = document.querySelectorAll('.body-m.text-ellipsis');

    for (const element of targetElements) {
      if (element.tagName === 'SPAN') {
        return element;
      }
    }

    // if it's not there, we have an issue. Maybe determine a fallback later?
    console.log('Could not find .body-m.text-ellipsis element');
    return null;
  }

  injectStats() {
    const targetElement = this.findFileCountElement();

    if (!targetElement) {
      console.log('Could not find .body-m.text-ellipsis element to inject stats');
      return;
    }

    // Remove existing stats if any
    const existingStats = targetElement.querySelector('.ado-pr-stats');
    if (existingStats) {
      existingStats.remove();
    }

    // Create stats element
    this.statsElement = document.createElement('span');
    this.statsElement.className = 'ado-pr-stats';
    this.statsElement.style.marginLeft = '8px';
    this.statsElement.style.color = '#666';
    this.statsElement.style.fontFamily = 'inherit';
    this.statsElement.style.fontSize = 'inherit';
    this.statsElement.style.fontWeight = 'normal';
    this.statsElement.style.whiteSpace = 'nowrap';

    this.updateStatsDisplay();

    targetElement.appendChild(this.statsElement);

    console.log('Successfully injected PR stats into .body-m.text-ellipsis element');
  }

  updateStatsDisplay() {
    if (!this.statsElement) return;

    const additionsText = this.additionsTotal > 0 ? `+${this.additionsTotal}` : '0';
    const deletionsText = this.deletionsTotal > 0 ? `-${this.deletionsTotal}` : '0';

    this.statsElement.innerHTML = `
      <span style="color: #28a745;">${additionsText}</span>
      <span style="margin: 0 4px;">/</span>
      <span style="color: #dc3545;">${deletionsText}</span>
    `;

    this.statsElement.title = `Total additions: ${this.additionsTotal}, Total deletions: ${this.deletionsTotal}`;
  }

  setupObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      let shouldRecalculate = false;

      // Check if nodes were added/removed that might contain our target elements
      mutations.forEach((mutation) => {
        if (shouldRecalculate) {
          return;
        }

        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);

          [...addedNodes, ...removedNodes].forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && this.checkForChanges(node)) {
              shouldRecalculate = true;
            }
          });
        }
      });

      if (shouldRecalculate) {
        setTimeout(() => {
          this.calculateStats();
          if (!this.statsElement || !document.contains(this.statsElement)) {
            this.injectStats();
          }
        }, this.delay);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  checkForChanges(node) {
    return node.classList?.contains('repos-compare-added-lines') ||
      node.classList?.contains('repos-compare-removed-lines') ||
      node.querySelector?.('.repos-compare-added-lines, .repos-compare-removed-lines');
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.statsElement && this.statsElement.parentNode) {
      this.statsElement.parentNode.removeChild(this.statsElement);
    }
  }
}

// Initialize the extension
let prStats = null;

// Handle page navigation in SPAs
function initializeExtension() {
  // Clean up previous instance
  if (prStats) {
    prStats.destroy();
  }

  // Check if we're on a PR page
  if (window.location.pathname.includes('pullrequest')) {
    prStats = new AzureDevOpsPRStats();
  }
}

// Initial load
initializeExtension();

// Handle SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(initializeExtension, 1000); // Delay to let new content load
  }
}).observe(document, { subtree: true, childList: true });
