// Pure (no network, no file system) helpers used by scripts/sync-parser.mjs.
// They turn an upstream TypeScript file into a readable ES module by erasing
// type syntax only: everything else (formatting, comments, blank lines) is
// kept byte-for-byte, so the generated files diff cleanly against upstream.
//
// Safety net: every conversion is checked by parsing the result as plain
// JavaScript and by comparing `ts.transpileModule` of the original with
// `ts.transpileModule` of the result (comments removed). Any difference means
// the eraser missed or mangled something, and the conversion fails.
import path from 'node:path';
import ts from 'typescript';

export class SyncError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SyncError';
  }
}

export const GENERATED_MARKER = '// GENERATED FILE - DO NOT EDIT.';
export const LOCAL_MARKER = '// LOCAL FILE - not synced from upstream.';

const TRANSPILE_OPTIONS = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  removeComments: true,
  moduleDetection: ts.ModuleDetectionKind.Force,
};

// Class member / parameter modifiers that only exist in TypeScript.
const TS_ONLY_MODIFIERS = new Set([
  ts.SyntaxKind.PublicKeyword,
  ts.SyntaxKind.PrivateKeyword,
  ts.SyntaxKind.ProtectedKeyword,
  ts.SyntaxKind.ReadonlyKeyword,
  ts.SyntaxKind.OverrideKeyword,
  ts.SyntaxKind.AbstractKeyword,
]);

function hasModifier(node, kind) {
  return Boolean(ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === kind));
}

function location(sourceFile, pos) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return `${sourceFile.fileName}:${line + 1}:${character + 1}`;
}

function unsupported(sourceFile, node, what) {
  return new SyncError(
    `Unsupported TypeScript syntax (${what}) at ${location(sourceFile, node.getStart(sourceFile))}: `
    + 'it cannot be converted by erasing types only. Update scripts/sync-parser-lib.mjs or drop the file from src/parser/upstream.json.',
  );
}

/** Index of the first non-whitespace character before `pos` (exclusive), or -1. */
function prevNonSpace(text, pos) {
  let i = pos - 1;
  while (i >= 0 && /\s/.test(text[i])) i -= 1;
  return i;
}

function nextNonSpace(text, pos) {
  let i = pos;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  return i;
}

/** Range of a whole statement including its leading comments and its line break. */
function statementRange(text, sourceFile, node) {
  const comments = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
  let start = comments.length ? comments[0].pos : node.getStart(sourceFile);
  // Start at the beginning of the line when only indentation precedes.
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  if (/^[ \t]*$/.test(text.slice(lineStart, start))) start = lineStart;
  let end = node.getEnd();
  // Swallow trailing spaces and the line break.
  while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end += 1;
  if (text[end] === '\r') end += 1;
  if (text[end] === '\n') end += 1;
  // Avoid leaving two blank lines (or a leading blank line) behind.
  const before = text.slice(0, start);
  if ((start === 0 || before.endsWith('\n\n')) && text[end] === '\n') end += 1;
  return { start, end };
}

/** Range of `<...>` around a type parameter / type argument list. */
function angleRange(text, list) {
  const open = prevNonSpace(text, list.pos);
  const close = nextNonSpace(text, list.end);
  if (text[open] !== '<' || text[close] !== '>') {
    throw new SyncError(`Could not locate <...> around type list at ${list.pos}`);
  }
  return { start: open, end: close + 1 };
}

/** Range of `: Type` for a node's type annotation. */
function annotationRange(text, typeNode, sourceFile) {
  const colon = prevNonSpace(text, typeNode.getStart(sourceFile));
  if (text[colon] !== ':') {
    throw new SyncError(`Could not locate ':' before type annotation at ${location(sourceFile, typeNode.getStart(sourceFile))}`);
  }
  return { start: colon, end: typeNode.getEnd() };
}

function tokenRange(token, sourceFile) {
  return { start: token.getStart(sourceFile), end: token.getEnd() };
}

/** Removes a modifier keyword together with the whitespace after it. */
function modifierRange(text, modifier, sourceFile) {
  return { start: modifier.getStart(sourceFile), end: nextNonSpace(text, modifier.getEnd()) };
}

/**
 * Ranges that remove `removed` elements from a comma separated list while
 * keeping the separators of the remaining elements intact. At least one
 * element must be kept.
 */
