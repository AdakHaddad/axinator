'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '../components/Header';
import VerilogEditor from '../components/VerilogEditor';
import PortTable from '../components/PortTable';
import RegisterPanel from '../components/RegisterPanel';
import OutputTabs from '../components/OutputTabs';
import StatusBar from '../components/StatusBar';

import { parseVerilogFile } from '../lib/parser';
import { suggestPortType } from '../lib/heuristics';
import { buildRegisterMap, mergeRegisters } from '../lib/registerMap';
import { generateAll } from '../lib/generator';
import { downloadZip } from '../lib/zipper';
import { buildDependencyGraph, getRequiredFiles } from '../lib/dependencies';

import type {
  UploadedFile,
  ParsedModule,
  DependencyGraph,
  PortConfig,
  RegisterEntry,
  GeneratedFiles,
  IPConfig,
  PortType,
} from '../lib/types';
import { PortType as PT } from '../lib/types';

export default function AppShell() {
  // ── State ────────────────────────────────────────────────────────────────
  const [ipName, setIpName] = useState('my_ip_axi');
  
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  
  const [parsedModules, setParsedModules] = useState<ParsedModule[]>([]);
  const [depGraph, setDepGraph] = useState<DependencyGraph | null>(null);
  const [topModuleName, setTopModuleName] = useState<string>('');
  
  const [portConfigs, setPortConfigs] = useState<PortConfig[]>([]);
  const [registers, setRegisters] = useState<RegisterEntry[]>([]);
  
  const [includeAllSources, setIncludeAllSources] = useState(false);
  const [generated, setGenerated] = useState<GeneratedFiles | null>(null);
  
  const [status, setStatus] = useState<{msg: string; type: 'ok' | 'error' | 'warn' | 'info'}>({ msg: 'Ready', type: 'info' });
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Resize handlers ─────────────────────────
  const [leftWidth, setLeftWidth] = useState(30);   
  const [centerWidth, setCenterWidth] = useState(40); 

  // ── Derived State ────────────────────────────────────────────────────────
  const topModule = useMemo(() => {
    return parsedModules.find(m => m.moduleName === topModuleName);
  }, [parsedModules, topModuleName]);

  // When top module changes, re-init ports and registers
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

  const allParseErrors = useMemo(() => {
    return parsedModules.reduce((sum, m) => sum + m.errors.length, 0);
  }, [parsedModules]);

  // ── Parse action ─────────────────────────────────────────────────────────
  const handleParse = useCallback(() => {
    setIsParsing(true);
    setStatus({ msg: 'Parsing Verilog files...', type: 'info' });
    
    setTimeout(() => {
      let allParsed: ParsedModule[] = [];
      for (const file of files) {
        const mods = parseVerilogFile(file.filename, file.content);
        allParsed = allParsed.concat(mods);
      }
      
      setParsedModules(allParsed);
      
      const graph = buildDependencyGraph(allParsed);
      setDepGraph(graph);

      if (graph.topCandidates.length > 0) {
        setTopModuleName(graph.topCandidates[0]);
      } else if (allParsed.length > 0) {
        // fallback if cyclical or all instantiated
        setTopModuleName(allParsed[0].moduleName);
      } else {
        setTopModuleName('');
      }
      
      let msg = `Parsed ${allParsed.length} module(s). `;
      let type: 'ok'|'warn' = 'ok';

      if (graph.missingDeps.size > 0) {
        msg += 'Some dependencies are missing.';
        type = 'warn';
      }

      setStatus({ msg, type });
      setIsParsing(false);
    }, 50);
  }, [files]);

  // ── Handlers ─────────────────────────────────────────────────────────────
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

  // ── Generate action ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (!topModule || !depGraph) return;
    setIsGenerating(true);
    setStatus({ msg: 'Generating AXI wrapper...', type: 'info' });

    setTimeout(() => {
      const clockPort = portConfigs.find(p => p.portType === PT.CLOCK);
      const resetPort = portConfigs.find(p => p.portType === PT.RESET);

      const cfg: IPConfig = {
        ipName,
        dataWidth: 32,
        clock: clockPort ? { portName: clockPort.port.name, useAxiClock: true } : null,
        reset: resetPort ? { portName: resetPort.port.name, polarity: 'active_low', useAxiReset: true } : null,
        portConfigs,
        registers,
      };

      const genFiles = generateAll(cfg, topModule.raw);
      setGenerated(genFiles);
      setStatus({ msg: 'Generation complete.', type: 'ok' });
      setIsGenerating(false);
    }, 50);
  }, [ipName, topModule, depGraph, portConfigs, registers]);

  // ── Download action ──────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!generated || !topModule || !depGraph) return;
    setStatus({ msg: 'Packaging ZIP...', type: 'info' });
    
    const reqFiles = getRequiredFiles(topModule.moduleName, depGraph, includeAllSources);
    const filesToPackage = files.filter(f => reqFiles.has(f.filename));

    downloadZip(ipName, generated, filesToPackage)
      .then(() => setStatus({ msg: 'Download started.', type: 'ok' }))
      .catch((e) => setStatus({ msg: `Download failed: ${e.message}`, type: 'error' }));
  }, [generated, ipName, topModule, depGraph, includeAllSources, files]);

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
        {/* Top Split */}
        <div style={{ flex: '1 1 60%', display: 'flex', minHeight: 0 }}>
          {/* Left: Editor */}
          <div style={{ width: `${leftWidth}%`, borderRight: '1px solid var(--border)' }}>
            <VerilogEditor
              files={files}
              activeFileIndex={activeFileIndex}
              onFilesChange={(f) => { setFiles(f); setGenerated(null); }}
              onActiveFileChange={setActiveFileIndex}
              onParse={handleParse}
              isParsing={isParsing}
            />
          </div>
          
          {/* Center: Port Config & Top Module Selection */}
          <div style={{ width: `${centerWidth}%`, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            {parsedModules.length > 0 && (
              <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Top Module:</span>
                <select 
                  className="select" 
                  value={topModuleName} 
                  onChange={(e) => setTopModuleName(e.target.value)}
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
            
            {depGraph?.missingDeps.has(topModuleName) && (
              <div style={{ padding: '8px 12px', background: 'rgba(255,166,87,0.1)', borderBottom: '1px solid rgba(255,166,87,0.3)', color: 'var(--amber)', fontSize: '12px' }}>
                <strong>Warning:</strong> Missing dependencies: {depGraph.missingDeps.get(topModuleName)?.join(', ')}
              </div>
            )}

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <PortTable portConfigs={portConfigs} onUpdate={updatePortConfig} />
            </div>
          </div>

          {/* Right: Registers */}
          <div style={{ width: `${100 - leftWidth - centerWidth}%` }}>
            <RegisterPanel registers={registers} onUpdate={updateRegister} />
          </div>
        </div>

        {/* Bottom Panel: Generated Output */}
        <div style={{ flex: '1 1 40%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {generated && (
             <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
               <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                 <input type="checkbox" checked={includeAllSources} onChange={e => setIncludeAllSources(e.target.checked)} />
                 Include all unused source files in ZIP
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
