#!/usr/bin/env node
/**
 * pre-commit helper: keep the audio-engine pin in pnpm-lock.yaml fresh.
 *
 * The engine is consumed as `github:bebejane/audio-engine` with no ref, so the
 * lockfile pins the exact resolved commit and Vercel installs with
 * --frozen-lockfile. This hook compares the pinned commit against the engine
 * repo's HEAD (git ls-remote) and, when they differ, runs `pnpm engine:sync`
 * and stages the refreshed pnpm-lock.yaml so the commit carries the new pin.
 *
 * Offline / remote unreachable → skip with a warning, keep the old pin, commit
 * proceeds. See AGENTS.md → "Shipping engine changes".
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENGINE_REPO = 'https://github.com/bebejane/audio-engine.git';
const LOCKFILE = 'pnpm-lock.yaml';
// the pin appears as `...audio-engine.git#<sha>` or `...audio-engine/tar.gz/<sha>`
// depending on how pnpm resolved it
const PIN_RES = [/audio-engine\.git#([0-9a-f]{40})/, /audio-engine\/tar\.gz\/([0-9a-f]{40})/];

function git(args) {
	return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function pinned() {
	const lock = readFileSync(join(top, LOCKFILE), 'utf8');
	for (const re of PIN_RES) {
		const m = lock.match(re);
		if (m) return m[1];
	}
	return null;
}

function head() {
	// ls-remote's first line is "<sha>\tHEAD"; output-porcelain both probes
	const out = execFileSync('git', ['ls-remote', ENGINE_REPO, 'HEAD'], {
		encoding: 'utf8',
		timeout: 20000,
	});
	return (out.match(/^([0-9a-f]{40})/) || [])[1] || null;
}

function run(cmd, args) {
	return execFileSync(cmd, args, { encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
}

let top;
try {
	top = git(['rev-parse', '--show-toplevel']);
} catch {
	process.exit(0); // not a git checkout — nothing to do
}

let previous;
try {
	previous = pinned();
} catch {
	console.warn(`pre-commit: could not read ${LOCKFILE}, skipping engine sync`);
	process.exit(0);
}

let remote;
try {
	remote = head();
} catch {
	console.log('pre-commit: offline / engine repo unreachable — keeping existing audio-engine pin');
	process.exit(0);
}
if (!remote) {
	console.warn('pre-commit: could not resolve audio-engine HEAD — keeping existing pin');
	process.exit(0);
}
if (remote === previous) process.exit(0);

// sync refreshes the pin without touching node_modules; snapshot for restore
const snapshot = readFileSync(join(top, LOCKFILE), 'utf8');
try {
	run('pnpm', ['engine:sync']);
} catch (err) {
	writeFileSync(join(top, LOCKFILE), snapshot); // never leave a half-updated lock
	console.warn(
		'pre-commit: engine:sync failed, keeping existing pin (update it manually with `pnpm engine:sync`)',
		err.stderr || err.message || err,
	);
	process.exit(0);
}

const next = pinned();
if (next === previous) process.exit(0); // pnpm decided nothing needed changing

git(['add', LOCKFILE]);
if (next === remote) {
	console.log(`pre-commit: pnpm-lock.yaml now pins audio-engine ${next.slice(0, 9)} — staged`);
} else {
	// staged anyway (a refresh is better than a stale pin), but flag the drift
	console.warn(`pre-commit: lockfile pins ${next && next.slice(0, 9)} but engine HEAD is ${remote.slice(0, 9)}`);
}
