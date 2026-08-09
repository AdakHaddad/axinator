import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { GeneratedFiles, UploadedFile } from './types';

/**
 * Packages all generated files into a ZIP and triggers browser download.
 */
export async function downloadZip(
  ipName: string,
  files: GeneratedFiles,
  originalFiles: UploadedFile[]
): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder(ipName)!;

  // hdl/
  const hdl = root.folder('hdl')!;
  hdl.file(`${ipName}.v`,          files.topWrapper);
  hdl.file(`${ipName}_S00_AXI.v`,  files.axiSlave);
  
  for (const f of originalFiles) {
    hdl.file(f.filename, f.content);
  }

  // xgui/ (placeholder — Vivado generates this automatically on package)
  const xgui = root.folder('xgui')!;
  xgui.file(`${ipName}_v1_0.tcl`,
    `# Auto-generated xgui Tcl stub for ${ipName}\n# Open in Vivado IP Packager to complete.\n`);

  // root files
  root.file('component.xml', files.componentXml);
  root.file('README.md',     files.readme);

  // generate and download
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(blob, `${ipName}.zip`);
}
