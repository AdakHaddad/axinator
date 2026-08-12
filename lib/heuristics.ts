import { PortType } from './types';
import type { VerilogPort, PortConfig, HeuristicConfidence } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal result type — confidence travels alongside the suggestion
// ─────────────────────────────────────────────────────────────────────────────

interface Suggestion {
  portType: PortType;
  confidence: HeuristicConfidence;
}

// ─────────────────────────────────────────────────────────────────────────────
// suggestPortType  (now returns confidence too)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suggest a PortType for a VerilogPort based on naming conventions.
 * Returns both the type and a confidence level so the UI can warn the user
 * when the classification is uncertain.
 *
 * HIGH   = strong, unambiguous naming match
 * MEDIUM = reasonable guess, most designs would agree
 * LOW    = fell through to a width-based default — user should double-check
 */
export function suggestPortConfig(port: VerilogPort): Suggestion {
  const n = port.name.toLowerCase();

  // ── Clock — HIGH confidence ──────────────────────────────────────────────
  if (
    port.direction === 'input' &&
    port.width === 1 &&
    (n === 'clk' || n === 'clock' ||
     n.startsWith('clk_') || n.endsWith('_clk') ||
     n.startsWith('clock_') || n.endsWith('_clock') ||
     n === 'mclk' || n === 'sclk' || n === 'aclk' ||
     n === 'pclk' || n === 'hclk' || n === 'fclk')
  ) {
    return { portType: PortType.CLOCK, confidence: 'HIGH' };
  }

  // ── Reset — HIGH confidence ──────────────────────────────────────────────
  if (
    port.direction === 'input' &&
    port.width === 1 &&
    (n === 'rst' || n === 'reset' || n === 'rstn' || n === 'resetn' ||
     n === 'rst_n' || n === 'reset_n' || n === 'aresetn' || n === 'nrst' ||
     n.startsWith('rst_') || n.endsWith('_rst') ||
     n.startsWith('reset_') || n.endsWith('_reset') ||
     n.startsWith('arst') || n.endsWith('_rstn'))
  ) {
    return { portType: PortType.RESET, confidence: 'HIGH' };
  }

  // ── Output — HIGH confidence (direction is explicit in RTL) ─────────────
  if (port.direction === 'output') {
    return { portType: PortType.EXTERNAL_OUTPUT, confidence: 'HIGH' };
  }

  // ── Inout — HIGH confidence ──────────────────────────────────────────────
  if (port.direction === 'inout') {
    return { portType: PortType.EXTERNAL_INOUT, confidence: 'HIGH' };
  }

  // From here all ports are inputs. Confidence depends on naming clarity.

  // ── Well-known control/data input names → EXTERNAL_INPUT, HIGH ──────────
  if (
    port.direction === 'input' &&
    (n === 'valid' || n === 'en' || n === 'enable' || n === 'start' ||
     n === 'ce' || n === 'wr' || n === 'rd' || n === 'we' || n === 'oe' ||
     n === 'cs' || n === 'load' || n === 'clear' || n === 'sync' ||
     n === 'strobe' || n === 'busy' || n === 'ready' ||
     n.startsWith('valid') || n.endsWith('_valid') ||
     n.startsWith('en_')   || n.endsWith('_en') ||
     n.startsWith('sel')   || n.endsWith('_sel') ||
     n.includes('irq')     || n.includes('int'))
  ) {
    return { portType: PortType.EXTERNAL_INPUT, confidence: 'HIGH' };
  }

  // ── Coefficient/config inputs (b0_1, a2_2, ..._in DSP coeffs) → AXI_REGISTER ─
  // MUST run before the generic "_in" data-bus rule so filter-style coefficient
  // ports (b0_1_in, b1_2_in, a2_2_in, ...) become AXI registers instead of
  // external pins. Without this, a filter's coefficients get no register map.
  if (
    port.direction === 'input' &&
    port.width > 1 &&
    /^[ab](\d|_)/.test(n)   // b0_1_in, a1_2_in, b_coeff, a2, b3, ...
  ) {
    return { portType: PortType.AXI_REGISTER, confidence: 'MEDIUM' };
  }

  // ── Data/streaming bus names → EXTERNAL_INPUT, HIGH ─────────────────────
  if (
    port.direction === 'input' &&
    (n === 'x_in' || n === 'din' || n === 'data_in' ||
     n === 'sample' || n === 'sample_in' || n === 'audio_in' ||
     n.includes('data') || n.includes('addr') || n.includes('bus') ||
     n.startsWith('x_') ||
     n.includes('tdata') || n.includes('tvalid') || n.includes('tlast') ||
     n.includes('gpio') || n.includes('io') ||
     (n.includes('_in') && n.endsWith('_in')))
  ) {
    return { portType: PortType.EXTERNAL_INPUT, confidence: 'HIGH' };
  }

  // ── Switch / selector inputs (common in DSP) → EXTERNAL_INPUT, MEDIUM ───
  if (
    port.direction === 'input' &&
    (n === 'sw' || n.startsWith('sw_') || n.endsWith('_sw') ||
     n === 'sel' || n.startsWith('sel_') || n.endsWith('_sel') ||
     n === 'mode' || n === 'ctrl')
  ) {
    return { portType: PortType.EXTERNAL_INPUT, confidence: 'MEDIUM' };
  }

  // ── Multi-bit inputs — ambiguous; could be coefficient/config or data ────
  // Lean toward AXI_REGISTER for coefficient-like names (b, a + number suffix)
  if (
    port.direction === 'input' &&
    port.width > 1 &&
    /^[ab]\d/.test(n)   // matches b0, a1, b0_1_in, a2_2, etc.
  ) {
    return { portType: PortType.AXI_REGISTER, confidence: 'MEDIUM' };
  }

  // ── Multi-bit input with no recognisable name → AXI_REGISTER, LOW ───────
  if (port.direction === 'input' && port.width > 1) {
    return { portType: PortType.AXI_REGISTER, confidence: 'LOW' };
  }

  // ── Single-bit input, name unrecognised → EXTERNAL_INPUT, LOW ────────────
  return { portType: PortType.EXTERNAL_INPUT, confidence: 'LOW' };
}

