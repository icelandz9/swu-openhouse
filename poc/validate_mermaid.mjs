import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

function findMarkdownFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.next') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findMarkdownFiles(fullPath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const mdFiles = findMarkdownFiles('.');
let totalDiagrams = 0;
let totalErrors = 0;

for (const filePath of mdFiles) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const regex = /```mermaid\s*\n([\s\S]*?)\n```/g;
  let match;
  let fileDiagramCount = 0;

  while ((match = regex.exec(content)) !== null) {
    totalDiagrams++;
    fileDiagramCount++;
    const diagramCode = match[1].trim();
    const firstLine = diagramCode.split('\n')[0];
    try {
      await mermaid.parse(diagramCode);
    } catch (err) {
      totalErrors++;
      console.error(`❌ [${filePath}] Diagram #${fileDiagramCount} (${firstLine})`);
      console.error(`   Error: ${err.message || err}`);
      console.error(`   Snippet:\n${diagramCode.split('\n').slice(0, 8).join('\n')}\n`);
    }
  }
}

console.log(`\n==============================================`);
console.log(`Audited ${mdFiles.length} Markdown files.`);
console.log(`Total Mermaid Diagrams: ${totalDiagrams} | Errors: ${totalErrors}`);
console.log(`==============================================`);
