'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import s from './Home.module.scss';

const random = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min)) + min + 1;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Home({
	init,
	onStart,
}: {
	init: boolean;
	onStart: () => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cancelRef = useRef<{ flackao?: boolean; blakao?: boolean; crackao?: boolean }>({});
	const xRef = useRef(0);
	const yRef = useRef(0);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [intro, setIntro] = useState(true);
	const [purples, setPurples] = useState(false);
	const [started, setStarted] = useState(false);

	// mutable size ref so loops can read latest without re-rendering
	const sizeRef = useRef(size);
	sizeRef.current = size;

	useEffect(() => {
		const update = () => {
			if (containerRef.current) {
				const { clientWidth, clientHeight } = containerRef.current;
				setSize({ width: clientWidth, height: clientHeight });
			}
		};
		update();
		window.addEventListener('resize', update);
		return () => {
			window.removeEventListener('resize', update);
			cancelRef.current = { flackao: true, blakao: true, crackao: true };
		};
	}, []);

	const flackao = useCallback(async () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		let size = 0;
		for (let i = 0; i < 10000000; i++) {
			const w = sizeRef.current?.width || 1;
			const h = sizeRef.current?.height || 1;
			for (let y = 0; y < h; y += h / 100, size += 1) {
				ctx.fillStyle = 'rgb(64, 0, ' + random(50, 63) + ')';
				const w2 = random(0, w) - 100;
				const x2 = xRef.current + random(0, w / 2);
				const h2 = random(20, 29);
				ctx.fillRect(x2, y, w2, h2);
				await sleep(30);
				ctx.clearRect(x2, y, w2, h2);
				const x3 = random(0, w);
				const y3 = random(0, h);
				ctx.fillStyle = 'rgb(68, 0, ' + random(10, 30 + size / 2) + ')';
				await sleep(15);
				ctx.fillStyle = 'rgb(68, 0, ' + random(50, 67) + ')';
				ctx.fillRect(x3, y3, random(1, 3), random(0, h));
				await sleep(30);
				ctx.fillStyle = 'rgb(68, 5, 90)';
				ctx.fillRect(random(0, w), random(0, h), random(1, 4) + size / 10, random(1, 4) + size / 10);
				await sleep(60);
				if (cancelRef.current.flackao) return;
			}
			await sleep(random(100, 2000));
			if (size > 100) size = 0;
		}
	}, []);

	const blakao = useCallback(async () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const w = sizeRef.current?.width || 1;
		const h = sizeRef.current?.height || 1;
		for (let i = 0; i < 100000; i++) {
			for (let y = 0; y < h; y += 1) {
				ctx.fillStyle = 'rgb(68, 0, 79)';
				ctx.fillRect(random(0, w), random(0, h / 2), 5, 5);
				await sleep(50);
				ctx.fillStyle = 'rgb(68, 0, 50)';
				ctx.fillRect(random(0, w), 0, random(1, 30), random(0, h));
				if (cancelRef.current.blakao) return;
			}
			await sleep(random(100, 2000));
		}
	}, []);

	useEffect(() => {
		flackao();
		setIntro(false);
	}, [flackao]);

	const start = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!purples) {
			cancelRef.current.flackao = true;
			setTimeout(() => blakao(), 500);
			setPurples(true);
			return;
		}
		cancelRef.current.flackao = true;
		cancelRef.current.blakao = true;
		setStarted(true);
		setTimeout(() => onStart(), 50);
	};

	if (init || started) return null;

	return (
		<div
			className={s.home}
			ref={containerRef}
			onMouseMove={(e) => {
				xRef.current = e.pageX;
				yRef.current = e.pageY;
			}}
		>
			{!intro && (
				<div className={s.container}>
					<div className={cn(purples ? s.purples : s.purple)} onClick={(e) => start(e)}>
						{purples ? 'PURPLES' : 'PURPLE'}
					</div>
				</div>
			)}
			<canvas ref={canvasRef} className={s.canvas} width={size.width} height={size.height} />
		</div>
	);
}