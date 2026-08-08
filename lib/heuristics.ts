import { PortType } from './types';
import type { VerilogPort } from './types';

/**
 * Suggests a PortType for a given VerilogPort based on common naming conventions.
 * These are SUGGESTIONS ONLY — the user can always override them in the UI.
 */
export function suggestPortType(port: VerilogPort): PortType {
  const n = port.name.toLowerCase();

  // ── Clock detection ──────────────────────────────────────────────────────
  if (
    port.direction === 'input' &&
    port.width === 1 &&
    (n === 'clk' || n === 'clock' || n.startsWith('clk_') || n.endsWith('_clk') ||
     n.startsWith('clock_') || n.endsWith('_clock') || n === 'mclk' || n === 'sclk' ||
     n === 'aclk' || n === 'pclk' || n === 'hclk' || n === 'fclk')
  ) {
    return PortType.CLOCK;
  }

  // ── Reset detection ──────────────────────────────────────────────────────
  if (
    port.direction === 'input' &&
    port.width === 1 &&
    (n === 'rst' || n === 'reset' || n === 'rstn' || n === 'resetn' ||
     n === 'rst_n' || n === 'reset_n' || n === 'aresetn' || n === 'nrst' ||
     n.startsWith('rst_') || n.endsWith('_rst') ||
     n.startsWith('reset_') || n.endsWith('_reset') ||
     n.startsWith('arst') || n.endsWith('_rstn'))
  ) {
    return PortType.RESET;
  }

  // ── Output ports ─────────────────────────────────────────────────────────
  if (port.direction === 'output') {
    return PortType.EXTERNAL_OUTPUT;
  }

  // ── Inout ports ──────────────────────────────────────────────────────────
  if (port.direction === 'inout') {
    return PortType.EXTERNAL_INOUT;
  }

  // ── Input: heuristic split on width and naming ───────────────────────────
  // Single-bit inputs with common control signal names → external input
  if (
    port.direction === 'input' &&
    port.width === 1 &&
    (n === 'en' || n === 'enable' || n === 'valid' || n === 'start' || n === 'ce' ||
     n === 'wr' || n === 'rd' || n === 'we' || n === 'oe' || n === 'cs' ||
     n.startsWith('valid') || n.endsWith('_valid') || n.startsWith('en_') ||
     n.endsWith('_en') || n.startsWith('sel') || n.endsWith('_sel') ||
     n === 'load' || n === 'clear' || n === 'sync' || n === 'strobe' ||
     n.includes('irq') || n.includes('int') || n === 'busy' || n === 'ready')
  ) {
    return PortType.EXTERNAL_INPUT;
  }

  // Multi-bit inputs with data-like names → external input (streaming/data bus)
  if (
    port.direction === 'input' &&
    port.width > 1 &&
    (n.includes('data') || n.includes('addr') || n.includes('bus') ||
     n.startsWith('x_') || n === 'x_in' || n === 'din' || n === 'data_in' ||
     n.includes('_in') || n.includes('tdata') || n.includes('tvalid') ||
     n.includes('tlast') || n.includes('gpio') || n.includes('io') ||
     n.startsWith('sw') || n === 'sw')
  ) {
    return PortType.EXTERNAL_INPUT;
  }

  // Default for multi-bit inputs: AXI register (coefficients, configuration)
  if (port.direction === 'input' && port.width > 1) {
    return PortType.AXI_REGISTER;
  }

  // Default for single-bit inputs: external
  return PortType.EXTERNAL_INPUT;
}

/** Returns human-readable label for a PortType */
export function portTypeLabel(pt: PortType): string {
  switch (pt) {
    case PortType.CLOCK:           return 'CLOCK';
    case PortType.RESET:           return 'RESET';
    case PortType.AXI_REGISTER:    return 'AXI REGISTER';
    case PortType.EXTERNAL_INPUT:  return 'EXTERNAL INPUT';
    case PortType.EXTERNAL_OUTPUT: return 'EXTERNAL OUTPUT';
    case PortType.EXTERNAL_INOUT:  return 'EXTERNAL INOUT';
    case PortType.IGNORE:          return 'IGNORE';
  }
}

/** Badge color class for each port type */
export function portTypeColor(pt: PortType): string {
  switch (pt) {
    case PortType.CLOCK:           return 'badge-clock';
    case PortType.RESET:           return 'badge-reset';
    case PortType.AXI_REGISTER:    return 'badge-axi';
    case PortType.EXTERNAL_INPUT:  return 'badge-ext-in';
    case PortType.EXTERNAL_OUTPUT: return 'badge-ext-out';
    case PortType.EXTERNAL_INOUT:  return 'badge-ext-inout';
    case PortType.IGNORE:          return 'badge-ignore';
  }
}
