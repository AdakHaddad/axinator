// ── Core Verilog parsing types ──────────────────────────────────────────────

export type PortDirection = 'input' | 'output' | 'inout';

export interface VerilogPort {
  name: string;
  direction: PortDirection;
  width: number;          // total bit width, e.g. 16 for [15:0]
  msb: number;            // e.g. 15
  lsb: number;            // e.g. 0
  signed: boolean;
  raw: string;            // original declaration line
}

export interface VerilogParameter {
  name: string;
  defaultValue: string;
  raw: string;
}

export interface ParsedModule {
  moduleName: string;
  parameters: VerilogParameter[];
  ports: VerilogPort[];
  errors: ParseError[];
  raw: string;            // full original Verilog text
}

export interface ParseError {
  line: number;
  message: string;
}

// ── Port configuration types ─────────────────────────────────────────────────

export enum PortType {
  CLOCK            = 'CLOCK',
  RESET            = 'RESET',
  AXI_REGISTER     = 'AXI_REGISTER',
  EXTERNAL_INPUT   = 'EXTERNAL_INPUT',
  EXTERNAL_OUTPUT  = 'EXTERNAL_OUTPUT',
  EXTERNAL_INOUT   = 'EXTERNAL_INOUT',
  IGNORE           = 'IGNORE',
}

export type ResetPolarity = 'active_low' | 'active_high';
export type RegisterMode  = 'RW' | 'RO' | 'WO';

export interface PortConfig {
  port: VerilogPort;
  portType: PortType;
  // filled when portType === AXI_REGISTER
  registerIndex?: number;
}

// ── Register map types ───────────────────────────────────────────────────────

export interface RegisterEntry {
  regName: string;        // e.g. slv_reg0
  address: number;        // byte address, e.g. 0x00
  width: number;          // bits used, e.g. 16
  msb: number;            // slice MSB, e.g. 15
  lsb: number;            // slice LSB, e.g. 0
  mode: RegisterMode;     // RW / RO / WO
  mappedPort: string;     // port name this register drives
}

// ── IP configuration ─────────────────────────────────────────────────────────

export interface ClockConfig {
  portName: string;       // the verilog port used as clock
  useAxiClock: boolean;   // connect to S_AXI_ACLK
}

export interface ResetConfig {
  portName: string;
  polarity: ResetPolarity;
  useAxiReset: boolean;   // connect to S_AXI_ARESETN
}

export interface IPConfig {
  ipName: string;
  dataWidth: 32 | 64;
  clock: ClockConfig | null;
  reset: ResetConfig | null;
  portConfigs: PortConfig[];
  registers: RegisterEntry[];
}

// ── Generator output ─────────────────────────────────────────────────────────

export interface GeneratedFiles {
  topWrapper: string;
  axiSlave: string;
  originalHdl: string;
  registerMapMd: string;
  componentXml: string;
  readme: string;
}
