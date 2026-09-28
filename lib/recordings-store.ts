/**
 * Persisted master-mix recordings (IndexedDB) — survives reloads.
 *
 * The `Recording` shape lives in RecordingsDialog.tsx; the persisted record is
 * the same minus the transient object `url`, which is regenerated on load
 * (`buffer` is stored too so MP3 conversion still works after a reload).
 */

export interface StoredRecording {
	id: number;
	blob: Blob;
	buffer: Float32Array[];
	mimeType: string;
	filename: string;
	name: string;
	duration: number;
}

const DB_NAME = 'purplepurples';
const STORE = 'recordings';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => {
			dbPromise = null;
			reject(req.error);
		};
	});
	return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return openDB().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const t = db.transaction(STORE, mode);
				const req = run(t.objectStore(STORE));
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			}),
	);
}

/** Load every saved recording, oldest Store request first (newest left first in state). */
export function loadStoredRecordings(): Promise<StoredRecording[]> {
	return tx('readonly', (store) => store.getAll() as IDBRequest<StoredRecording[]>).then((rows) =>
		rows.sort((a, b) => b.id - a.id),
	);
}

export function putStoredRecording(rec: StoredRecording): Promise<IDBValidKey> {
	// overwrite-safe: ids are Date.now() stamps so an exact clash is unlikely,
	// and a re-put with the same id is preferable to a dead duplicate
	return tx('readwrite', (store) => store.put(rec));
}

export function deleteStoredRecording(id: number): Promise<undefined> {
	return tx<undefined>('readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}
