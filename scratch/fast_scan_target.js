const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const targets = ['210951', '210 951', '210,951'];

function scanFolder(dir, maxDepth = 3) {
  if (maxDepth < 0) return;
  let items = [];
  try {
    items = fs.readdirSync(dir);
  } catch (e) {
    return;
  }

  for (const item of items) {
    if (item.startsWith('.') || item === 'node_modules' || item === 'AppData' || item === '$Recycle.Bin') continue;
    const fullPath = path.join(dir, item);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    if (stat.isDirectory()) {
      scanFolder(fullPath, maxDepth - 1);
    } else {
      const ext = path.extname(item).toLowerCase();
      if (['.xlsx', '.xls', '.csv', '.txt', '.json'].includes(ext)) {
        if (stat.size > 50 * 1024 * 1024) continue; // skip > 50MB
        try {
          if (ext === '.xlsx' || ext === '.xls') {
            const wb = XLSX.readFile(fullPath);
            for (const s of wb.SheetNames) {
              const ws = wb.Sheets[s];
              const txt = JSON.stringify(ws);
              for (const t of targets) {
                if (txt.includes(t)) {
                  console.log(`[MATCH FOUND] File: ${fullPath} | Sheet: ${s} | Target: ${t}`);
                }
              }
            }
          } else {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const t of targets) {
              if (content.includes(t)) {
                console.log(`[MATCH FOUND] Text File: ${fullPath} | Target: ${t}`);
              }
            }
          }
        } catch (e) {}
      }
    }
  }
}

console.log('Starting scan across user directories...');
scanFolder('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG', 3);
scanFolder('C:/Users/msai/Documents', 3);
scanFolder('C:/Users/msai/Desktop', 3);
scanFolder('C:/Users/msai/Downloads', 3);
console.log('Scan complete.');
