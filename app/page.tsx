'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import Header from '../components/Header';
import VerilogEditor from '../components/VerilogEditor';
import PortTable from '../components/PortTable';
import RegisterPanel from '../components/RegisterPanel';
import OutputTabs from '../components/OutputTabs';
import StatusBar from '../components/StatusBar';

import { parseVerilog } from '../lib/parser';
import { suggestPortType } from '../lib/heuristics';
import { buildRegisterMap, mergeRegisters } from '../lib/registerMap';
import { generateAll } from '../lib/generator';
import { downloadZip } from '../lib/zipper';

import type {
  ParsedModule,
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
  const [verilogSrc, setVerilogSrc] = useState('');
  
  const [parsed, setParsed] = useState<ParsedModule | null>(null);
  const [portConfigs, setPortConfigs] = useState<PortConfig[]>([]);
  const [registers, setRegisters] = useState<RegisterEntry[]>([]);
  
  const [generated, setGenerated] = useState<GeneratedFiles | null>(null);
  
  const [status, setStatus] = useState<{msg: string; type: 'ok' | 'error' | 'warn' | 'info'}>({ msg: 'Ready', type: 'info' });
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Resize handlers (simple flex layout for now) ─────────────────────────
  const [leftWidth, setLeftWidth] = useState(30);   // %
  const [centerWidth, setCenterWidth] = useState(40); // %

  // ── Parse action ─────────────────────────────────────────────────────────
  const handleParse = useCallback(() => {
    setIsParsing(true);
    setStatus({ msg: 'Parsing Verilog...', type: 'info' });
    
    // Simulate slight delay for UI feel
    setTimeout(() => {
      const res = parseVerilog(verilogSrc);
      setParsed(res);
      
      if (res.moduleName !== 'unknown') {
        setIpName(res.moduleName + '_axi');
      }

      // Build initial port configs
      const configs = res.ports.map(p => ({
        port: p,
        portType: suggestPortType(p),
      }));
      setPortConfigs(configs);

      // Build initial register map
      const regs = buildRegisterMap(configs);
      // Merge with existing so we don't wipe out user renaming if they re-parse
      setRegisters(prev => mergeRegisters(regs, prev));
      
      setGenerated(null); // invalidate generated
      
      const errCount = res.errors.length;
      if (errCount > 0) {
        setStatus({ msg: `Parsed with ${errCount} warning(s)`, type: 'warn' });
      } else {
        setStatus({ msg: `Successfully parsed module '${res.moduleName}'`, type: 'ok' });
      }
      setIsParsing(false);
    }, 50);
  }, [verilogSrc]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const updatePortConfig = (idx: number, newType: PortType) => {
    const newConfigs = [...portConfigs];
    newConfigs[idx] = { ...newConfigs[idx], portType: newType };
    setPortConfigs(newConfigs);
    
    // Rebuild register map based on new types, preserving edits
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
    if (!parsed) return;
    setIsGenerating(true);
    setStatus({ msg: 'Generating AXI wrapper...', type: 'info' });

    setTimeout(() => {
      // Find clock/reset
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

      const files = generateAll(cfg, parsed.raw);
      setGenerated(files);
      setStatus({ msg: 'Generation complete.', type: 'ok' });
      setIsGenerating(false);
    }, 50);
  }, [ipName, parsed, portConfigs, registers]);

  // ── Download action ──────────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!generated) return;
    setStatus({ msg: 'Packaging ZIP...', type: 'info' });
    downloadZip(ipName, generated, `${parsed?.moduleName || 'module'}.v`)
      .then(() => setStatus({ msg: 'Download started.', type: 'ok' }))
      .catch((e) => setStatus({ msg: `Download failed: ${e.message}`, type: 'error' }));
  }, [generated, ipName, parsed]);

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
        {/* Top 3-panel split */}
        <div style={{ flex: '1 1 60%', display: 'flex', minHeight: 0 }}>
          {/* Left: Editor */}
          <div style={{ width: `${leftWidth}%`, borderRight: '1px solid var(--border)' }}>
            <VerilogEditor
              value={verilogSrc}
              onChange={(v) => { setVerilogSrc(v); setGenerated(null); }}
              onParse={handleParse}
              isParsing={isParsing}
            />
          </div>
          
          {/* Center: Port Config */}
          <div style={{ width: `${centerWidth}%`, borderRight: '1px solid var(--border)' }}>
            <PortTable portConfigs={portConfigs} onUpdate={updatePortConfig} />
          </div>

          {/* Right: Registers */}
          <div style={{ width: `${100 - leftWidth - centerWidth}%` }}>
            <RegisterPanel registers={registers} onUpdate={updateRegister} />
          </div>
        </div>

        {/* Bottom Panel: Generated Output */}
        <div style={{ flex: '1 1 40%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <OutputTabs files={generated} />
        </div>
      </div>

      <StatusBar
        message={status.msg}
        type={status.type}
        parseErrors={parsed?.errors.length || 0}
      />
    </>
  );
}
