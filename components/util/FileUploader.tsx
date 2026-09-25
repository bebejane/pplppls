'use client';

import { useRef, useState } from 'react';
import s from './FileUploader.module.scss';

export interface UploadedFile {
	contents: ArrayBuffer;
	filename: string;
}

/**
 * Invisible full-area drop target that reads a file as ArrayBuffer and
 * hands it to onUpload / onMultiUpload. Also forwards mouse events to the
 * parent so hover state on the column still works.
 */
export default function FileUploader({
	id,
	multi = false,
	backgroundColor = 'transparent',
	label,
	style,
	onUpload,
	onMultiUpload,
	onUploadProgress,
	onUploadError,
	onError,
}: {
	id?: string;
	multi?: boolean;
	backgroundColor?: string;
	label?: string;
	style?: React.CSSProperties;
	onUpload?: (contents: ArrayBuffer, filename: string) => void;
	onMultiUpload?: (files: UploadedFile[]) => void;
	onUploadProgress?: (prog: { progress: number; loaded: number; total: number }) => void;
	onUploadError?: (err: unknown) => void;
	onError?: (err: unknown) => void;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [progress, setProgress] = useState(0);
	const [showDrop, setShowDrop] = useState(false);

	const uploadFile = (file: File): Promise<UploadedFile> => {
		return new Promise((resolve, reject) => {
			setProgress(0);
			if (!file) return reject(new Error('no file'));
			const reader = new FileReader();
			reader.onload = (e) => {
				if (onUploadProgress) onUploadProgress({ progress: 100, loaded: 0, total: 0 });
				resolve({ contents: e.target!.result as ArrayBuffer, filename: file.name });
			};
			reader.onprogress = (e) => {
				const prog = {
					progress: parseInt(((e.loaded / e.total) * 100).toFixed(0)),
					loaded: e.loaded,
					total: e.total,
				};
				setProgress(prog.progress);
				if (onUploadProgress) onUploadProgress(prog);
			};
			reader.onerror = (err) => {
				reject(err);
				if (onUploadError) onUploadError(err);
			};
			reader.readAsArrayBuffer(file);
		});
	};

	const handleError = (err: unknown) => {
		if (onError) onError(err);
	};

	const onDrop = async (ev: React.DragEvent) => {
		ev.preventDefault();
		const files: File[] = [];
		if (ev.dataTransfer.items) {
			for (let i = 0; i < ev.dataTransfer.items.length; i++) {
				if (ev.dataTransfer.items[i].kind === 'file') {
					const f = ev.dataTransfer.items[i].getAsFile();
					if (f) files.push(f);
				}
			}
		}
		if (ev.dataTransfer.files) {
			for (let i = 0; i < ev.dataTransfer.files.length; i++) {
				const item = ev.dataTransfer.files.item(i);
				if (item) files.push(item);
			}
		}
		if (files.length > 1 && multi) {
			const uploaded: UploadedFile[] = [];
			for (const f of files) uploaded.push(await uploadFile(f));
			if (onMultiUpload) onMultiUpload(uploaded);
		} else {
			const file = files[0];
			if (file) {
				try {
					const uploaded = await uploadFile(file);
					if (onUpload) onUpload(uploaded.contents, uploaded.filename);
				} catch (err) {
					handleError(err);
				}
			}
		}
		setShowDrop(false);
		setProgress(0);
	};

	const delegateEvent = (e: React.MouseEvent) => {
		const el = ref.current;
		if (!el || !e.target) return;
		el.style.display = 'none';
		const target = e.target as HTMLElement;
		if (target.parentNode) {
			target.parentNode.dispatchEvent(new MouseEvent(e.type, e as unknown as MouseEventInit));
		}
		el.style.display = 'flex';
		if (e.type !== 'mouseleave') e.stopPropagation();
	};

	const show = showDrop || (progress !== 0 && progress !== 100);

	return (
		<div
			ref={ref}
			className={s.uploader}
			style={style}
			onDragEnter={(e) => {
				setShowDrop(true);
				e.preventDefault();
			}}
			onDragOver={(e) => e.preventDefault()}
			onDragLeave={(e) => {
				setShowDrop(false);
				e.preventDefault();
			}}
			onDragStart={(e) => e.preventDefault()}
			onMouseDown={delegateEvent}
			onMouseMove={delegateEvent}
			onMouseLeave={delegateEvent}
			onMouseEnter={delegateEvent}
			onMouseOver={delegateEvent}
			onMouseUp={delegateEvent}
			onDrop={onDrop}
		>
			<div
				className={s.item}
				id={id}
				style={{
					opacity: show ? 1 : 0,
					zIndex: show ? 20000 : 0,
					backgroundColor,
				}}
			>
				{progress !== 0 && progress !== 100 ? progress + '%' : label !== undefined ? label : 'DROP'}
			</div>
		</div>
	);
}