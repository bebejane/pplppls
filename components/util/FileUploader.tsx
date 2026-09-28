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

		if (files.length > 1 && multi) {
			const uploaded: UploadedFile[] = [];
			for (const f of files) uploaded.push(await uploadFile(f));
			if (onMultiUpload) onMultiUpload(uploaded);
		} else {
			const file = files[0];
			if (file) {
				try {
					const uploaded = await uploadFile(file);
					console.log(uploaded);
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
		// The uploader covers the whole column, so its mouse events are
		// re-dispatched on the parent to keep the column's own hover/click
		// handling working. The forwarded event is built from the *native*
		// event (React's synthetic event isn't a valid MouseEventInit and used
		// to throw here) and the whole dispatch is guarded: it re-enters
		// document-level handlers (tooltips etc.) that may touch detached
		// nodes, which must not take the app down.
		const parent = (e.target as HTMLElement).parentElement;
		if (parent) {
			const src = e.nativeEvent;
			// hide the overlay from hit-testing for the duration of the dispatch
			el.style.pointerEvents = 'none';
			try {
				parent.dispatchEvent(
					new MouseEvent(e.type, {
						bubbles: true,
						cancelable: true,
						composed: true,
						view: src.view ?? window,
						screenX: src.screenX,
						screenY: src.screenY,
						clientX: src.clientX,
						clientY: src.clientY,
						ctrlKey: src.ctrlKey,
						shiftKey: src.shiftKey,
						altKey: src.altKey,
						metaKey: src.metaKey,
						button: src.button,
						buttons: src.buttons,
					}),
				);
			} catch (err) {
				// a downstream handler failed while re-routing; not fatal
			} finally {
				el.style.pointerEvents = '';
			}
		}
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
