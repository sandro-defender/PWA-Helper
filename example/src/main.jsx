import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { YouGeAssistant } from '@you-ge/assistant-sdk';
import {
  FALLBACK_ASSISTANT_STATE,
  dispatchAssistantAction,
  getExternalStoreBindings,
} from '@you-ge/assistant-sdk/react';
import ElectricLogo from './ElectricLogo.jsx';
import FoundationPreview from './FoundationPreview.tsx';
import GlareHover from './react-bits/GlareHover';
import LatticeLoader from './react-bits/LatticeLoader';
import SpotlightCard from './react-bits/SpotlightCard';
import assistantMark from './assistant-mark.png';
import './ElectricLogo.css';

class LogoBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* The React example consumes the extracted @you-ge/assistant-sdk and shares
 * the exact same singleton state as classic browser scripts (assistant-state.js)
 * and the dependency-free DOM renderer (assistant-widget.js). */
const fallbackState = {
  ...FALLBACK_ASSISTANT_STATE,
  project: {
    ...FALLBACK_ASSISTANT_STATE.project,
    id: 'example',
    name: 'Staff Space',
    shortName: 'Staff Space',
    hostname: window.location.hostname,
    themeColor: '#17634f',
  },
  network: {
    ...FALLBACK_ASSISTANT_STATE.network,
    online: navigator.onLine !== false,
  },
  appearance: {
    ...FALLBACK_ASSISTANT_STATE.appearance,
    offsets: { x: 16, y: 16 },
    theme: 'light',
    themeColor: '#17634f',
  },
};

const assistantStore = getExternalStoreBindings(
  () => YouGeAssistant.attach(),
  null,
  fallbackState
);

function dispatchWidgetAction(id, kind) {
  dispatchAssistantAction(id, kind, {
    assistant: YouGeAssistant.attach(),
    source: 'react-widget',
  });
}

