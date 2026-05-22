import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { importarPDF } from '../src/source-library.js';

const prisma = new PrismaClient();

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

const filePath = process.argv[2];

if (!filePath) {
  console.error('Uso: npm run import:pdf -- "C:\\ruta\\libro.pdf" --title="Título" --author="Autor"');
  process.exit(1);
}

try {
  const result = await importarPDF(prisma, filePath, {
    title: readArg('title'),
    author: readArg('author'),
    licenseStatus: readArg('licenseStatus') ?? 'COPYRIGHTED',
    licenseNote: readArg('licenseNote') ?? 'PDF provisto por el usuario para biblioteca interna de estudio.'
  });

  console.log(JSON.stringify({
    ok: true,
    sourceBook: result.sourceBook.title,
    insertedChunks: result.insertedChunks,
    skipped: result.skipped,
    embeddingsEnabled: result.embeddingsEnabled
  }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
