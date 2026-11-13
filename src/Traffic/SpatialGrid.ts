/**
 * Uniform spatial hash grid — the broadphase for street agent neighbour queries (ADR-0014).
 *
 * Rebuilt from scratch every tick with a counting sort into flat typed arrays: O(n) build, zero
 * allocation after construction, cache-friendly queries. Points outside the bounds clamp into the
 * border cells (still found, just less selectively).
 */
export class SpatialGrid {
    readonly cell: number;
    readonly x0: number;
    readonly z0: number;
    readonly cols: number;
    readonly rows: number;
    /** cellStart[c]..cellStart[c+1] index into `items` for cell c. */
    private readonly cellStart: Int32Array;
    private readonly cursor: Int32Array;
    private readonly cellOf: Int32Array;
    private readonly items: Int32Array;

    constructor(x0: number, z0: number, x1: number, z1: number, cell: number, capacity: number) {
        this.cell = cell;
        this.x0 = x0;
        this.z0 = z0;
        this.cols = Math.max(1, Math.ceil((x1 - x0) / cell));
        this.rows = Math.max(1, Math.ceil((z1 - z0) / cell));
        this.cellStart = new Int32Array(this.cols * this.rows + 1);
        this.cursor = new Int32Array(this.cols * this.rows);
        this.cellOf = new Int32Array(capacity);
        this.items = new Int32Array(capacity);
    }

    private cellIndex(x: number, z: number): number {
        const cx = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.x0) / this.cell)));
        const cz = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.z0) / this.cell)));
        return cz * this.cols + cx;
    }

    /** Re-buckets entities 0..n-1 at (xs[i], zs[i]); entities with active[i] === 0 are skipped. */
    rebuild(n: number, xs: ArrayLike<number>, zs: ArrayLike<number>, active?: ArrayLike<number>): void {
        const cells = this.cols * this.rows;
        const start = this.cellStart;
        start.fill(0);
        for (let i = 0; i < n; i++) {
            if (active && !active[i]) { this.cellOf[i] = -1; continue; }
            const c = this.cellIndex(xs[i], zs[i]);
            this.cellOf[i] = c;
            start[c + 1]++;
        }
        for (let c = 0; c < cells; c++) start[c + 1] += start[c];
        const cur = this.cursor;
        cur.set(start.subarray(0, cells));
        for (let i = 0; i < n; i++) {
            const c = this.cellOf[i];
            if (c >= 0) this.items[cur[c]++] = i;
        }
    }

    /**
     * Writes ids of entities whose CELL lies within `r` of (x, z) into `out` (caller filters by
     * exact distance). Returns how many were written; stops when `out` is full.
     */
    query(x: number, z: number, r: number, out: Int32Array): number {
        const c0x = Math.max(0, Math.floor((x - r - this.x0) / this.cell));
        const c1x = Math.min(this.cols - 1, Math.floor((x + r - this.x0) / this.cell));
        const c0z = Math.max(0, Math.floor((z - r - this.z0) / this.cell));
        const c1z = Math.min(this.rows - 1, Math.floor((z + r - this.z0) / this.cell));
        let k = 0;
        for (let cz = c0z; cz <= c1z; cz++) {
            for (let cx = c0x; cx <= c1x; cx++) {
                const c = cz * this.cols + cx;
                for (let p = this.cellStart[c]; p < this.cellStart[c + 1]; p++) {
                    if (k >= out.length) return k;
                    out[k++] = this.items[p];
                }
            }
        }
        return k;
    }
}