/**
 * Build a PortConfig with heuristic suggestion and confidence attached.
 * Use this instead of calling suggestPortType directly.
 */
export function buildPortConfig(port: VerilogPort): PortConfig {
  const { portType, confidence } = suggestPortConfig(port);
  return { port, portType, confidence };
}

/**
 * Legacy shim — returns only the PortType for callers that don't need confidence.
 */
export function suggestPortType(port: VerilogPort): PortType {
  return suggestPortConfig(port).portType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Label / colour helpers (unchanged API)
// ─────────────────────────────────────────────────────────────────────────────

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
    default: return 'UNKNOWN';
  }
}

/** Badge colour class for each PortType */
export function portTypeColor(pt: PortType): string {
  switch (pt) {
    case PortType.CLOCK:           return 'badge-clock';
    case PortType.RESET:           return 'badge-reset';
    case PortType.AXI_REGISTER:    return 'badge-axi';
    case PortType.EXTERNAL_INPUT:  return 'badge-ext-in';
    case PortType.EXTERNAL_OUTPUT: return 'badge-ext-out';
    case PortType.EXTERNAL_INOUT:  return 'badge-ext-inout';
    case PortType.IGNORE:          return 'badge-ignore';
    default: return 'badge-ignore';
  }
}

/** Tooltip text explaining why a confidence level was assigned */
export function confidenceTooltip(confidence: HeuristicConfidence): string {
  switch (confidence) {
    case 'HIGH':   return 'Strong naming-convention match — classification is reliable.';
    case 'MEDIUM': return 'Reasonable guess — verify this is correct for your design.';
    case 'LOW':    return 'No naming convention matched — defaulted by width/direction. Please review.';
  }
}