function AssistantFloatingWidget() {
  const state = useSyncExternalStore(
    assistantStore.subscribe,
    assistantStore.getSnapshot,
    assistantStore.getServerSnapshot
  );
  const [open, setOpen] = useState(false);
  const widgetRef = useRef(null);
  const toggleRef = useRef(null);
  const badge = state.badge || fallbackState.badge;
  const notifications = state.notifications || [];
  const network = state.network || fallbackState.network;
  const installation = state.installation || fallbackState.installation;
  const project = state.project || fallbackState.project;
  const extraActions = (state.availableActions || []).filter(
    (action) => action.id !== 'diagnostics' && action.id !== 'install'
  );

  useEffect(() => {
    if (!open) return undefined;

    function closeOnEscape(event) {
      if (event.key === 'Escape') closePanel(true);
    }
    function closeOnOutsidePointer(event) {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) setOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  function closePanel(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus && toggleRef.current) toggleRef.current.focus({ preventScroll: true });
  }

  return (
    <div className="assistant-widget" ref={widgetRef} data-position={state.appearance?.position || 'bottom-right'}>
      <section
        className={`assistant-panel${open ? ' is-open' : ''}`}
        id="assistant-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="assistant-panel-title"
        aria-describedby="assistant-panel-description"
        hidden={!open}
      >
        <header className="assistant-panel-header">
          <img className="assistant-panel-brand" src={project.icon || 'icons/icon-192.png'} alt="" width="32" height="32" />
          <h2 className="assistant-panel-title" id="assistant-panel-title">{project.name}</h2>
          <button
            className="assistant-panel-close"
            type="button"
            aria-label="Close assistant menu"
            onClick={() => closePanel(true)}
          >
            ×
          </button>
        </header>
        <p className="assistant-panel-description" id="assistant-panel-description">
          {(project.shortName || 'You.Ge')} · {(project.hostname || 'localhost')} — prioritized help for this workspace.
        </p>

        <SpotlightCard
          className="assistant-status-card"
          theme="light"
          spotlightColor="#17634f"
          spotlightSize={180}
          intensity={0.1}
          borderGlow={0.2}
          proximity={48}
          smoothing={0.3}
          softness={0.7}
          shape="circle"
          ambient={false}
          flare={false}
          grain={0}
        >
          <div className="assistant-status-grid" role="group" aria-label="Connection status">
            <span><i className={`connection-dot${network.online === false ? ' is-offline' : ''}`} aria-hidden="true" />{network.online === false ? 'Offline' : 'Online'}</span>
            <span>Primary: {network.endpoints?.primary || 'unknown'}</span>
            <span>Backup: {network.endpoints?.backup || 'inactive'}</span>
            <span>DNS: {(network.dns?.classification || 'not checked').replace(/_/g, ' ')}</span>
          </div>
          {network.dns?.status === 'running' ? (
            <LatticeLoader
              label="Checking connection"
              status="working"
              showTimer={false}
              fontSize={11}
              color="#17634f"
              className="assistant-loader"
            />
          ) : null}
        </SpotlightCard>

        <div className="assistant-notice-block" aria-live="polite">
          {notifications.length ? (
            <ul className="assistant-notice-list">
              {notifications.map((notice) => (
                <li className={`assistant-notice priority-${notice.priority}`} key={notice.id} data-tone={notice.tone}>
                  <div className="assistant-notice-copy">
                    <strong>{notice.title}</strong>
                    <p>{notice.message}</p>
                  </div>
                  <div className="assistant-notice-controls">
                    <button type="button" onClick={() => dispatchWidgetAction(notice.actionId || notice.id, 'notice')}>Open</button>
                    {notice.critical ? (
                      <button type="button" onClick={() => YouGeAssistant.attach().acknowledge(notice.id)}>Acknowledge</button>
                    ) : (
                      <button type="button" onClick={() => YouGeAssistant.attach().dismiss(notice.id)}>Dismiss</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="assistant-panel-empty" role="status">All clear — the Assistant is still available for help.</p>
          )}
        </div>

        <button
          className="assistant-panel-action"
          type="button"
          data-pwa-diagnostics
          onClick={() => { dispatchWidgetAction('diagnostics', 'diagnostics'); closePanel(true); }}
        >
          <span aria-hidden="true">⌁</span>
          <span><strong>Network diagnostics</strong><small>Check this connection on demand</small></span>
          <span className="assistant-action-arrow" aria-hidden="true">→</span>
        </button>
        {installation.status === 'available' ? (
          <button
            className="assistant-panel-action"
            type="button"
            data-pwa-install
            onClick={() => { dispatchWidgetAction('install', 'install'); closePanel(true); }}
          >
            <span aria-hidden="true">＋</span>
            <span><strong>{installation.nativeAvailable ? 'Install this app' : 'Installation instructions'}</strong><small>Add it to your home screen</small></span>
            <span className="assistant-action-arrow" aria-hidden="true">→</span>
          </button>
        ) : null}
        {extraActions.map((action) => (
          <button
            className="assistant-panel-action"
            type="button"
            key={action.id}
            onClick={() => { dispatchWidgetAction(action.id, action.kind); if (action.id !== 'update') closePanel(true); }}
          >
            <span aria-hidden="true">↗</span>
            <span><strong>{action.label}</strong><small>{action.message || 'Project-specific action'}</small></span>
            <span className="assistant-action-arrow" aria-hidden="true">→</span>
          </button>
        ))}
        <a className="assistant-panel-link" href="#today" onClick={() => closePanel(false)}>
          Go to today’s workspace <span aria-hidden="true">↗</span>
        </a>
      </section>

      <span className="visually-hidden" role="status" aria-live="polite">
        {badge.count ? `${badge.count} alerts. Highest priority: ${badge.label}.` : 'No alerts.'}
      </span>

      <GlareHover
        className="assistant-fab-glare"
        width="66px"
        height="66px"
        background="transparent"
        borderRadius="50%"
        borderColor="transparent"
        glareColor="#ffffff"
        glareOpacity={0.18}
        glareSize={22}
        mode="hover"
        playOnce
      >
        <button
          className="assistant-fab"
          ref={toggleRef}
          type="button"
          aria-label={open ? 'Close You.Ge Assistant menu' : `Open You.Ge Assistant menu${badge.count ? `, ${badge.count} alerts, ${badge.label}` : ', no alerts'}`}
          aria-controls="assistant-panel"
          aria-expanded={open}
          aria-haspopup="dialog"
          title="You.Ge Assistant"
          onClick={() => setOpen((wasOpen) => !wasOpen)}
        >
          <span className="assistant-fab-stage" aria-hidden="true">
            <LogoBoundary>
              <ElectricLogo
                src={assistantMark}
                color="#f4dcff"
                glowColor="#ad6dff"
                scale={0.7}
                intensity={0.95}
                glow={0.7}
                fill={0.18}
                strands={4}
                bend={0.6}
                crackle={1.5}
                arcs={1}
                speed={2.5}
                interactive
                cursorIntensity={0.75}
                cursorRadius={70}
                theme="dark"
                className="assistant-electric-logo"
              />
            </LogoBoundary>
            <img className="assistant-mark-image" src={assistantMark} alt="" />
          </span>
          {badge.count > 0 ? (
            <span className="assistant-badge" data-tone={badge.tone} aria-hidden="true">
              {badge.count > 9 ? '9+' : badge.count}
            </span>
          ) : null}
          <span className="visually-hidden">{open ? 'Close assistant' : 'Open assistant'}</span>
        </button>
      </GlareHover>
    </div>
  );
}

const mount = document.getElementById('assistant-floating-root');
if (mount) createRoot(mount).render(<AssistantFloatingWidget />);

const foundationMount = document.getElementById('assistant-foundation-root');
if (foundationMount) createRoot(foundationMount).render(<FoundationPreview />);
