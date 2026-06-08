function ordinal(day: number): string {
    if (day > 3 && day < 21) return `${day}th`;
    switch (day % 10) {
        case 1: return `${day}st`;
        case 2: return `${day}nd`;
        case 3: return `${day}rd`;
        default: return `${day}th`;
    }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/** Returns a formatted in-game date string: today - 70 years + (round - 1) days. */
export function getGameDate(round: number): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 70);
    d.setDate(d.getDate() + (round - 1));
    return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
}
