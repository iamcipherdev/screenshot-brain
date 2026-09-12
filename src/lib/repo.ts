// ─── Screenshot repository: all DB reads/writes in one layer ──────────────

import {
  allShots, getShot, putShot, putShots, delShot, putBlobs, getBlobs,
  allColls, putColl, delColl, kvGet, kvSet, kvDel, wipeAll,
  allConvos, getConvo, putConvo, delConvo,
} from './db';
import { clearThumbUrls, dropThumbUrl } from './images';
import type { AiMeta, AppSettings, BlobRec, ChatMsg, Collection, Conversation, Shot, ValueLevel } from '../types';
import { uid } from './util';

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  geminiKey: '',
  model: 'gemini-2.0-flash',
  theme: 'system',
  appLock: false,
  lockPin: '',
  biometric: false,
};

// settings ---------------------------------------------------------
export async function loadSettings(): Promise<AppSettings> {
  const s = await kvGet<Partial<AppSettings>>('settings');
  return { ...DEFAULT_SETTINGS, ...s };
}
export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const cur = await loadSettings();
  const next = { ...cur, ...patch };
  await kvSet('settings', next);
  return next;
}

// shots ------------------------------------------------------------
export async function listShots(includeDeleted = false): Promise<Shot[]> {
  const shots = await allShots<Shot>();
  const live = includeDeleted ? shots : shots.filter((s) => !s.deletedAt);
  live.sort((a, b) => b.createdAt - a.createdAt);
  return live;
}
export async function trashCount(): Promise<number> {
  const shots = await allShots<Shot>();
  return shots.filter((s) => s.deletedAt).length;
}
export async function shotById(id: string): Promise<Shot | undefined> {
  return getShot<Shot>(id);
}
export async function createShot(
  meta: Omit<Shot, 'id' | 'addedAt' | 'value' | 'ocrStatus' | 'aiStatus'>,
  blobs: { thumb: Blob; full: Blob },
): Promise<Shot> {
  const shot: Shot = {
    ...meta,
    id: uid('s_'),
    addedAt: Date.now(),
    value: 'useful',
    ocrStatus: 'pending',
    aiStatus: 'pending',
  };
  await putShot(shot);
  await putBlobs({ id: shot.id, thumb: blobs.thumb, full: blobs.full });
  return shot;
}
export async function createShotWithId(shot: Shot, blobs: BlobRec): Promise<void> {
  await putShot(shot);
  await putBlobs(blobs);
}
export async function updateShot(id: string, patch: Partial<Shot>): Promise<Shot | undefined> {
  const cur = await getShot<Shot>(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch };
  await putShot(next);
  return next;
}
export async function updateAiMeta(id: string, ai: AiMeta, value: ValueLevel, valueReason: string): Promise<Shot | undefined> {
  return updateShot(id, { ai, aiStatus: 'done', value, valueReason });
}
export async function removeShots(ids: string[]): Promise<void> {
  for (const id of ids) {
    await delShot(id);
    dropThumbUrl(id);
  }
  // scrub from collections
  const colls = await allColls<Collection>();
  for (const c of colls) {
    if (c.shotIds.some((s) => ids.includes(s))) {
      await putColl({ ...c, shotIds: c.shotIds.filter((s) => !ids.includes(s)) });
    }
  }
  // scrub duplicate pointers
  const shots = await allShots<Shot>();
  const orphans = shots.filter((s) => s.dupOf && ids.includes(s.dupOf));
  for (const o of orphans) await updateShot(o.id, { dupOf: undefined, value: o.value === 'duplicate' ? 'useful' : o.value, valueReason: 'Previous duplicate was removed' });
}

