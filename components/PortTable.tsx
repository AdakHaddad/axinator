'use client';

import { PortType } from '../lib/types';
import type { HeuristicConfidence } from '../lib/types';
import { portTypeLabel, portTypeColor, confidenceTooltip } from '../lib/heuristics';
import type { PortConfig } from '../lib/types';

const ALL_PORT_TYPES: PortType[] = [
  PortType.CLOCK,
  PortType.RESET,
  PortType.AXI_REGISTER,
  PortType.EXTERNAL_INPUT,
  PortType.EXTERNAL_OUTPUT,
  PortType.EXTERNAL_INOUT,
  PortType.IGNORE,
];

interface PortTableProps {
  portConfigs: PortConfig[];
  onUpdate: (index: number, type: PortType) => void;
}

function directionIcon(dir: string) {
  if (dir === 'input')  return <span style={{ color: 'var(--accent)',  fontSize: '10px', fontWeight: 700 }}>→</span>;
  if (dir === 'output') return <span style={{ color: 'var(--green)',  fontSize: '10px', fontWeight: 700 }}>←</span>;
  return <span style={{ color: 'var(--teal)', fontSize: '10px', fontWeight: 700 }}>⇄</span>;
}

/**
 * Small coloured dot with a tooltip explaining the heuristic confidence.
 * HIGH   = green   — reliable
 * MEDIUM = amber   — reasonable guess
 * LOW    = red     — fell through to default, user should review
 * undefined = grey — user has manually set this port type
 */
function ConfidenceDot({ confidence }: { confidence?: HeuristicConfidence }) {
  const color =
    confidence === 'HIGH'   ? 'var(--green)'  :
    confidence === 'MEDIUM' ? 'var(--amber)'  :
    confidence === 'LOW'    ? '#f85149'        :
    'var(--text-muted)';

  const label =
    confidence === 'HIGH'   ? 'H' :
    confidence === 'MEDIUM' ? 'M' :
    confidence === 'LOW'    ? 'L' :
    '—';

  const tip = confidence ? confidenceTooltip(confidence) : 'Manually set by user.';

  return (
    <span
      title={tip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: color,
        color: '#0d1117',
        fontSize: '9px',
        fontWeight: 800,
        cursor: 'help',
        flexShrink: 0,
        opacity: confidence ? 1 : 0.45,
      }}
    >
      {label}
    </span>
  );
}

export default function PortTable({ portConfigs, onUpdate }: PortTableProps) {
  if (portConfigs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="panel-title-dot" style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
            <span>Port Configuration</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0 ports</span>
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--text-muted)',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          <p style={{ fontSize: '12px', textAlign: 'center', maxWidth: '200px', lineHeight: '1.6' }}>
            Parse a Verilog module to configure ports and assign AXI register mappings.
          </p>
        </div>
      </div>
    );
  }

  const axiCount = portConfigs.filter(pc => pc.portType === PortType.AXI_REGISTER).length;
  const extCount = portConfigs.filter(pc =>
    pc.portType === PortType.EXTERNAL_INPUT ||
    pc.portType === PortType.EXTERNAL_OUTPUT ||
    pc.portType === PortType.EXTERNAL_INOUT
  ).length;
  const lowCount = portConfigs.filter(pc => pc.confidence === 'LOW').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="panel-title-dot" style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
          <span>Port Configuration</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge badge-axi">{axiCount} REG</span>
          <span className="badge badge-ext-in" style={{ background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(63,185,80,0.3)' }}>{extCount} EXT</span>
          {lowCount > 0 && (
            <span
              title={`${lowCount} port${lowCount > 1 ? 's' : ''} have LOW confidence — please review them.`}
              className="badge"
              style={{ background: 'rgba(248,81,73,0.15)', color: '#f85149', border: '1px solid rgba(248,81,73,0.35)', cursor: 'help' }}
            >
              ⚠ {lowCount} LOW
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{portConfigs.length} ports</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="eda-table">
          <thead>
            <tr>
              <th>Port</th>
              <th>Dir</th>
              <th>Width</th>
              <th>Sgn</th>
              <th style={{ width: '28px', textAlign: 'center' }} title="Heuristic classification confidence: H=High, M=Medium, L=Low">Conf</th>
              <th style={{ minWidth: '140px' }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {portConfigs.map((pc, idx) => (
              <tr key={pc.port.name} className="animate-fade-in">
                <td>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}>
                    {pc.port.name}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {directionIcon(pc.port.direction)}
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {pc.port.direction}
                    </span>
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>
                    {pc.port.width === 1
                      ? '1'
                      : `[${pc.port.msb}:${pc.port.lsb}]`
                    }
                  </span>
                </td>
                <td>
                  {pc.port.signed ? (
                    <span className="badge" style={{
                      background: 'rgba(0,212,255,0.08)',
                      color: 'var(--accent)',
                      border: '1px solid rgba(0,212,255,0.2)',
                      fontSize: '9px',
                      padding: '1px 5px',
                    }}>S</span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>U</span>
                  )}
                </td>
                {/* Confidence dot — shows heuristic reliability */}
                <td style={{ textAlign: 'center' }}>
                  <ConfidenceDot confidence={pc.confidence} />
                </td>
                <td>
                  <select
                    id={`port-type-${pc.port.name}`}
                    className="select"
                    style={{ width: '100%' }}
                    value={pc.portType}
                    onChange={(e) => {
                      // Clear confidence when user manually overrides the type
                      onUpdate(idx, e.target.value as PortType);
                    }}
                  >
                    {ALL_PORT_TYPES.map(pt => (
                      <option key={pt} value={pt}>{portTypeLabel(pt)}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        padding: '6px 12px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {ALL_PORT_TYPES.filter(pt => pt !== PortType.IGNORE).map(pt => (
          <span key={pt} className={`badge ${portTypeColor(pt)}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
            {portTypeLabel(pt)}
          </span>
        ))}
        <span style={{ marginLeft: '6px', borderLeft: '1px solid var(--border)', paddingLeft: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <ConfidenceDot confidence="HIGH" />
          <ConfidenceDot confidence="MEDIUM" />
          <ConfidenceDot confidence="LOW" />
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>confidence</span>
        </span>
      </div>
    </div>
  );
}
