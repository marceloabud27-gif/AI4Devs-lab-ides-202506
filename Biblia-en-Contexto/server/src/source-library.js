import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { createRequire } from 'node:module';
import OpenAI from 'openai';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function normalizeWhitespace(text) {
  return text
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/-\s*\n\s*/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const cleanText = normalizeWhitespace(text);
  const chunks = [];
  let start = 0;

  while (start < cleanText.length) {
    let end = Math.min(start + size, cleanText.length);
    const nextBreak = cleanText.lastIndexOf('\n', end);
    const nextSentence = cleanText.lastIndexOf('.', end);
    const cutPoint = Math.max(nextBreak, nextSentence);

    if (cutPoint > start + Math.floor(size * 0.55)) {
      end = cutPoint + 1;
    }

    const chunk = cleanText.slice(start, end).trim();
    if (chunk.length > 80) chunks.push(chunk);
    if (end >= cleanText.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

export async function procesarPDF(filePath) {
  const fs = await import('node:fs/promises');
  const buffer = await fs.readFile(filePath);
  const parsed = await pdfParse(buffer);
  const text = normalizeWhitespace(parsed.text ?? '');
  const chunks = chunkText(text);

  return {
    fileName: basename(filePath),
    text,
    contentHash: sha256(text),
    chunks
  };
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function createEmbeddings(chunks) {
  const client = getOpenAIClient();
  if (!client) return chunks.map(() => null);

  const embeddings = [];
  const batchSize = 64;

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS
    });

    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

function vectorLiteral(embedding) {
  if (!embedding) return null;
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(',')}]`;
}

function sourceSearchTerms(query) {
  const baseTerms = normalizeWhitespace(query)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s:-]/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 4)
    .slice(0, 10);

  const expanded = new Set(baseTerms);
  const expansions = {
    infierno: ['inierno', 'gehenna', 'fuego', 'castigo'],
    inierno: ['infierno', 'gehenna', 'fuego', 'castigo'],
    gracia: ['salvacion', 'fe', 'redencion'],
    salvacion: ['gracia', 'fe', 'redencion'],
    espiritu: ['santo', 'regeneracion', 'pentecostes'],
    pacto: ['promesa', 'revelacion', 'redentora'],
    iglesia: ['comunidad', 'discipulado', 'mision'],
    romanos: ['justicia', 'gracia', 'fe'],
    efesios: ['iglesia', 'unidad', 'gracia'],
    juan: ['vida', 'creer', 'luz'],
    mateo: ['reino', 'discipulos', 'cumplimiento'],
    hebreos: ['sacerdocio', 'pacto', 'sacrificio']
  };

  for (const term of baseTerms) {
    for (const extra of expansions[term] ?? []) expanded.add(extra);
  }

  return Array.from(expanded).slice(0, 16);
}

function normalizeSearchText(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function termOccurrences(text, term) {
  if (!term) return 0;
  return text.split(term).length - 1;
}

function contentQualityScore(text) {
  const clean = normalizeSearchText(text);
  const digitRatio = (clean.match(/\d/g)?.length ?? 0) / Math.max(clean.length, 1);
  const referenceCount = clean.match(/\b\d?\s?[a-z]{2,}\s+\d+:\d+/g)?.length ?? 0;
  let score = 1;

  if (clean.length < 180) score -= 0.35;
  if (/^(indice|bibliografia|notas|endnotes|scripture index)\b/.test(clean)) score -= 0.8;
  if (clean.includes('bibliografia seleccionada')) score -= 0.8;
  if (clean.includes('indice de temas') || clean.includes('indice de pasajes')) score -= 0.7;
  if (digitRatio > 0.16) score -= 0.35;
  if (referenceCount > 8) score -= 0.45;
  if (clean.includes('capitulo') && clean.includes('preguntas para reflexion')) score += 0.1;

  return Math.max(score, 0.15);
}

function isWeakSourceChunk(text) {
  const clean = normalizeSearchText(text);
  const digitRatio = (clean.match(/\d/g)?.length ?? 0) / Math.max(clean.length, 1);
  const weakMarkers = [
    'bibliografia seleccionada',
    'indice de temas',
    'indice de pasajes',
    'scripture index',
    'isbn',
    'copyright'
  ];

  return weakMarkers.some((marker) => clean.includes(marker)) || digitRatio > 0.28;
}

function scoreSourceChunk(row, terms, query) {
  const text = normalizeSearchText(row.contentText);
  const title = normalizeSearchText(`${row.sourceBook?.title ?? row.title ?? ''} ${row.sourceBook?.author ?? row.author ?? ''}`);
  const queryText = normalizeSearchText(query);
  const baseTerms = terms.filter((term) => term.length >= 4);

  const textHits = baseTerms.reduce((score, term) => score + Math.min(termOccurrences(text, term), 4), 0);
  const titleHits = baseTerms.reduce((score, term) => score + (title.includes(term) ? 3 : 0), 0);
  const phraseBonus = queryText.length > 8 && text.includes(queryText.slice(0, 80)) ? 4 : 0;
  const quality = contentQualityScore(row.contentText);

  return (textHits + titleHits + phraseBonus) * quality;
}

function diversifySourceRows(rows, limit, perSource = 2) {
  const counts = new Map();
  const selected = [];

  for (const row of rows) {
    if (isWeakSourceChunk(row.contentText)) continue;
    const key = `${row.title ?? row.sourceBook?.title ?? 'Fuente'}:${row.author ?? row.sourceBook?.author ?? ''}`;
    const count = counts.get(key) ?? 0;
    if (count >= perSource) continue;
    counts.set(key, count + 1);
    selected.push(row);
    if (selected.length >= limit) break;
  }

  if (selected.length >= Math.min(limit, 3)) return selected;
  return rows.filter((row) => !isWeakSourceChunk(row.contentText)).slice(0, limit);
}

export async function guardarEnNeon(prisma, chunks, fileName, metadata = {}) {
  const joinedText = chunks.join('\n\n');
  const bookHash = metadata.contentHash ?? sha256(joinedText);
  const existing = await prisma.sourceBook.findUnique({
    where: { contentHash: bookHash },
    include: { _count: { select: { chunks: true } } }
  });

  if (existing && existing._count.chunks > 0) {
    return {
      sourceBook: existing,
      insertedChunks: 0,
      skipped: true,
      embeddingsEnabled: Boolean(process.env.OPENAI_API_KEY)
    };
  }

  if (existing) {
    await prisma.sourceBook.delete({ where: { id: existing.id } });
  }

  const embeddings = await createEmbeddings(chunks);

  const sourceBook = await prisma.sourceBook.create({
    data: {
      fileName,
      title: metadata.title ?? fileName.replace(/\.pdf$/i, ''),
      author: metadata.author ?? null,
      licenseStatus: metadata.licenseStatus ?? 'COPYRIGHTED',
      licenseNote: metadata.licenseNote ?? 'Importado desde PDF provisto por el usuario.',
      contentHash: bookHash,
      totalCharacters: joinedText.length,
      totalChunks: chunks.length
    }
  });

  for (let index = 0; index < chunks.length; index += 1) {
    const contentText = chunks[index];
    const embedding = vectorLiteral(embeddings[index]);

    if (embedding) {
      await prisma.$executeRaw`
        INSERT INTO "SourceChunk"
          ("id", "sourceBookId", "chunkIndex", "contentText", "contentHash", "tokenEstimate", "embedding", "createdAt")
        VALUES
          (${randomUUID()}, ${sourceBook.id}, ${index}, ${contentText}, ${sha256(`${sourceBook.id}:${index}:${contentText}`)}, ${estimateTokens(contentText)}, ${embedding}::vector, NOW())
        ON CONFLICT ("contentHash") DO NOTHING
      `;
    } else {
      await prisma.$executeRaw`
        INSERT INTO "SourceChunk"
          ("id", "sourceBookId", "chunkIndex", "contentText", "contentHash", "tokenEstimate", "embedding", "createdAt")
        VALUES
          (${randomUUID()}, ${sourceBook.id}, ${index}, ${contentText}, ${sha256(`${sourceBook.id}:${index}:${contentText}`)}, ${estimateTokens(contentText)}, NULL, NOW())
        ON CONFLICT ("contentHash") DO NOTHING
      `;
    }
  }

  return {
    sourceBook,
    insertedChunks: chunks.length,
    skipped: false,
    embeddingsEnabled: Boolean(process.env.OPENAI_API_KEY)
  };
}

export async function importarPDF(prisma, filePath, metadata = {}) {
  const processed = await procesarPDF(filePath);
  return guardarEnNeon(prisma, processed.chunks, processed.fileName, {
    ...metadata,
    contentHash: processed.contentHash
  });
}

export async function buscarChunksDeFuentes(prisma, query, limit = 6) {
  const cleanQuery = normalizeWhitespace(query).slice(0, 600);
  if (!cleanQuery) return [];
  const terms = sourceSearchTerms(cleanQuery);

  const client = getOpenAIClient();
  if (client) {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleanQuery,
      dimensions: EMBEDDING_DIMENSIONS
    });
    const embedding = vectorLiteral(response.data[0].embedding);

    const rows = await prisma.$queryRaw`
      SELECT
        c."id",
        c."chunkIndex",
        c."contentText",
        b."title",
        b."author",
        b."fileName",
        1 - (c."embedding" <=> ${embedding}::vector) AS score
      FROM "SourceChunk" c
      JOIN "SourceBook" b ON b."id" = c."sourceBookId"
      WHERE c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> ${embedding}::vector
      LIMIT ${limit}
    `;

    if (rows.length) return rows;
  }

  const ftsRows = await prisma.$queryRaw`
    SELECT
      c."id",
      c."chunkIndex",
      c."contentText",
      b."title",
      b."author",
      b."fileName",
      ts_rank(to_tsvector('spanish', c."contentText"), websearch_to_tsquery('spanish', ${cleanQuery})) AS score
    FROM "SourceChunk" c
    JOIN "SourceBook" b ON b."id" = c."sourceBookId"
    WHERE to_tsvector('spanish', c."contentText") @@ websearch_to_tsquery('spanish', ${cleanQuery})
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  if (ftsRows.length >= Math.min(3, limit)) return ftsRows;

  const ilikeRows = await prisma.sourceChunk.findMany({
    where: {
      OR: terms.map((term) => ({
        contentText: { contains: term, mode: 'insensitive' }
      }))
    },
    take: Math.max(limit * 220, 1200),
    orderBy: { createdAt: 'desc' },
    include: {
      sourceBook: {
        select: { title: true, author: true, fileName: true }
      }
    }
  });

  const mappedRows = ilikeRows.map((row) => ({
    scoreValue: scoreSourceChunk(row, terms, cleanQuery),
    row: {
      id: row.id,
      chunkIndex: row.chunkIndex,
      contentText: row.contentText,
      title: row.sourceBook.title,
      author: row.sourceBook.author,
      fileName: row.sourceBook.fileName,
      score: scoreSourceChunk(row, terms, cleanQuery)
    }
  }));

  const sortedRows = [
    ...ftsRows.map((row) => ({ ...row, score: Number(row.score ?? 0) + contentQualityScore(row.contentText) })),
    ...mappedRows
      .filter((item) => item.scoreValue > 0)
      .sort((a, b) => b.scoreValue - a.scoreValue)
      .map((item) => item.row)
  ]
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));

  return diversifySourceRows(sortedRows, limit);
}
