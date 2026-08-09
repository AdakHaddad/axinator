# Verilog AXI Wrapper Generator

> Convert existing Verilog RTL into a Vivado-compatible AXI4-Lite IP wrapper — automatically.

[![Next.js](https://img.shields.io/badge/Next.js-TypeScript-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](#license)

**Verilog AXI Wrapper Generator** is a web-based EDA tool that automates the repetitive work of turning an existing Verilog module into an AXI4-Lite peripheral suitable for use in AMD/Xilinx Vivado.

Instead of manually creating AXI ports, register mappings, AXI slave logic, and RTL instantiations, the tool analyzes the Verilog interface and generates the required wrapper automatically.

> **Verilog RTL → Port Configuration → AXI4-Lite Wrapper → Vivado IP Package**

---

## Features

- Parse existing Verilog `.v` files
- Upload or paste HDL source
- Support multiple Verilog source files
- Detect Verilog modules and module instantiations
- Build the internal module dependency hierarchy
- Select the top-level RTL module
- Automatically detect module ports
- Configure port roles interactively
- Map HDL inputs to AXI4-Lite registers
- Preserve external inputs and outputs
- Automatically generate register addresses
- Automatically calculate AXI address width
- Generate dynamic register declarations
- Generate AXI read/write logic
- Preserve AXI `WSTRB` byte-enable handling
- Automatically instantiate the original RTL
- Preserve the original RTL hierarchy
- Generate Vivado-style AXI4-Lite wrappers
- Generate `component.xml`
- Generate a complete IP directory
- Download the generated IP as a ZIP archive
- Preview generated Verilog and register maps

---

## What Problem Does It Solve?

Creating a custom AXI4-Lite peripheral in Vivado is straightforward but repetitive.

For an existing RTL module, the developer normally has to manually:

1. Create an AXI4-Lite peripheral.
2. Add the RTL module to the project.
3. Add ports to the AXI wrapper.
4. Create AXI registers.
5. Connect registers to the RTL module.
6. Modify register write logic.
7. Modify register read logic.
8. Instantiate the RTL module.
9. Connect all ports.
10. Package the result as an IP.

This tool automates those repetitive steps.

For example, instead of manually writing:

```verilog
slv_reg0
slv_reg1
slv_reg2
...
```

and then manually connecting:

```verilog
.b0_1(slv_reg0[15:0]),
.b1_1(slv_reg1[15:0]),
.b2_1(slv_reg2[15:0]),
```

the application generates these connections from the user's port configuration.

---

# How It Works

```text
                 Verilog Source
                       │
                       ▼
                ┌──────────────┐
                │ Verilog      │
                │ Parser       │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Module /     │
                │ Dependency   │
                │ Detection    │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Top Module   │
                │ Selection    │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Port          │
                │ Configuration │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ AXI Register │
                │ Map          │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ AXI4-Lite    │
                │ Generator    │
                └──────┬───────┘
                       │
                       ▼
                ┌──────────────┐
                │ Vivado IP    │
                │ Package      │
                └──────────────┘
```

The original RTL is treated as a **black box**.

The generator does not need to understand whether the design is:

* an IIR filter
* an FIR filter
* an I2S peripheral
* a UART
* a GPIO controller
* a DSP accelerator
* an arithmetic unit
* a custom FPGA peripheral

It only needs to understand the module interface and its source hierarchy.

---

# Example

Suppose the user has:

```verilog
module multiplier (
    input wire clk,
    input wire enable,
    input wire signed [15:0] a,
    input wire signed [15:0] b,
    output wire signed [31:0] result
);

endmodule
```

The application detects:

| Port     | Direction | Width | Signed |
| -------- | --------- | ----: | ------ |
| `clk`    | input     |     1 | No     |
| `enable` | input     |     1 | No     |
| `a`      | input     |    16 | Yes    |
| `b`      | input     |    16 | Yes    |
| `result` | output    |    32 | Yes    |

The user can configure:

```text
clk     → CLOCK
enable  → AXI REGISTER
a       → AXI REGISTER
b       → AXI REGISTER
result  → EXTERNAL OUTPUT
```

The generated register map becomes:

| Address | Register   | HDL Port | Width |
| ------- | ---------- | -------- | ----: |
| `0x00`  | `slv_reg0` | `enable` |     1 |
| `0x04`  | `slv_reg1` | `a`      |    16 |
| `0x08`  | `slv_reg2` | `b`      |    16 |

The generated RTL instantiation becomes:

```verilog
multiplier u_multiplier (
    .clk(S_AXI_ACLK),
    .enable(slv_reg0[0]),
    .a(slv_reg1[15:0]),
    .b(slv_reg2[15:0]),
    .result(result)
);
```

No module-specific code needs to be manually written.

---

# Multi-File RTL

The generator supports designs consisting of multiple Verilog files.

For example:

```text
filter_coeff.v
filter_biquad.v
```

where `filter_coeff` contains:

```verilog
filter_biquad stage1 (...);
filter_biquad stage2 (...);
```

The application detects the dependency:

```text
filter_coeff
├── filter_biquad
└── filter_biquad
```

The user selects:

```text
TOP MODULE = filter_coeff
```

Only the top-level module is wrapped with AXI4-Lite.

The internal hierarchy remains unchanged.

The generated package becomes:

```text
AXI_FILTER/
├── hdl/
│   ├── AXI_FILTER.v
│   ├── AXI_FILTER_slave_lite_v1_0_S00_AXI.v
│   ├── filter_coeff.v
│   └── filter_biquad.v
├── xgui/
├── component.xml
└── README.md
```

The generator does **not**:

* flatten the design
* modify internal module instantiations
* generate AXI interfaces for internal modules
* rewrite the original RTL

It simply adds an AXI4-Lite wrapper around the selected top module.

---

# Port Configuration

After parsing the HDL, ports are displayed in an editable table.

Example:

| Port    | Direction | Width | Signed | Type            |
| ------- | --------- | ----: | ------ | --------------- |
| `clk`   | input     |     1 | No     | CLOCK           |
| `valid` | input     |     1 | No     | EXTERNAL INPUT  |
| `sw`    | input     |     3 | No     | EXTERNAL INPUT  |
| `x_in`  | input     |    16 | Yes    | EXTERNAL INPUT  |
| `b0_1`  | input     |    16 | Yes    | AXI REGISTER    |
| `b1_1`  | input     |    16 | Yes    | AXI REGISTER    |
| `y_out` | output    |    16 | Yes    | EXTERNAL OUTPUT |

Available classifications:

* `CLOCK`
* `RESET`
* `AXI REGISTER`
* `EXTERNAL INPUT`
* `EXTERNAL OUTPUT`
* `EXTERNAL INOUT`
* `IGNORE`

The automatic classification is only a suggestion. The user can change it.

---

# AXI4-Lite Register Mapping

Inputs classified as `AXI REGISTER` are automatically mapped to AXI4-Lite registers.

For example:

```text
b0_1 → slv_reg0
b1_1 → slv_reg1
b2_1 → slv_reg2
a1_1 → slv_reg3
a2_1 → slv_reg4
```

With the default 32-bit AXI data width:

```verilog
.b0_1(slv_reg0[15:0]),
.b1_1(slv_reg1[15:0]),
.b2_1(slv_reg2[15:0]),
.a1_1(slv_reg3[15:0]),
.a2_1(slv_reg4[15:0])
```

The number of registers is completely dynamic.

There is no fixed limit of 4, 10, or 80 registers in the generator.

---

# Register Addresses

The default AXI register spacing is 4 bytes:

```text
REG0 → 0x00
REG1 → 0x04
REG2 → 0x08
REG3 → 0x0C
...
```

The application automatically calculates the required `C_S_AXI_ADDR_WIDTH`.

For example:

| Registers | Address Range | Address Width |
| --------: | ------------- | ------------: |
|         4 | `0x00–0x0C`   |             4 |
|         8 | `0x00–0x1C`   |             5 |
|        10 | `0x00–0x24`   |             6 |
|        16 | `0x00–0x3C`   |             6 |
|        32 | `0x00–0x7C`   |             7 |

The register map can be edited before generation.

---

# Register Access

Each AXI register can be configured as:

* `RW` — Read/Write
* `RO` — Read Only
* `WO` — Write Only

The default is:

```text
RW
```

The generator creates the appropriate AXI read/write behavior.

---

# AXI4-Lite Template

The AXI implementation is based on the standard AXI4-Lite peripheral structure generated by Vivado.

The generator does not invent a custom AXI protocol implementation.

The template contains the normal:

* AXI write channel
* AXI read channel
* `AWREADY`
* `WREADY`
* `BVALID`
* `BRESP`
* `ARREADY`
* `RVALID`
* `RRESP`
* `WSTRB`
* address decoding
* register read logic
* register write logic

Only the variable portions are generated.

This makes the output structurally similar to a normal Vivado-generated AXI4-Lite peripheral.

---

# Generated Files

The generated package contains:

```text
AXI_<NAME>/
├── hdl/
│   ├── AXI_<NAME>.v
│   ├── AXI_<NAME>_slave_lite_v1_0_S00_AXI.v
│   └── <original_sources>.v
├── xgui/
├── component.xml
└── README.md
```

### Top-level wrapper

Contains:

* IP parameters
* generated external ports
* AXI4-Lite ports
* AXI slave instantiation

### AXI slave

Contains:

* AXI4-Lite protocol logic
* register declarations
* register read/write logic
* generated RTL instantiation

### Original sources

Copied unchanged from the user's input.

---

# Generated Verilog

For example, the generated structure is:

```verilog
module AXI_FILTER #(
    parameter integer C_S00_AXI_DATA_WIDTH = 32,
    parameter integer C_S00_AXI_ADDR_WIDTH = 6
)(
    // External user ports

    input wire valid,
    input wire [2:0] sw,
    input wire signed [15:0] x_in,
    output wire signed [15:0] y_out,

    // AXI4-Lite ports
    ...
);

    AXI_FILTER_slave_lite_v1_0_S00_AXI #(
        .C_S_AXI_DATA_WIDTH(C_S00_AXI_DATA_WIDTH),
        .C_S_AXI_ADDR_WIDTH(C_S00_AXI_ADDR_WIDTH)
    ) AXI_FILTER_slave_inst (
        ...
    );

endmodule
```

Inside the slave:

```verilog
reg [C_S_AXI_DATA_WIDTH-1:0] slv_reg0;
reg [C_S_AXI_DATA_WIDTH-1:0] slv_reg1;
...
```

and the original RTL is instantiated automatically.

---

# Vivado IP Package

The generated package is intended to be added to a Vivado IP repository.

Typical workflow:

```text
Generate ZIP
      ↓
Extract
      ↓
Vivado
      ↓
Settings
      ↓
IP Repositories
      ↓
Add generated IP directory
      ↓
Use IP in Block Design
```

The generated `component.xml` describes the IP and its interfaces where supported.

---

# UI

The application uses an engineering-tool-oriented interface rather than a marketing landing page.

Main layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Verilog AXI Wrapper Generator                               │
├────────────────┬─────────────────────┬──────────────────────┤
│ HDL Source     │ Port Configuration  │ Register Map         │
│                │                     │                      │
│ module ...     │ clk    CLOCK        │ 0x00  REG0           │
│                │ data   AXI REG      │ 0x04  REG1           │
│                │ enable AXI REG      │ 0x08  REG2           │
│                │ out    OUTPUT        │ ...                  │
├────────────────┴─────────────────────┴──────────────────────┤
│ Generated Files                                              │
│                                                              │
│ [Wrapper] [AXI Slave] [HDL] [XML] [README]                  │
└──────────────────────────────────────────────────────────────┘
```

Actions:

* **Open Verilog**
* **Parse**
* **Generate**
* **Copy**
* **Download ZIP**

---

# Generated Code Preview

The application provides previews for:

* Top-level AXI wrapper
* AXI slave
* Original HDL
* Register map
* `component.xml`
* `README.md`

Code previews should have syntax highlighting and a copy button.

---

# Security & Privacy

The application should process HDL locally in the browser whenever practical.

User HDL should not be uploaded to an external service.

Generated ZIP files should be created client-side.

---

# Technology

Built with:

* [Next.js](https://nextjs.org/)
* TypeScript
* Tailwind CSS
* shadcn/ui
* Monaco Editor
* JSZip

---

# Development

Clone the repository:

```bash
git clone https://github.com/<USERNAME>/<REPOSITORY>.git
cd <REPOSITORY>
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

Build for production:

```bash
npm run build
```

Run the production server:

```bash
npm start
```

---

# Architecture

The application is intentionally divided into independent stages:

```text
┌─────────────────┐
│ Verilog Parser  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Port Model      │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Configuration   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Register Map    │
└────────┬────────┘
         ▼
┌─────────────────┐
│ AXI Generator   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ ZIP Packager    │
└─────────────────┘
```

The parser and generator should remain independent from the UI so the generation engine can later be reused by a CLI.

---

# Roadmap

## Core

* [x] Verilog source input
* [x] Port parsing
* [x] Port classification
* [x] AXI register mapping
* [x] Dynamic register generation
* [x] AXI wrapper generation
* [x] Multi-file dependency support
* [x] ZIP generation

## Planned

* [ ] Improved Verilog parser
* [ ] SystemVerilog support
* [ ] Better `component.xml` generation
* [ ] AXI4-Stream support
* [ ] Multiple AXI interfaces
* [ ] Interrupt generation
* [ ] Parameter generation
* [ ] Register arrays
* [ ] Packed register/memory mappings
* [ ] VHDL support
* [ ] CLI version
* [ ] Vivado project generation
* [ ] Automated validation with Verilog tools

---

# Contributing

Contributions are welcome.

Before making large architectural changes, please open an issue to discuss the proposed approach.

When contributing:

1. Keep the parser independent from the UI.
2. Keep AXI templates separate from generation logic.
3. Do not add module-specific assumptions to the core generator.
4. Preserve the original RTL source.
5. Add tests for parser and register-map changes.

---

# License

This project is licensed under the MIT License.

See [`LICENSE`](LICENSE) for details.

---

## Star History

<a href="https://www.star-history.com/?repos=adakhaddad%2Faxinator&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=adakhaddad/axinator&type=date&theme=dark&legend=top-left&sealed_token=Qssmz4UfL-_Z4B-gP4hSI-CjxX3u88wJDBoKZ-8xmyJg7hPXbZPVDNXWXW1o97DPNWx8oVZZxkiYOVQWcC5g7aKaxrU6UplM46Gd4BDGCVKudYgTqAX28JhsHwzim8o4KfE4D1dYjrypJDYbXBUQpfjZufQjJgCfFmhUWqDh2iLZqSx3GQwclEmzVTN2" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=adakhaddad/axinator&type=date&legend=top-left&sealed_token=Qssmz4UfL-_Z4B-gP4hSI-CjxX3u88wJDBoKZ-8xmyJg7hPXbZPVDNXWXW1o97DPNWx8oVZZxkiYOVQWcC5g7aKaxrU6UplM46Gd4BDGCVKudYgTqAX28JhsHwzim8o4KfE4D1dYjrypJDYbXBUQpfjZufQjJgCfFmhUWqDh2iLZqSx3GQwclEmzVTN2" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=adakhaddad/axinator&type=date&legend=top-left&sealed_token=Qssmz4UfL-_Z4B-gP4hSI-CjxX3u88wJDBoKZ-8xmyJg7hPXbZPVDNXWXW1o97DPNWx8oVZZxkiYOVQWcC5g7aKaxrU6UplM46Gd4BDGCVKudYgTqAX28JhsHwzim8o4KfE4D1dYjrypJDYbXBUQpfjZufQjJgCfFmhUWqDh2iLZqSx3GQwclEmzVTN2" />
 </picture>
</a>

---

# Disclaimer

This project generates HDL/IP packaging files intended for use with Vivado.

Generated output should be reviewed and simulated/synthesized by the user before being used in hardware.