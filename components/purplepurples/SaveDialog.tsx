'use client';

import { useRef } from 'react';
import s from './SaveDialog.module.scss';

export default function SaveDialog({
	model,
	onSubmit,
	onClose,
}: {
	model: string;
	onSubmit: (name: string) => void;
	onClose: () => void;
}) {
	const ref = useRef<HTMLInputElement>(null);

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		if (ref.current?.value) onSubmit(ref.current.value);
	};

	return (
		<div className={s.dialog} onMouseMove={(e) => e.stopPropagation()}>
			<div className={s.box}>
				Save
				<br />
				<form onSubmit={submit}>
					<input
						className={s.input}
						ref={ref}
						placeholder='name it....'
						spellCheck={false}
						autoComplete='off'
						type='text'
						defaultValue={model}
						autoFocus
						onKeyDown={(e) => {
							if (e.key === 'Escape') onClose();
						}}
					/>
				</form>
				<div className={s.close} onClick={onClose}>
					X
				</div>
			</div>
		</div>
	);
}