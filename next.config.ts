import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
	// `audio-engine` is linked from a sibling directory (../audio-engine), which
	// is outside the app root — tell Turbopack the workspace root includes it.
	turbopack: {
		root: path.resolve(process.cwd(), '..'),
	},
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
