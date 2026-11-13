/**
 * Triggers a browser download of `data` as pretty-printed JSON (Blob URL + temporary <a download>).
 *
 * @param fileName suggested file name, e.g. `street-edits-20261113-142501.json`
 * @param data     any JSON-serialisable value
 */
export function downloadJson(fileName: string, data: unknown): void {
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke on the next tick — some browsers start the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
