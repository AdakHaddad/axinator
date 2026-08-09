'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Header from '../components/Header';
import VerilogEditor from '../components/VerilogEditor';
import PortTable from '../components/PortTable';
import RegisterPanel from '../components/RegisterPanel';
import OutputTabs from '../components/OutputTabs';
import StatusBar from '../components/StatusBar';
import DependencyTree from '../components/DependencyTree';

import { parseVerilogFile } from '../lib/parser';
import { suggestPortType } from '../lib/heuristics';
import { buildRegisterMap, mergeRegisters } from '../lib/registerMap';
import { generateAll } from '../lib/generator';
import { downloadZip } from '../lib/zipper';
import {
  buildDependencyGraph,
  buildDependencyTree,
  getRequiredFiles,
  validateSetup,
} from '../lib/dependencies';
import { useSplitPane } from '../lib/useSplitPane';

import type {
  UploadedFile,
  ParsedModule,
  DependencyGraph,
  DependencyNode,
  PortConfig,
  RegisterEntry,
  GeneratedFiles,
  IPConfig,
  PortType,
  ValidationMessage,
} from '../lib/types';
import { PortType as PT } from '../lib/types';

// ── Drag handle component ─────────────────────────────────────────────────────
function Handle({
  dir,
  onMouseDown,
  isDragging,
}: {
  dir: 'h' | 'v';
  onMouseDown: (e: React.MouseEvent) => void;
  isDragging: boolean;
}) {
  return (
    <div
      className={`resize-handle-${dir}${isDragging ? ' is-dragging' : ''}`}
      onMouseDown={onMouseDown}
    />
  );
}

// ── useSplitPane wrapper that also tracks dragging state ──────────────────────
function useDraggableSplit(
  initialPx: number,
  minPx: number,
  maxPx: number,
  dir: 'h' | 'v',
) {
  const { size, onMouseDown: baseDown } = useSplitPane(initialPx, minPx, maxPx, dir);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      baseDown(e);
    },
    [baseDown],
  );

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  return { size, onMouseDown, isDragging };
}

