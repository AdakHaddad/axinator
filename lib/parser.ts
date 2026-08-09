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

export function parseVerilogFile(filename: string, src: string): ParsedModule[] {
  const clean = stripComments(src);
  const moduleRegex = /\bmodule\s+([a-zA-Z_]\w*)([\s\S]*?)\bendmodule\b/g;
  let match;
  const modules: ParsedModule[] = [];

  while ((match = moduleRegex.exec(clean)) !== null) {
    const rawModule = match[0];
    const moduleName = match[1];
    const moduleBody = match[2];
    const errors: ParseError[] = [];

    // ── Extract parameter block #( ... ) ──────────────────────────────────
    const parameters: VerilogParameter[] = [];
    const paramBlockMatch = moduleBody.match(/^\s*#\s*\(([\s\S]*?)\)\s*\(/);
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

    // ── Extract port list ─────────────────────────────────────────────────
    let portBlockStr = '';
    // Find the first '(' that belongs to the port list
    const hashIdx = moduleBody.indexOf('#');
    let parenStart = -1;

    if (hashIdx !== -1 && hashIdx < moduleBody.indexOf('(')) {
      // has parameter block - find matching closing paren then the next open paren
      let depth = 0;
      let i = moduleBody.indexOf('(', hashIdx);
      for (; i < moduleBody.length; i++) {
        if (moduleBody[i] === '(') depth++;
        else if (moduleBody[i] === ')') {
          depth--;
          if (depth === 0) { parenStart = moduleBody.indexOf('(', i + 1); break; }
        }
      }
    } else {
      parenStart = moduleBody.indexOf('(');
    }

    if (parenStart === -1) {
      errors.push({ line: 0, message: 'Could not find port list.' });
    } else {
      // Extract balanced parens for port block
      let depth = 0;
      let portBlockEnd = parenStart;
      for (let i = parenStart; i < moduleBody.length; i++) {
        if (moduleBody[i] === '(') depth++;
        else if (moduleBody[i] === ')') {
          depth--;
          if (depth === 0) { portBlockEnd = i; break; }
        }
      }
      portBlockStr = moduleBody.slice(parenStart + 1, portBlockEnd);
    }

    // ── Parse individual ports ────────────────────────────────────────────
    const ports: VerilogPort[] = [];
    if (portBlockStr) {
      const portDecls = splitTopLevel(portBlockStr, ',');
      const portRegex = /^\s*(input|output|inout)\s+(?:(wire|reg)\s+)?(?:(signed)\s+)?(\[\s*\d+\s*:\s*\d+\s*\]\s*)?([a-zA-Z_]\w*)\s*$/;

      for (let idx = 0; idx < portDecls.length; idx++) {
        const decl = portDecls[idx].trim();
        if (!decl) continue;

        const m = portRegex.exec(decl);
        if (!m) {
          const lineNo = findLineNumber(src, decl);
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
    }

    // ── Extract instantiations ─────────────────────────────────────────────
    const instantiations = new Set<string>();
    // Pattern: Identifier1 [#(params)] Identifier2 (
    const instRegex = /\b([a-zA-Z_]\w*)\s+(?:#\s*\([\s\S]*?\)\s*)?([a-zA-Z_]\w*)\s*\(/g;
    let instMatch;
    const keywords = new Set([
      'if', 'else', 'case', 'always', 'for', 'while', 'task', 'function', 
      'begin', 'end', 'module', 'endmodule', 'assign', 'wire', 'reg', 'input', 
      'output', 'inout', 'parameter', 'localparam', 'signed', 'unsigned'
    ]);

    while ((instMatch = instRegex.exec(moduleBody)) !== null) {
      const typeName = instMatch[1];
      if (!keywords.has(typeName)) {
        instantiations.add(typeName);
      }
    }

    modules.push({
      moduleName,
      filename,
      parameters,
      ports,
      instantiations: Array.from(instantiations),
      errors,
      raw: rawModule,
    });
  }

  return modules;
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


