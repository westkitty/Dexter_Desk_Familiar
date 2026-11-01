'use strict';
// Private Markdown project-memory document store.
// Allows the user to import up to 10 local .md / .txt files (<= 512 KiB each).
// Documents are parsed into heading/paragraph chunks with SHA-256 integrity,
// stored locally under userData with mode 0600, and queried via keyword/heading
// relevance scoring (bounded <= 1200 chars in context).
//
// Dual-gate continuity firewall:
// 1. useProjectMemory: MUST be explicitly enabled by user.
// 2. allowProjectMemoryRemote: Remote inference endpoints cannot receive project
//    documents unless this second privacy gate is explicitly turned on.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_DOCUMENTS = 10;
const MAX_FILE_BYTES = 512 * 1024; // 512 KiB
const MAX_CONTEXT_CHARS = 1200;
const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
  'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between',
  'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor',
  'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who',
  'whom', 'why', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

function tokenize(text) {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\-]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

function chunkMarkdown(text, filename = 'document') {
  if (typeof text !== 'string') return [];
  const lines = text.split(/\r?\n/);
  const chunks = [];
  let currentHeading = 'Overview';
  let currentLines = [];

  function flush() {
    const raw = currentLines.join('\n').trim();
    if (raw.length > 0) {
      const tokens = tokenize(raw + ' ' + currentHeading);
      chunks.push({
        heading: currentHeading,
        text: raw,
        charCount: raw.length,
        keywords: Array.from(new Set(tokens))
      });
    }
    currentLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
    } else {
      currentLines.push(line);
      // If a paragraph without headings grows beyond ~600 chars, break on double newline
      if (currentLines.length > 20 && line.trim() === '') {
        flush();
      }
    }
  }
  flush();

  // If no chunks produced (e.g. empty or only headings), return empty
  return chunks;
}

