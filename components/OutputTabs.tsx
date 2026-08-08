'use client';

import { useState } from 'react';
import CodeViewer from './CodeViewer';
import type { GeneratedFiles } from '../lib/types';

interface OutputTabsProps {
  files: GeneratedFiles | null;
}

type TabId = 'top' | 'slave' | 'orig' | 'regmap' | 'xml' | 'readme';

export default function OutputTabs({ files }: OutputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('top');

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'top',    label: 'Top Wrapper', icon: 'v' },
    { id: 'slave',  label: 'AXI Slave',   icon: 'v' },
    { id: 'orig',   label: 'Original HDL',icon: 'v' },
    { id: 'regmap', label: 'Register Map',icon: 'md' },
    { id: 'xml',    label: 'component.xml',icon: 'xml' },
    { id: 'readme', label: 'README',      icon: 'md' },
  ];

  let currentContent = '';
  let currentLang: 'verilog' | 'markdown' | 'xml' = 'verilog';

  if (files) {
    switch (activeTab) {
      case 'top':    currentContent = files.topWrapper; currentLang = 'verilog'; break;
      case 'slave':  currentContent = files.axiSlave; currentLang = 'verilog'; break;
      case 'orig':   currentContent = files.originalHdl; currentLang = 'verilog'; break;
      case 'regmap': currentContent = files.registerMapMd; currentLang = 'markdown'; break;
      case 'xml':    currentContent = files.componentXml; currentLang = 'xml'; break;
      case 'readme': currentContent = files.readme; currentLang = 'markdown'; break;
    }
  }

  function renderIcon(type: string) {
    const color = type === 'v' ? '#27c93f' : type === 'md' ? '#00d4ff' : '#f59e0b';
    return (
      <span style={{
        display: 'inline-block',
        fontSize: '9px',
        fontWeight: 700,
        color,
        border: `1px solid ${color}`,
        borderRadius: '2px',
        padding: '0 3px',
        lineHeight: '1.2',
      }}>
        {type.toUpperCase()}
      </span>
    );
  }

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 0, border: 'none', borderTop: '1px solid var(--border)' }}>
      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {renderIcon(t.icon)}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CodeViewer language={currentLang} code={currentContent} />
      </div>
    </div>
  );
}
