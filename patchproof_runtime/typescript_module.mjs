// Loader for standalone TypeScript utilities, using the project's pinned compiler.
// It executes actual repository source; it does not substitute application logic.
//
// Extended: in addition to fully import-free files, this now recursively resolves
// and transpiles LOCAL imports (relative "./x" / "../x" or the project's "@/x" path
// alias) so multi-file utilities can be tested too. Bare package specifiers (e.g.
// 'zustand', 'react'), TS `import =` / dynamic `import()`, and raw `require(...)`
// calls remain rejected, same as before — this only widens what counts as "local".
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const nodeRequire = createRequire(import.meta.url);
const ts = nodeRequire('typescript');
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

const RESOLVE_EXTS = ['', '.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];

function resolveLocalSpecifier(specifier, fromDir) {
  let target;
  if (specifier.startsWith('.')) {
    target = resolve(fromDir, specifier);
  } else if (specifier.startsWith('@/')) {
    target = resolve(root, specifier.slice(2));
  } else {
    return null; // bare package specifier — not supported
  }
  for (const ext of RESOLVE_EXTS) {
    const candidate = target + ext;
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  return null;
}

function assertWithinRepo(filename) {
  const local = relative(root, filename);
  if (local.startsWith('..') || isAbsolute(local) || !filename.endsWith('.ts')) {
    throw new Error('The loader accepts only .ts files inside this repository.');
  }
  return local;
}

// filename (absolute, realpath'd) -> { exports } | 'loading' (cycle guard)
const moduleCache = new Map();

function loadModule(filename) {
  assertWithinRepo(filename);
  const cached = moduleCache.get(filename);
  if (cached === 'loading') {
    throw new Error(`Circular import detected while loading ${filename}`);
  }
  if (cached) return cached.exports;

  moduleCache.set(filename, 'loading');

  const source = readFileSync(filename, 'utf8');
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true);
  const fromDir = dirname(filename);
  const localImports = new Map(); // original specifier -> resolved absolute path

  const check = (node) => {
    const isDynamicImport =
      ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
    const isRawRequire =
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require';

    if (ts.isImportEqualsDeclaration(node) || isDynamicImport || isRawRequire) {
      throw new Error('This loader supports static local imports only (no import(), import =, or require()).');
    }

    if ((ts.isImportDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier))
        && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const resolved = resolveLocalSpecifier(specifier, fromDir);
      if (!resolved) {
        throw new Error(
          `Unsupported import "${specifier}" — only local relative ("./x") or "@/x" ` +
          `project imports are supported, not external packages.`
        );
      }
      localImports.set(specifier, resolved);
    }
    ts.forEachChild(node, check);
  };
  check(parsed);

  const result = ts.transpileModule(source, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const errors = [...parsed.parseDiagnostics, ...(result.diagnostics ?? [])]
    .filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    throw new SyntaxError(errors.map((item) =>
      ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
  }

  // Local `require` bound to this file: resolves only the specifiers we already
  // vetted above, recursing into loadModule (which re-applies every check).
  const localRequire = (specifier) => {
    const resolved = localImports.get(specifier);
    if (!resolved) {
      // Shouldn't happen — every specifier in the transpiled output was vetted above.
      throw new Error(`Unresolved import "${specifier}"`);
    }
    return loadModule(resolved);
  };

  const module = { exports: {} };
  const execute = new Function('module', 'exports', 'require', result.outputText);
  execute(module, module.exports, localRequire);

  moduleCache.set(filename, module);
  return module.exports;
}

export function loadStandaloneTypeScript(relativePath) {
  const filename = realpathSync(resolve(root, relativePath));
  assertWithinRepo(filename);
  moduleCache.delete(filename); // allow re-loading the entry module fresh per call
  return loadModule(filename);
}
