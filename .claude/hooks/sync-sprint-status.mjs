#!/usr/bin/env node
// PostToolUse hook: keep production/sprint-status.yaml in sync with story files.
//
// The yaml is otherwise only updated by /story-done, which gets skipped in
// autonomous-sprint mode — so the yaml drifts behind the story files' Status:
// field. This hook syncs the yaml `status` (and fills `completed`) from the
// authoritative `**Status**:` field in a story .md, on every Edit/Write to
// production/stories/*.md.
//
// IMPORTANT — only the story file that was JUST edited is synced. Drift in this
// repo runs both ways (some story files lag the yaml, e.g. the advisor stories),
// so a blanket re-scan of every story file would happily propagate a STALE file
// over a correct yaml row. The hook fires *because* file X was just authored, so
// only X is trustworthy-fresh at that moment — we touch only X's row.
//
// It reads the PostToolUse payload on stdin, scopes to the changed path, and
// writes the yaml only when that row actually changed (so it never loops: it
// writes the yaml, never a story file). Line-based editing preserves the yaml's
// comments and formatting.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const YAML_PATH = 'production/sprint-status.yaml';

// story Status: field  ->  yaml status: value
const STATUS_MAP = {
    'not started': 'backlog',
    'ready': 'ready-for-dev',
    'in progress': 'in-progress',
    'in review': 'review',
    'complete': 'done',
    'blocked': 'blocked',
};

function readStdin() {
    try {
        return readFileSync(0, 'utf8');
    } catch {
        return '';
    }
}

function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// --- gate: only run for edits to a single production/stories/*.md file ---
const raw = readStdin();
let changedPath = '';
try {
    const payload = JSON.parse(raw || '{}');
    changedPath =
        payload?.tool_input?.file_path ||
        payload?.tool_response?.filePath ||
        '';
} catch {
    // invalid/empty payload — nothing to scope to
}
const normalized = changedPath.replace(/\\/g, '/');
const m = normalized.match(/production\/stories\/([^/]+\.md)$/);
if (!m) process.exit(0); // unrelated edit, or no path to scope to

const changedBase = m[1]; // e.g. "5-2-weird-laws.md" — the ONLY file we sync

if (!existsSync(YAML_PATH)) process.exit(0);

const baseOf = (p) => p.replace(/\\/g, '/').split('/').pop();

// --- parse story file: extract Status + a completion date ---
function readStory(file) {
    if (!existsSync(file)) return null;
    const text = readFileSync(file, 'utf8');
    const statusMatch = text.match(/\*\*Status\*\*:\s*(.+)/);
    if (!statusMatch) return null;
    const status = statusMatch[1].trim().toLowerCase();
    const yamlStatus = STATUS_MAP[status];
    if (!yamlStatus) return null;
    const dateMatch =
        text.match(/Completed:\s*(\d{4}-\d{2}-\d{2})/) ||
        text.match(/\*\*Last Updated\*\*:\s*(\d{4}-\d{2}-\d{2})/) ||
        text.match(/Last Updated:\s*(\d{4}-\d{2}-\d{2})/);
    return { yamlStatus, date: dateMatch ? dateMatch[1] : null };
}

// --- reconcile yaml line-by-line, preserving comments/formatting ---
const lines = readFileSync(YAML_PATH, 'utf8').split('\n');
const changes = [];

let i = 0;
while (i < lines.length) {
    const idMatch = lines[i].match(/^(\s*)-\s*id:\s*"?([^"\n]+)"?\s*$/);
    if (!idMatch) { i++; continue; }

    const id = idMatch[2].trim();
    // collect the block: lines until the next "- id:" or a non-indented line
    const block = { fileIdx: -1, statusIdx: -1, completedIdx: -1, file: null };
    let j = i + 1;
    for (; j < lines.length; j++) {
        if (/^\s*-\s*id:/.test(lines[j])) break;
        if (/^\S/.test(lines[j]) && lines[j].trim() !== '') break; // top-level key
        const f = lines[j].match(/^\s*file:\s*"?([^"\n]+)"?\s*$/);
        if (f) { block.fileIdx = j; block.file = f[1].trim(); }
        if (/^\s*status:\s*/.test(lines[j]) && block.statusIdx === -1) block.statusIdx = j;
        if (/^\s*completed:\s*/.test(lines[j]) && block.completedIdx === -1) block.completedIdx = j;
    }

    if (block.file && baseOf(block.file) === changedBase && block.statusIdx !== -1) {
        const story = readStory(block.file);
        if (story) {
            const cur = lines[block.statusIdx].match(/status:\s*"?([^"\n]+)?"?\s*$/);
            const curStatus = cur && cur[1] ? cur[1].trim() : '';
            if (curStatus !== story.yamlStatus) {
                const indent = lines[block.statusIdx].match(/^(\s*)/)[1];
                lines[block.statusIdx] = `${indent}status: ${story.yamlStatus}`;
                changes.push(`${id}: ${curStatus || '(empty)'} -> ${story.yamlStatus}`);
            }
            // fill completed date when newly done and currently empty
            if (story.yamlStatus === 'done' && story.date && block.completedIdx !== -1) {
                const c = lines[block.completedIdx].match(/completed:\s*"?([^"\n]*)"?\s*$/);
                const curCompleted = c && c[1] ? c[1].trim() : '';
                if (!curCompleted) {
                    const indent = lines[block.completedIdx].match(/^(\s*)/)[1];
                    lines[block.completedIdx] = `${indent}completed: "${story.date}"`;
                }
            }
        }
    }
    i = j;
}

if (changes.length === 0) {
    process.exit(0); // nothing drifted — stay silent
}

// bump the top-level `updated:` field
const td = today();
for (let k = 0; k < lines.length; k++) {
    if (/^updated:\s*/.test(lines[k])) {
        lines[k] = `updated: "${td}"`;
        break;
    }
}

writeFileSync(YAML_PATH, lines.join('\n'));

// surface what we fixed to the user
process.stdout.write(JSON.stringify({
    systemMessage: `sprint-status.yaml synced from story files: ${changes.join('; ')}`,
    suppressOutput: true,
}));
