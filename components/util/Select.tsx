'use client';

import { useEffect, useRef, useState } from 'react';
import s from './Select.module.scss';

export interface SelectOption {
	value: unknown;
	label?: string;
}

export default function Select({
	value,
	options,
	onChange,
	onClick,
	center,
	direction = 'up',
}: {
	value?: unknown;
	options: SelectOption[];
	onChange?: (value: unknown) => void;
	onClick?: (value?: unknown) => void;
	center?: boolean;
	direction?: 'up' | 'down';
}) {
	const selectRef = useRef<HTMLDivElement>(null);
	const optionsRef = useRef<HTMLDivElement>(null);
	const [display, setDisplay] = useState(false);
	const [pos, setPos] = useState({ x: 0, y: 0, width: 0 });

	const getWidth = () => selectRef.current?.clientWidth ?? 0;

	// track resize
	useEffect(() => {
		const onResize = () => {
			if (selectRef.current)
				setPos((p) => ({ ...p, x: selectRef.current!.offsetLeft, width: getWidth() }));
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	const onDisplay = (on: boolean) => {
		if (onClick) onClick();
		if (!on) return setDisplay(false);
		const select = selectRef.current;
		const optref = optionsRef.current;
		if (!select || !optref) return;
		const width = getWidth();
		const y =
			direction === 'down'
				? select.offsetTop + select.clientHeight
				: select.offsetTop - optref.clientHeight;
		const x = select.offsetLeft;
		setPos({ x, y, width });
		setDisplay(true);
	};

	const click = (optionValue: unknown) => {
		setDisplay(false);
		if (onChange) onChange(optionValue);
		if (onClick) onClick(optionValue);
	};

	const selected: SelectOption = options.find((o) => o.value === value) || options[0]!;
	if (!options.length) return null;

	return (
		<div className={s.select} ref={selectRef}>
			<div
				className={s.selected}
				onClick={() => onDisplay(!display)}
				style={{
					minWidth: pos.width + 'px',
					visibility: selected.label ? 'visible' : 'hidden',
					justifyContent: center ? 'center' : undefined,
				}}
			>
				{selected.label}
			</div>
			<div
				className={s.options}
				ref={optionsRef}
				style={{
					top: pos.y,
					left: pos.x,
					visibility: display ? 'visible' : 'hidden',
				}}
			>
				{options
					.filter((o) => o.value !== selected.value)
					.map((o, idx) => (
						<div
							key={idx}
							className={s.option}
							style={{
								minWidth: pos.width + 'px',
								maxWidth: pos.width + 'px',
								justifyContent: center ? 'center' : undefined,
							}}
							onClick={() => click(o.value)}
						>
							{o.label}
						</div>
					))}
			</div>
		</div>
	);
}