'use client';

import { useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface VerilogEditorProps {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
  isParsing: boolean;
}

const EXAMPLE_VERILOG = `module filter_coeff (
    input wire clk,
    input wire valid,
    input wire [2:0] sw,
    input wire signed [15:0] x_in,
    input wire signed [15:0] b0_1,
    input wire signed [15:0] b1_1,
    output wire signed [15:0] y_out
);
endmodule`;

export default function VerilogEditor({ value, onChange, onParse, isParsing }: VerilogEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onChange(text);
    };
    reader.readAsText(file);
    // reset so same file can be re-uploaded
    e.target.value = '';
  }, [onChange]);

  const handleLoadExample = useCallback(() => {
    onChange(EXAMPLE_VERILOG);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Panel header */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          <span className="panel-title-dot" />
          <span>Verilog Input</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            id="btn-load-example"
            className="btn btn-ghost"
            style={{ fontSize: '11px', padding: '3px 8px' }}
            onClick={handleLoadExample}
            title="Load example Verilog module"
          >
            Example
          </button>
          <button
            id="btn-upload"
            className="btn btn-ghost"
            style={{ fontSize: '11px', padding: '3px 8px' }}
            onClick={() => fileInputRef.current?.click()}
            title="Upload .v file"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8.53 1.22a.75.75 0 0 0-1.06 0L3.22 5.47a.75.75 0 0 0 1.06 1.06L7 3.81V10a.75.75 0 0 0 1.5 0V3.81l2.72 2.72a.75.75 0 1 0 1.06-1.06L8.53 1.22z"/>
              <path d="M3.5 12a.5.5 0 0 0-.5.5V14c0 .28.22.5.5.5h9a.5.5 0 0 0 .5-.5v-1.5a.5.5 0 0 0-1 0V13.5h-8V12.5a.5.5 0 0 0-.5-.5z"/>
            </svg>
            Upload .v
          </button>
          <button
            id="btn-clear-editor"
            className="btn btn-ghost"
            style={{ fontSize: '11px', padding: '3px 8px' }}
            onClick={handleClear}
            title="Clear editor"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <MonacoEditor
          height="100%"
          defaultLanguage="verilog"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          theme="vs-dark"
          options={{
            fontSize: 12,
            fontFamily: "'JetBrains Mono', 'Geist Mono', monospace",
            fontLigatures: true,
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 4,
            renderLineHighlight: 'gutter',
            bracketPairColorization: { enabled: true },
            padding: { top: 8, bottom: 8 },
            scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
          }}
          onMount={(editor, monaco) => {
            // Register Verilog as a basic language with keyword highlighting
            monaco.languages.register({ id: 'verilog' });
            monaco.languages.setMonarchTokensProvider('verilog', {
              keywords: [
                'module','endmodule','input','output','inout','wire','reg',
                'signed','unsigned','parameter','localparam','assign',
                'always','begin','end','if','else','case','endcase',
                'posedge','negedge','initial','integer','genvar','generate',
                'endgenerate','for','while','function','endfunction','task',
                'endtask','`timescale','`define','`include',
              ],
              tokenizer: {
                root: [
                  [/\/\/.*$/, 'comment'],
                  [/\/\*/, 'comment', '@comment'],
                  [/`[a-zA-Z_]\w*/, 'keyword'],
                  [/\b(module|endmodule|input|output|inout|wire|reg|signed|unsigned|parameter|localparam|assign|always|begin|end|if|else|case|endcase|posedge|negedge|initial|integer)\b/, 'keyword'],
                  [/\b\d+('b[01xzXZ]+|'h[0-9a-fA-FxXzZ]+|'d\d+|'o[0-7xzXZ]+|\d*)\b/, 'number'],
                  [/\b0x[0-9a-fA-F]+\b/, 'number'],
                  [/[a-zA-Z_]\w*/, 'identifier'],
                  [/[\[\](){};,]/, 'delimiter'],
                  [/[=<>!&|+\-*\/^~%]/, 'operator'],
                ],
                comment: [
                  [/[^/*]+/, 'comment'],
                  [/\*\//, 'comment', '@pop'],
                  [/[/*]/, 'comment'],
                ],
              },
            });
            monaco.editor.defineTheme('axinator-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'keyword',    foreground: '79c0ff', fontStyle: 'bold' },
                { token: 'comment',    foreground: '8b949e', fontStyle: 'italic' },
                { token: 'number',     foreground: 'f2cc60' },
                { token: 'identifier', foreground: 'cdd9e5' },
                { token: 'operator',   foreground: 'ff7b72' },
                { token: 'delimiter',  foreground: '8b949e' },
              ],
              colors: {
                'editor.background':           '#0d1117',
                'editor.foreground':           '#cdd9e5',
                'editor.lineHighlightBackground': '#161b2288',
                'editorLineNumber.foreground': '#484f58',
                'editorLineNumber.activeForeground': '#8b949e',
                'editorCursor.foreground':     '#00d4ff',
                'editor.selectionBackground':  '#264f78',
                'editorGutter.background':     '#0d1117',
              },
            });
            monaco.editor.setTheme('axinator-dark');
          }}
        />
      </div>

      {/* Parse button */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Paste or upload any Verilog module
        </span>
        <button
          id="btn-parse"
          className="btn btn-primary"
          disabled={!value.trim() || isParsing}
          onClick={onParse}
          style={{ padding: '6px 16px' }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.5 2.5c0-.28.22-.5.5-.5h6a.5.5 0 0 1 .35.85L8 6.7 11.35 10.15a.5.5 0 0 1-.35.85H5a.5.5 0 0 1-.5-.5v-8z"/>
          </svg>
          {isParsing ? 'Parsing…' : 'Parse Module'}
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".v,.sv"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
    </div>
  );
}
