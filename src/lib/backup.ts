import { applyDoc, markChanged, snapshot } from './store.ts';
import { mergeDocs, parseDoc } from './sync.ts';

/** Save everything the learner keeps as a file. */
export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify({ ...snapshot(), exportedAt: new Date().toISOString() }, null, 1)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `read-hebrew-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Load a backup file and combine it with what is on this device. Returns how many lookups it added. */
export async function loadBackup(file: File): Promise<number> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not a Read Hebrew backup');
  }
  const doc = parseDoc(raw);
  if (!doc) throw new Error('That file is not a Read Hebrew backup');
  const before = snapshot();
  const merged = mergeDocs(before, doc);
  applyDoc(merged);
  markChanged(); // so a signed-in device uploads it
  return merged.lookups.length - before.lookups.length;
}
