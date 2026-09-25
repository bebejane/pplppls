import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
	{
		ignores: [
			'legacy/**',
			'.next/**',
			'node_modules/**',
			'public/**',
			'.git/**',
			// engine DSP code is ported as-is from the CRA era (uses require()/CommonJS)
			'lib/audio/**',
			// gitignored local scratch dirs
			'utils/**',
			'audio/**',
			'icons/**',
		],
	},
	...nextVitals,
	...nextTs,
	{
		rules: {
			// The app talks to an untyped WebAudio engine through `any`;
			// strict any-avoidance is not a goal for this port.
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'react-hooks/exhaustive-deps': 'warn',
			'react-hooks/set-state-in-effect': 'off',
			// New compiler-mode strictness rules flag intentional ported patterns
			'react-hooks/refs': 'off',
			'react-hooks/immutability': 'off',
		},
	},
]);