import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { GeneratedFiles } from './types';

/**
 * Packages all generated files into a ZIP and triggers browser download.
 * originalFiles are the RTL sources already stored in generated.sourceMap.
 */
export async function downloadZip(
  ipName: string,
  files: GeneratedFiles,
): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder(ipName)!;

  // hdl/ — generated wrappers
  const hdl = root.folder('hdl')!;
  hdl.file(`${ipName}.v`,         files.topWrapper);
  hdl.file(`${ipName}_S00_AXI.v`, files.axiSlave);

  // hdl/ — all original RTL sources
  for (const [filename, content] of files.sourceMap.entries()) {
    hdl.file(filename, content);
  }

  // xgui/ placeholder
  const xgui = root.folder('xgui')!;
  xgui.file(
    `${ipName}_v1_0.tcl`,
    `# Auto-generated xgui Tcl stub for ${ipName}\n# Open in Vivado IP Packager to complete.\n`,
  );

  // Root files
  root.file('component.xml', files.componentXml);
  root.file('README.md',     files.readme);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(blob, `${ipName}.zip`);
}
