// Build docs/Copilot-Genie-One-Private-Integration-Guide.docx from the repository's Markdown guides.
// Requirements: Node.js 18+ and the "docx" package (npm install docx@9).
// Usage (from the repository root): node tools/build-word-guide.js .
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, ImageRun, ExternalHyperlink, AlignmentType, LevelFormat, PageBreak, TableOfContents,
  Header, Footer, PageNumber, TabStopType,
} = require('docx');

const ROOT = process.argv[2];
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(DOCS, 'Copilot-Genie-One-Private-Integration-Guide.docx');

const FONT = 'Calibri', MONO = 'Consolas';
const INK = '0F1F2A', MUTED = '5B6B76', BLUE = '1D5FBF', LINE = 'C9D3DA';
const PAGE_W = 12240, MARGIN = 1440, CONTENT_W = PAGE_W - 2 * MARGIN; // US Letter, 1" margins
const MAX_IMG_PX = 624; // 6.5 in at 96 dpi

// ---------- inline markdown → runs ----------
function inlineRuns(text, base = {}) {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*\s][^*]*\*)/g;
  let last = 0, m;
  const push = (t, extra = {}) => { if (t) out.push(new TextRun({ text: t, font: FONT, ...base, ...extra })); };
  while ((m = re.exec(text)) !== null) {
    push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) {
      out.push(new TextRun({ text: tok.slice(1, -1), font: MONO, size: (base.size || 21) - 2, color: '3D4B55', shading: { type: ShadingType.CLEAR, fill: 'F1F4F7' } }));
    } else if (m[2]) {
      out.push(...inlineRuns(tok.slice(2, -2), { ...base, bold: true }));
    } else if (m[3]) {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      const label = lm[1].replace(/`/g, ''), href = lm[2];
      if (/^https?:\/\//.test(href)) {
        out.push(new ExternalHyperlink({ link: href, children: [new TextRun({ text: label, font: FONT, ...base, style: 'Hyperlink' })] }));
      } else {
        out.push(...inlineRuns(label, { ...base, color: BLUE }));
      }
    } else if (m[4]) {
      out.push(...inlineRuns(tok.slice(1, -1), { ...base, italics: true }));
    }
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return out;
}

// ---------- images ----------
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b };
}
function imageParagraph(src) {
  // Use the 3x PNG twin of any SVG reference.
  const name = path.basename(src).replace(/\.svg$/i, '.png');
  const file = path.join(DOCS, 'images', 'png', name);
  if (!fs.existsSync(file)) return null;
  const { w, h, data } = pngSize(file);
  const width = MAX_IMG_PX, height = Math.round(MAX_IMG_PX * h / w);
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 160 },
    children: [new ImageRun({ type: 'png', data, transformation: { width, height } })] });
}

// ---------- tables ----------
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: LINE };
function buildTable(rows) {
  const cols = Math.max(...rows.map(r => r.length));
  const norm = rows.map(r => { while (r.length < cols) r.push(''); return r; });
  const lens = Array.from({ length: cols }, (_, c) => Math.max(...norm.map(r => r[c].replace(/[`*]/g, '').length), 4));
  const weights = lens.map(l => Math.min(Math.max(l, 8), 60));
  // never narrower than the longest single word in the column (about 100 DXA per character at 9 pt, plus padding)
  const longestWord = Array.from({ length: cols }, (_, c) => Math.max(...norm.map(r =>
    Math.max(0, ...r[c].replace(/[`*\[\]()]/g, ' ').split(/\s+/).filter(Boolean).map(w => Math.min(w.length, 22))))));
  const minW = longestWord.map(n => Math.min(n * 100 + 240, Math.floor(CONTENT_W / 2)));
  const total = weights.reduce((a, b) => a + b, 0);
  let widths = weights.map((w, c) => Math.max(minW[c], Math.floor(CONTENT_W * w / total)));
  const over = widths.reduce((a, b) => a + b, 0) - CONTENT_W;
  if (over > 0) { // take the excess from columns that are wider than their minimum, proportionally
    const slack = widths.map((w, c) => Math.max(0, w - minW[c])); const s = slack.reduce((a, b) => a + b, 0) || 1;
    widths = widths.map((w, c) => w - Math.floor(over * slack[c] / s));
  }
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: norm.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      cantSplit: true,
      children: r.map((cell, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
        shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'E8EEF6' } : undefined,
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: inlineRuns(cell.trim(), { size: 18, bold: ri === 0 || undefined }) })],
      })),
    })),
  });
}
function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
}

// ---------- markdown → blocks ----------
let listInstance = 0;
function convert(md, opts = {}) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0, numberedOpen = false, skip = false;
  const skipSections = opts.skipSections || [];
  while (i < lines.length) {
    let line = lines[i];
    const t = line.trim();
    // headings
    const hm = /^(#{1,4})\s+(.*)$/.exec(t);
    if (hm) {
      numberedOpen = false;
      const lvl = hm[1].length; let text = hm[2];
      if (lvl <= 2) skip = skipSections.some(s => text.toLowerCase().startsWith(s.toLowerCase()));
      if (skip) { i++; continue; }
      if (lvl === 1 && opts.firstH1As) { text = opts.firstH1As; opts.firstH1As = null; }
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][lvl - 1];
      const children = inlineRuns(text.replace(/`/g, ''));
      if (lvl === 1) out.push(new Paragraph({ children: [new PageBreak()] }));
      out.push(new Paragraph({ heading: level, children }));
      i++; continue;
    }
    if (skip) { i++; continue; }
    // fenced code
    if (t.startsWith('```')) {
      numberedOpen = false;
      const code = []; i++;
      const indent = line.indexOf('```');
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i].slice(Math.min(indent, lines[i].search(/\S|$/)))); i++; }
      i++;
      code.forEach((c, k) => out.push(new Paragraph({
        spacing: { before: k === 0 ? 80 : 0, after: k === code.length - 1 ? 120 : 0, line: 240 },
        shading: { type: ShadingType.CLEAR, fill: 'F3F6F8' },
        indent: { left: 200, right: 200 },
        children: [new TextRun({ text: c.length ? c : ' ', font: MONO, size: 16, color: '22313B' })],
      })));
      continue;
    }
    // table
    if (t.startsWith('|')) {
      numberedOpen = false;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim();
        if (!/^\|?\s*:?-{2,}/.test(r)) rows.push(splitRow(r));
        i++;
      }
      out.push(buildTable(rows));
      out.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [] }));
      continue;
    }
    // image
    const im = /^!\[[^\]]*\]\(([^)]+)\)/.exec(t);
    if (im) { const p = imageParagraph(im[1]); if (p) out.push(p); i++; continue; }
    // blockquote
    if (t.startsWith('>')) {
      numberedOpen = false;
      const paras = [[]];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const q = lines[i].trim().replace(/^>\s?/, '');
        if (!q.length) paras.push([]); else paras[paras.length - 1].push(q);
        i++;
      }
      paras.filter(p => p.length).forEach(p => out.push(new Paragraph({
        spacing: { before: 60, after: 100 },
        indent: { left: 240 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: '94B6EA', space: 8 } },
        shading: { type: ShadingType.CLEAR, fill: 'F1F6FE' },
        children: inlineRuns(p.join(' '), { size: 20 }),
      })));
      continue;
    }
    // lists
    const lm = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (lm) {
      const indent = lm[1].length, marker = lm[2];
      let text = lm[3].replace(/^\[ \]\s*/, '☐ ').replace(/^\[x\]\s*/i, '☑ ');
      // fold soft-wrapped continuation lines into the item
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) &&
             !/^\s*([-*]|\d+\.)\s|^\s*(```|\||>|!\[)/.test(lines[i + 1])) { i++; text += ' ' + lines[i].trim(); }
      if (/^\[[^\]]+\]\(#[^)]+\)$/.test(text.trim())) { i++; continue; } // in-page contents link
      const level = indent >= 2 ? 1 : 0;
      if (/\d+\./.test(marker)) {
        if (marker === '1.' && level === 0) listInstance++;
        numberedOpen = true;
        out.push(new Paragraph({ numbering: { reference: 'steps', level, instance: listInstance }, spacing: { before: 20, after: 40 }, children: inlineRuns(text) }));
      } else {
        const p = new Paragraph({ numbering: { reference: 'bullets', level: numberedOpen && indent >= 2 ? 1 : level }, spacing: { before: 20, after: 40 }, children: inlineRuns(text) });
        out.push(p);
      }
      i++; continue;
    }
    // blank, horizontal rule, in-page "Contents" label
    if (!t.length || /^-{3,}$/.test(t) || t === '**Contents**') { i++; continue; }
    // paragraph (join soft-wrapped lines)
    numberedOpen = numberedOpen && /^\s{2,}/.test(line);
    const buf = [t]; i++;
    while (i < lines.length && lines[i].trim().length && !/^(#{1,4}\s|```|\||>|!\[|\s*([-*]|\d+\.)\s)/.test(lines[i].trim())) { buf.push(lines[i].trim()); i++; }
    out.push(new Paragraph({ spacing: { before: 60, after: 100 }, indent: /^\s{2,}/.test(line) ? { left: 360 } : undefined, children: inlineRuns(buf.join(' ')) }));
  }
  return out;
}

