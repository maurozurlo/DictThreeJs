import i18n from '../i18n'

/** Returns a locale-aware in-game date string: today - 70 years + (round - 1) days. */
export function getGameDate(round: number): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 70);
    d.setDate(d.getDate() + (round - 1));
    return new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(d);
}
