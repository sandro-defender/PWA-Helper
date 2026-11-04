import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ElectricLogo from './ElectricLogo.jsx';
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

function AssistantFloatingWidget() {
  const [open, setOpen] = useState(false);
  const widgetRef = useRef(null);
  const toggleRef = useRef(null);

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
    <div className="assistant-widget" ref={widgetRef}>
      <section
        className="assistant-panel"
        id="assistant-panel"
        role="dialog"
        aria-label="You.Ge Assistant quick actions"
        aria-describedby="assistant-panel-description"
        hidden={!open}
      >
        <header className="assistant-panel-header">
          <span className="assistant-panel-mark" aria-hidden="true">✦</span>
          <span className="assistant-panel-title">You.Ge Assistant</span>
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
          Quick help for this sample workspace.
        </p>
        <button
          className="assistant-panel-action"
          type="button"
          data-pwa-diagnostics
          onClick={() => closePanel(true)}
        >
          <span aria-hidden="true">⌁</span>
          <span><strong>Network help</strong><small>Check this connection</small></span>
          <span className="assistant-action-arrow" aria-hidden="true">→</span>
        </button>
        <button
          className="assistant-panel-action"
          type="button"
          data-pwa-install
          onClick={() => closePanel(true)}
        >
          <span aria-hidden="true">＋</span>
          <span><strong>Install Staff Space</strong><small>Add it to your home screen</small></span>
          <span className="assistant-action-arrow" aria-hidden="true">→</span>
        </button>
        <a className="assistant-panel-link" href="#today" onClick={closePanel}>
          Go to today’s workspace <span aria-hidden="true">↗</span>
        </a>
      </section>

      <button
        className="assistant-fab"
        ref={toggleRef}
        type="button"
        aria-label={open ? 'Close You.Ge Assistant menu' : 'Open You.Ge Assistant menu'}
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
        <span className="visually-hidden">{open ? 'Close assistant' : 'Open assistant'}</span>
      </button>
    </div>
  );
}

const mount = document.getElementById('assistant-floating-root');
if (mount) createRoot(mount).render(<AssistantFloatingWidget />);
