import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  let rawImport = false;
  if (specifier.endsWith('?raw')) {
    rawImport = true;
    specifier = specifier.slice(0, -4);
  }

  if (specifier.startsWith('.') || specifier.startsWith('/') || (specifier.length > 2 && specifier[1] === ':')) {
    const parentDir = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
    let targetPath = path.resolve(parentDir, specifier);

    const candidates = [
      targetPath,
      targetPath + '.ts',
      targetPath + '.tsx',
      targetPath + '.js',
      path.join(targetPath, 'index.ts'),
      path.join(targetPath, 'index.tsx'),
      path.join(targetPath, 'index.js'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        const url = pathToFileURL(cand).href + (rawImport ? '?raw' : '');
        return { shortCircuit: true, url };
      }
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('?raw')) {
    const filePath = fileURLToPath(url.slice(0, -4));
    const content = fs.readFileSync(filePath, 'utf-8');
    return {
      shortCircuit: true,
      format: 'module',
      source: `export default ${JSON.stringify(content)};`,
    };
  }
  return nextLoad(url, context);
}
