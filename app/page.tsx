'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
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

export default function AppShell() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [ipName, setIpName] = useState('my_ip_axi');

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);

  const [parsedModules, setParsedModules] = useState<ParsedModule[]>([]);
  const [depGraph, setDepGraph] = useState<DependencyGraph | null>(null);
  const [depTree, setDepTree] = useState<DependencyNode | null>(null);
  const [topModuleName, setTopModuleName] = useState<string>('');

  const [portConfigs, setPortConfigs] = useState<PortConfig[]>([]);
  const [registers, setRegisters] = useState<RegisterEntry[]>([]);

  const [includeAllSources, setIncludeAllSources] = useState(false);
  const [generated, setGenerated] = useState<GeneratedFiles | null>(null);

  const [validationMessages, setValidationMessages] = useState<ValidationMessage[]>([]);

  const [status, setStatus] = useState<{ msg: string; type: 'ok' | 'error' | 'warn' | 'info' }>({
    msg: 'Ready',
    type: 'info',
  });
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Layout widths ─────────────────────────────────────────────────────────
  const [leftWidth] = useState(30);
  const [centerWidth] = useState(40);

  // ── Derived state ─────────────────────────────────────────────────────────
  const topModule = useMemo(
    () => parsedModules.find(m => m.moduleName === topModuleName),
    [parsedModules, topModuleName],
  );

  // Re-build dep tree whenever top module or graph changes
  useEffect(() => {
    if (depGraph && topModuleName) {
      setDepTree(buildDependencyTree(topModuleName, depGraph));
    } else {
      setDepTree(null);
    }
  }, [depGraph, topModuleName]);

  // Re-init ports & registers when the selected top module changes
  useEffect(() => {
    if (topModule) {
      const configs = topModule.ports.map(p => ({
        port: p,
        portType: suggestPortType(p),
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

  // ── Parse action ──────────────────────────────────────────────────────────
  const handleParse = useCallback(() => {
    setIsParsing(true);
    setStatus({ msg: 'Parsing Verilog files…', type: 'info' });
    setValidationMessages([]);

    setTimeout(() => {
      let allParsed: ParsedModule[] = [];
      for (const file of files) {
        const mods = parseVerilogFile(file.filename, file.content);
        allParsed = allParsed.concat(mods);
      }

      setParsedModules(allParsed);

      const graph = buildDependencyGraph(allParsed);
      setDepGraph(graph);

      const top =
        graph.topCandidates.length > 0
          ? graph.topCandidates[0]
          : allParsed.length > 0
          ? allParsed[0].moduleName
          : '';
      setTopModuleName(top);

      // Status summary
      let msg = `Parsed ${allParsed.length} module(s) across ${files.length} file(s).`;
      let type: 'ok' | 'warn' = 'ok';
      if (graph.missingDeps.size > 0) { msg += ' Missing dependencies detected.'; type = 'warn'; }
      if (graph.hasCycle) { msg += ' Circular dependency detected.'; type = 'warn'; }

      setStatus({ msg, type });
      setIsParsing(false);
    }, 50);
  }, [files]);

  // ── Port / register handlers ──────────────────────────────────────────────
  const updatePortConfig = (idx: number, newType: PortType) => {
    const newConfigs = [...portConfigs];
    newConfigs[idx] = { ...newConfigs[idx], portType: newType };
    setPortConfigs(newConfigs);
    const freshRegs = buildRegisterMap(newConfigs);
    setRegisters(prev => mergeRegisters(freshRegs, prev));
    setGenerated(null);
  };

  const updateRegister = (idx: number, updates: Partial<RegisterEntry>) => {
    const newRegs = [...registers];
    newRegs[idx] = { ...newRegs[idx], ...updates };
    setRegisters(newRegs);
    setGenerated(null);
  };

  // ── Generate action ───────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (!topModule || !depGraph) return;

    // Run validation first
    const validation = validateSetup(topModuleName, depGraph, files, includeAllSources);
    setValidationMessages(validation.messages);

    if (!validation.valid) {
      const errCount = validation.messages.filter(m => m.severity === 'error').length;
      setStatus({ msg: `Generation blocked: ${errCount} error(s). See dependency panel.`, type: 'error' });
      return;
    }

    setIsGenerating(true);
    setStatus({ msg: 'Generating AXI wrapper…', type: 'info' });

    setTimeout(() => {
      const clockPort = portConfigs.find(p => p.portType === PT.CLOCK);
      const resetPort = portConfigs.find(p => p.portType === PT.RESET);

      // Collect the source files to package
      const requiredFilenames = getRequiredFiles(topModuleName, depGraph, includeAllSources);
      const sourceFiles = files
        .filter(f => requiredFilenames.has(f.filename))
        .map(f => ({ filename: f.filename, content: f.content }));

      const cfg: IPConfig = {
        ipName,
        dataWidth: 32,
        clock: clockPort ? { portName: clockPort.port.name, useAxiClock: true } : null,
        reset: resetPort
          ? { portName: resetPort.port.name, polarity: 'active_low', useAxiReset: true }
          : null,
        portConfigs,
        registers,
        sourceFiles,
      };

      const genFiles = generateAll(cfg);
      setGenerated(genFiles);
      setStatus({ msg: `Generation complete. ${sourceFiles.length} source file(s) packaged.`, type: 'ok' });
      setIsGenerating(false);
    }, 50);
  }, [ipName, topModule, topModuleName, depGraph, portConfigs, registers, files, includeAllSources]);

  // ── Download action ───────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!generated) return;
    setStatus({ msg: 'Packaging ZIP…', type: 'info' });
    downloadZip(ipName, generated)
      .then(() => setStatus({ msg: 'Download started.', type: 'ok' }))
      .catch(e => setStatus({ msg: `Download failed: ${e.message}`, type: 'error' }));
  }, [generated, ipName]);

  // ── Validation panel ──────────────────────────────────────────────────────
  const errors   = validationMessages.filter(m => m.severity === 'error');
  const warnings = validationMessages.filter(m => m.severity === 'warning');

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
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top split */}
        <div style={{ flex: '1 1 60%', display: 'flex', minHeight: 0 }}>

          {/* Left: Editor + file sidebar */}
          <div style={{ width: `${leftWidth}%`, borderRight: '1px solid var(--border)' }}>
            <VerilogEditor
              files={files}
              activeFileIndex={activeFileIndex}
              onFilesChange={f => { setFiles(f); setGenerated(null); }}
              onActiveFileChange={setActiveFileIndex}
              onParse={handleParse}
              isParsing={isParsing}
            />
          </div>

          {/* Center: top module selector + validation + port config */}
          <div style={{ width: `${centerWidth}%`, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>

            {/* Top module selector */}
            {parsedModules.length > 0 && (
              <div style={{
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
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
                      {depGraph.topCandidates.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label="All Modules">
                    {parsedModules.map(m => (
                      <option key={m.moduleName} value={m.moduleName}>{m.moduleName}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Validation messages */}
            {errors.length > 0 && (
              <div style={{
                padding: '6px 12px',
                background: 'rgba(248,81,73,0.08)',
                borderBottom: '1px solid rgba(248,81,73,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}>
                {errors.map((m, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'var(--red)', display: 'flex', gap: '6px' }}>
                    <span style={{ flexShrink: 0 }}>✗</span>
                    <span>{m.message}</span>
                  </div>
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div style={{
                padding: '6px 12px',
                background: 'rgba(255,166,87,0.07)',
                borderBottom: '1px solid rgba(255,166,87,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}>
                {warnings.map((m, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'var(--amber)', display: 'flex', gap: '6px' }}>
                    <span style={{ flexShrink: 0 }}>⚠</span>
                    <span>{m.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <PortTable portConfigs={portConfigs} onUpdate={updatePortConfig} />
            </div>
          </div>

          {/* Right: split vertically — dep tree (top) + register panel (bottom) */}
          <div style={{
            width: `${100 - leftWidth - centerWidth}%`,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Dependency tree — upper half */}
            <div style={{ flex: '1 1 40%', minHeight: 0, borderBottom: '1px solid var(--border)' }}>
              <DependencyTree root={depTree} topModuleName={topModuleName} />
            </div>

            {/* Register panel — lower half */}
            <div style={{ flex: '1 1 60%', minHeight: 0 }}>
              <RegisterPanel registers={registers} onUpdate={updateRegister} />
            </div>
          </div>
        </div>

        {/* Bottom panel: generated output */}
        <div style={{ flex: '1 1 40%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {generated && (
            <div style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {generated.sourceMap.size} source file(s) packaged
              </span>
              <label style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}>
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

      <StatusBar
        message={status.msg}
        type={status.type}
        parseErrors={allParseErrors}
      />
    </>
  );
}
