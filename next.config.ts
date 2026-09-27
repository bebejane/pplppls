import type { NextConfig } from 'next';
import fs from 'node:fs';
import path from 'node:path';

// When developing against the sibling `../audio-engine` checkout (pnpm link /
// `link:../audio-engine`), that package lives outside the app root, so Turbopack
// needs the workspace root widened to resolve it. With the published git
// dependency (node_modules/audio-engine) no override is needed — which is what
// Vercel uses.
const linkedEngine = path.resolve(process.cwd(), '..', 'audio-engine');
const turbopack = fs.existsSync(linkedEngine)
	? { root: path.resolve(process.cwd(), '..') }
	: undefined;

const nextConfig: NextConfig = {
	...(turbopack ? { turbopack } : {}),
	transpilePackages: ['audio-engine'],
	sassOptions: {
		silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions'],
	},
	images: {
		unoptimized: true,
	},
	devIndicators: false,
	experimental: {},
};

export default nextConfig;
