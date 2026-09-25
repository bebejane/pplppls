import type { Metadata, Viewport } from 'next';
import '../styles/globals.scss';

export const metadata: Metadata = {
	title: 'purplepurples',
	description: 'a web audio instrument',
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#44003f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<body>{children}</body>
		</html>
	);
}