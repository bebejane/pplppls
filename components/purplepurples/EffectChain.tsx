'use client';

import Global from '@/lib/Global';
import { useCallback, useEffect, useState } from 'react';
import cn from 'classnames';
import { IconPlay, IconStop } from '@/components/icons/Icons';
import type { EffectDef, EffectEntry, EffectParamDef } from './types';
import s from './EffectChain.module.scss';

/**
 * Effect-chain editor for one sound, opened from a Mixer channel strip.
 *
 * The chain lives on the engine (Sound.effects): this popup only mirrors the
 * sound's `state<id>` events and calls the engine facade — addEffect,
 * removeEffect, moveEffect, effectBypass, effectParams and the all-on/off
 * toggle. Rows are reordered with native HTML5 drag & drop (only the handle is
 * draggable, so the parameter sliders keep working).
 */
export default function EffectChain({
	id,
	filename,
	onClose,
}: {
	id: string;
	filename?: string;
	onClose: () => void;
}) {
	const [st, setSt] = useState<Record<string, any>>({});
	const [dragIdx, setDragIdx] = useState<number | null>(null);
	const [overIdx, setOverIdx] = useState<number | null>(null);
	const [adding, setAdding] = useState(false);

	useEffect(() => {
		// seed from the engine: the chain may have been built long before this
		// popup mounted, so waiting for a `state` event would show an empty chain
		const sound = Global.engine?.get?.(id)?.sound as Record<string, any> | undefined;
		if (sound) {
			setSt((prev) => ({
				...prev,
				effects: sound.effectParams ? sound.effectParams() : [],
				filename: sound._filename,
			}));
		}
		const onState = (state: Record<string, any>) => setSt((prev) => ({ ...prev, ...state }));
		Global.engine.on('state' + id, onState);
		return () => {
			Global.engine.off('state' + id, onState);
		};
	}, [id]);

	const effects: EffectEntry[] = Array.isArray(st.effects) ? st.effects : [];
	const name = st.filename || filename || id;
	// drive the all-on/off button from the chain itself — Sound._effectsEnabled
	// is a sticky flag (undefined until enable/disableEffects runs, and newly
	// added effects stay active), so it doesn't describe what's audible
	const anyActive = effects.some((e) => !e.bypassed);

	// the engine's effect catalog (EFFECTS) drives the "add" list and the labels
	const catalog = (Global.engine?.effects || []) as EffectDef[];
	const names: Record<string, string> = {};
	catalog.forEach((e) => (names[e.id] = e.name));

	const reorder = useCallback(
		(from: number, to: number) => {
			if (from === to || from < 0 || to < 0) return;
			Global.engine.moveEffect(id, from, to);
		},
		[id],
	);

	const onDrop = (e: React.DragEvent, to: number) => {
		const from = dragIdx ?? Number(e.dataTransfer.getData('text/plain'));
		setDragIdx(null);
		setOverIdx(null);
		if (!Number.isFinite(from) || from === to) return;
		reorder(from, to);
	};

	const setParam = (idx: number, key: string, value: number | boolean) => {
		Global.engine.effectParams(id, idx, { [key]: value });
	};

	return (
		<div className={s.overlay} onMouseMove={(e) => e.stopPropagation()}>
			<div className={s.dialog}>
				<div className={s.header}>
					<div className={s.title}>
						Effects <span className={s.sound}>{name}</span>
					</div>
					<button type='button' className={s.close} onClick={onClose}>
						X
					</button>
				</div>

				<div className={s.toolbar}>
					<div className={s.addWrap}>
						<button
							type='button'
							className={cn(s.addBtn, adding && s.addBtnOpen)}
							onClick={() => setAdding((v) => !v)}
						>
							+ Add effect
						</button>
						{adding && (
							<div className={s.addMenu}>
								{catalog.map((eff) => (
									<button
										key={eff.id}
										type='button'
										className={s.addItem}
										onClick={() => {
											setAdding(false);
											// third arg is `bypassed` — false = immediately active
											Global.engine.addEffect(id, eff.id, false);
										}}
									>
										{eff.name}
									</button>
								))}
							</div>
						)}
					</div>
					<div className={s.count}>{effects.length} in chain</div>
					<button
						type='button'
						className={cn(s.allBtn, anyActive && s.on)}
						disabled={!effects.length}
						title={anyActive ? 'Bypass every effect' : 'Enable every effect'}
						onClick={() =>
							anyActive
								? Global.engine.disableEffects(id)
								: Global.engine.enableEffects(id)
						}
					>
						{anyActive ? 'Bypass all' : 'Enable all'}
					</button>
				</div>

				<div className={s.chain}>
					{!effects.length && (
						<div className={s.empty}>
							No effects yet — use <b>+ Add effect</b> to build the chain.
						</div>
					)}
					{effects.map((effect, i) => (
						<div
							key={`${effect.type}-${effect.idx}-${i}`}
							className={cn(
								s.effect,
								effect.bypassed && s.bypassed,
								dragIdx === i && s.dragging,
								overIdx === i && s.dropTarget,
							)}
							onDragOver={(e) => {
								e.preventDefault();
								e.dataTransfer.dropEffect = 'move';
								if (overIdx !== i) setOverIdx(i);
							}}
							onDrop={(e) => {
								e.preventDefault();
								onDrop(e, i);
							}}
						>
							<div className={s.effectHead}>
								<div
									className={s.handle}
									draggable
									title='Drag to reorder'
									onDragStart={(e) => {
										setDragIdx(i);
										e.dataTransfer.effectAllowed = 'move';
										e.dataTransfer.setData('text/plain', String(i));
									}}
									onDragEnd={() => {
										setDragIdx(null);
										setOverIdx(null);
									}}
								>
									⠿
								</div>
								<div className={s.effectName}>{names[effect.type] || effect.type}</div>
								<button
									type='button'
									className={cn(s.mini, !effect.bypassed && s.on)}
									title={effect.bypassed ? 'Enable effect' : 'Bypass effect'}
									onClick={() =>
										Global.engine.effectBypass(id, effect.idx, !effect.bypassed)
									}
								>
									{effect.bypassed ? <IconStop /> : <IconPlay />}
								</button>
								<button
									type='button'
									className={s.mini}
									title='Remove effect'
									onClick={() => Global.engine.removeEffect(id, effect.idx)}
								>
									×
								</button>
							</div>

							<div className={s.params}>
								{Object.keys(effect.defaults || {}).map((key) => (
									<Param
										key={key}
										label={key}
										def={effect.defaults[key]}
										value={effect.params?.[key]}
										onChange={(v) => setParam(effect.idx, key, v)}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** One parameter control: a range slider for numbers, a toggle for booleans. */
function Param({
	label,
	def,
	value,
	onChange,
}: {
	label: string;
	def?: EffectParamDef;
	value: number | boolean | undefined;
	onChange: (value: number | boolean) => void;
}) {
	if (!def) return null;

	if (def.type === 'boolean') {
		const on = !!value;
		return (
			<div className={s.param}>
				<div className={s.paramLabel} title={label}>
					{label}
				</div>
				<button
					type='button'
					className={cn(s.bool, on && s.on)}
					onClick={() => onChange(!on)}
				>
					{on ? 'ON' : 'OFF'}
				</button>
			</div>
		);
	}

	const min = Number(def.min);
	const max = Number(def.max);
	const isInt = def.type === 'integer';
	const step = isInt ? 1 : Math.max((max - min) / 100, 0.0001);
	const current = typeof value === 'number' && Number.isFinite(value) ? value : Number(def.value);
	return (
		<div className={s.param}>
			<div className={s.paramLabel} title={label}>
				{label}
			</div>
			<input
				className={s.range}
				type='range'
				aria-label={label}
				min={min}
				max={max}
				step={step}
				value={Math.min(max, Math.max(min, current))}
				onChange={(e) => {
					const v = parseFloat(e.target.value);
					onChange(isInt ? Math.round(v) : parseFloat(v.toFixed(4)));
				}}
			/>
			<div className={s.paramValue}>
				{isInt ? Math.round(current) : current.toFixed(2)}
			</div>
		</div>
	);
}