/** Soft delete — recoverable from Trash. Nothing is permanently removed. */
export async function softDeleteShots(ids: string[]): Promise<void> {
  const now = Date.now();
  for (const id of ids) await updateShot(id, { deletedAt: now });
}
export async function restoreShots(ids: string[]): Promise<void> {
  for (const id of ids) await updateShot(id, { deletedAt: undefined });
}
export async function listTrash(): Promise<Shot[]> {
  const shots = await allShots<Shot>();
  const trashed = shots.filter((s) => s.deletedAt);
  trashed.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  return trashed;
}
export async function purgeTrash(olderThanMs?: number): Promise<number> {
  const shots = await allShots<Shot>();
  const cutoff = olderThanMs ? Date.now() - olderThanMs : 0;
  const gone = shots.filter((s) => s.deletedAt && s.deletedAt <= (cutoff || Date.now()));
  if (gone.length) await removeShots(gone.map((s) => s.id));
  return gone.length;
}
export async function blobsFor(id: string) {
  return getBlobs(id);
}

// collections --------------------------------------------------------
export async function listColls(): Promise<Collection[]> {
  const colls = await allColls<Collection>();
  colls.sort((a, b) => a.auto === b.auto ? b.createdAt - a.createdAt : a.auto ? 1 : -1);
  return colls;
}
export async function collById(id: string): Promise<Collection | undefined> {
  return (await allColls<Collection>()).find((c) => c.id === id);
}
export async function createColl(name: string, emoji: string, auto = false, shotIds: string[] = []): Promise<Collection> {
  const c: Collection = { id: uid('c_'), name, emoji, auto, createdAt: Date.now(), shotIds };
  await putColl(c);
  return c;
}
export async function saveColl(c: Collection): Promise<void> {
  await putColl(c);
}
export async function addShotsToColl(collId: string, shotIds: string[]): Promise<void> {
  const c = await collById(collId);
  if (!c) return;
  const set = new Set([...c.shotIds, ...shotIds]);
  await putColl({ ...c, shotIds: [...set] });
}
export async function removeShotFromColl(collId: string, shotId: string): Promise<void> {
  const c = await collById(collId);
  if (!c) return;
  await putColl({ ...c, shotIds: c.shotIds.filter((s) => s !== shotId) });
}
export async function deleteColl(collId: string): Promise<void> {
  await delColl(collId);
}

// conversations ------------------------------------------------------
export async function listConvos(): Promise<Conversation[]> {
  const convos = await allConvos<Conversation>();
  convos.sort((a, b) => b.updatedAt - a.updatedAt);
  return convos;
}
export async function convoById(id: string): Promise<Conversation | undefined> {
  return getConvo<Conversation>(id);
}
export async function createConvo(title = 'New chat'): Promise<Conversation> {
  const now = Date.now();
  const c: Conversation = { id: uid('cv_'), title, createdAt: now, updatedAt: now, messages: [] };
  await putConvo(c);
  return c;
}
export async function saveConvo(c: Conversation): Promise<void> {
  c.updatedAt = Date.now();
  c.messages = c.messages.slice(-120);
  await putConvo(c);
}
export async function renameConvo(id: string, title: string): Promise<void> {
  const c = await getConvo<Conversation>(id);
  if (!c) return;
  c.title = title.slice(0, 60) || 'Untitled chat';
  await putConvo(c);
}
export async function deleteConvo(id: string): Promise<void> {
  await delConvo(id);
}
/** One-time migration: move the old single-thread kv chat into a conversation. */
export async function migrateLegacyChat(): Promise<void> {
  const legacy = await kvGet<ChatMsg[]>('chat');
  const existing = await allConvos<Conversation>();
  if (legacy && legacy.length > 0 && existing.length === 0) {
    const c = await createConvo('Previous chat');
    c.messages = legacy;
    await putConvo(c);
  }
  if (legacy) await kvDel('chat');
}

// misc -----------------------------------------------------------------
export { kvGet, kvSet, kvDel } from './db';
export async function nukeEverything(): Promise<void> {
  await wipeAll();
  clearThumbUrls();
}
export async function bulkPutShots(shots: Shot[]): Promise<void> {
  await putShots(shots);
}
