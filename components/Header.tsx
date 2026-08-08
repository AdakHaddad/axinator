'use client';

interface HeaderProps {
  ipName: string;
  onIpNameChange: (name: string) => void;
  onGenerate: () => void;
  onDownload: () => void;
  canGenerate: boolean;
  canDownload: boolean;
  isGenerating: boolean;
}

export default function Header({
  ipName,
  onIpNameChange,
  onGenerate,
  onDownload,
  canGenerate,
  canDownload,
  isGenerating,
}: HeaderProps) {
  return (
    <header
      style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 16px',
        height: '48px',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="1" y="1" width="20" height="20" rx="4" stroke="var(--accent)" strokeWidth="1.5"/>
          <path d="M4 11h4l2-5 2 10 2-5 2 0" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="17" cy="11" r="1.5" fill="var(--amber)"/>
        </svg>
        <span style={{
          fontSize: '14px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}>
          Axinator
        </span>
        <span style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          paddingLeft: '8px',
          borderLeft: '1px solid var(--border)',
          marginLeft: '4px',
        }}>
          Verilog → AXI4-Lite IP Generator
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* IP Name input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          IP Name
        </label>
        <input
          id="ip-name-input"
          className="input"
          style={{ width: '180px' }}
          value={ipName}
          onChange={(e) => onIpNameChange(e.target.value)}
          placeholder="my_ip_axi"
          spellCheck={false}
        />
      </div>

      {/* Actions */}
      <button
        id="btn-generate"
        className="btn btn-primary"
        disabled={!canGenerate || isGenerating}
        onClick={onGenerate}
        title="Generate AXI wrapper files"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 1 1 0 11A5.5 5.5 0 0 1 8 2.5zM6.5 5.5l4 2.5-4 2.5V5.5z"/>
        </svg>
        {isGenerating ? 'Generating…' : 'Generate'}
      </button>

      <button
        id="btn-download"
        className="btn btn-amber"
        disabled={!canDownload}
        onClick={onDownload}
        title="Download ZIP package"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
          <path d="M7.47 10.78l-3.5-3.5a.75.75 0 0 1 1.06-1.06L7 8.19V2.75a.75.75 0 0 1 1.5 0v5.44l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0z"/>
          <path d="M3.75 13a.75.75 0 0 1 0-1.5h8.5a.75.75 0 0 1 0 1.5h-8.5z"/>
        </svg>
        Download ZIP
      </button>

      {/* Vivado badge */}
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: '3px',
        background: 'var(--purple-dim, rgba(163,113,247,0.15))',
        color: 'var(--purple, #a371f7)',
        border: '1px solid rgba(163,113,247,0.3)',
        letterSpacing: '0.06em',
        flexShrink: 0,
      }}>
        VIVADO AXI4-LITE
      </div>
    </header>
  );
}