function createDocumentsStore({
  file,
  maxDocs = MAX_DOCUMENTS,
  maxFileBytes = MAX_FILE_BYTES,
  maxContextChars = MAX_CONTEXT_CHARS,
  fsImpl = fs
} = {}) {
  let documents = []; // Array of doc objects
  let crossings = 0;

  function load() {
    if (!file) return 0;
    try {
      const raw = JSON.parse(fsImpl.readFileSync(file, 'utf8'));
      if (Array.isArray(raw?.documents)) {
        documents = raw.documents.filter(d => d && typeof d.id === 'string' && typeof d.hash === 'string');
      }
    } catch {
      documents = [];
    }
    return documents.length;
  }

  function save() {
    if (!file) return;
    if (!documents.length) {
      try { fsImpl.rmSync(file, {force: true}); } catch {}
      return;
    }
    const dir = path.dirname(file);
    try { fsImpl.mkdirSync(dir, {recursive: true}); } catch {}
    const tmp = file + '.tmp';
    fsImpl.writeFileSync(tmp, JSON.stringify({version: 1, documents}, null, 1), {mode: 0o600});
    fsImpl.renameSync(tmp, file);
  }

  function importText(name, content, {enabled = true} = {}) {
    if (typeof content !== 'string') throw new Error('Content must be a string.');
    const buf = Buffer.from(content, 'utf8');
    if (buf.length > maxFileBytes) {
      throw new Error(`Document exceeds maximum size of ${Math.round(maxFileBytes / 1024)} KiB.`);
    }
    const ext = path.extname(name).toLowerCase() || '.md';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error('Only Markdown (.md) or plain text (.txt) files can be imported.');
    }

    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const existingIndex = documents.findIndex(d => d.hash === hash || d.name === name);

    if (existingIndex < 0 && documents.length >= maxDocs) {
      throw new Error(`Maximum of ${maxDocs} project documents reached. Remove an existing document first.`);
    }

    const cleanName = path.basename(name).slice(0, 100);
    const chunks = chunkMarkdown(content, cleanName);
    const doc = {
      id: existingIndex >= 0 ? documents[existingIndex].id : 'doc-' + crypto.randomBytes(6).toString('hex'),
      name: cleanName,
      ext,
      sizeBytes: buf.length,
      hash,
      enabled: Boolean(enabled),
      importedAt: new Date().toISOString(),
      chunks,
      content // kept locally in 0600 storage for preview
    };

    if (existingIndex >= 0) {
      documents[existingIndex] = doc;
    } else {
      documents.push(doc);
    }
    save();
    return {
      id: doc.id,
      name: doc.name,
      sizeBytes: doc.sizeBytes,
      hash: doc.hash,
      chunkCount: chunks.length,
      enabled: doc.enabled,
      importedAt: doc.importedAt
    };
  }

  function importFile(filePath, {enabled = true} = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Valid file path required.');
    }
    const stat = fsImpl.statSync(filePath);
    if (!stat.isFile()) throw new Error('Path is not a regular file.');
    if (stat.size > maxFileBytes) {
      throw new Error(`File exceeds ${Math.round(maxFileBytes / 1024)} KiB limit.`);
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error('Only .md, .markdown, or .txt files may be imported.');
    }
    const content = fsImpl.readFileSync(filePath, 'utf8');
    return importText(path.basename(filePath), content, {enabled});
  }

  function remove(id) {
    const before = documents.length;
    documents = documents.filter(d => d.id !== id);
    if (documents.length !== before) {
      save();
      return true;
    }
    return false;
  }

  function toggle(id, enabled) {
    const doc = documents.find(d => d.id === id);
    if (!doc) return false;
    doc.enabled = Boolean(enabled);
    save();
    return true;
  }

  function clear() {
    documents = [];
    save();
  }

  function list() {
    return documents.map(d => ({
      id: d.id,
      name: d.name,
      sizeBytes: d.sizeBytes,
      hash: d.hash,
      chunkCount: d.chunks ? d.chunks.length : 0,
      enabled: d.enabled,
      importedAt: d.importedAt
    }));
  }

  function get(id) {
    const doc = documents.find(d => d.id === id);
    if (!doc) return null;
    return {
      ...doc,
      chunks: doc.chunks.map(c => ({heading: c.heading, charCount: c.charCount, text: c.text}))
    };
  }

  /**
   * Retrieves relevant chunks matching the query across enabled documents.
   * Returns formatted markdown and citations, bounded to maxContextChars.
   */
  function retrieveContext(query, {limit = 3, maxChars = maxContextChars} = {}) {
    const enabledDocs = documents.filter(d => d.enabled);
    if (!enabledDocs.length) return null;

    const queryTokens = tokenize(query);
    const candidateChunks = [];

    for (const doc of enabledDocs) {
      if (!Array.isArray(doc.chunks)) continue;
      for (const chunk of doc.chunks) {
        let score = 0;
        const headingTokens = tokenize(chunk.heading);
        const headingMatches = queryTokens.filter(t => headingTokens.includes(t));
        score += headingMatches.length * 3;

        const bodyMatches = queryTokens.filter(t => chunk.keywords.includes(t));
        score += bodyMatches.length;

        candidateChunks.push({
          docName: doc.name,
          heading: chunk.heading,
          text: chunk.text,
          score
        });
      }
    }

    // Sort by score descending; if all 0, pick first chunk of first enabled doc
    candidateChunks.sort((a, b) => b.score - a.score);
    const topChunks = candidateChunks.filter(c => c.score > 0);
    const selected = (topChunks.length > 0 ? topChunks : candidateChunks).slice(0, limit);

    if (!selected.length) return null;

    let totalChars = 0;
    const formattedBlocks = [];
    const citations = [];

    for (const item of selected) {
      const cite = `[Reference: ${item.docName} > ${item.heading}]`;
      const block = `${cite}\n${item.text}`;
      if (totalChars + block.length > maxChars) {
        const remaining = maxChars - totalChars - cite.length - 2;
        if (remaining > 50) {
          formattedBlocks.push(`${cite}\n${item.text.slice(0, remaining)}...`);
          citations.push(cite);
        }
        break;
      }
      formattedBlocks.push(block);
      citations.push(cite);
      totalChars += block.length + 2;
    }

    if (!formattedBlocks.length) return null;

    return {
      text: formattedBlocks.join('\n\n'),
      citations,
      charCount: totalChars
    };
  }

  /**
   * Dual-gate firewall crossing check:
   * 1. enabled (useProjectMemory setting)
   * 2. if isRemote, allowRemote (allowProjectMemoryRemote setting)
   */
  function cross({
    enabled = false,
    isRemote = false,
    allowRemote = false,
    query = '',
    purpose = 'chat'
  } = {}) {
    if (!enabled) return null;
    if (isRemote && !allowRemote) return null;

    const result = retrieveContext(query);
    if (!result || !result.text) return null;

    crossings++;
    return {
      purpose: String(purpose || '').slice(0, 40),
      text: 'Project documentation context (retrieved from user-imported documents):\n\n' + result.text,
      citations: result.citations,
      charCount: result.charCount
    };
  }

  function stats() {
    let totalBytes = 0;
    let totalChunks = 0;
    for (const d of documents) {
      totalBytes += d.sizeBytes || 0;
      totalChunks += d.chunks ? d.chunks.length : 0;
    }
    return {
      count: documents.length,
      totalBytes,
      totalChunks,
      crossings
    };
  }

  return {
    load,
    save,
    importText,
    importFile,
    remove,
    toggle,
    clear,
    list,
    get,
    retrieveContext,
    cross,
    stats,
    get size() { return documents.length; },
    get crossings() { return crossings; }
  };
}

module.exports = {
  createDocumentsStore,
  chunkMarkdown,
  tokenize,
  MAX_DOCUMENTS,
  MAX_FILE_BYTES,
  MAX_CONTEXT_CHARS
};
