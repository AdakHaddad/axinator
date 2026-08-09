import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Axinator — Verilog AXI Wrapper Generator',
  description:
    'Convert any Verilog module into a Vivado AXI4-Lite IP wrapper package. Parse ports, configure register maps, and generate synthesizable HDL — entirely in your browser.',
  keywords: ['Verilog', 'AXI4-Lite', 'Vivado', 'IP wrapper', 'FPGA', 'HDL', 'Xilinx'],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme is set client-side in page.tsx based on localStorage / OS pref.
    // Default to dark so there's no flash before hydration.
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="h-full overflow-hidden flex flex-col">{children}</body>
    </html>
  );
}
