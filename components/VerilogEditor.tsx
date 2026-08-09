'use client';

import { useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { UploadedFile } from '../lib/types';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface VerilogEditorProps {
  files: UploadedFile[];
  activeFileIndex: number;
  onFilesChange: (files: UploadedFile[]) => void;
  onActiveFileChange: (idx: number) => void;
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
    filter_biquad stage1 (
        .clk(clk)
    );
endmodule`;

const EXAMPLE_BIQUAD = `module filter_biquad (
    input wire clk
);
    // internal logic
endmodule`;

export default function VerilogEditor({ 
  files, 
  activeFileIndex, 
  onFilesChange, 
  onActiveFileChange, 
  onParse, 
  isParsing 
}: VerilogEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    
    const newFiles: UploadedFile[] = [];
    let processed = 0;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const reader = new FileReader();
      reader.onload = (ev) => {
        newFiles.push({
          filename: file.name,
          content: ev.target?.result as string,
        });
        processed++;
        if (processed === uploadedFiles.length) {
          onFilesChange([...files, ...newFiles]);
          if (files.length === 0) onActiveFileChange(0); // switch to first if it was empty
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }, [files, onFilesChange, onActiveFileChange]);

  const handleLoadExample = useCallback(() => {
    const newFiles = [
      { filename: 'filter_coeff.v', content: EXAMPLE_VERILOG },
      { filename: 'filter_biquad.v', content: EXAMPLE_BIQUAD }
    ];
    onFilesChange(newFiles);
    onActiveFileChange(0);
  }, [onFilesChange, onActiveFileChange]);

  const handleClear = useCallback(() => {
    onFilesChange([]);
    onActiveFileChange(-1);
  }, [onFilesChange, onActiveFileChange]);

  const removeFile = (idx: number) => {
    const newFiles = [...files];
    newFiles.splice(idx, 1);
    onFilesChange(newFiles);
    if (activeFileIndex === idx) {
      onActiveFileChange(newFiles.length > 0 ? 0 : -1);
    } else if (activeFileIndex > idx) {
      onActiveFileChange(activeFileIndex - 1);
    }
  };

  const activeFile = files[activeFileIndex];

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      
      {/* File Sidebar */}
      <div style={{ 
        width: '140px', 
        borderRight: '1px solid var(--border)', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'var(--bg-surface)'
      }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          SOURCES
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {files.map((f, i) => (
            <div 
              key={i} 
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                background: activeFileIndex === i ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                borderLeft: activeFileIndex === i ? '2px solid var(--accent)' : '2px solid transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
              onClick={() => onActiveFileChange(i)}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-code)' }}>
                {f.filename}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: '8px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '11px', padding: '4px', width: '100%', justifyContent: 'center' }}
            onClick={() => fileInputRef.current?.click()}
          >
            + Add Files
          </button>
          {files.length === 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '4px', width: '100%', justifyContent: 'center' }}
              onClick={handleLoadExample}
            >
              Load Example
            </button>
          )}
          {files.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ fontSize: '11px', padding: '4px', width: '100%', justifyContent: 'center', color: 'var(--red)' }}
              onClick={handleClear}
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <span className="panel-title-dot" />
            <span>{activeFile ? activeFile.filename : 'No File Selected'}</span>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          {activeFile ? (
            <MonacoEditor
              height="100%"
              defaultLanguage="verilog"
              value={activeFile.content}
              onChange={(v) => {
                const newFiles = [...files];
                newFiles[activeFileIndex] = { ...activeFile, content: v ?? '' };
                onFilesChange(newFiles);
              }}
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
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Add a Verilog file to begin
            </div>
          )}
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
            {files.length} file(s) loaded
          </span>
          <button
            id="btn-parse"
            className="btn btn-primary"
            disabled={files.length === 0 || isParsing}
            onClick={onParse}
            style={{ padding: '6px 16px' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 2.5c0-.28.22-.5.5-.5h6a.5.5 0 0 1 .35.85L8 6.7 11.35 10.15a.5.5 0 0 1-.35.85H5a.5.5 0 0 1-.5-.5v-8z"/>
            </svg>
            {isParsing ? 'Parsing…' : 'Parse All'}
          </button>
        </div>

      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".v,.sv"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />
    </div>
  );
}