function listRemovalRanges(elements, removed, sourceFile) {
  const ranges = [];
  elements.forEach((el, i) => {
    if (!removed.has(el)) return;
    const nextKept = elements.slice(i + 1).find((e) => !removed.has(e));
    if (nextKept) {
      ranges.push({ start: el.getStart(sourceFile), end: nextKept.getStart(sourceFile) });
    } else {
      const prevKept = elements.slice(0, i).reverse().find((e) => !removed.has(e));
      ranges.push({ start: prevKept.getEnd(), end: el.getEnd() });
    }
  });
  return ranges;
}

/** `Base<T>` in `class A extends Base<T>`: a value expression with type arguments. */
function isClassExtends(node) {
  return ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)
    && node.parent.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassLike(node.parent.parent);
}

/**
 * Collects the names that are referenced as values (outside of type
 * positions), used to elide imports that are only used as types, exactly as
 * `tsc` does.
 */
function collectValueIdentifiers(sourceFile) {
  const names = new Set();
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) return;
    if (isClassExtends(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isIdentifier(node)) names.add(node.text);
    if (ts.isShorthandPropertyAssignment(node)) names.add(node.name.text);
    if (ts.isExportSpecifier(node) && !node.isTypeOnly && !node.parent.parent.isTypeOnly) {
      names.add((node.propertyName ?? node.name).text);
    }
    if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression)) names.add(node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

/**
 * Erases TypeScript-only syntax from `source`. Returns the JavaScript text.
 * Throws a SyncError for syntax that has runtime semantics in TypeScript
 * (enums, namespaces, parameter properties, decorators, ...).
 */
export function stripTypes(source, fileName = 'input.ts') {
  const text = source.replace(/\r\n/g, '\n');
  const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length) {
    const diag = sourceFile.parseDiagnostics[0];
    throw new SyncError(`TypeScript parse error in ${location(sourceFile, diag.start)}: ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
  }
  const valueNames = collectValueIdentifiers(sourceFile);
  const ranges = [];
  const remove = (range) => ranges.push(range);

  const visit = (node) => {
    // Whole statements / members that disappear.
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      || (ts.isFunctionDeclaration(node) && !node.body)
      || hasModifier(node, ts.SyntaxKind.DeclareKeyword)) {
      remove(statementRange(text, sourceFile, node));
      return;
    }
    if ((ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) && !node.body) {
      remove(statementRange(text, sourceFile, node));
      return;
    }
    if (ts.isIndexSignatureDeclaration(node) && ts.isClassLike(node.parent)) {
      remove(statementRange(text, sourceFile, node));
      return;
    }
    if (hasModifier(node, ts.SyntaxKind.AbstractKeyword) && !ts.isClassLike(node)) {
      remove(statementRange(text, sourceFile, node));
      return;
    }
    if (ts.isEnumDeclaration(node)) throw unsupported(sourceFile, node, 'enum');
    if (ts.isModuleDeclaration(node)) throw unsupported(sourceFile, node, 'namespace/module');
    if (ts.isImportEqualsDeclaration(node)) throw unsupported(sourceFile, node, 'import = require');
    if (ts.isExportAssignment(node) && node.isExportEquals) throw unsupported(sourceFile, node, 'export =');
    if (ts.isDecorator(node)) throw unsupported(sourceFile, node, 'decorator');
    if (ts.isParameter(node) && ts.getModifiers(node)?.some((m) => TS_ONLY_MODIFIERS.has(m.kind))) {
      throw unsupported(sourceFile, node, 'constructor parameter property');
    }
    if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === 'this') {
      throw unsupported(sourceFile, node, 'this parameter');
    }

    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (!clause) return; // side-effect import: kept
      if (clause.isTypeOnly) {
        remove(statementRange(text, sourceFile, node));
        return;
      }
      const keepDefault = clause.name && valueNames.has(clause.name.text);
      const bindings = clause.namedBindings;
      let keptNamed = 0;
      const removedElements = [];
      if (bindings && ts.isNamespaceImport(bindings)) {
        keptNamed = valueNames.has(bindings.name.text) ? 1 : 0;
      } else if (bindings) {
        bindings.elements.forEach((el) => {
          if (el.isTypeOnly || !valueNames.has(el.name.text)) removedElements.push(el);
          else keptNamed += 1;
        });
      }
      if (!keepDefault && keptNamed === 0) {
        remove(statementRange(text, sourceFile, node));
        return;
      }
      if (clause.name && !keepDefault) {
        throw unsupported(sourceFile, node, 'default import used only as a type next to value imports');
      }
      if (bindings && ts.isNamespaceImport(bindings) && keptNamed === 0) {
        throw unsupported(sourceFile, node, 'namespace import used only as a type next to a default import');
      }
      if (bindings && ts.isNamedImports(bindings) && keptNamed === 0) {
        // `import Foo, { type Bar } from` -> `import Foo from`
        remove({ start: clause.name.getEnd(), end: bindings.getEnd() });
        return;
      }
      if (removedElements.length) {
        listRemovalRanges(bindings.elements, new Set(removedElements), sourceFile).forEach(remove);
      }
      return;
    }

    if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly) {
        remove(statementRange(text, sourceFile, node));
        return;
      }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        const elements = node.exportClause.elements;
        const typeOnly = elements.filter((el) => el.isTypeOnly);
        if (typeOnly.length && typeOnly.length === elements.length) {
          remove(statementRange(text, sourceFile, node));
          return;
        }
        listRemovalRanges(elements, new Set(typeOnly), sourceFile).forEach(remove);
      }
      return;
    }

    // Pieces of syntax inside value code.
    if (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ImplementsKeyword) {
      remove({ start: prevNonSpace(text, node.getStart(sourceFile)) + 1, end: node.getEnd() });
      return;
    }
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
      remove({ start: node.expression.getEnd(), end: node.getEnd() });
      visit(node.expression);
      return;
    }
    if (ts.isTypeAssertionExpression(node)) {
      remove({ start: node.getStart(sourceFile), end: node.expression.getStart(sourceFile) });
      visit(node.expression);
      return;
    }
    if (ts.isNonNullExpression(node)) {
      remove({ start: node.getEnd() - 1, end: node.getEnd() });
      visit(node.expression);
      return;
    }

    if (ts.canHaveModifiers(node) && !ts.isParameter(node)) {
      ts.getModifiers(node)?.forEach((m) => {
        if (TS_ONLY_MODIFIERS.has(m.kind)) remove(modifierRange(text, m, sourceFile));
      });
    }
    if (node.typeParameters) remove(angleRange(text, node.typeParameters));
    if (node.typeArguments && (!ts.isTypeNode(node) || isClassExtends(node))) {
      remove(angleRange(text, node.typeArguments));
    }
    if (node.questionToken && (ts.isParameter(node) || ts.isPropertyDeclaration(node)
      || ts.isMethodDeclaration(node))) {
      remove(tokenRange(node.questionToken, sourceFile));
    }
    if (node.exclamationToken && (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node))) {
      remove(tokenRange(node.exclamationToken, sourceFile));
    }
    if (node.type && ts.isTypeNode(node.type) && !ts.isTypeNode(node)
      && !ts.isTypeAliasDeclaration(node)) {
      remove(annotationRange(text, node.type, sourceFile));
    }

    ts.forEachChild(node, (child) => {
      if (child === node.type || child === node.typeParameters || child === node.typeArguments) return;
      if (ts.isTypeNode(child) && !ts.isExpressionWithTypeArguments(child)) return;
      visit(child);
    });
  };
  visit(sourceFile);

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  let out = '';
  let cursor = 0;
  ranges.forEach(({ start, end }) => {
    if (end <= cursor) return; // nested in an already removed range
    out += text.slice(cursor, Math.max(start, cursor));
    cursor = end;
  });
  out += text.slice(cursor);
  out = out.replace(/^\n+/, '');

  verifyErasure(text, out, fileName);
  return out;
}

// Parentheses are dropped before printing because `(x as T).y` legitimately
// becomes `(x).y`, which tsc prints as `x.y`.
const unwrapParentheses = (context) => {
  const visit = (node) => (ts.isParenthesizedExpression(node)
    ? visit(node.expression)
    : ts.visitEachChild(node, visit, context));
  return (sourceFile) => ts.visitNode(sourceFile, visit);
};

function transpileForComparison(code, fileName) {
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: TRANSPILE_OPTIONS,
    fileName,
    transformers: { before: [unwrapParentheses] },
  });
  // Trailing commas in lists are formatting only.
  return outputText.replace(/,(\s*[)\]}])/g, '$1').replace(/^export \{\};\n?/m, '');
}

/** Throws unless `js` is valid JavaScript equivalent to the TypeScript `tsSource`. */
export function verifyErasure(tsSource, js, fileName = 'input.ts') {
  // A program is needed: the plain parser accepts TypeScript syntax in .js
  // files and only reports it ("... can only be used in TypeScript files")
  // through the program's syntactic diagnostics.
  const jsName = `/virtual/${path.posix.basename(fileName).replace(/\.tsx?$/, '')}.js`;
  const jsFile = ts.createSourceFile(jsName, js, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const host = {
    getSourceFile: (name) => (name === jsName ? jsFile : undefined),
    getDefaultLibFileName: () => '/virtual/lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '/virtual',
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === jsName,
    readFile: (name) => (name === jsName ? js : undefined),
    directoryExists: () => true,
    getDirectories: () => [],
  };
  const program = ts.createProgram({
    rootNames: [jsName],
    options: {
      allowJs: true, noEmit: true, noLib: true, noResolve: true, types: [], target: ts.ScriptTarget.ESNext,
    },
    host,
  });
  const [diag] = program.getSyntacticDiagnostics(jsFile);
  if (diag) {
    throw new SyncError(`Type erasure produced invalid JavaScript (${location(jsFile, diag.start)}): ${ts.flattenDiagnosticMessageText(diag.messageText, '\n')}`);
  }
  const expected = transpileForComparison(tsSource, fileName);
  const actual = transpileForComparison(js, fileName);
  if (expected !== actual) {
    throw new SyncError(`Type erasure of ${fileName} does not match ts.transpileModule output; refusing to write it.`);
  }
}

/**
 * Rewrites the module specifiers of a converted file.
 * - relative specifiers that resolve to a mapped upstream file are rewritten
 *   to the local path of that file, with a `.js` extension;
 * - anything else (unmapped relative files, packages, node builtins) throws.
 *
 * @param {string} js converted JavaScript
 * @param {object} ctx
 * @param {string} ctx.upstreamPath posix path of this file in upstream
 * @param {string} ctx.localPath posix path of this file locally
 * @param {Record<string,string>} ctx.mapping upstream path -> local path (all synced files)
 */
export function rewriteImports(js, { upstreamPath, localPath, mapping }) {
  const sourceFile = ts.createSourceFile(localPath, js, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const edits = [];
  const errors = [];
  const handle = (literal) => {
    const spec = literal.text;
    if (!spec.startsWith('./') && !spec.startsWith('../')) {
      errors.push(`'${spec}' (not a relative import)`);
      return;
    }
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(upstreamPath), spec));
    const candidates = [resolved, `${resolved}.ts`, `${resolved}/index.ts`]
      .concat(resolved.endsWith('.js') ? [`${resolved.slice(0, -3)}.ts`] : []);
    const target = candidates.find((c) => Object.hasOwn(mapping, c));
    if (!target) {
      errors.push(`'${spec}' (resolves to ${resolved}, which is not in the sync whitelist)`);
      return;
    }
    let rel = path.posix.relative(path.posix.dirname(localPath), mapping[target]);
    if (!rel.startsWith('.')) rel = `./${rel}`;
    const quote = js[literal.getStart(sourceFile)];
    edits.push({ start: literal.getStart(sourceFile), end: literal.getEnd(), value: `${quote}${rel}${quote}` });
  };
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      handle(node.moduleSpecifier);
    } else if (ts.isCallExpression(node)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteralLike(arg)) handle(arg);
      else errors.push('a dynamic import()/require() with a non-literal specifier');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (errors.length) {
    throw new SyncError(
      `${upstreamPath} imports something outside the sync whitelist: ${errors.join('; ')}. `
      + 'Add the dependency to "files" in src/parser/upstream.json (if it is self-contained) or adapt the sync.',
    );
  }
  let out = js;
  edits.sort((a, b) => b.start - a.start).forEach(({ start, end, value }) => {
    out = out.slice(0, start) + value + out.slice(end);
  });
  return out;
}

/** Names of `Global.member` expressions used by the code that need a polyfill. */
export function findPolyfillNeeds(js, polyfills) {
  const sourceFile = ts.createSourceFile('x.js', js, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const needed = new Set();
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node)) {
      const name = `${node.expression.getText(sourceFile)}.${node.name.text}`;
      if (Object.hasOwn(polyfills, name)) needed.add(name);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...needed].sort();
}

export function generatedHeader({ repo, commit, upstreamPath, license }) {
  return [
    GENERATED_MARKER,
    '// Run `npm run sync:parser` to regenerate it; local changes will be overwritten.',
    `// Generated from ${repo.replace(/\.git$/, '')}@${commit}`,
    `// Original path: ${upstreamPath}`,
    `// Source: wiki-bot (github.com/EladHeller), ${license} license. See src/parser/CREDITS.md.`,
  ].join('\n');
}

/**
 * Converts one upstream TypeScript file into the content of its local file.
 * @param {string} source upstream TypeScript source
 * @param {object} ctx
 * @param {string} ctx.repo upstream repo URL
 * @param {string} ctx.commit upstream commit SHA
 * @param {string} ctx.license upstream license name
 * @param {string} ctx.upstreamPath posix path in upstream
 * @param {string} ctx.localPath posix path of the output file (repo relative)
 * @param {Record<string,string>} ctx.mapping all upstream -> local mappings
 * @param {Record<string,string>} [ctx.polyfills] `Global.member` -> local polyfill path (repo relative)
 */
export function convertFile(source, ctx) {
  const js = stripTypes(source, path.posix.basename(ctx.upstreamPath));
  const rewritten = rewriteImports(js, ctx);
  const polyfills = ctx.polyfills ?? {};
  const imports = [...new Set(findPolyfillNeeds(rewritten, polyfills).map((name) => polyfills[name]))]
    .map((p) => {
      let rel = path.posix.relative(path.posix.dirname(ctx.localPath), p);
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `import '${rel}'; // local polyfill, see src/parser/CREDITS.md\n`;
    });
  const header = generatedHeader(ctx);
  const body = rewritten.replace(/\s+$/, '');
  return `${header}\n\n${imports.length ? `${imports.join('')}\n` : ''}${body}\n`;
}

/**
 * Validates src/parser/upstream.json content and returns the normalized config.
 */
export function validateConfig(config) {
  const problems = [];
  if (!config || typeof config !== 'object') throw new SyncError('upstream.json must contain an object');
  if (typeof config.repo !== 'string' || !/^https:\/\//.test(config.repo)) problems.push('"repo" must be an https URL');
  if (typeof config.commit !== 'string' || !/^[0-9a-f]{40}$/.test(config.commit)) problems.push('"commit" must be a full 40-character SHA');
  if (!config.files || typeof config.files !== 'object' || !Object.keys(config.files).length) problems.push('"files" must map upstream paths to local paths');
  const locals = new Set();
  Object.entries(config.files ?? {}).forEach(([up, local]) => {
    if (!/\.ts$/.test(up) || /\.d\.ts$/.test(up) || up.startsWith('/') || up.includes('..')) problems.push(`bad upstream path ${up}`);
    if (!/\.js$/.test(local) || local.startsWith('/') || local.includes('..')) problems.push(`bad local path ${local}`);
    if (locals.has(local)) problems.push(`local path ${local} is used twice`);
    locals.add(local);
  });
  (config.localFiles ?? []).forEach((local) => {
    if (locals.has(local)) problems.push(`${local} is listed both as generated and as local`);
  });
  if (problems.length) throw new SyncError(`Invalid src/parser/upstream.json: ${problems.join('; ')}`);
  return {
    license: 'ISC', localFiles: [], polyfills: {}, ...config,
  };
}

/** Parses the command line of scripts/sync-parser.mjs. */
export function parseArgs(argv) {
  const args = { latest: false, ref: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--latest') {
      args.latest = true;
    } else if (arg === '--ref') {
      args.ref = argv[i + 1];
      i += 1;
      if (!args.ref || args.ref.startsWith('-')) throw new SyncError('--ref needs a value (full commit SHA, branch or tag)');
    } else if (arg.startsWith('--ref=')) {
      args.ref = arg.slice('--ref='.length);
      if (!args.ref) throw new SyncError('--ref needs a value (full commit SHA, branch or tag)');
    } else {
      throw new SyncError(`Unknown argument ${arg}. Usage: npm run sync:parser [-- --latest | --ref <sha|branch|tag>]`);
    }
  }
  if (args.latest && args.ref) throw new SyncError('Use either --latest or --ref, not both');
  if (args.ref && /^[0-9a-f]{7,39}$/.test(args.ref)) {
    throw new SyncError(`--ref ${args.ref} looks like an abbreviated SHA; git can only fetch full 40-character SHAs`);
  }
  return args;
}
