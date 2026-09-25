import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
