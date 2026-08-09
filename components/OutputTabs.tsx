'use client';

import { useState, useMemo } from 'react';
import CodeViewer from './CodeViewer';
import type { GeneratedFiles } from '../lib/types';

interface OutputTabsProps {
  files: GeneratedFiles | null;
}

type BuiltinTabId = 'top' | 'slave' | 'regmap' | 'xml' | 'readme';
type TabId = BuiltinTabId | string; // string = source filename

export default function OutputTabs({ files }: OutputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('top');

  // Derive source file tabs from the map
  const sourceTabs = useMemo(() => {
    if (!files) return [];
    return Array.from(files.sourceMap.keys());
  }, [files]);

  // Reset to 'top' if current tab is a source file that no longer exists
  const safeActiveTab: TabId = useMemo(() => {
    if (!files) return 'top';
    if (['top', 'slave', 'regmap', 'xml', 'readme'].includes(activeTab as string)) return activeTab;
    if (files.sourceMap.has(activeTab as string)) return activeTab;
    return 'top';
  }, [activeTab, files]);

  const builtinTabs: { id: BuiltinTabId; label: string; icon: string }[] = [
    { id: 'top',    label: 'Top Wrapper',   icon: 'v'   },
    { id: 'slave',  label: 'AXI Slave',     icon: 'v'   },
    { id: 'regmap', label: 'Register Map',  icon: 'md'  },
    { id: 'xml',    label: 'component.xml', icon: 'xml' },
    { id: 'readme', label: 'README',        icon: 'md'  },
  ];

  let currentContent = '';
  let currentLang: 'verilog' | 'markdown' | 'xml' = 'verilog';

  if (files) {
    switch (safeActiveTab) {
      case 'top':    currentContent = files.topWrapper;    currentLang = 'verilog';  break;
      case 'slave':  currentContent = files.axiSlave;      currentLang = 'verilog';  break;
      case 'regmap': currentContent = files.registerMapMd; currentLang = 'markdown'; break;
      case 'xml':    currentContent = files.componentXml;  currentLang = 'xml';      break;
      case 'readme': currentContent = files.readme;        currentLang = 'markdown'; break;
      default:
        currentContent = files.sourceMap.get(safeActiveTab as string) ?? '';
        currentLang = 'verilog';
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
      <div className="tab-bar" style={{ overflowX: 'auto', flexShrink: 0, flexWrap: 'nowrap' }}>
        {/* Generated file tabs */}
        {builtinTabs.map(t => (
          <button
            key={t.id}
            className={`tab ${safeActiveTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {renderIcon(t.icon)}
            {t.label}
          </button>
        ))}

        {/* Separator when source tabs exist */}
        {sourceTabs.length > 0 && (
          <span style={{
            alignSelf: 'center',
            width: '1px',
            height: '16px',
            background: 'var(--border)',
            margin: '0 4px',
            flexShrink: 0,
          }} />
        )}

        {/* One tab per original source file */}
        {sourceTabs.map(filename => (
          <button
            key={filename}
            className={`tab ${safeActiveTab === filename ? 'active' : ''}`}
            onClick={() => setActiveTab(filename)}
            title={filename}
          >
            {renderIcon('v')}
            {filename}
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
