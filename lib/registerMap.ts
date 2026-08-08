import type { PortConfig, RegisterEntry } from './types';
import { PortType } from './types';

/** Auto-generate a register map from the current port configuration */
export function buildRegisterMap(portConfigs: PortConfig[]): RegisterEntry[] {
  const registers: RegisterEntry[] = [];
  let regIndex = 0;

  for (const pc of portConfigs) {
    if (pc.portType !== PortType.AXI_REGISTER) continue;

    const port = pc.port;
    const regName = `slv_reg${regIndex}`;
    const address = regIndex * 4; // 0x00, 0x04, 0x08 ...

    registers.push({
      regName,
      address,
      width: port.width,
      msb: port.msb,
      lsb: port.lsb,
      mode: 'RW',
      mappedPort: port.name,
    });

    regIndex++;
  }

  return registers;
}

/** Compute C_S_AXI_ADDR_WIDTH from the number of registers */
export function calcAddrWidth(numRegs: number): number {
  if (numRegs === 0) return 4;
  // addr width = ceil(log2(numRegs * 4)) + 2, minimum 4
  const bits = Math.ceil(Math.log2(numRegs * 4 + 1));
  return Math.max(bits, 4);
}

/** Format address as 0x-prefixed hex string */
export function formatAddress(addr: number): string {
  return `0x${addr.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** Merge a fresh register map with user edits (preserves user overrides by port name) */
export function mergeRegisters(
  fresh: RegisterEntry[],
  existing: RegisterEntry[]
): RegisterEntry[] {
  return fresh.map((entry) => {
    const existing_match = existing.find((e) => e.mappedPort === entry.mappedPort);
    if (existing_match) {
      // Preserve user-edited mode and regName, but update address/slice from fresh
      return {
        ...entry,
        regName: existing_match.regName,
        mode: existing_match.mode,
      };
    }
    return entry;
  });
}
