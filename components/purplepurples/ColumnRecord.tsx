'use client';

import { useRef, useState } from 'react';
import FrequencyVisualizer from '@/components/visualizers/FrequencyVisualizer';
import VolumeVisualizer from '@/components/visualizers/VolumeVisualizer';
import OscilloscopeVisualizer from '@/components/visualizers/OscilloscopeVisualizer';
import FileUploader, { type UploadedFile } from '@/components/util/FileUploader';
import cn from 'classnames';
import s from './ColumnRecord.module.scss';

export default function ColumnRecord({
	id,
	sampling,
	isSampling,
	loaded,
	loading,
	error,
	onUpload,
	onMultiUpload,
	onSampleRecord,
	onCancelSampleRecord,
}: {
	id: string;
	sampling?: boolean;
	isSampling?: boolean;
	loaded?: boolean;
	loading?: boolean;
	error?: boolean;
	onUpload: (buffer: ArrayBuffer, filename: string) => void;
	onMultiUpload: (files: UploadedFile[]) => void;
	onSampleRecord: (on: boolean) => void;
	onCancelSampleRecord: () => void;
}) {
	const fileUploaderRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [uploadError, setUploadError] = useState<unknown>(null);

	const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const target = event.target;
		if (!target.files || !target.files.length) return;
		const file = target.files[0];
		const reader = new FileReader();
		reader.addEventListener('load', (e) => {
			onUpload(e.target!.result as ArrayBuffer, file.name);
			setUploading(false);
			setUploadError(null);
			setProgress(100);
		});
		reader.addEventListener('progress', (e) => {
			setProgress(parseInt(((e.loaded / e.total) * 100).toString(), 10));
		});
		reader.addEventListener('error', (err) => {
			setUploading(false);
			setUploadError(err);
		});
		reader.addEventListener('abort', () => {
			setUploading(false);
		});
		reader.readAsArrayBuffer(file);
		setUploading(true);
	};

	const openFile = (e: React.MouseEvent) => {
		fileUploaderRef.current?.click();
		e.stopPropagation();
	};

	const blockDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		return false;
	};

	const sampleStart = (e: React.MouseEvent, on: boolean) => {
		e.stopPropagation();
		e.preventDefault();
		if (isSampling && !sampling) return;
		onSampleRecord(on);
	};

	return (
		<>
			<FileUploader
				id={id}
				multi={true}
				backgroundColor={'rgb(140, 40, 187)'}
				onUpload={onUpload}
				onMultiUpload={onMultiUpload}
			/>
			<div className={s.rec}>
				{sampling ? (
					<div className={s.meterWrap}>
						<div className={s.meter}>
							<OscilloscopeVisualizer
								id={'input'}
								color={'#e1c2e8'}
								options={{ fftSize: 512 }}
								ready={true}
							/>
						</div>
						<div className={s.open} onMouseDown={() => onCancelSampleRecord()}>
							cancel
						</div>
						<div className={s.openToggle} onMouseDown={(e) => sampleStart(e, false)}>
							stop
						</div>
					</div>
				) : !loaded && !loading ? (
					<div className={s.buttons}>
						<input
							type='file'
							ref={fileUploaderRef}
							accept={'audio/*,video/*'}
							style={{ display: 'none' }}
							onChange={onFileChange}
						/>
						<div
							className={s.open}
							draggable={false}
							onDrop={blockDrag}
							onDragStart={blockDrag}
							onDragEnd={blockDrag}
							onDragOver={blockDrag}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => openFile(e)}
						>
							open
						</div>
						<div
							className={s.open}
							draggable={false}
							onDrop={blockDrag}
							onDragStart={blockDrag}
							onDragEnd={blockDrag}
							onDragOver={blockDrag}
							onClick={(e) => e.stopPropagation()}
							onMouseDown={(e) => sampleStart(e, true)}
						>
							rec
						</div>
						{error && <div className={s.error}>{'Error loading file!'}</div>}
					</div>
				) : null}
				{uploading && <div className={s.uploading}>{progress}%</div>}
			</div>
		</>
	);
}