// ---------- assemble ----------
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const body = [];
body.push(...convert(read('README.md'), { firstH1As: 'Overview', skipSections: ['Start here', 'Diagrams', 'Folder map'] }));
for (const f of ['00-adoption-guide.md', '01-databricks-build-guide.md', '02-prerequisites-licensing-and-billing.md', '03-private-connectivity-power-platform-vnet.md',
  '04-genie-one-connector-and-copilot-agent.md', '05-production-hardening.md', '06-testing-and-verification.md',
  '07-design-decisions.md', '08-troubleshooting.md', '09-references.md', '10-preview-features-and-production-readiness.md']) {
  let md = read(path.join('docs', f));
  if (f.startsWith('01')) md = md.replace(/^# .*$/m, '# 1. Databricks build guide');
  body.push(...convert(md));
}
body.push(...convert(read('connector/ask-genie-agent-instructions.md').replace(/^# .*$/m, '# Appendix A. Agent instructions, option A')));
body.push(...convert(read('connector/ask-genie-agent-instructions-mcp.md').replace(/^# .*$/m, '# Appendix B. Agent instructions and tool settings, option B')));
body.push(...convert('# Appendix C. Custom connector definitions\n\n## Option A: two REST actions\n\nconnector/genie-one-connector.swagger.yaml. Replace the host with your workspace URL.\n\n```yaml\n' + read('connector/genie-one-connector.swagger.yaml') + '\n```\n\n## Option B: MCP server\n\nconnector/genie-one-mcp-connector.swagger.yaml. Replace the host with your workspace URL.\n\n```yaml\n' + read('connector/genie-one-mcp-connector.swagger.yaml') + '\n```\n'));
body.push(...convert(read('docs/diagrams.md').replace(/^# .*$/m, '# Appendix D. Diagrams')));

const cover = [
  new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'Microsoft 365 Copilot → Databricks Genie One', font: FONT, size: 52, bold: true, color: INK })] }),
  new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: 'Private, per-user, secretless integration · end-to-end build and operations guide', font: FONT, size: 28, color: BLUE })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 4 } }, spacing: { after: 360 }, children: [] }),
  ...[
    'Copilot Studio agent in Microsoft 365 Copilot and Teams, answering from Databricks Genie One',
    'Every query runs as the signed-in user; Unity Catalog decides what each person sees',
    'Workspace public network access disabled; traffic through Power Platform VNet support and Private Link',
    'No client secrets: managed identity with a federated credential',
    'Hardened with a data policy, assignment required, delete locks, budgets and audit logs',
  ].map(s => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: s, font: FONT, size: 22, color: '33424C' })] })),
  new Paragraph({ spacing: { before: 720 }, children: [new TextRun({ text: 'Reference implementation · built and verified · November 2026', font: FONT, size: 20, color: MUTED })] }),
  new Paragraph({ children: [new TextRun({ text: 'All names, URLs, IDs and IP ranges are example values. Replace them with your own.', font: FONT, size: 20, color: MUTED, italics: true })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ children: [new TextRun({ text: 'Contents', font: FONT, size: 32, bold: true, color: INK })], spacing: { after: 200 } }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'In Word, if page numbers are missing, right-click the table and choose Update Field. The PDF version already includes them.', font: FONT, size: 18, color: MUTED, italics: true })] }),
];

const doc = new Document({
  creator: 'Reference implementation',
  title: 'Microsoft 365 Copilot to Databricks Genie One: private integration guide',
  description: 'End-to-end build, hardening and operations guide',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: '22313B' }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 34, bold: true, color: INK }, paragraph: { spacing: { before: 120, after: 200 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 27, bold: true, color: BLUE }, paragraph: { spacing: { before: 300, after: 120 }, keepNext: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 23, bold: true, color: INK }, paragraph: { spacing: { before: 220, after: 80 }, keepNext: true, outlineLevel: 2 } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 21, bold: true, color: '33424C' }, paragraph: { spacing: { before: 160, after: 60 }, keepNext: true, outlineLevel: 3 } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [
      { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } },
      { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 260 } } } } ] },
    { reference: 'steps', levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 300 } } } },
      { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 760, hanging: 300 } } } } ] },
  ] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Microsoft 365 Copilot → Databricks Genie One · private integration guide', font: FONT, size: 16, color: MUTED })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: MUTED })] })] }) },
    children: [...cover, ...body],
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('wrote', OUT, (buf.length / 1024 / 1024).toFixed(1) + ' MB'); });
