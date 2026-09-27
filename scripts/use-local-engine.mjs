/**
 * Point `node_modules/audio-engine` at the sibling `../audio-engine` checkout while
 * working locally, *without* poisoning the committed config — production keeps the
 * github dependency.
 *
 * Why this exists: `pnpm link ../audio-engine` mutates *two* tracked files —
 *   1. `pnpm-lock.yaml` — swaps the github resolution for `link:../audio-engine`
 *      and drops the engine's transitive deps.
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
 *   pnpm dev                       # links the sibling first, then starts Next (soft)
 *   pnpm engine:link               # explicit link (fails if no sibling)
 *   pnpm engine:unlink             # back to the github dependency
 *   PURPLE_GITHUB_ENGINE=1 pnpm dev  # opt out — run locally against the github dep
 *
 * Soft vs strict: as part of `pnpm dev` this must never block the server, so a missing
 * sibling or a failed link just warns and leaves the github dependency in place. The
 * explicit `engine:link` (--required) fails loudly instead.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const strict = process.argv.includes('--required');
const forceGithub = /^(1|true)$/i.test(process.env.PURPLE_GITHUB_ENGINE ?? '');

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

const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const poisoned = () =>
	FILES.filter(({ name, linkPattern }) => {
		const body = stripComments(read(name));
		return body.includes(LINK_REF) || linkPattern.test(body);
	});

const spawn = (cmd, args) =>
	spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });

// Give up on linking but let the caller continue with the github dependency.
const bail = (softMessage, strictMessage = softMessage) => {
	if (strict) {
		console.error(`\n✖ ${strictMessage}`);
		process.exit(1);
	}
	console.log(`• ${softMessage}`);
	process.exit(0);
};

if (forceGithub) {
	console.log('• PURPLE_GITHUB_ENGINE set — skipping the local link (using the github dependency).');
	process.exit(0);
}

if (!fs.existsSync(sibling)) {
	bail(
		`No sibling checkout at ${sibling} — using the github dependency.\n` +
			'  Clone it to develop against local engine source:\n' +
			'    git clone https://github.com/bebejane/audio-engine.git ../audio-engine',
		`No sibling checkout at ${sibling}.\n` +
			'  Clone it to develop against local engine source:\n' +
			'    git clone https://github.com/bebejane/audio-engine.git ../audio-engine'
	);
}

// Recover if a previous bare `pnpm link` poisoned a tracked file — snapshotting dirty
// state would just restore the damage.
if (poisoned().length) {
	const names = poisoned().map((f) => f.name).join(', ');
	if (strict) {
		console.error(`\n✖ ${names} already reference the local link.`);
		console.error('  Run `pnpm engine:unlink` first, then link again.');
		process.exit(1);
	}
	console.log(`• ${names} looked link-poisoned — restoring before linking…`);
	if (spawn('pnpm', ['unlink', 'audio-engine']).status !== 0 || poisoned().length) {
		bail('Could not restore the github dependency — run `pnpm engine:unlink`, then retry.');
	}
}

// Snapshot both files.
fs.mkdirSync(snapshotDir, { recursive: true });
for (const { name } of FILES) {
	fs.writeFileSync(path.join(snapshotDir, name), read(name));
}

// Link the sibling checkout.
const linked = spawn('pnpm', ['link', sibling]).status === 0;

// Put the snapshots back (always — even if linking failed partway).
for (const { name } of FILES) {
	const file = path.join(root, name);
	if (read(name) !== fs.readFileSync(path.join(snapshotDir, name), 'utf8')) {
		fs.copyFileSync(path.join(snapshotDir, name), file);
	}
}

if (!linked) {
	bail('`pnpm link` failed — continuing with the github dependency.', '`pnpm link` failed.');
}

const stillLinked = poisoned();
if (stillLinked.length) {
	console.error(`✖ ${stillLinked.map((f) => f.name).join(' and ')} still reference ${LINK_REF} — do not commit.`);
	process.exit(1);
}

console.log(`\n✓ node_modules/audio-engine → ../audio-engine (local only; ${strict ? 'explicit' : 'pnpm dev'})`);
console.log('  pnpm-lock.yaml / pnpm-workspace.yaml left in the github-dependency state');
