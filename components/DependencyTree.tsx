'use client';

import type { DependencyNode } from '../lib/types';

interface DependencyTreeProps {
  root: DependencyNode | null;
  topModuleName: string;
}

interface NodeProps {
  node: DependencyNode;
  depth: number;
  isLast: boolean;
  prefix: string;
  isRoot: boolean;
}

function TreeNode({ node, depth, isLast, prefix, isRoot }: NodeProps) {
  const connector = isRoot ? '' : isLast ? '└── ' : '├── ';
  const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');

  const nameColor = node.isMissing
    ? 'var(--red)'
    : isRoot
    ? 'var(--accent)'
    : depth === 1
    ? 'var(--text-primary)'
    : 'var(--text-secondary)';

  return (
    <div style={{ fontFamily: 'var(--font-code)', fontSize: '12px', lineHeight: '1.8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'pre' }}>
        <span style={{ color: 'var(--text-muted)' }}>{prefix}{connector}</span>
        <span style={{ color: nameColor, fontWeight: isRoot ? 600 : 400 }}>
          {node.moduleName}
        </span>
        {node.filename && (
          <span style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 400 }}>
            {' '}
            <span style={{ color: 'var(--border)' }}>·</span>{' '}
            {node.filename}
          </span>
        )}
        {node.isMissing && (
          <span style={{
            fontSize: '9px',
            background: 'rgba(248,81,73,0.15)',
            color: 'var(--red)',
            border: '1px solid rgba(248,81,73,0.3)',
            borderRadius: '3px',
            padding: '0 4px',
            marginLeft: '4px',
          }}>
            MISSING
          </span>
        )}
        {isRoot && (
          <span style={{
            fontSize: '9px',
            background: 'rgba(0,212,255,0.12)',
            color: 'var(--accent)',
            border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: '3px',
            padding: '0 4px',
            marginLeft: '4px',
          }}>
            TOP
          </span>
        )}
      </div>
      {node.children.map((child, i) => (
        <TreeNode
          key={`${child.moduleName}-${i}`}
          node={child}
          depth={depth + 1}
          isLast={i === node.children.length - 1}
          prefix={childPrefix}
          isRoot={false}
        />
      ))}
    </div>
  );
}

export default function DependencyTree({ root, topModuleName }: DependencyTreeProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span
            className="panel-title-dot"
            style={{ background: 'var(--teal, #2dd4bf)', boxShadow: '0 0 6px var(--teal, #2dd4bf)' }}
          />
          <span>Dependency Tree</span>
        </div>
        {root && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            root: {topModuleName}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {!root ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
            Parse modules to view hierarchy
          </div>
        ) : (
          <TreeNode
            node={root}
            depth={0}
            isLast={true}
            prefix=""
            isRoot={true}
          />
        )}
      </div>
    </div>
  );
}
