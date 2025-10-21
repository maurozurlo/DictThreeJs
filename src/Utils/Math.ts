export const Clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
}

export function getRandomNumberInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomUniqueItem<T>(list: T[], used: Set<T>): T | null {
    if (list.length === 0) {
        console.warn("⚠️ getRandomUniqueItem: list is empty.");
        return null;
    }

    const available = list.filter(item => !used.has(item));

    if (available.length === 0) {
        console.warn("⚠️ getRandomUniqueItem: all items have already been used.");
        return null;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    return available[randomIndex];
}

export function getRandomFromList<T>(list: T[]): T {
    if (list.length === 0) {
        throw new Error("getRandomFromList: list is empty.");
    }
    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
}