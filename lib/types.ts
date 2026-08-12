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
  filename: string;
  parameters: VerilogParameter[];
  ports: VerilogPort[];
  instantiations: string[]; // names of instantiated modules
  errors: ParseError[];
  raw: string;            // full original Verilog text of the module
}

export interface UploadedFile {
  filename: string;
  content: string;
}

// ── Dependency graph ─────────────────────────────────────────────────────────

/** A single node in the rendered dependency tree */
export interface DependencyNode {
  moduleName: string;
  filename: string;       // source file that defines this module
  children: DependencyNode[];
  isMissing: boolean;     // true when module is instantiated but has no source
}

export interface DependencyGraph {
  modules: Map<string, ParsedModule>;
  topCandidates: string[];
  /** moduleName → list of missing instantiated module names */
  missingDeps: Map<string, string[]>;
  /** All modules that are NOT reachable from a given top module (populated per-query) */
  unreachableModules?: string[];
  /** True when a circular dependency was detected */
  hasCycle: boolean;
  /** Pairs of module names that form a cycle, e.g. [['a','b'],['b','a']] */
  cycleEdges: [string, string][];
}

export interface ParseError {
  line: number;
  message: string;
}

// ── Validation ───────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationMessage {
  severity: ValidationSeverity;
  message: string;
}

export interface ValidationResult {
  valid: boolean;           // false if any errors exist
  messages: ValidationMessage[];
}

// ── Port configuration types ─────────────────────────────────────────────────

export enum PortType {
  CLOCK            = 'CLOCK',
  RESET            = 'RESET',
  AXI_REGISTER     = 'AXI_REGISTER',
  /** Output sampled into a read-only (RO) AXI register so firmware can read it */
  AXI_READ         = 'AXI_READ',
  EXTERNAL_INPUT   = 'EXTERNAL_INPUT',
  EXTERNAL_OUTPUT  = 'EXTERNAL_OUTPUT',
  EXTERNAL_INOUT   = 'EXTERNAL_INOUT',
  IGNORE           = 'IGNORE',
}

/**
 * Confidence level for an auto-classified port type.
 * HIGH   = strong naming convention match (clk, rst_n, y_out etc.)
 * MEDIUM = reasonable guess based on direction + width
 * LOW    = fell through to a default rule — user should verify
 */
export type HeuristicConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type ResetPolarity = 'active_low' | 'active_high';
export type RegisterMode  = 'RW' | 'RO' | 'WO';

export interface PortConfig {
  port: VerilogPort;
  portType: PortType;
  /** Confidence of the auto-classification. undefined = user-overridden. */
  confidence?: HeuristicConfidence;
  // filled when portType === AXI_REGISTER
  registerIndex?: number;
}

// ── Register map types ───────────────────────────────────────────────────────

export interface RegisterEntry {
  regName: string;        // e.g. slv_reg0
  address: number;        // byte address, e.g. 0x00
  width: number;          // bits used, e.g. 16
  msb: number;            // slice MSB within the 32-bit register word, e.g. 15
  lsb: number;            // slice LSB within the 32-bit register word, e.g. 0
  mode: RegisterMode;     // RW / RO / WO
  mappedPort: string;     // port name this register drives
  /**
   * When two narrow ports are packed into the same 32-bit register word,
   * both entries share the same regName and address but differ in msb/lsb.
   * packed = true marks the second (high-half) port in such a pair.
   */
  packed?: boolean;
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
  /** Names of all source files that should be included in the IP package (in order) */
  sourceFiles: { filename: string; content: string }[];
}

// ── Generator output ─────────────────────────────────────────────────────────

export interface GeneratedFiles {
  topWrapper: string;
  axiSlave: string;
  /** Map from filename → content for all original HDL source files */
  sourceMap: Map<string, string>;
  registerMapMd: string;
  componentXml: string;
  readme: string;
  /** C driver that lets firmware (MicroBlaze/Zynq/RISC-V) poke the registers */
  driverHeader: string;
  driverSource: string;
}
