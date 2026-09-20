import { openPath } from "@tauri-apps/plugin-opener";
import { reportOpened } from "./api";

/** Opens a file in its OS-default app and tells the backend, so usage memory learns from clicks. */
export async function openFile(absPath: string, relPath: string): Promise<void> {
  await openPath(absPath);
  reportOpened(relPath).catch(() => undefined);
}

/** Opens several files. The backend already recorded these (workspace opens), so no report here. */
export async function openAll(absPaths: string[]): Promise<void> {
  for (const path of absPaths) {
    await openPath(path);
  }
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
