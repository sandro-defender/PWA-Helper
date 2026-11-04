import React, { useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import ElectricLogo from './ElectricLogo.jsx';
import './ElectricLogo.css';

const assistantLogo = new URL('../../icons/icon-192.png', import.meta.url).href;

class LogoBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    if (this.props.onError) this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function AnimatedAssistantMark() {
  const fallbackRef = useRef(null);
  const markCovered = useCallback(() => {
    if (fallbackRef.current) fallbackRef.current.classList.add('is-covered');
  }, []);
  const showFallback = useCallback(() => {
    if (fallbackRef.current) fallbackRef.current.classList.remove('is-covered');
  }, []);

  return (
    <span className="brand-electric-stage" aria-hidden="true">
      <img className="brand-emblem-fallback" ref={fallbackRef} src={assistantLogo} alt="" />
      <LogoBoundary onError={showFallback}>
        <ElectricLogo
          src={assistantLogo}
          color="#f4dcff"
          glowColor="#ad6dff"
          scale={0.74}
          intensity={1.1}
          glow={1.15}
          strands={4}
          bend={0.6}
          crackle={1.5}
          arcs={1}
          speed={2.2}
          interactive
          cursorIntensity={0.7}
          cursorRadius={90}
          theme="dark"
          onRender={markCovered}
          className="brand-electric-logo"
        />
      </LogoBoundary>
    </span>
  );
}

const mount = document.getElementById('assistant-electric-logo');
if (mount) createRoot(mount).render(<AnimatedAssistantMark />);