export default function AppShell() {
  // ── Theme ────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Respect OS preference on first load
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const saved = localStorage.getItem('axinator-theme') as 'dark' | 'light' | null;
    setTheme(saved ?? (prefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('axinator-theme', theme);
  }, [theme]);

  const handleThemeToggle = () =>
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // ── Resizable splits ─────────────────────────────────────────────────────
  // Left column (editor)      — default 300 px, min 180, max 600
  const left   = useDraggableSplit(300, 180, 600, 'h');
  // Centre column (ports)     — default 380 px, min 240, max 700
  const centre = useDraggableSplit(380, 240, 700, 'h');
  // Right inner split (dep tree vs registers) — default 220 px, min 80, max 500
  const rightV = useDraggableSplit(220, 80,  500, 'v');
  // Top/bottom row split      — default 55 %, expressed as px; we'll use flex
  const topRow = useDraggableSplit(420, 160, 800, 'v');

  // ── App state ────────────────────────────────────────────────────────────
  const [ipName, setIpName] = useState('my_ip_axi');

  const [files, setFiles]                   = useState<UploadedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);

  const [parsedModules, setParsedModules]   = useState<ParsedModule[]>([]);
  const [depGraph, setDepGraph]             = useState<DependencyGraph | null>(null);
  const [depTree, setDepTree]               = useState<DependencyNode | null>(null);
  const [topModuleName, setTopModuleName]   = useState<string>('');

  const [portConfigs, setPortConfigs]       = useState<PortConfig[]>([]);
  const [registers,   setRegisters]         = useState<RegisterEntry[]>([]);

  const [includeAllSources, setIncludeAllSources] = useState(false);
  const [generated, setGenerated]           = useState<GeneratedFiles | null>(null);
  const [validationMessages, setValidationMessages] = useState<ValidationMessage[]>([]);

  const [status, setStatus] = useState<{
    msg: string; type: 'ok' | 'error' | 'warn' | 'info';
  }>({ msg: 'Ready', type: 'info' });

  const [isParsing,    setIsParsing]    = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const topModule = useMemo(
    () => parsedModules.find(m => m.moduleName === topModuleName),
    [parsedModules, topModuleName],
  );

  useEffect(() => {
    if (depGraph && topModuleName) setDepTree(buildDependencyTree(topModuleName, depGraph));
    else setDepTree(null);
  }, [depGraph, topModuleName]);

  useEffect(() => {
    if (topModule) {
      const configs = topModule.ports.map(p => ({
        port: p, portType: suggestPortType(p),
      }));
      setPortConfigs(configs);
      setRegisters(buildRegisterMap(configs));
      setGenerated(null);
      setIpName(topModule.moduleName + '_axi');
    } else {
      setPortConfigs([]);
      setRegisters([]);
      setGenerated(null);
    }
  }, [topModule]);

  const allParseErrors = useMemo(
    () => parsedModules.reduce((s, m) => s + m.errors.length, 0),
    [parsedModules],
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleParse = useCallback(() => {
    setIsParsing(true);
    setStatus({ msg: 'Parsing Verilog files…', type: 'info' });
    setValidationMessages([]);
    setTimeout(() => {
      let allParsed: ParsedModule[] = [];
      for (const file of files)
        allParsed = allParsed.concat(parseVerilogFile(file.filename, file.content));

      setParsedModules(allParsed);
      const graph = buildDependencyGraph(allParsed);
      setDepGraph(graph);

      const top = graph.topCandidates[0] ?? allParsed[0]?.moduleName ?? '';
      setTopModuleName(top);

      let msg = `Parsed ${allParsed.length} module(s) across ${files.length} file(s).`;
      let type: 'ok' | 'warn' = 'ok';
      if (graph.missingDeps.size > 0) { msg += ' Missing dependencies detected.'; type = 'warn'; }
      if (graph.hasCycle)             { msg += ' Circular dependency detected.';  type = 'warn'; }
      setStatus({ msg, type });
      setIsParsing(false);
    }, 50);
  }, [files]);

  const updatePortConfig = (idx: number, newType: PortType) => {
    const next = [...portConfigs];
    next[idx] = { ...next[idx], portType: newType };
    setPortConfigs(next);
    setRegisters(prev => mergeRegisters(buildRegisterMap(next), prev));
    setGenerated(null);
  };

  const updateRegister = (idx: number, updates: Partial<RegisterEntry>) => {
    const next = [...registers];
    next[idx] = { ...next[idx], ...updates };
    setRegisters(next);
    setGenerated(null);
  };

  const handleGenerate = useCallback(() => {
    if (!topModule || !depGraph) return;
    const validation = validateSetup(topModuleName, depGraph, files, includeAllSources);
    setValidationMessages(validation.messages);
    if (!validation.valid) {
      const n = validation.messages.filter(m => m.severity === 'error').length;
      setStatus({ msg: `Generation blocked: ${n} error(s). See dependency panel.`, type: 'error' });
      return;
    }
    setIsGenerating(true);
    setStatus({ msg: 'Generating AXI wrapper…', type: 'info' });
    setTimeout(() => {
      const clockPort = portConfigs.find(p => p.portType === PT.CLOCK);
      const resetPort = portConfigs.find(p => p.portType === PT.RESET);
      const reqFiles  = getRequiredFiles(topModuleName, depGraph, includeAllSources);
      const sourceFiles = files
        .filter(f => reqFiles.has(f.filename))
        .map(f => ({ filename: f.filename, content: f.content }));

      const cfg: IPConfig = {
        ipName, dataWidth: 32,
        clock: clockPort ? { portName: clockPort.port.name, useAxiClock: true } : null,
        reset: resetPort ? { portName: resetPort.port.name, polarity: 'active_low', useAxiReset: true } : null,
        portConfigs, registers, sourceFiles,
      };
      const genFiles = generateAll(cfg);
      setGenerated(genFiles);
      setStatus({ msg: `Generation complete. ${sourceFiles.length} source file(s) packaged.`, type: 'ok' });
      setIsGenerating(false);
    }, 50);
  }, [ipName, topModule, topModuleName, depGraph, portConfigs, registers, files, includeAllSources]);

  const handleDownload = useCallback(() => {
    if (!generated) return;
    setStatus({ msg: 'Packaging ZIP…', type: 'info' });
    downloadZip(ipName, generated)
      .then(() => setStatus({ msg: 'Download started.', type: 'ok' }))
      .catch(e => setStatus({ msg: `Download failed: ${e.message}`, type: 'error' }));
  }, [generated, ipName]);

  const errors   = validationMessages.filter(m => m.severity === 'error');
  const warnings = validationMessages.filter(m => m.severity === 'warning');

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <>
      <Header
        ipName={ipName}
        onIpNameChange={setIpName}
        onGenerate={handleGenerate}
        onDownload={handleDownload}
        canGenerate={portConfigs.length > 0}
        canDownload={generated !== null}
        isGenerating={isGenerating}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />

      {/* Main workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Top row ── */}
        <div style={{ height: topRow.size, minHeight: 0, display: 'flex', flexShrink: 0 }}>

          {/* LEFT — editor + file sidebar */}
          <div style={{ width: left.size, minWidth: 0, flexShrink: 0, overflow: 'hidden' }}>
            <VerilogEditor
              files={files}
              activeFileIndex={activeFileIndex}
              onFilesChange={f => { setFiles(f); setGenerated(null); }}
              onActiveFileChange={setActiveFileIndex}
              onParse={handleParse}
              isParsing={isParsing}
              theme={theme}
            />
          </div>

          <Handle dir="h" onMouseDown={left.onMouseDown} isDragging={left.isDragging} />

          {/* CENTRE — module selector + validation + port table */}
          <div style={{ width: centre.size, minWidth: 0, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>

            {/* Top module selector */}
            {parsedModules.length > 0 && (
              <div style={{
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  Top Module:
                </span>
                <select
                  className="select"
                  value={topModuleName}
                  onChange={e => { setTopModuleName(e.target.value); setValidationMessages([]); }}
                  style={{ flex: 1 }}
                >
                  {depGraph?.topCandidates.length ? (
                    <optgroup label="Top Candidates">
                      {depGraph.topCandidates.map(n => <option key={n} value={n}>{n}</option>)}
                    </optgroup>
                  ) : null}
                  <optgroup label="All Modules">
                    {parsedModules.map(m => <option key={m.moduleName} value={m.moduleName}>{m.moduleName}</option>)}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Validation errors */}
            {errors.length > 0 && (
              <div style={{ padding: '6px 12px', background: 'rgba(248,81,73,0.08)', borderBottom: '1px solid rgba(248,81,73,0.25)', display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                {errors.map((m, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'var(--red)', display: 'flex', gap: '6px' }}>
                    <span style={{ flexShrink: 0 }}>✗</span><span>{m.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Validation warnings */}
            {warnings.length > 0 && (
              <div style={{ padding: '6px 12px', background: 'rgba(255,166,87,0.07)', borderBottom: '1px solid rgba(255,166,87,0.2)', display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                {warnings.map((m, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'var(--amber)', display: 'flex', gap: '6px' }}>
                    <span style={{ flexShrink: 0 }}>⚠</span><span>{m.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <PortTable portConfigs={portConfigs} onUpdate={updatePortConfig} />
            </div>
          </div>

          <Handle dir="h" onMouseDown={centre.onMouseDown} isDragging={centre.isDragging} />

          {/* RIGHT — dep tree (top) + registers (bottom), with vertical splitter */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Dep tree */}
            <div style={{ height: rightV.size, minHeight: 0, flexShrink: 0, overflow: 'hidden' }}>
              <DependencyTree root={depTree} topModuleName={topModuleName} />
            </div>

            <Handle dir="v" onMouseDown={rightV.onMouseDown} isDragging={rightV.isDragging} />

            {/* Register panel */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <RegisterPanel registers={registers} onUpdate={updateRegister} />
            </div>
          </div>
        </div>

        {/* ── Row splitter ── */}
        <Handle dir="v" onMouseDown={topRow.onMouseDown} isDragging={topRow.isDragging} />

        {/* ── Bottom row — output tabs ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {generated && (
            <div style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {generated.sourceMap.size} source file(s) packaged
              </span>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeAllSources}
                  onChange={e => setIncludeAllSources(e.target.checked)}
                />
                Include all uploaded source files in ZIP
              </label>
            </div>
          )}
          <OutputTabs files={generated} />
        </div>
      </div>

      <StatusBar message={status.msg} type={status.type} parseErrors={allParseErrors} />
    </>
  );
}
