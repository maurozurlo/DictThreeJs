import type { GameState } from "../types/GameState";

function stripFunctions(obj: unknown): unknown {
    if (typeof obj === 'function') return undefined;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Set) return Array.from(obj as Set<unknown>).map(stripFunctions);
    if (Array.isArray(obj)) return obj.map(stripFunctions);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value !== 'function') {
            result[key] = stripFunctions(value);
        }
    }
    return result;
}

export function exportSave(state: GameState): void {
    const serializable = stripFunctions(state);
    const json = JSON.stringify(serializable);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const blob = new Blob([encoded], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictator-save-round${state.gameManagement.round}.dict`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importSave(file: File): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const encoded = (e.target?.result as string).trim();
                const json = decodeURIComponent(escape(atob(encoded)));
                resolve(JSON.parse(json) as Record<string, unknown>);
            } catch {
                reject(new Error('Invalid save file'));
            }
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsText(file);
    });
}
