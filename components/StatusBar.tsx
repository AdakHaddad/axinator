'use client';

interface StatusBarProps {
  message: string;
  type: 'ok' | 'error' | 'warn' | 'info';
  parseErrors: number;
}

export default function StatusBar({ message, type, parseErrors }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
        {type === 'ok' && <span className="status-ok">●</span>}
        {type === 'error' && <span className="status-error">●</span>}
        {type === 'warn' && <span className="status-warn">●</span>}
        {type === 'info' && <span className="status-info">●</span>}
        <span style={{ color: type === 'error' ? 'var(--red)' : 'var(--text-secondary)' }}>
          {message}
        </span>
      </div>

      {parseErrors > 0 && (
        <div style={{ color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z"/>
            <path d="M7.25 4.5a.75.75 0 0 1 1.5 0v3.25a.75.75 0 0 1-1.5 0V4.5zM8 11.25a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
          </svg>
          {parseErrors} parser warning{parseErrors !== 1 ? 's' : ''}
        </div>
      )}

      <div style={{ color: 'var(--text-muted)' }}>
        Axinator Generator Engine v1.0
      </div>
    </footer>
  );
}
