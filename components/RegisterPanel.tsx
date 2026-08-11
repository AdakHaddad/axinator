'use client';

import type { RegisterEntry, RegisterMode } from '../lib/types';
import { formatAddress, calcAddrWidth, countPhysicalRegs } from '../lib/registerMap';

interface RegisterPanelProps {
  registers: RegisterEntry[];
  onUpdate: (index: number, updates: Partial<RegisterEntry>) => void;
}

export default function RegisterPanel({ registers, onUpdate }: RegisterPanelProps) {
  const addrWidth = calcAddrWidth(countPhysicalRegs(registers));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="panel-title-dot" style={{ background: 'var(--purple)', boxShadow: '0 0 6px var(--purple)' }} />
          <span>Register Map</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="tooltip" data-tip="Auto-calculated C_S_AXI_ADDR_WIDTH" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ADDR_WIDTH <span style={{ color: 'var(--accent)' }}>{addrWidth}</span>
          </div>
          <span className="badge badge-axi">{registers.length}</span>
        </div>
      </div>

      {/* Table area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {registers.length === 0 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}>
            No AXI registers mapped
          </div>
        ) : (
          <table className="eda-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Addr</th>
                <th>Register Name</th>
                <th>Mapped Port</th>
                <th>Slice</th>
                <th style={{ width: '60px' }}>Mode</th>
              </tr>
            </thead>
            <tbody>
              {registers.map((reg, idx) => (
                <tr key={idx} className="animate-fade-in">
                  <td>
                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--amber)', fontSize: '11px' }}>
                      {formatAddress(reg.address)}
                    </span>
                  </td>
                  <td>
                    <input
                      className="input"
                      style={{
                        width: '100%',
                        padding: '2px 6px',
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-code)',
                      }}
                      value={reg.regName}
                      onChange={(e) => onUpdate(idx, { regName: e.target.value })}
                    />
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>
                      {reg.mappedPort}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)', fontSize: '11px' }}>
                      {reg.width < 32 ? `[${reg.msb}:${reg.lsb}]` : '32-bit'}
                      {reg.packed && (
                        <span
                          title="Packed: shares a 32-bit register word with the port below"
                          style={{ marginLeft: '4px', color: 'var(--amber)', fontSize: '9px', fontWeight: 700 }}
                        >PKD</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <select
                      className="select"
                      style={{ width: '100%', padding: '2px 4px' }}
                      value={reg.mode}
                      onChange={(e) => onUpdate(idx, { mode: e.target.value as RegisterMode })}
                    >
                      <option value="RW">RW</option>
                      <option value="RO">RO</option>
                      <option value="WO">WO</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
