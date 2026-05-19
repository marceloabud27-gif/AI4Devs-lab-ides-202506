import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const testamentByBook = {
  GEN: 'OLD', EXO: 'OLD', LEV: 'OLD', NUM: 'OLD', DEU: 'OLD', JOS: 'OLD', JDG: 'OLD', RUT: 'OLD',
  '1SA': 'OLD', '2SA': 'OLD', '1KI': 'OLD', '2KI': 'OLD', '1CH': 'OLD', '2CH': 'OLD', EZR: 'OLD',
  NEH: 'OLD', EST: 'OLD', JOB: 'OLD', PSA: 'OLD', PRO: 'OLD', ECC: 'OLD', SNG: 'OLD', ISA: 'OLD',
  JER: 'OLD', LAM: 'OLD', EZK: 'OLD', DAN: 'OLD', HOS: 'OLD', JOL: 'OLD', AMO: 'OLD', OBA: 'OLD',
  JON: 'OLD', MIC: 'OLD', NAM: 'OLD', HAB: 'OLD', ZEP: 'OLD', HAG: 'OLD', ZEC: 'OLD', MAL: 'OLD',
  MAT: 'NEW', MRK: 'NEW', LUK: 'NEW', JHN: 'NEW', ACT: 'NEW', ROM: 'NEW', '1CO': 'NEW', '2CO': 'NEW',
  GAL: 'NEW', EPH: 'NEW', PHP: 'NEW', COL: 'NEW', '1TH': 'NEW', '2TH': 'NEW', '1TI': 'NEW', '2TI': 'NEW',
  TIT: 'NEW', PHM: 'NEW', HEB: 'NEW', JAS: 'NEW', '1PE': 'NEW', '2PE': 'NEW', '1JN': 'NEW', '2JN': 'NEW',
  '3JN': 'NEW', JUD: 'NEW', REV: 'NEW'
};

const spanishBookNames = {
  GEN: 'Génesis', EXO: 'Éxodo', LEV: 'Levítico', NUM: 'Números', DEU: 'Deuteronomio',
  JOS: 'Josué', JDG: 'Jueces', RUT: 'Rut', '1SA': '1 Samuel', '2SA': '2 Samuel',
  '1KI': '1 Reyes', '2KI': '2 Reyes', '1CH': '1 Crónicas', '2CH': '2 Crónicas',
  EZR: 'Esdras', NEH: 'Nehemías', EST: 'Ester', JOB: 'Job', PSA: 'Salmos',
  PRO: 'Proverbios', ECC: 'Eclesiastés', SNG: 'Cantares', ISA: 'Isaías',
  JER: 'Jeremías', LAM: 'Lamentaciones', EZK: 'Ezequiel', DAN: 'Daniel',
  HOS: 'Oseas', JOL: 'Joel', AMO: 'Amós', OBA: 'Abdías', JON: 'Jonás',
  MIC: 'Miqueas', NAM: 'Nahúm', HAB: 'Habacuc', ZEP: 'Sofonías', HAG: 'Hageo',
  ZEC: 'Zacarías', MAL: 'Malaquías', MAT: 'Mateo', MRK: 'Marcos', LUK: 'Lucas',
  JHN: 'Juan', ACT: 'Hechos', ROM: 'Romanos', '1CO': '1 Corintios',
  '2CO': '2 Corintios', GAL: 'Gálatas', EPH: 'Efesios', PHP: 'Filipenses',
  COL: 'Colosenses', '1TH': '1 Tesalonicenses', '2TH': '2 Tesalonicenses',
  '1TI': '1 Timoteo', '2TI': '2 Timoteo', TIT: 'Tito', PHM: 'Filemón',
  HEB: 'Hebreos', JAS: 'Santiago', '1PE': '1 Pedro', '2PE': '2 Pedro',
  '1JN': '1 Juan', '2JN': '2 Juan', '3JN': '3 Juan', JUD: 'Judas', REV: 'Apocalipsis'
};

function decodeXmlEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function cleanVerseText(value) {
  return decodeXmlEntities(value)
    .replace(/<note\b[\s\S]*?<\/note>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTerm(value) {
  return value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function wordsFromText(text) {
  return Array.from(
    new Set(
      normalizeTerm(text)
        .replace(/[^a-z0-9\s]/gi, ' ')
        .split(/\s+/)
        .filter((word) => word.length >= 2)
    )
  ).slice(0, 80);
}

function parseVersesFromUsfx(xml) {
  const verses = [];
  let bookCode = '';
  let chapter = 0;
  let verse = null;
  let verseTextStart = 0;

  function flushVerse(endIndex) {
    if (!bookCode || !chapter || !verse) return;
    const text = cleanVerseText(xml.slice(verseTextStart, endIndex));
    if (!text) return;

    const book = spanishBookNames[bookCode] ?? bookCode;
    const numericVerse = Number.parseInt(String(verse).split('-')[0], 10);
    if (!Number.isFinite(numericVerse)) return;

    verses.push({
      reference: `${book} ${chapter}:${numericVerse}`,
      book,
      chapter,
      verse: numericVerse,
      text,
      version: 'RVA1909',
      testament: testamentByBook[bookCode] ?? 'OLD',
      keywords: wordsFromText(text)
    });
  }

  const markerPattern = /<book\b[^>]*\bid="([^"]+)"[^>]*>|<c\b[^>]*\bid="([^"]+)"[^>]*\/?>|<v\b[^>]*\bid="([^"]+)"[^>]*\/?>|<ve\s*\/>/gi;
  let match;

  while ((match = markerPattern.exec(xml)) !== null) {
    if (match[0].startsWith('<ve')) {
      flushVerse(match.index);
      verse = null;
      continue;
    }

    if (match[1]) {
      flushVerse(match.index);
      bookCode = match[1];
      chapter = 0;
      verse = null;
      continue;
    }

    if (match[2]) {
      flushVerse(match.index);
      chapter = Number.parseInt(match[2], 10);
      verse = null;
      continue;
    }

    if (match[3]) {
      flushVerse(match.index);
      verse = match[3];
      verseTextStart = markerPattern.lastIndex;
    }
  }

  flushVerse(xml.length);
  return verses;
}

async function main() {
  const file = process.argv[2] ?? 'prisma/data/spa-rv1909.usfx.xml';
  const xml = await readFile(file, 'utf8');
  const verses = parseVersesFromUsfx(xml);

  if (verses.length < 30000) {
    throw new Error(`Se esperaban más de 30000 versículos, pero se parsearon ${verses.length}.`);
  }

  await prisma.bibleVerse.deleteMany({ where: { version: 'RVA1909' } });

  for (let i = 0; i < verses.length; i += 500) {
    await prisma.bibleVerse.createMany({
      data: verses.slice(i, i + 500),
      skipDuplicates: true
    });
    console.log(`Importados ${Math.min(i + 500, verses.length)} / ${verses.length}`);
  }

  console.log(`Importación completa: ${verses.length} versículos RVA1909.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
