import type {
  VerilogPort,
  VerilogParameter,
  ParsedModule,
  ParseError,
  PortDirection,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripComments(src: string): string {
  // Remove block comments /* ... */
  let s = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Remove line comments // ...
  s = s.replace(/\/\/[^\n]*/g, '');
  return s;
}

function parseWidth(widthStr: string | undefined): { msb: number; lsb: number; width: number } {
  if (!widthStr || widthStr.trim() === '') {
    return { msb: 0, lsb: 0, width: 1 };
  }
  const m = widthStr.trim().match(/^\[(\d+)\s*:\s*(\d+)\]$/);
  if (!m) return { msb: 0, lsb: 0, width: 1 };
  const msb = parseInt(m[1], 10);
  const lsb = parseInt(m[2], 10);
  return { msb, lsb, width: Math.abs(msb - lsb) + 1 };
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseVerilog(src: string): ParsedModule {
  const errors: ParseError[] = [];

  // ── 1. Strip comments ────────────────────────────────────────────────────
  const clean = stripComments(src);

  // ── 2. Extract module name ───────────────────────────────────────────────
  const moduleMatch = clean.match(/\bmodule\s+(\w+)/);
  if (!moduleMatch) {
    errors.push({ line: 0, message: 'Could not find a module declaration.' });
    return { moduleName: 'unknown', parameters: [], ports: [], errors, raw: src };
  }
  const moduleName = moduleMatch[1];

  // ── 3. Extract parameter block #( ... ) ──────────────────────────────────
  const parameters: VerilogParameter[] = [];
  const paramBlockMatch = clean.match(/\bmodule\s+\w+\s*#\s*\(([\s\S]*?)\)\s*\(/);
  if (paramBlockMatch) {
    const paramBlock = paramBlockMatch[1];
    const paramLines = paramBlock.split(',');
    for (const pl of paramLines) {
      // parameter [type] NAME = value
      const pm = pl.match(/\bparameter\b(?:\s+\w+)?\s+(\w+)\s*=\s*([^,\n]+)/);
      if (pm) {
        parameters.push({
          name: pm[1].trim(),
          defaultValue: pm[2].trim(),
          raw: pl.trim(),
        });
      }
    }
  }

  // ── 4. Extract port list ─────────────────────────────────────────────────
  // Find the port list: the first (...) after the module name (and optional params)
  let portBlockStr = '';
  let searchFrom = clean.indexOf(moduleName, clean.indexOf('module'));
  // skip past parameter block if any
  const hashIdx = clean.indexOf('#', searchFrom);
  let parenStart = -1;

  if (hashIdx !== -1 && hashIdx < clean.indexOf('(', searchFrom)) {
    // has parameter block - find matching closing paren then the next open paren
    let depth = 0;
    let i = clean.indexOf('(', hashIdx);
    for (; i < clean.length; i++) {
      if (clean[i] === '(') depth++;
      else if (clean[i] === ')') {
        depth--;
        if (depth === 0) { parenStart = clean.indexOf('(', i + 1); break; }
      }
    }
  } else {
    parenStart = clean.indexOf('(', searchFrom);
  }

  if (parenStart === -1) {
    errors.push({ line: 0, message: 'Could not find port list.' });
    return { moduleName, parameters, ports: [], errors, raw: src };
  }

  // Extract balanced parens for port block
  let depth = 0;
  let portBlockEnd = parenStart;
  for (let i = parenStart; i < clean.length; i++) {
    if (clean[i] === '(') depth++;
    else if (clean[i] === ')') {
      depth--;
      if (depth === 0) { portBlockEnd = i; break; }
    }
  }
  portBlockStr = clean.slice(parenStart + 1, portBlockEnd);

  // ── 5. Parse individual ports ────────────────────────────────────────────
  const ports: VerilogPort[] = [];

  // Split by comma at top level (depth 0 within the port block)
  const portDecls = splitTopLevel(portBlockStr, ',');

  // Port declaration regex:
  // (input|output|inout) [wire|reg] [signed] [[MSB:LSB]] NAME
  const portRegex =
    /^\s*(input|output|inout)\s+(?:(wire|reg)\s+)?(?:(signed)\s+)?(\[\s*\d+\s*:\s*\d+\s*\]\s*)?(\w+)\s*$/;

  for (let idx = 0; idx < portDecls.length; idx++) {
    const decl = portDecls[idx].trim();
    if (!decl) continue;

    const m = portRegex.exec(decl);
    if (!m) {
      // Try to find line number in original source
      const lineNo = findLineNumber(src, decl);
      // Skip empty/comment lines silently; warn on real content
      if (decl.replace(/\s/g, '')) {
        errors.push({
          line: lineNo,
          message: `Could not parse port declaration: "${decl.slice(0, 60)}"`,
        });
      }
      continue;
    }

    const direction = m[1] as PortDirection;
    const isSigned = !!m[3];
    const widthStr = m[4];
    const name = m[5];

    const { msb, lsb, width } = parseWidth(widthStr);

    ports.push({
      name,
      direction,
      width,
      msb,
      lsb,
      signed: isSigned,
      raw: decl,
    });
  }

  return { moduleName, parameters, ports, errors, raw: src };
}

/** Split a string by a separator, respecting nested brackets/parens */
function splitTopLevel(str: string, sep: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) {
      results.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) results.push(current);
  return results;
}

function findLineNumber(src: string, snippet: string): number {
  const lines = src.split('\n');
  const target = snippet.trim().slice(0, 20);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(target)) return i + 1;
  }
  return 0;
}
