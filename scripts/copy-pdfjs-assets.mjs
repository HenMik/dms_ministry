import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json', { paths: [require.resolve('react-pdf')] }));
const target = join(process.cwd(), 'public', 'pdfjs');

mkdirSync(target, { recursive: true });

for (const dir of ['cmaps', 'standard_fonts']) {
    const source = join(pdfjsRoot, dir);
    if (existsSync(source)) {
        cpSync(source, join(target, dir), { recursive: true });
    }
}
