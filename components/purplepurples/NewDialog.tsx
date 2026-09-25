'use client';

import { useRef } from 'react';
import s from './NewDialog.module.scss';

export default function NewDialog({
	onSubmit,
	onClose,
}: {
	onSubmit: (name: string, cols: number, rows: number) => void;
	onClose: () => void;
}) {
	const nameRef = useRef<HTMLInputElement>(null);
	const colsRef = useRef<HTMLInputElement>(null);
	const rowsRef = useRef<HTMLInputElement>(null);

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		if (nameRef.current?.value)
			onSubmit(
				nameRef.current.value,
				parseInt(colsRef.current?.value || '3', 10),
				parseInt(rowsRef.current?.value || '3', 10),
			);
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') onClose();
	};

	return (
		<div className={s.dialog} onMouseMove={(e) => e.stopPropagation()}>
			<div className={s.box}>
				New
				<br />
				<form className={s.form} onSubmit={submit}>
					<input
						name='new-dialog-model'
						ref={nameRef}
						placeholder='name it....'
						spellCheck={false}
						autoComplete='off'
						type='text'
						autoFocus
						onKeyDown={onKeyDown}
					/>
					<input
						name='new-dialog-cols'
						ref={colsRef}
						placeholder='COLS'
						min={1}
						max={30}
						spellCheck={false}
						autoComplete='off'
						type='number'
						defaultValue={3}
						onKeyDown={onKeyDown}
					/>
					<input
						name='new-dialog-rows'
						ref={rowsRef}
						placeholder='ROWS'
						min={1}
						max={30}
						spellCheck={false}
						autoComplete='off'
						type='number'
						defaultValue={3}
						onKeyDown={onKeyDown}
					/>
					<input type='submit' value='ADD' />
				</form>
				<div className={s.close} onClick={onClose}>
					X
				</div>
			</div>
		</div>
	);
}