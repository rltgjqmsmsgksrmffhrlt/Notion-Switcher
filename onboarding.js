'use strict';

window.Onboarding = (function () {
  var STORAGE_KEY = 'onboardingDone';
  var step = 0;
  var arrowEl = null;
  var tooltipEl = null;
  var prevTarget = null;
  var mockEl = null;

  var POINTS = [
    { target: '#btn-add-link',      textKey: 'obTip1' },
    { target: '#filter-add-folder', textKey: 'obTip2' },
    { target: null,                 textKey: 'obTip3', mock: true },
    { target: '.header-right',      textKey: 'obTip4' }
  ];

  function createEls() {
    arrowEl = document.createElement('div');
    arrowEl.className = 'ob-arrow';
    document.body.appendChild(arrowEl);

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'ob-tooltip';
    document.body.appendChild(tooltipEl);
  }

  function createMock() {
    mockEl = document.createElement('div');
    mockEl.className = 'workspace-item ob-mock';
    mockEl.style.pointerEvents = 'none';
    mockEl.innerHTML =
      '<div class="ws-icon" style="background:var(--tile-blue-bg);color:var(--tile-blue-fg)">' +
        '<span style="font-size:15px">\uD83D\uDCDD</span>' +
      '</div>' +
      '<div class="ws-info">' +
        '<div class="ws-name">My Workspace</div>' +
        '<div class="ws-url">notion.so/my-workspace</div>' +
      '</div>' +
      '<div class="ws-meta"><span class="ws-badge ob-badge-highlight">1</span></div>';

    var wsList = document.getElementById('ws-list');
    wsList.insertBefore(mockEl, wsList.firstChild);
    return mockEl;
  }

  function removeMock() {
    if (mockEl) { mockEl.remove(); mockEl = null; }
  }

  function showStep(idx) {
    var point = POINTS[idx];
    var el;

    removeMock();

    if (point.mock) {
      el = createMock();
    } else {
      el = document.querySelector(point.target);
    }

    if (!el) { advance(); return; }

    if (prevTarget) prevTarget.classList.remove('ob-highlight');
    el.classList.add('ob-highlight');
    prevTarget = el;

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    requestAnimationFrame(function () {
      var rect = el.getBoundingClientRect();

      arrowEl.style.top = (rect.top + rect.height / 2) + 'px';
      arrowEl.style.left = Math.max(2, rect.left - 16) + 'px';

      var isLast = idx === POINTS.length - 1;
      tooltipEl.innerHTML =
        '<div class="ob-tt-body">' +
          '<span class="ob-tt-step">' + (idx + 1) + '/' + POINTS.length + '</span> ' +
          '<span class="ob-tt-text">' + t(point.textKey) + '</span>' +
        '</div>' +
        '<div class="ob-tt-btns">' +
          (isLast
            ? '<button class="ob-btn-primary">' + t('obDone') + '</button>'
            : '<button class="ob-btn-primary">' + t('obNext') + ' \u2192</button>') +
          '<button class="ob-btn-skip">' + t('obSkip') + '</button>' +
        '</div>';

      var ttHeight = 72;
      var spaceBelow = window.innerHeight - rect.bottom - 10;
      if (spaceBelow >= ttHeight) {
        tooltipEl.style.top = (rect.bottom + 10) + 'px';
      } else {
        tooltipEl.style.top = (rect.top - ttHeight - 10) + 'px';
      }
      tooltipEl.style.left = Math.min(Math.max(8, rect.left), 320 - 216) + 'px';

      tooltipEl.querySelector('.ob-btn-primary').onclick = isLast ? finish : advance;
      tooltipEl.querySelector('.ob-btn-skip').onclick = finish;
    });
  }

  function advance() {
    step++;
    if (step >= POINTS.length) finish();
    else showStep(step);
  }

  function finish() {
    if (prevTarget) { prevTarget.classList.remove('ob-highlight'); prevTarget = null; }
    if (arrowEl) { arrowEl.remove(); arrowEl = null; }
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
    removeMock();
    step = 0;
    chrome.storage.local.set({ onboardingDone: true });
  }

  function start() {
    step = 0;
    createEls();
    showStep(0);
    setTimeout(function () {
      if (arrowEl) arrowEl.classList.add('ob-moving');
      if (tooltipEl) tooltipEl.classList.add('ob-moving');
    }, 50);
  }

  function restart() {
    finish();
    chrome.storage.local.remove(STORAGE_KEY, function () {
      setTimeout(start, 300);
    });
  }

  function checkAndStart() {
    chrome.storage.local.get([STORAGE_KEY], function (data) {
      if (!data[STORAGE_KEY]) {
        setTimeout(start, 500);
      }
    });
  }

  return { start: start, restart: restart, checkAndStart: checkAndStart };
})();
