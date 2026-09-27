/**
 * Local-only helper: point `node_modules/audio-engine` at the sibling
 * `../audio-engine` checkout without poisoning the committed config.
 *
 * Why this exists: `pnpm link ../audio-engine` mutates *two* tracked files —
 *   1. `pnpm-lock.yaml` — swaps the `github:bebejane/audio-engine#v0.1.0`
 *      resolution for `link:../audio-engine` and drops the engine's transitive deps.
 *   2. `pnpm-workspace.yaml` — appends an `overrides: { audio-engine: link:../audio-engine }`
 *      block, which pnpm 12 persists automatically.
 * If either reaches Vercel (where the sibling checkout doesn't exist) the install
 * produces a dangling symlink and the build fails with
 * "Module not found: Can't resolve 'audio-engine'".
 *
 * So: snapshot both files, link, then put the snapshots back and verify. `node_modules`
 * is gitignored, so the local link itself never reaches CI.
 *
 * Usage:
 *   pnpm engine:link    # develop against ../audio-engine
 *   pnpm engine:unlink  # back to the published tag (runs `pnpm unlink audio-engine`)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sibling = path.resolve(root, '..', 'audio-engine');
const snapshotDir = path.join(root, 'node_modules', '.audio-engine-snapshots');

// Every tracked file `pnpm link` rewrites, and the pattern that must never survive.
const FILES = [
	{ name: 'pnpm-lock.yaml', linkPattern: /link:\.\.\/audio-engine/ },
	{ name: 'pnpm-workspace.yaml', linkPattern: /^overrides:\s*$/m },
];

const LINK_REF = 'link:../audio-engine';

// Check config semantics, not raw text: `#` comments (including the warning comment in
// pnpm-workspace.yaml) mention LINK_REF and must not trip the guard.
const stripComments = (body) =>
	body
		.split('\n')
		.filter((line) => !/^\s*#/.test(line))
		.join('\n');

const run = (cmd, args) => {
	const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
	if (res.status !== 0) {
		console.error(`\n✖ ${cmd} ${args.join(' ')} failed (exit ${res.status})`);
		process.exit(res.status ?? 1);
	}
};

if (!fs.existsSync(sibling)) {
	console.error(`✖ No sibling checkout at ${sibling}`);
	console.error('  Clone it, or run `pnpm engine:unlink` to use the published tag instead:');
	console.error('    git clone https://github.com/bebejane/audio-engine.git ../audio-engine');
	process.exit(1);
}

const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

// 1. Bail out if a previous bare `pnpm link` already poisoned a tracked file — snapshotting
//    dirty state would just restore the damage.
const dirty = FILES.filter(({ name, linkPattern }) => {
	const body = stripComments(read(name));
	return body.includes(LINK_REF) || linkPattern.test(body);
});
if (dirty.length) {
	console.error(`\n✖ ${dirty.map((f) => f.name).join(' and ')} already reference the local link.`);
	console.error('  Run `pnpm engine:unlink` first to restore the published tag, then link again.');
	process.exit(1);
}

// 2. Snapshot both files.
fs.mkdirSync(snapshotDir, { recursive: true });
for (const { name } of FILES) {
	fs.writeFileSync(path.join(snapshotDir, name), read(name));
}

// 3. Link the sibling checkout.
run('pnpm', ['link', sibling]);

// 4. Put the snapshots back, then verify the link reference is gone from both.
const stillLinked = [];
for (const { name } of FILES) {
	const file = path.join(root, name);
	if (read(name) !== fs.readFileSync(path.join(snapshotDir, name), 'utf8')) {
		fs.copyFileSync(path.join(snapshotDir, name), file);
	}
	if (stripComments(read(name)).includes(LINK_REF)) stillLinked.push(name);
}

if (stillLinked.length) {
	console.error(`\n✖ ${stillLinked.join(' and ')} still reference ${LINK_REF} — do not commit.`);
	console.error('  Run `pnpm engine:unlink` and re-check `git status` before pushing.');
	process.exit(1);
}

console.log('\n✓ node_modules/audio-engine → ../audio-engine (local only)');
console.log('  pnpm-lock.yaml / pnpm-workspace.yaml restored to the published-tag state');
console.log('  Run `pnpm engine:unlink` to go back to the published tag.');
