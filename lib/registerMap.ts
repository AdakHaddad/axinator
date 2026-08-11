import type { PortConfig, RegisterEntry } from './types';
import { PortType } from './types';

/**
 * Auto-generate a register map from the current port configuration.
 *
 * Packing rules:
 *  - Ports whose width is ≤ 16 bits are candidates for packing into one
 *    32-bit word (two ports per register).
 *  - Ports wider than 16 bits each get their own 32-bit register.
 *  - A pending narrow port that has no partner at the end of the list is
 *    promoted to its own register (upper half stays zero / unused).
 *
 * This matches the natural Vivado convention and saves address space.
 */
export function buildRegisterMap(portConfigs: PortConfig[]): RegisterEntry[] {
  const registers: RegisterEntry[] = [];
  let regIndex = 0;

  // Collect only AXI_REGISTER ports
  const axiPorts = portConfigs.filter(pc => pc.portType === PortType.AXI_REGISTER);

  let i = 0;
  while (i < axiPorts.length) {
    const pc = axiPorts[i];
    const port = pc.port;
    const address = regIndex * 4; // 0x00, 0x04, 0x08 …

    if (port.width <= 16 && i + 1 < axiPorts.length) {
      // Peek at the next port — pack if it also fits in the lower 16 bits
      const next = axiPorts[i + 1];
      if (next.port.width <= 16) {
        const regName = `slv_reg${regIndex}`;

        // Low half [15:0] → first port
        registers.push({
          regName,
          address,
          width: port.width,
          msb: port.width - 1,
          lsb: 0,
          mode: 'RW',
          mappedPort: port.name,
          packed: false,
        });

        // High half [31:16] → second port
        registers.push({
          regName,
          address,
          width: next.port.width,
          msb: 16 + next.port.width - 1,
          lsb: 16,
          mode: 'RW',
          mappedPort: next.port.name,
          packed: true,
        });

        regIndex++;
        i += 2;
        continue;
      }
    }

    // Default: one port occupies a full 32-bit register
    registers.push({
      regName: `slv_reg${regIndex}`,
      address,
      width: port.width,
      msb: port.width - 1,
      lsb: 0,
      mode: 'RW',
      mappedPort: port.name,
      packed: false,
    });

    regIndex++;
    i++;
  }

  return registers;
}

/**
 * Compute C_S_AXI_ADDR_WIDTH from the number of *physical* registers.
 *
 * A physical register is a unique 32-bit word (packed pairs count as one).
 * Formula: we need to address up to (numPhysRegs * 4 - 4) byte offset,
 * so the minimum address bits = ceil(log2(numPhysRegs)) + 2, minimum 4.
 *
 * Examples:
 *   1 reg  → ceil(log2(1))+2 = 0+2 = 2 → max(2,4) = 4  ✓
 *   4 regs → ceil(log2(4))+2 = 2+2 = 4                  ✓
 *   5 regs → ceil(log2(5))+2 = 3+2 = 5                  ✓
 *  80 regs → ceil(log2(80))+2 = 7+2 = 9                 ✓
 */
export function calcAddrWidth(numPhysRegs: number): number {
  if (numPhysRegs <= 0) return 4;
  const bits = Math.ceil(Math.log2(numPhysRegs)) + 2;
  return Math.max(bits, 4);
}

/**
 * Count distinct physical registers (unique regName/address pairs).
 * Packed pairs count as one.
 */
export function countPhysicalRegs(registers: RegisterEntry[]): number {
  const seen = new Set<number>();
  for (const r of registers) seen.add(r.address);
  return seen.size;
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
