'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeViewerProps {
  language: 'verilog' | 'markdown' | 'xml';
  code: string;
}

export default function CodeViewer({ language, code }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  if (!code) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        color: 'var(--text-muted)',
      }}>
        Generated code will appear here
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* Absolute positioned copy button overlay */}
      <div style={{ position: 'absolute', top: '12px', right: '20px', zIndex: 10 }}>
        <button
          className="btn btn-ghost"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            padding: '4px 8px',
            fontSize: '11px',
          }}
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--green)">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <MonacoEditor
        height="100%"
        language={language}
        value={code}
        theme="axinator-dark"
        options={{
          readOnly: true,
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
          minimap: { enabled: false },
          wordWrap: 'off',
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          renderLineHighlight: 'none',
          scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        }}
      />
    </div>
  );
}
