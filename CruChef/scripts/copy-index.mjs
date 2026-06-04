import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const browserDir = join(process.cwd(), 'dist', 'CruChef', 'browser');
const csrIndexPath = join(browserDir, 'index.csr.html');
const indexPath = join(browserDir, 'index.html');

if (existsSync(csrIndexPath)) {
  copyFileSync(csrIndexPath, indexPath);
  console.log(`Copied ${csrIndexPath} to ${indexPath}`);
}
