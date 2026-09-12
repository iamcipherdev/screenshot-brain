// ─── Error boundary: never show a raw exception to the user ───────────────

import React from 'react';
import { Icon } from './Icon';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ScreenshotBrain] crashed:', err);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="crashscreen">
        <div className="lock-mark"><Icon name="alert" size={30} strokeWidth={1.5} /></div>
        <b>Something went wrong</b>
        <p>The app hit an unexpected error. Your data is safe — reloading usually fixes it.</p>
        <code className="crash-msg">{this.state.message.slice(0, 160)}</code>
        <button className="btn btn-primary btn-big" onClick={() => window.location.reload()}>
          <Icon name="refresh" size={17} /> Reload app
        </button>
        <div className="made-line">made by <b>CIPHER</b></div>
      </div>
    );
  }
}
