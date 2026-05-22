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

  return prisma.$queryRaw`
    SELECT
      c."id",
      c."chunkIndex",
      c."contentText",
      b."title",
      b."author",
      b."fileName",
      ts_rank(to_tsvector('spanish', c."contentText"), plainto_tsquery('spanish', ${cleanQuery})) AS score
    FROM "SourceChunk" c
    JOIN "SourceBook" b ON b."id" = c."sourceBookId"
    WHERE to_tsvector('spanish', c."contentText") @@ plainto_tsquery('spanish', ${cleanQuery})
    ORDER BY score DESC
    LIMIT ${limit}
  `;
}
