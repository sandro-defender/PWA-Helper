/*!
 * assistant-widget.js — dependency-free You.Ge Assistant floating widget
 * ---------------------------------------------------------------------
 * A thin renderer over window.YouGeAssistant (assistant-state.js). It owns no
 * state of its own beyond "panel open/closed", never polls, never calls fetch(),
 * never registers a service worker, and never auto-opens. All user-visible
 * conditions come from the centralized state model.
 *
 * Load with `defer` after assistant-state.js. Configure via
 * window.YOU_GE_ASSISTANT_CONFIG before assistant-state.js executes.
 */
(function (root) {
  'use strict';

  if (root.YouGeAssistantWidget && root.YouGeAssistantWidget.__mounted) return;
  var doc = root.document;
  if (!doc || !root.YouGeAssistant || typeof root.YouGeAssistant.subscribe !== 'function') return;

  var api = root.YouGeAssistant;
  var ROOT_ID = 'youge-assistant-root';
  var PANEL_ID = 'youge-assistant-panel';
  var ICONS = {
    assistant: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-4.4 0-8 3.1-8 7v4.5c0 1.1-.4 2.1-1.2 2.9L2 19h4.2c1 1.2 2.6 2 4.8 2 1.4 0 2.6-.3 3.6-.8"/><path d="M20 13V10c0-3.9-3.6-7-8-7"/><circle cx="12" cy="10" r="1.2" fill="currentColor" stroke="none"/><path d="M8 14h8"/><path d="M18 16.5v4M16 18.5h4"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v8M8.5 11.5L12 15l3.5-3.5"/></svg>',
    diagnostics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3l2-6 4 12 2-6h4"/><circle cx="21" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
    recovery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/></svg>',
    backup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.2 1-1.2 2"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    update: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8.5 11.5L12 15l3.5-3.5"/><path d="M5 19h14"/></svg>',
    custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  var mount = null;
  var fab = null;
  var badge = null;
  var live = null;
  var panel = null;
  var panelBody = null;
  var closeButton = null;
  var isOpen = false;
  var unsubscribe = null;
  var closeTimer = null;
  var lastLiveLabel = '';
  var lastBadge = '';

  function el(tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function icon(name) {
    var span = el('span', 'youge-icon');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = ICONS[name] || ICONS.custom; // fixed local map only
    return span;
  }

  function button(label, iconName, className) {
    var node = el('button', className || 'youge-btn');
    node.type = 'button';
    node.appendChild(icon(iconName || 'custom'));
    node.appendChild(el('span', 'youge-btn-label', label));
    return node;
  }

  function statusRow(label, value, tone) {
    var row = el('div', 'youge-status-row');
    row.appendChild(el('span', 'youge-status-label', label));
    var valueWrap = el('span', 'youge-status-value');
    var dot = el('span', 'youge-status-dot');
    dot.setAttribute('data-tone', tone || 'neutral');
    dot.setAttribute('aria-hidden', 'true');
    valueWrap.appendChild(dot);
    valueWrap.appendChild(el('span', '', value));
    row.appendChild(valueWrap);
    return row;
  }

  function section(title, description) {
    var wrap = el('section', 'youge-section');
    wrap.appendChild(el('h3', 'youge-section-title', title));
    if (description) wrap.appendChild(el('p', 'youge-section-desc', description));
    return wrap;
  }

  function applyAppearance(state) {
    if (!mount || !state) return;
    var appearance = state.appearance || {};
    mount.setAttribute('data-position', appearance.position || 'bottom-right');
    mount.setAttribute('data-theme', appearance.theme || 'auto');
    mount.style.setProperty('--youge-offset-x', (appearance.offsets ? appearance.offsets.x : 20) + 'px');
    mount.style.setProperty('--youge-offset-y', (appearance.offsets ? appearance.offsets.y : 20) + 'px');
    if (appearance.themeColor) mount.style.setProperty('--youge-brand', appearance.themeColor);
    mount.hidden = state.enabled === false;
  }

  function updateFab(state) {
    if (!fab || !badge || !state) return;
    var badgeState = state.badge || { count: 0, tone: 'none', label: 'No alerts' };
    var count = badgeState.count || 0;
    var tone = badgeState.tone || 'none';
    var label = state.project && state.project.name ? state.project.name : 'You.Ge Assistant';
    var accessible = label + ' assistant';
    if (count) accessible += ', ' + count + (count === 1 ? ' alert' : ' alerts') + ', highest priority: ' + badgeState.label;
    else accessible += ', no alerts';
    fab.setAttribute('aria-label', accessible);
    fab.setAttribute('data-tone', tone);
    var badgeText = count > 9 ? '9+' : String(count);
    if (badgeText !== lastBadge || tone !== badge.getAttribute('data-tone')) {
      lastBadge = badgeText;
      badge.textContent = badgeText;
      badge.setAttribute('data-tone', tone);
      badge.hidden = count === 0;
    }
    var liveText = count
      ? label + ': ' + count + (count === 1 ? ' alert' : ' alerts') + '. Highest priority: ' + badgeState.label + '.'
      : label + ': no alerts.';
    if (live && liveText !== lastLiveLabel) {
      live.textContent = liveText;
      lastLiveLabel = liveText;
    }
  }

  function installationText(installation) {
    if (!installation) return 'Installation status unavailable.';
    if (installation.installed) return 'This app is already installed. No install suggestion is needed.';
    if (installation.support === 'none') return 'Installation is unavailable for this project or browser.';
    if (installation.support === 'manual-ios') return 'iPhone/iPad: open Share in Safari, then choose Add to Home Screen.';
    if (installation.support === 'native') return 'This browser offers a native install prompt. Use the install action below.';
    return 'Desktop/mobile: open your browser menu and choose Install app, or Add to Home Screen.';
  }

  function networkText(state) {
    var network = state.network || {};
    var endpoints = network.endpoints || {};
    var dns = network.dns || {};
    return {
      online: network.online === false ? 'Offline' : 'Online',
      primary: endpoints.primary || 'unknown',
      backup: endpoints.backup || 'inactive',
      dns: dns.classification ? String(dns.classification).replace(/_/g, ' ') : 'not checked',
    };
  }

  function renderNotice(notice) {
    var article = el('article', 'youge-notice');
    article.setAttribute('data-priority', String(notice.priority));
    article.setAttribute('data-tone', notice.tone || 'info');
    article.appendChild(icon(notice.priority === 1 ? 'recovery' : notice.priority === 4 ? 'install' : 'info'));
    var content = el('div', 'youge-notice-content');
    content.appendChild(el('h4', 'youge-notice-title', notice.title));
    content.appendChild(el('p', 'youge-notice-message', notice.message));
    var controls = el('div', 'youge-notice-controls');
    if (notice.actionId) {
      var action = button('Open', 'custom', 'youge-btn youge-btn-small');
      action.setAttribute('data-action', notice.actionId);
      controls.appendChild(action);
    }
    if (notice.critical) {
      var ack = button('Acknowledge', 'recovery', 'youge-btn youge-btn-quiet youge-btn-small');
      ack.setAttribute('data-acknowledge', notice.id);
      controls.appendChild(ack);
    } else if (notice.dismissible !== false) {
      var dismiss = button('Dismiss', 'close', 'youge-btn youge-btn-quiet youge-btn-small');
      dismiss.setAttribute('data-dismiss', notice.id);
      controls.appendChild(dismiss);
    }
    content.appendChild(controls);
    article.appendChild(content);
    return article;
  }

  function renderPanel(state) {
    if (!panelBody || !state) return;
    var active = doc.activeElement;
    var focusKey = active && active.getAttribute
      ? (active.getAttribute('data-action') || active.getAttribute('data-dismiss') ||
         active.getAttribute('data-acknowledge') || (active === closeButton ? 'close' : ''))
      : '';
    while (panelBody.firstChild) panelBody.removeChild(panelBody.firstChild);

    // Identity / branding
    var identity = el('div', 'youge-identity');
    var brandIcon = doc.createElement('img');
    brandIcon.className = 'youge-brand-image';
    brandIcon.src = state.project.icon || 'icons/icon-192.png';
    brandIcon.alt = '';
    brandIcon.width = 36;
    brandIcon.height = 36;
    identity.appendChild(brandIcon);
    var identityText = el('div', 'youge-identity-text');
    identityText.appendChild(el('strong', '', state.project.name || 'You.Ge Assistant'));
    identityText.appendChild(el('span', '', (state.project.shortName || 'You.Ge') + ' · ' + (state.project.hostname || 'localhost')));
    identity.appendChild(identityText);
    panelBody.appendChild(identity);

    // Connection status
    var status = section('Connection status', 'Live conditions reported by this project.');
    var statusGrid = el('div', 'youge-status-grid');
    var net = networkText(state);
    statusGrid.appendChild(statusRow('Network', net.online, state.network.online === false ? 'critical' : 'ok'));
    statusGrid.appendChild(statusRow('Primary API', net.primary, /failed|unavailable|degraded/.test(net.primary) ? 'critical' : 'ok'));
    statusGrid.appendChild(statusRow('Backup', net.backup, net.backup === 'active' ? 'backup' : 'neutral'));
    statusGrid.appendChild(statusRow('DNS', net.dns, /failure|missing|interference/.test(net.dns) ? 'critical' : 'neutral'));
    status.appendChild(statusGrid);
    panelBody.appendChild(status);

    // Prioritized notifications
    var notices = section('What needs attention', state.notifications.length
      ? 'Ordered by priority. Critical recovery stays visible until resolved or acknowledged.'
      : 'No current alerts. The Assistant remains available for help and diagnostics.');
    if (state.notifications.length) {
      var list = el('div', 'youge-notice-list');
      state.notifications.forEach(function (notice) { list.appendChild(renderNotice(notice)); });
      notices.appendChild(list);
    } else {
      notices.appendChild(el('p', 'youge-empty', 'All clear — nothing needs your attention right now.'));
    }
    panelBody.appendChild(notices);

    // Installation assistance
    var install = section('Installation', installationText(state.installation));
    if (state.installation && state.installation.status === 'available') {
      var installAction = button(state.installation.nativeAvailable ? 'Install this app' : 'Installation instructions', 'install');
      installAction.setAttribute('data-action', 'install');
      installAction.setAttribute('data-pwa-install', '');
      install.appendChild(installAction);
    }
    panelBody.appendChild(install);

    // Network diagnostics + recovery assistance
    var diagnostics = section('Diagnostics & recovery', 'Checks run only when you choose; no background probing.');
    var diagnosticsRow = el('div', 'youge-action-row');
    var diagnosticsButton = button('Run network diagnostics', 'diagnostics');
    diagnosticsButton.setAttribute('data-action', 'diagnostics');
    diagnosticsButton.setAttribute('data-pwa-diagnostics', '');
    diagnosticsRow.appendChild(diagnosticsButton);
    diagnostics.appendChild(diagnosticsRow);
    var recovery = el('details', 'youge-recovery');
    recovery.appendChild(el('summary', '', 'Recovery guidance'));
    var steps = el('ol', 'youge-steps');
    ['Confirm device connectivity and retry diagnostics.',
      'If a backup endpoint is configured, let the project switch to it.',
      'If DNS results disagree, check DNS propagation before changing provider settings.',
      'Contact the project support channel if the primary API stays unavailable.'].forEach(function (step) {
      steps.appendChild(el('li', '', step));
    });
    recovery.appendChild(steps);
    diagnostics.appendChild(recovery);
    panelBody.appendChild(diagnostics);

    // App-specific help / available actions
    var actions = section('Available actions', 'Project-specific actions are published through the centralized state.');
    if (state.availableActions.length) {
      var actionList = el('div', 'youge-action-list');
      state.availableActions.forEach(function (action) {
        var node = button(action.label, action.icon || 'custom');
        node.setAttribute('data-action', action.id);
        node.setAttribute('data-kind', action.kind || 'custom');
        if (action.message) node.title = action.message;
        actionList.appendChild(node);
      });
      actions.appendChild(actionList);
    } else {
      actions.appendChild(el('p', 'youge-empty', 'No extra actions are configured for this project.'));
    }
    panelBody.appendChild(actions);

    if (focusKey) {
      var target = focusKey === 'close' ? closeButton : panelBody.querySelector(
        '[data-action="' + focusKey + '"], [data-dismiss="' + focusKey + '"], [data-acknowledge="' + focusKey + '"]');
      if (target && typeof target.focus === 'function') target.focus();
    }
  }

  function reducedMotion() {
    try {
      return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (error) { return false; }
  }

  function openPanel() {
    if (isOpen || !panel) return;
    isOpen = true;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    renderPanel(api.getState());
    var reveal = function () { panel.classList.add('is-open'); };
    if (root.requestAnimationFrame) root.requestAnimationFrame(reveal);
    else reveal();
    if (closeButton && typeof closeButton.focus === 'function') closeButton.focus();
  }

  function closePanel() {
    if (!isOpen || !panel) return;
    isOpen = false;
    fab.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    var hide = function () { if (!isOpen) panel.hidden = true; };
    if (reducedMotion()) hide();
    else closeTimer = setTimeout(hide, 180);
    if (fab && typeof fab.focus === 'function') fab.focus();
  }

  function dispatchAction(id, kind) {
    if (!doc.dispatchEvent || !root.CustomEvent) return;
    try {
      doc.dispatchEvent(new root.CustomEvent('youge:action', {
        detail: { id: id, kind: kind || 'custom', source: 'widget' },
      }));
    } catch (error) { /* ignore */ }
  }

  function handleAction(id, kind) {
    dispatchAction(id, kind);
    if (id === 'diagnostics' && (!root.PWA || typeof root.PWA.showNetworkDiagnostics !== 'function')) {
      api.runDiagnostics();
    }
    if (id === 'update' && root.PWA && typeof root.PWA.applyUpdate === 'function') {
      try { root.PWA.applyUpdate(); } catch (error) { /* ignore */ }
    }
    // `install` is handled by pwa.js through [data-pwa-install]; calling
    // promptInstall() here as well would request the same native prompt twice.
  }

  function onClick(event) {
    var target = event.target && event.target.closest
      ? event.target.closest('[data-action], [data-dismiss], [data-acknowledge], [data-role="close"], [data-role="toggle"]')
      : null;
    if (!target || !mount || !mount.contains(target)) return;
    if (target.getAttribute('data-role') === 'close') { closePanel(); return; }
    if (target.getAttribute('data-role') === 'toggle') { isOpen ? closePanel() : openPanel(); return; }
    var dismiss = target.getAttribute('data-dismiss');
    if (dismiss) { api.dismiss(dismiss); return; }
    var acknowledge = target.getAttribute('data-acknowledge');
    if (acknowledge) { api.acknowledge(acknowledge); return; }
    var action = target.getAttribute('data-action');
    if (action) handleAction(action, target.getAttribute('data-kind'));
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && isOpen) closePanel();
  }

  function onState(state) {
    applyAppearance(state);
    updateFab(state);
    if (isOpen) renderPanel(state);
  }

  function build() {
    if (doc.getElementById(ROOT_ID)) return doc.getElementById(ROOT_ID);
    var node = doc.createElement('div');
    node.id = ROOT_ID;
    node.className = 'youge-assistant-widget';
    node.setAttribute('data-youge-widget', '');
    node.setAttribute('data-position', 'bottom-right');

    fab = el('button', 'youge-fab');
    fab.type = 'button';
    fab.setAttribute('data-role', 'toggle');
    fab.setAttribute('aria-expanded', 'false');
    fab.setAttribute('aria-controls', PANEL_ID);
    fab.setAttribute('aria-label', 'You.Ge Assistant, no alerts');
    fab.appendChild(icon('assistant'));
    badge = el('span', 'youge-badge');
    badge.setAttribute('aria-hidden', 'true');
    badge.hidden = true;
    fab.appendChild(badge);
    node.appendChild(fab);

    live = el('span', 'youge-sr-only');
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    node.appendChild(live);

    panel = el('section', 'youge-panel');
    panel.id = PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'youge-assistant-title');
    var header = el('header', 'youge-panel-header');
    header.appendChild(el('h2', 'youge-panel-title', 'You.Ge Assistant')).id = 'youge-assistant-title';
    closeButton = el('button', 'youge-close');
    closeButton.type = 'button';
    closeButton.setAttribute('data-role', 'close');
    closeButton.setAttribute('aria-label', 'Close assistant panel');
    closeButton.appendChild(icon('close'));
    header.appendChild(closeButton);
    panel.appendChild(header);
    panelBody = el('div', 'youge-panel-body');
    panel.appendChild(panelBody);
    node.appendChild(panel);
    return node;
  }

  function mountWidget() {
    if (mount || !doc.body) return;
    mount = build();
    doc.body.appendChild(mount);
    mount.addEventListener('click', onClick);
    doc.addEventListener('keydown', onKeydown);
    unsubscribe = api.subscribe(onState);
  }

  function destroy() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (mount) {
      mount.removeEventListener('click', onClick);
      if (mount.parentNode) mount.parentNode.removeChild(mount);
    }
    doc.removeEventListener('keydown', onKeydown);
    mount = null;
    isOpen = false;
    root.YouGeAssistantWidget.__mounted = false;
  }

  root.YouGeAssistantWidget = {
    __mounted: true,
    open: openPanel,
    close: closePanel,
    destroy: destroy,
    getRoot: function () { return mount; },
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mountWidget, { once: true });
  else mountWidget();
})(typeof globalThis !== 'undefined' ? globalThis : this);
