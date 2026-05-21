import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Clipboard, Eye, History, Library, Loader2, Search, Sparkles, Star, Wand2 } from 'lucide-react';
import { analyzeInput } from './api.js';

const examples = ['Romanos 8:29', 'Juan 3:16', 'presciencia', 'gracia'];
const depthOptions = [
  { id: 'sencillo', label: 'Sencillo' },
  { id: 'estudiante', label: 'Estudiante' },
  { id: 'academico', label: 'Académico claro' }
];
const loadingSteps = ['buscando texto bíblico', 'identificando género', 'preparando léxico', 'generando síntesis'];
const secondTempleSources = [
  {
    source: 'Flavio Josefo',
    work: 'Antigüedades de los judíos; La guerra de los judíos',
    content: 'Historia judía, dinastía herodiana, dominio romano, grupos judíos, revueltas y destrucción del Templo.',
    context: 'Ayuda a ubicar a Jesús, los fariseos, saduceos, zelotes y el conflicto con Roma dentro de un marco político real.'
  },
  {
    source: 'Filón de Alejandría',
    work: 'Sobre la vida contemplativa; Legación a Gayo; tratados alegóricos',
    content: 'Judaísmo helenístico, lectura alegórica de la Torá, vida comunitaria, filosofía grecorromana y piedad judía.',
    context: 'Muestra cómo algunos judíos de la diáspora expresaban la fe bíblica con categorías filosóficas griegas.'
  },
  {
    source: '1 Enoc',
    work: 'Libro de los Vigilantes; Similitudes; Astronómico; Sueños; Epístola',
    content: 'Ángeles, juicio final, Hijo del Hombre, resurrección, castigo de impíos y esperanza escatológica.',
    context: 'Permite ver expectativas apocalípticas judías anteriores o cercanas al Nuevo Testamento.'
  },
  {
    source: 'Salmos de Salomón',
    work: 'Salmos 17-18',
    content: 'Esperanza de un mesías davídico justo, purificación de Jerusalén y derrota de gobernantes impíos.',
    context: 'Evidencia que algunos judíos esperaban un rey mesiánico ligado a justicia, restauración nacional y juicio.'
  },
  {
    source: 'Qumrán',
    work: 'Regla de la Comunidad; Documento de Damasco; Pesher Habacuc; Rollo de la Guerra',
    content: 'Comunidad sectaria, pureza, interpretación profética, guerra escatológica y oposición entre luz y tinieblas.',
    context: 'Muestra un judaísmo separatista que leía su tiempo como crisis final y esperaba intervención divina.'
  },
  {
    source: 'Tácito, Suetonio y Plinio el Joven',
    work: 'Anales; Vida de Claudio; Carta a Trajano',
    content: 'Referencias romanas a Judea, disturbios relacionados con judíos y cristianos, y prácticas cristianas tempranas.',
    context: 'Aportan una mirada externa romana, limitada pero útil, sobre el ambiente imperial y la recepción del movimiento cristiano.'
  }
];

const bookGroups = {
  evangelio: ['Mateo', 'Marcos', 'Lucas', 'Juan'],
  paulina: ['Romanos', '1 Corintios', '2 Corintios', 'Gálatas', 'Efesios', 'Filipenses', 'Colosenses', '1 Tesalonicenses', '2 Tesalonicenses', '1 Timoteo', '2 Timoteo', 'Tito', 'Filemón'],
  general: ['Hebreos', 'Santiago', '1 Pedro', '2 Pedro', '1 Juan', '2 Juan', '3 Juan', 'Judas'],
  apocaliptica: ['Apocalipsis'],
  tora: ['Génesis', 'Éxodo', 'Levítico', 'Números', 'Deuteronomio'],
  historia: ['Josué', 'Jueces', 'Rut', '1 Samuel', '2 Samuel', '1 Reyes', '2 Reyes', '1 Crónicas', '2 Crónicas', 'Esdras', 'Nehemías', 'Ester'],
  poesia: ['Job', 'Salmos', 'Proverbios', 'Eclesiastés', 'Cantares'],
  profetas: ['Isaías', 'Jeremías', 'Lamentaciones', 'Ezequiel', 'Daniel', 'Oseas', 'Joel', 'Amós', 'Abdías', 'Jonás', 'Miqueas', 'Nahúm', 'Habacuc', 'Sofonías', 'Hageo', 'Zacarías', 'Malaquías']
};

const bookAliases = {
  genesis: 'Génesis',
  exodo: 'Éxodo',
  levitico: 'Levítico',
  numeros: 'Números',
  deuteronomio: 'Deuteronomio',
  josue: 'Josué',
  jueces: 'Jueces',
  rut: 'Rut',
  '1 samuel': '1 Samuel',
  '2 samuel': '2 Samuel',
  '1 reyes': '1 Reyes',
  '2 reyes': '2 Reyes',
  '1 cronicas': '1 Crónicas',
  '2 cronicas': '2 Crónicas',
  esdras: 'Esdras',
  nehemias: 'Nehemías',
  ester: 'Ester',
  job: 'Job',
  salmos: 'Salmos',
  salmo: 'Salmos',
  proverbios: 'Proverbios',
  eclesiastes: 'Eclesiastés',
  cantares: 'Cantares',
  isaias: 'Isaías',
  jeremias: 'Jeremías',
  lamentaciones: 'Lamentaciones',
  ezequiel: 'Ezequiel',
  daniel: 'Daniel',
  oseas: 'Oseas',
  joel: 'Joel',
  amos: 'Amós',
  abdias: 'Abdías',
  jonas: 'Jonás',
  miqueas: 'Miqueas',
  nahum: 'Nahúm',
  habacuc: 'Habacuc',
  sofonias: 'Sofonías',
  hageo: 'Hageo',
  zacarias: 'Zacarías',
  malaquias: 'Malaquías',
  mateo: 'Mateo',
  marcos: 'Marcos',
  lucas: 'Lucas',
  juan: 'Juan',
  hechos: 'Hechos',
  romanos: 'Romanos',
  '1 corintios': '1 Corintios',
  '2 corintios': '2 Corintios',
  galatas: 'Gálatas',
  efesios: 'Efesios',
  filipenses: 'Filipenses',
  colosenses: 'Colosenses',
  '1 tesalonicenses': '1 Tesalonicenses',
  '2 tesalonicenses': '2 Tesalonicenses',
  '1 timoteo': '1 Timoteo',
  '2 timoteo': '2 Timoteo',
  tito: 'Tito',
  filemon: 'Filemón',
  hebreos: 'Hebreos',
  santiago: 'Santiago',
  '1 pedro': '1 Pedro',
  '2 pedro': '2 Pedro',
  '1 juan': '1 Juan',
  '2 juan': '2 Juan',
  '3 juan': '3 Juan',
  judas: 'Judas',
  apocalipsis: 'Apocalipsis'
};

const specificBookContexts = {
  Efesios: {
    setting: 'Efesios debe leerse dentro del ambiente urbano de Éfeso y Asia Menor: una región marcada por culto imperial, prestigio cívico, comercio, prácticas religiosas locales y fuerte identidad gentil. La carta trabaja la identidad de una comunidad formada por judíos y gentiles en Cristo, con énfasis en unidad, nueva humanidad, reconciliación y vida comunitaria.',
    culture: 'El trasfondo ayuda a entender imágenes como ciudadanía, herencia, poderes celestiales, templo santo y cuerpo. No conviene leer “misterio”, “potestades” o “unidad” como ideas abstractas: funcionan en un mundo donde religión, ciudad, familia, honor y lealtades públicas estaban conectadas.',
    sources: 'Hechos 19, literatura paulina, contexto de Asia Menor romana, culto imperial y estudios sobre religión urbana del siglo I.'
  },
  Mateo: {
    setting: 'Mateo se entiende mejor en un ambiente judeocristiano que discute identidad, Torá, justicia, autoridad de Jesús y relación con Israel. El Evangelio usa muchas citas y ecos del Antiguo Testamento, presenta a Jesús como Mesías davídico y maestro autorizado, y organiza su enseñanza con fuerte sensibilidad judía.',
    culture: 'El contexto del Judaísmo del Segundo Templo es clave: reino de los cielos, cumplimiento, justicia, fariseos, escribas, sinagoga, pureza, limosna, oración y ayuno no son conceptos modernos, sino prácticas y debates judíos del siglo I.',
    sources: 'Tradiciones sinópticas, Escrituras de Israel, debates fariseos sobre Torá, Josefo, literatura judía temprana y estudios sobre comunidades judeocristianas.'
  },
  Romanos: {
    setting: 'Romanos se dirige a creyentes en la capital imperial, con tensiones entre judíos y gentiles después de conflictos sociales y expulsiones previas. Pablo argumenta sobre justicia de Dios, pecado, Torá, Abraham, Israel, gentiles y vida comunitaria.',
    culture: 'La carta combina Escritura judía, retórica epistolar y realidad imperial romana. Temas como ley, gracia, fe, carne, espíritu e Israel deben leerse dentro del debate judío-gentil del siglo I.',
    sources: 'Romanos, Escrituras de Israel, información romana sobre judíos en Roma, Suetonio, Josefo y estudios de comunidad mixta judío-gentil.'
  },
  Juan: {
    setting: 'Juan presenta a Jesús con lenguaje simbólico denso: vida, luz, verdad, gloria, mundo, señales y testimonio. El libro refleja disputas sobre identidad de Jesús, autoridad, templo, fiestas judías y pertenencia comunitaria.',
    culture: 'Las fiestas, el templo, el agua, el pan, la luz y el pastor no son adornos: son símbolos judíos cargados de memoria bíblica y litúrgica.',
    sources: 'Evangelio de Juan, fiestas judías, Escrituras de Israel, tradición sapiencial, debates sinagogales y contexto judeorromano.'
  }
};

function detectInputKind(value) {
  const cleaned = value.trim();
  if (!cleaned) return { label: 'Esperando consulta', helper: 'Escribí una palabra, un versículo o pegá un texto.' };
  if (/\d+:\d+/.test(cleaned) || /^[1-3]?\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+\d+/.test(cleaned)) {
    return { label: 'Detecté un pasaje', helper: 'Voy a mostrar primero el texto bíblico y después el análisis.' };
  }
  if (cleaned.split(/\s+/).filter(Boolean).length <= 3) {
    return { label: 'Detecté una palabra o tema', helper: 'Voy a buscar usos bíblicos y explicar el sentido en contexto.' };
  }
  return { label: 'Detecté texto pegado', helper: 'Voy a analizarlo como texto y señalar qué falta para ubicarlo mejor.' };
}

function modeLabel(mode) {
  if (mode === 'passage') return 'Pasaje';
  if (mode === 'word') return 'Palabra';
  return 'Texto';
}

function formatStudyForCopy(result) {
  const lines = [
    `Biblia en Contexto - ${result.title}`,
    '',
    `Tipo: ${modeLabel(result.mode)}`,
    `Resumen: ${result.explanation}`,
    ''
  ];

  if (result.verses?.length) {
    lines.push('Texto bíblico:');
    for (const verse of result.verses) {
      lines.push(`${verse.reference}: ${verse.clearText ?? verse.text}`);
    }
    lines.push('');
  }

  if (result.sections?.length) {
    lines.push('Análisis:');
    for (const section of result.sections) {
      lines.push(`${section.title}: ${section.body}`);
    }
    lines.push('');
  }

  if (result.lexicalRows?.length) {
    lines.push('Palabras clave:');
    for (const row of result.lexicalRows) {
      lines.push(`${row.lemma}: ${row.semantics} Uso: ${row.contextualUse}`);
    }
  }

  return lines.join('\n');
}

function sectionId(title) {
  return title.toLowerCase().replace(/\s+/g, '-');
}

function normalizeText(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function detectBook(value) {
  const normalized = normalizeText(value).replace(/[:.,;].*$/, '');
  const sortedAliases = Object.keys(bookAliases).sort((a, b) => b.length - a.length);
  return sortedAliases.find((alias) => normalized === alias || normalized.startsWith(`${alias} `))
    ? bookAliases[sortedAliases.find((alias) => normalized === alias || normalized.startsWith(`${alias} `))]
    : null;
}

function bookGroup(book) {
  return Object.entries(bookGroups).find(([, books]) => books.includes(book))?.[0] ?? 'general-biblico';
}

function getBookHistoricalContext(value) {
  const book = detectBook(value);

  if (!book) {
    return {
      book: 'Judaísmo del Segundo Templo',
      group: 'general',
      setting: 'Escribí un libro o pasaje para que el marco histórico se adapte a esa búsqueda. Mientras tanto, este módulo muestra el contexto general del judaísmo del siglo I a.C. y siglo I d.C.',
      culture: 'El contexto general ayuda a ubicar Torá, Templo, Roma, escatología, grupos judíos, literatura apocalíptica y metáforas comunes.',
      sources: 'Josefo, Filón, literatura apócrifa y pseudoepigráfica, Qumrán y autores romanos.'
    };
  }

  if (specificBookContexts[book]) {
    return { book, group: bookGroup(book), ...specificBookContexts[book] };
  }

  const group = bookGroup(book);
  const genericByGroup = {
    evangelio: {
      setting: `${book} debe leerse dentro del mundo judío del siglo I: sinagoga, Torá, expectativas del reino, ocupación romana, autoridad de escribas y fariseos, y memoria de las Escrituras de Israel.`,
      culture: 'Las parábolas, disputas, sanidades, comidas, genealogías, títulos mesiánicos y referencias al Templo tienen sentido dentro de prácticas judías concretas, no como ideas religiosas aisladas.',
      sources: 'Tradición sinóptica o joánica, Escrituras de Israel, Josefo, Qumrán, literatura apocalíptica judía y estudios del Judaísmo del Segundo Templo.'
    },
    paulina: {
      setting: `${book} pertenece al mundo de las comunidades cristianas tempranas dentro del imperio romano, con tensiones entre identidad judía, gentiles incorporados, vida urbana, casas-iglesia, honor social y lealtad a Cristo.`,
      culture: 'Conceptos como fe, gracia, ley, cuerpo, santidad, poderes, ciudadanía y herencia deben leerse en diálogo con la Escritura judía y la realidad grecorromana del siglo I.',
      sources: 'Cartas paulinas, Hechos, Escrituras de Israel, inscripciones urbanas, Josefo, Filón y estudios sobre comunidades judío-gentiles.'
    },
    general: {
      setting: `${book} se ubica en comunidades cristianas tempranas que leen a Jesús a la luz de la Escritura judía, bajo presión social, debates internos y expectativas escatológicas.`,
      culture: 'El honor, la perseverancia, la comunidad, la pureza, el sufrimiento justo y la esperanza final son categorías del mundo judío y grecorromano, no abstracciones modernas.',
      sources: 'Cartas generales, Escrituras de Israel, literatura judía temprana, Qumrán y contexto social del imperio romano.'
    },
    apocaliptica: {
      setting: `${book} pertenece al género apocalíptico: visiones simbólicas, conflicto cósmico, juicio, imperios, perseverancia comunitaria y esperanza de intervención divina.`,
      culture: 'Bestias, tronos, sellos, templo, ciudad, bodas, número y juicio deben leerse dentro del lenguaje simbólico judío apocalíptico, no como cronograma moderno directo.',
      sources: 'Daniel, Ezequiel, Zacarías, 1 Enoc, Qumrán, literatura apocalíptica judía y contexto imperial romano.'
    },
    tora: {
      setting: `${book} pertenece a la Torá, núcleo identitario de Israel. Aunque el texto es anterior al Segundo Templo, era leído en el siglo I como fundamento de pacto, pureza, culto, calendario, tierra y obediencia.`,
      culture: 'Las leyes, genealogías, narraciones y ritos funcionaban como memoria formativa para comunidades judías bajo dominio extranjero.',
      sources: 'Texto bíblico hebreo, tradición judía interpretativa, Filón, Josefo, Qumrán y recepción de la Torá en el siglo I.'
    },
    historia: {
      setting: `${book} narra memoria histórica de Israel: tierra, monarquía, templo, exilio, liderazgo, fidelidad e infidelidad. En el siglo I estos relatos alimentaban identidad nacional y esperanza de restauración.`,
      culture: 'Reyes, sacerdotes, pactos, guerras y exilio eran categorías vivas para judíos bajo Roma, especialmente al pensar en restauración y juicio.',
      sources: 'Libros históricos, Josefo, tradición judía, Qumrán y lectura de Israel bajo ocupación extranjera.'
    },
    poesia: {
      setting: `${book} pertenece a poesía o sabiduría de Israel. En el siglo I estos textos formaban oración, ética, lamento, esperanza, culto y enseñanza comunitaria.`,
      culture: 'Salmos, proverbios, sufrimiento, sabiduría, justicia y temor de Dios se leían como lenguaje de vida fiel, no como frases sueltas.',
      sources: 'Poesía hebrea, tradición sapiencial, uso litúrgico judío, Qumrán y recepción en el Nuevo Testamento.'
    },
    profetas: {
      setting: `${book} pertenece al corpus profético. En el siglo I, los profetas eran leídos para entender juicio, exilio, restauración, templo, justicia, naciones y esperanza escatológica.`,
      culture: 'Imágenes como viña, siervo, pastor, nuevo pacto, día del Señor y restauración de Sion eran parte del vocabulario religioso del período.',
      sources: 'Texto profético, Qumrán, literatura apocalíptica, Josefo y recepción de los profetas en el Nuevo Testamento.'
    }
  };

  return { book, group, ...genericByGroup[group] };
}

function historicalSectionsForBook(bookContext) {
  const specific = {
    Mateo: {
      worldview: 'Para Mateo, la cosmovisión relevante es la de un judaísmo del siglo I que discute Torá, justicia, reino, identidad de Israel, autoridad de escribas y fariseos, pureza, oración, limosna, ayuno y esperanza mesiánica. El marco no es cristianismo posterior, sino una comunidad que lee a Jesús dentro de las Escrituras de Israel y de debates judíos vivos.',
      literature: 'En Mateo importan especialmente las formas judías de enseñanza: parábolas, dichos sapienciales, controversias legales, genealogía, tipología de Moisés, cumplimiento profético y ecos de Isaías, Oseas, Jeremías, Daniel y Zacarías. Las imágenes de reino, viña, banquete, siervo, pastor, juez y bodas ya tenían resonancia en la tradición bíblica y judía.',
      historians: 'Josefo ayuda a ubicar fariseos, saduceos, Herodes, templo y tensiones con Roma. Filón sirve para comparar judaísmo helenístico, aunque Mateo es más palestino/judeocristiano en tono. Los romanos aportan el marco imperial que condiciona la vida judía bajo ocupación.',
      evidence: [
        ['Evangelio de Mateo', 'Genealogía, discursos, cumplimiento, reino de los cielos', 'Muestra una lectura judeocristiana de Jesús como Mesías davídico y maestro autorizado.'],
        ['Josefo', 'Antigüedades; Guerra', 'Aporta datos sobre fariseos, saduceos, Herodes, templo y poder romano.'],
        ['Qumrán', 'Regla de la Comunidad; Pesher Habacuc', 'Permite comparar lenguaje de justicia, comunidad fiel, interpretación profética y escatología.'],
        ['Salmos de Salomón', 'Salmos 17-18', 'Ayuda a entender expectativas de un mesías davídico justo y restaurador.']
      ]
    },
    Juan: {
      worldview: 'Para Juan, el contexto relevante incluye judaísmo del siglo I, fiestas judías, templo, sinagoga, pureza, testimonio, conflicto de autoridad y símbolos como luz, agua, pan, vida, verdad y gloria. El texto debe leerse como narración teológica con fuerte densidad simbólica judía.',
      literature: 'Juan usa símbolos ya cargados por la Escritura: maná, agua viva, pastor, vid, templo, serpiente levantada, luz y tinieblas. También dialoga con lenguaje sapiencial y con expectativas judías sobre revelación, profeta, Mesías e Hijo del Hombre.',
      historians: 'Josefo ayuda con el marco de Judea, templo, sacerdocio y tensiones con Roma. Filón es útil por su lenguaje helenístico sobre Logos y alegoría, aunque no debe imponerse automáticamente sobre Juan. Los romanos ayudan a ubicar el ambiente imperial tardío del siglo I.',
      evidence: [
        ['Evangelio de Juan', 'Señales, discursos, fiestas, templo, testimonio', 'Muestra una interpretación de Jesús dentro de símbolos judíos y conflicto comunitario.'],
        ['Filón de Alejandría', 'Tratados alegóricos y lenguaje del Logos', 'Sirve como paralelo cultural helenístico, con cautela metodológica.'],
        ['Josefo', 'Antigüedades; Guerra', 'Ubica templo, sacerdocio, Judea y tensiones políticas.'],
        ['Qumrán', 'Textos de luz/tinieblas', 'Ayuda a comparar lenguaje dualista judío sin asumir dependencia directa.']
      ]
    },
    Efesios: {
      worldview: 'Para Efesios, el marco es una comunidad de Asia Menor en ambiente urbano grecorromano, con creyentes judíos y gentiles. Importan identidad colectiva, reconciliación, familia, poderes espirituales, ciudadanía, herencia, templo y pertenencia a un solo pueblo.',
      literature: 'Efesios no trabaja con parábolas narrativas como los Evangelios, sino con lenguaje epistolar, doxología, oración, exhortación doméstica y metáforas corporativas: cuerpo, edificio, templo, armadura, herencia y nueva humanidad. Estas imágenes mezclan Escritura judía y mundo social grecorromano.',
      historians: 'Hechos 19 aporta una escena narrativa de Éfeso. Josefo y Filón sirven para entender judaísmo de diáspora y relación judío-gentil. Las fuentes romanas y datos urbanos ayudan a ubicar culto imperial, economía, asociaciones y religión cívica.',
      evidence: [
        ['Efesios', 'Unidad, nueva humanidad, templo, poderes, armadura', 'Explica identidad comunitaria judío-gentil en Cristo dentro del mundo romano.'],
        ['Hechos 19', 'Éfeso, culto de Artemisa, conflicto público', 'Aporta trasfondo narrativo de religión urbana y presión social.'],
        ['Inscripciones y contexto de Asia Menor', 'Culto imperial, ciudad, honor, asociaciones', 'Ayuda a leer ciudadanía, lealtad, casa y vida pública.'],
        ['Literatura paulina', 'Romanos, Gálatas, Colosenses', 'Permite comparar ley, gentiles, cuerpo, poderes y reconciliación.']
      ]
    },
    Romanos: {
      worldview: 'Para Romanos, el marco es una comunidad mixta en la capital imperial. El debate gira alrededor de justicia de Dios, pecado, Torá, Abraham, Israel, gentiles, identidad comunitaria y vida bajo el poder de Roma.',
      literature: 'Romanos usa argumentación epistolar, diatriba, citas bíblicas, lectura de Abraham, Adán, Moisés, profetas y salmos. No debe leerse como manual sistemático moderno, sino como argumento dirigido a una situación judío-gentil concreta.',
      historians: 'Suetonio ayuda a ubicar conflictos judíos en Roma bajo Claudio. Josefo aporta contexto judío amplio. Filón muestra judaísmo de diáspora. Tácito ayuda con el imaginario romano sobre judíos y cristianos.',
      evidence: [
        ['Romanos', 'Justicia, Torá, Abraham, Israel, gentiles', 'Muestra una argumentación sobre identidad y salvación en comunidad mixta.'],
        ['Suetonio', 'Vida de Claudio', 'Aporta referencia a disturbios judíos en Roma y expulsiones.'],
        ['Josefo', 'Antigüedades; Guerra', 'Contextualiza diversidad judía y relación con Roma.'],
        ['Escrituras de Israel', 'Génesis, Salmos, Isaías, Oseas', 'Base argumentativa de Pablo para leer promesa, pecado, justicia e Israel.']
      ]
    }
  };

  if (specific[bookContext.book]) return specific[bookContext.book];

  const byGroup = {
    evangelio: {
      worldview: `Para ${bookContext.book}, el marco principal es el judaísmo del siglo I: Torá, sinagoga, templo, pureza, reino, autoridad, expectativas mesiánicas y ocupación romana. Las palabras y acciones de Jesús deben leerse dentro de ese mundo social.`,
      literature: 'Importan parábolas, controversias, ecos proféticos, sabiduría judía, imágenes de viña, bodas, banquete, pastor, siervo, juez, camino, luz y tinieblas. Estas metáforas ya tenían historia en la Escritura y en tradiciones judías.',
      historians: 'Josefo ayuda a ubicar Judea, Galilea, sectas judías, Herodes, templo y Roma. Filón permite comparar judaísmo de diáspora. Tácito y Suetonio aportan mirada romana externa.',
      evidence: [
        [bookContext.book, 'Narración evangélica, dichos, señales o parábolas', 'Muestra a Jesús dentro de debates judíos y presión romana.'],
        ['Josefo', 'Antigüedades; Guerra', 'Contextualiza grupos judíos, autoridades y tensiones políticas.'],
        ['Qumrán', 'Textos sectarios y apocalípticos', 'Permite comparar pureza, escatología y lectura profética.'],
        ['Literatura apócrifa/pseudoepigráfica', '1 Enoc; Salmos de Salomón', 'Ilumina expectativas de juicio, Mesías y restauración.']
      ]
    },
    paulina: {
      worldview: `Para ${bookContext.book}, el marco es una comunidad cristiana temprana dentro del imperio romano, con preguntas sobre identidad, judíos y gentiles, lealtad, vida comunitaria, familia, honor y Escritura de Israel.`,
      literature: 'La literatura relevante incluye cartas, exhortaciones, catálogos éticos, oraciones, bendiciones, citas bíblicas y metáforas corporativas. El lenguaje de gracia, fe, ley, cuerpo, herencia y santidad debe leerse históricamente.',
      historians: 'Josefo y Filón ayudan a entender judaísmo de diáspora y relación con gentiles. Fuentes romanas ayudan a ubicar ciudadanía, casa, honor, culto imperial y vida urbana.',
      evidence: [
        [bookContext.book, 'Carta cristiana temprana', 'Permite leer una situación comunitaria concreta, no doctrina abstracta aislada.'],
        ['Hechos', 'Viajes, ciudades, conflictos públicos', 'Aporta marco narrativo para algunas comunidades paulinas.'],
        ['Josefo y Filón', 'Judaísmo del siglo I y diáspora', 'Ayudan a entender Torá, identidad judía y mundo helenístico.'],
        ['Fuentes romanas e inscripciones', 'Ciudad, honor, familia, culto imperial', 'Iluminan la vida social de comunidades urbanas.']
      ]
    },
    profetas: {
      worldview: `Para ${bookContext.book}, aunque el libro es anterior al siglo I, su recepción en el Judaísmo del Segundo Templo lo conectaba con juicio, restauración, templo, exilio, Mesías, naciones y esperanza final.`,
      literature: 'Los profetas alimentaron imágenes como viña, siervo, pastor, nuevo pacto, día del Señor, Sion, desierto, templo y restauración. Qumrán muestra cómo estos textos se releían para interpretar el presente.',
      historians: 'Josefo ayuda a ver cómo la memoria profética seguía viva en crisis nacionales. Qumrán es especialmente relevante como evidencia interpretativa.',
      evidence: [
        [bookContext.book, 'Oráculos proféticos', 'Base para esperanza, juicio y restauración en lecturas judías posteriores.'],
        ['Qumrán', 'Pesharim', 'Muestra interpretación profética aplicada al presente de una comunidad.'],
        ['Literatura apocalíptica', 'Daniel; 1 Enoc', 'Conecta profecía con escatología y juicio.'],
        ['Nuevo Testamento', 'Citas y ecos proféticos', 'Muestra recepción cristiana temprana de esos textos.']
      ]
    }
  };

  return byGroup[bookContext.group] ?? {
    worldview: bookContext.setting,
    literature: bookContext.culture,
    historians: 'Josefo, Filón, Qumrán y autores romanos ofrecen el marco comparativo más útil para ubicar el período, siempre con cautela crítica.',
    evidence: [
      [bookContext.book, 'Texto bíblico consultado', 'Punto de partida para el análisis del libro o pasaje.'],
      ['Josefo', 'Antigüedades; Guerra', 'Marco histórico judío-romano.'],
      ['Filón', 'Tratados judíos helenísticos', 'Comparación con judaísmo de diáspora.'],
      ['Qumrán', 'Manuscritos del Mar Muerto', 'Comparación con sectarismo, escatología y lectura bíblica judía.']
    ]
  };
}

function theologicalThemeForQuery(value, bookContext) {
  const normalized = normalizeText(value);
  if (
    normalized.includes('predestin') ||
    normalized.includes('gracia') ||
    normalized.includes('eleccion') ||
    normalized.includes('presciencia') ||
    normalized.includes('romanos 8') ||
    normalized.includes('efesios 1')
  ) {
    return 'soteriologia';
  }
  if (
    normalized.includes('juan') ||
    normalized.includes('logos') ||
    normalized.includes('verbo') ||
    normalized.includes('hijo') ||
    normalized.includes('cristo') ||
    bookContext.book === 'Juan'
  ) {
    return 'cristologia';
  }
  if (
    normalized.includes('iglesia') ||
    normalized.includes('autoridad') ||
    normalized.includes('llaves') ||
    normalized.includes('mateo 16') ||
    bookContext.book === 'Mateo'
  ) {
    return 'autoridad';
  }
  return bookContext.group === 'paulina' ? 'soteriologia' : 'general';
}

function patristicContextForTheme(theme, bookContext) {
  const emphasis = {
    soteriologia: 'En esta búsqueda conviene observar cómo la Iglesia antigua fue pasando de exhortaciones pastorales sobre obediencia y gracia a debates técnicos sobre pecado, voluntad, gracia y predestinación. El texto no debe leerse como si Agustín, Lutero o Dort ya estuvieran dentro del siglo I, pero sí puede estudiarse cómo esos debates usaron pasajes como Romanos o Efesios.',
    cristologia: 'En esta búsqueda conviene seguir cómo la Iglesia antigua desarrolló lenguaje técnico para hablar de Cristo: Logos, encarnación, naturaleza, persona y relación con el Padre. El punto crítico es distinguir el sentido original del texto y la recepción dogmática posterior.',
    autoridad: 'En esta búsqueda conviene observar cómo los Padres leyeron textos sobre enseñanza, obispos, unidad, tradición, disciplina y autoridad eclesial. La recepción patrística no reemplaza el contexto original, pero muestra cómo la Iglesia antigua organizó su vida comunitaria.',
    general: 'En esta búsqueda conviene usar la patrística como historia de recepción: los Padres no son el contexto original del texto bíblico, sino lectores antiguos que muestran cómo ciertas preguntas se volvieron centrales en la Iglesia.'
  };

  return {
    emphasis: emphasis[theme],
    stages: [
      {
        period: 'Padres Apostólicos',
        figures: 'Clemente de Roma, Ignacio de Antioquía, Policarpo',
        focus: theme === 'autoridad'
          ? 'Orden eclesiástico, obediencia comunitaria, obispos, presbíteros y unidad visible.'
          : 'Continuidad apostólica, vida comunitaria, martirio, obediencia y defensa de la realidad humana de Cristo contra tendencias docetas.',
        relevance: `Sirven para ver cómo comunidades cercanas al período apostólico leyeron textos como ${bookContext.book} desde preocupaciones pastorales concretas.`
      },
      {
        period: 'Padres Apologistas',
        figures: 'Justino Mártir',
        focus: theme === 'cristologia'
          ? 'Uso del Logos para dialogar con filosofía griega y explicar a Cristo como revelación divina.'
          : 'Defensa pública del cristianismo ante el mundo grecorromano y puente conceptual con filosofía, moral y razón.',
        relevance: 'Ayudan a observar cómo el mensaje bíblico empezó a explicarse en categorías comprensibles para el ambiente helenístico.'
      },
      {
        period: 'Desarrolladores del dogma',
        figures: 'Ireneo, Tertuliano, Orígenes',
        focus: theme === 'cristologia'
          ? 'Regla de fe, lucha contra gnosticismo, lenguaje técnico sobre Dios, Cristo, sustancia y persona.'
          : 'Combate contra gnosticismo, defensa de creación, encarnación, Escritura, tradición y primeras formulaciones técnicas.',
        relevance: 'Muestran cómo la lectura bíblica pasó a enfrentar sistemas rivales de interpretación.'
      },
      {
        period: 'Padres de los grandes concilios',
        figures: 'Atanasio, Basilio, Gregorio de Nisa, Gregorio Nacianceno',
        focus: theme === 'cristologia'
          ? 'Disputas contra el arrianismo, definición de lenguaje trinitario y cristológico, homoousios, naturaleza y persona.'
          : 'Defensa de la plena divinidad del Hijo y del Espíritu, y consolidación del vocabulario doctrinal cristiano.',
        relevance: 'Sirven para estudiar recepción dogmática posterior sin confundirla con el primer horizonte histórico del pasaje.'
      }
    ]
  };
}

function theologicalDisputesForTheme(theme) {
  const highlight = {
    soteriologia: 'Esta búsqueda toca directamente debates sobre gracia, voluntad, pecado, elección, predestinación o justificación.',
    cristologia: 'Esta búsqueda toca especialmente debates sobre identidad de Cristo, Logos, encarnación, divinidad y relación con el Padre.',
    autoridad: 'Esta búsqueda toca especialmente debates sobre autoridad, tradición, Escritura, Iglesia y magisterio.',
    general: 'Estas disputas muestran cómo la historia cristiana transformó preguntas bíblicas en controversias doctrinales, políticas e institucionales.'
  };

  return {
    highlight: highlight[theme],
    disputes: [
      {
        title: 'Agustín de Hipona vs. Pelagio',
        period: 'Siglos IV-V',
        context: 'Antigüedad tardía, crisis imperial, disciplina moral cristiana y debate sobre pecado original.',
        sideA: 'Agustín afirmó que la humanidad está radicalmente dañada por el pecado, que la gracia divina inicia y sostiene la salvación, y que la voluntad necesita ser liberada.',
        sideB: 'Pelagio defendió una mayor capacidad moral humana: Dios manda obedecer porque el ser humano puede obedecer; la gracia ayuda, pero no determina interiormente la voluntad.',
        relevance: theme === 'soteriologia' ? 'Muy relevante para textos sobre gracia, elección, pecado, voluntad y predestinación.' : 'Relevante como historia posterior de recepción soteriológica.'
      },
      {
        title: 'Lutero vs. Magisterio Romano; Lutero vs. Erasmo',
        period: 'Siglo XVI',
        context: 'Reforma temprana, indulgencias, autoridad papal, economía eclesiástica, imprenta y crisis de legitimidad religiosa.',
        sideA: 'Lutero atacó las indulgencias y defendió la justificación forense por la fe; contra Erasmo sostuvo la esclavitud de la voluntad en asuntos de salvación.',
        sideB: 'El magisterio romano defendió la autoridad eclesial y el sistema penitencial; Erasmo sostuvo una libertad humana cooperante y rechazó el determinismo teológico fuerte.',
        relevance: theme === 'autoridad' ? 'Muy relevante para textos sobre autoridad, tradición, Escritura y reforma.' : 'Relevante para gracia, justificación, fe y voluntad.'
      },
      {
        title: 'Calvino y Dort vs. Arminio y la Remonstrancia',
        period: 'Siglos XVI-XVII',
        context: 'Post-Reforma, consolidación confesional, universidades reformadas, política neerlandesa y disputa sobre predestinación.',
        sideA: 'La ortodoxia reformada resumida en Dort defendió depravación humana, elección incondicional, expiación definida, gracia eficaz y perseverancia de los santos.',
        sideB: 'La Remonstrancia arminiana defendió elección condicionada por presciencia, gracia resistible, expiación universal y posibilidad debatida de apostasía.',
        relevance: theme === 'soteriologia' ? 'Muy relevante para búsquedas sobre predestinación, presciencia, elección, gracia y perseverancia.' : 'Relevante como desarrollo confesional posterior.'
      }
    ]
  };
}

function chronologyRowsForTheme(theme, bookContext) {
  const rows = [
    ['Siglos I-II', 'Padres Apostólicos vs. docetismo y desorden comunitario', 'Cristología / Autoridad', '1 Clemente; cartas de Ignacio; Martirio de Policarpo', 'Consolidación de autoridad comunitaria, martirio y defensa de la realidad de Cristo.'],
    ['Siglo II', 'Apologistas cristianos frente a crítica pagana', 'Cristología / Razón pública', 'Justino, Apologías; Diálogo con Trifón', 'Uso del Logos como puente con filosofía griega y defensa del cristianismo.'],
    ['Siglos II-III', 'Ireneo, Tertuliano y Orígenes vs. gnosticismos', 'Cristología / Escritura / Regla de fe', 'Contra las herejías; Contra Praxeas; De principiis', 'Desarrollo de vocabulario técnico y defensa de creación, encarnación y unidad bíblica.'],
    ['Siglos IV-V', 'Atanasio y Capadocios vs. arrianismo', 'Cristología / Trinidad', 'Nicea; Constantinopla; escritos antiarrianos', 'Definición conciliar de la plena divinidad del Hijo y del Espíritu.'],
    ['Siglos IV-V', 'Agustín vs. Pelagio', 'Soteriología', 'De natura et gratia; escritos pelagianos; concilios africanos', 'Victoria histórica de la prioridad de la gracia en Occidente.'],
    ['Siglo XVI', 'Lutero vs. Roma; Lutero vs. Erasmo', 'Autoridad / Justificación / Antropología', '95 tesis; De servo arbitrio; De libero arbitrio', 'Ruptura reformadora y debate sobre justificación y voluntad.'],
    ['Siglos XVI-XVII', 'Dort vs. Remonstrancia arminiana', 'Soteriología', 'Cinco artículos remonstrantes; Cánones de Dort', 'Formulación confesional reformada de los cinco puntos contra la Remonstrancia.']
  ];

  if (theme === 'cristologia') return rows.filter((row) => row[2].includes('Cristología') || row[0].includes('IV'));
  if (theme === 'autoridad') return rows.filter((row) => row[2].includes('Autoridad') || row[1].includes('Lutero') || row[0] === 'Siglos I-II');
  if (theme === 'soteriologia') return rows.filter((row) => row[2].includes('Soteriología') || row[1].includes('Lutero'));
  return rows.map((row) => row[0] === 'Siglos I-II' ? [row[0], `${row[1]} en recepción de ${bookContext.book}`, ...row.slice(2)] : row);
}

const simpleTermDefinitions = {
  soteriologia: 'Estudio de cómo se entiende la salvación.',
  escatologia: 'Estudio de la esperanza final: juicio, resurrección, reino y consumación.',
  cristologia: 'Estudio de quién es Cristo y cómo se habla de su identidad.',
  hermeneutica: 'Forma responsable de interpretar un texto.',
  exegesis: 'Lectura cuidadosa que intenta sacar el sentido del texto, no meterle una idea externa.',
  docetismo: 'Idea antigua de que Cristo solo parecía humano, pero no habría tenido humanidad real.',
  gnosticismo: 'Conjunto de movimientos que mezclaban salvación con conocimiento secreto y desprecio de lo material.',
  justificacion: 'Declaración o acto por el cual Dios considera justo al ser humano, según el marco teológico discutido.',
  predestinacion: 'Idea de un propósito determinado de antemano por Dios; su alcance se debatió mucho en la historia.',
  logos: 'Palabra griega que puede significar palabra, razón o principio expresivo; en Juan se usa para hablar del Verbo.',
  tora: 'Instrucción o Ley de Israel; no solo normas, sino identidad, pacto y vida comunitaria.'
};

function studyGuideSteps(result, bookContext) {
  return [
    ['Texto', 'Leé primero el pasaje completo antes de sacar conclusiones.'],
    ['Contexto del libro', `Ubicá el texto dentro de ${bookContext.book}: audiencia, género, cultura y problema tratado.`],
    ['Palabras clave', 'Observá términos repetidos o cargados de sentido, sin definirlos solo por etimología.'],
    ['Estructura', 'Mirar cómo avanza el argumento: causa, contraste, promesa, mandato, ejemplo o conclusión.'],
    ['Historia de recepción', 'Después del sentido original, compará cómo fue leído por Padres, Reformadores y debates posteriores.'],
    ['Síntesis responsable', `Resumí qué afirma ${result.title} y qué preguntas deja abiertas sin forzarlas.`]
  ];
}

function termsForResult(result) {
  const text = normalizeText([
    result.title,
    result.explanation,
    ...(result.sections ?? []).map((section) => `${section.title} ${section.body}`),
    ...(result.lexicalRows ?? []).map((row) => `${row.lemma} ${row.semantics}`)
  ].join(' '));

  return Object.entries(simpleTermDefinitions)
    .filter(([term]) => text.includes(term))
    .slice(0, 8)
    .map(([term, definition]) => ({ term, definition }));
}

function interpretationViews(result, bookContext) {
  const theme = theologicalThemeForQuery(result.title, bookContext);
  const base = [
    {
      title: 'Sentido histórico original',
      body: `Primero se pregunta qué comunicaba el texto dentro de ${bookContext.book}, su género, audiencia y mundo social.`
    },
    {
      title: 'Lectura del Segundo Templo',
      body: 'Observa ecos judíos previos o contemporáneos: Torá, templo, reino, juicio, pureza, sabiduría, apocalíptica o identidad de Israel.'
    },
    {
      title: 'Recepción patrística',
      body: 'Muestra cómo los primeros cristianos usaron el texto en debates sobre Cristo, Iglesia, Escritura, herejías y vida comunitaria.'
    }
  ];

  if (theme === 'soteriologia') {
    base.push(
      { title: 'Lectura agustiniana/reformada', body: 'Tiende a resaltar prioridad de la gracia, pecado, elección, voluntad humana limitada y seguridad de la obra divina.' },
      { title: 'Lectura arminiana/remonstrante', body: 'Tiende a resaltar gracia preveniente, respuesta humana real, presciencia y advertencias bíblicas como significativas.' }
    );
  } else if (theme === 'cristologia') {
    base.push(
      { title: 'Lectura nicena', body: 'Lee el texto dentro de la defensa de la plena divinidad del Hijo y el lenguaje de naturaleza/persona.' },
      { title: 'Cautela crítica', body: 'Distingue entre lo que el texto dice en su marco original y el vocabulario técnico posterior de los concilios.' }
    );
  } else {
    base.push(
      { title: 'Lectura católica histórica', body: 'Suele prestar atención a tradición, Iglesia visible, sacramentos, autoridad y continuidad institucional.' },
      { title: 'Lectura reformada histórica', body: 'Suele priorizar Escritura, predicación, gracia, fe y revisión crítica de tradiciones posteriores.' }
    );
  }

  return base;
}

function classMode(result, bookContext) {
  return {
    objective: `Entender ${result.title} dentro de ${bookContext.book}, evitando sacar el texto de su contexto.`,
    questions: [
      `Qué problema o tema está tratando ${bookContext.book} cerca de este pasaje?`,
      'Qué palabras se repiten o cargan el peso del argumento?',
      'Qué parte pertenece al sentido original y qué parte pertenece a recepción histórica posterior?',
      'Qué aplicación sería responsable sin forzar el texto?'
    ],
    outline: [
      'Leer el texto completo.',
      'Explicar contexto histórico y literario.',
      'Definir palabras clave en lenguaje sencillo.',
      'Comparar interpretaciones históricas sin caricaturizar.',
      'Cerrar con una síntesis breve y honesta.'
    ]
  };
}

function Pill({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-moss-50 text-moss-800 ring-moss-100',
    gold: 'bg-[#f4e7d0] text-[#7a4d16] ring-[#ead7b8]'
  };

  return (
    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-normal ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function App() {
  const [input, setInput] = useState('Romanos 8:29');
  const [depth, setDepth] = useState('estudiante');
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [simpleMode, setSimpleMode] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [showHistoricalContext, setShowHistoricalContext] = useState(false);
  const [studyView, setStudyView] = useState('completo');
  const [favoriteStatus, setFavoriteStatus] = useState('');
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bec_history') ?? '[]');
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bec_favorites') ?? '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('bec_history', JSON.stringify(history.slice(0, 8)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('bec_favorites', JSON.stringify(favorites.slice(0, 20)));
  }, [favorites]);

  const inputKind = detectInputKind(input);
  const historicalContext = getBookHistoricalContext(input);
  const showFullStudy = studyView === 'completo' || studyView === 'historia';
  const showHistoryStudy = studyView === 'historia';
  const simpleTerms = result ? termsForResult(result) : [];
  const classStudy = result ? classMode(result, historicalContext) : null;

  async function handleAnalyze(event) {
    event.preventDefault();
    const value = input.trim();
    if (!value) {
      setStatus('Escribí un versículo, texto o palabra para analizar.');
      return;
    }

    setLoading(true);
    setSimpleMode(false);
    setReadingMode(false);
    setStudyView('completo');
    setStatus('Analizando con método histórico-gramatical...');
    setResult(null);

    try {
      const data = await analyzeInput({ input: value, depth });
      setResult(data);
      setStatus(data.found ? 'Análisis listo' : 'No encontré una coincidencia exacta');
      setHistory((current) => {
        const nextItem = {
          query: value,
          type: modeLabel(data.mode),
          date: new Date().toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })
        };
        return [nextItem, ...current.filter((item) => (typeof item === 'string' ? item : item.query) !== value)].slice(0, 8);
      });
    } catch (error) {
      setStatus(error.response?.data?.mensaje ?? 'No se pudo analizar. Revisá que el backend esté encendido.');
    } finally {
      setLoading(false);
    }
  }

  function useExample(example) {
    setInput(example);
    setResult(null);
    setSimpleMode(false);
    setReadingMode(false);
    setStatus('');
  }

  async function copyStudy() {
    if (!result) return;
    const text = formatStudyForCopy(result);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopyStatus('Estudio copiado');
    } catch {
      setCopyStatus('No pude copiar automáticamente');
    }
    window.setTimeout(() => setCopyStatus(''), 2200);
  }

  function saveFavorite() {
    if (!result) return;
    const item = {
      query: result.title,
      type: modeLabel(result.mode),
      date: new Date().toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' }),
      summary: result.explanation
    };
    setFavorites((current) => [item, ...current.filter((favorite) => favorite.query !== item.query)].slice(0, 20));
    setFavoriteStatus('Guardado');
    window.setTimeout(() => setFavoriteStatus(''), 2200);
  }

  return (
    <main className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-6 py-8 md:py-12">
      <section className="grid gap-4">
        <div className="inline-flex items-center gap-2 font-extrabold text-moss-800">
          <BookOpen size={22} />
          <span>Biblia en Contexto</span>
        </div>
        <div className="grid gap-3">
          <h1 className="max-w-5xl text-4xl font-black leading-[1.05] tracking-normal text-ink md:text-6xl">
            Exégesis bíblica clara, seria y fácil de entender
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-muted">
            Escribí un versículo, pasaje, palabra bíblica o texto. La app responde con método histórico-gramatical:
            contexto, género, estructura, léxico, crítica textual y síntesis sin forzar dogmas.
          </p>
        </div>
      </section>

      <form
        className={`rounded-lg border border-[#dbe3d8] bg-white shadow-soft transition-all ${readingMode ? 'p-4' : 'p-5 md:p-6'}`}
        onSubmit={handleAnalyze}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm font-extrabold text-ink" htmlFor="analysis-input">
            Buscar o analizar
          </label>
          <div className="rounded-lg border border-moss-100 bg-moss-50 px-3 py-2 text-sm text-moss-800">
            <strong>{inputKind.label}</strong>
            <span className="ml-2 text-muted">{inputKind.helper}</span>
          </div>
          <div className="grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white sm:inline-flex">
            {depthOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`min-h-9 px-3 text-sm font-bold transition ${depth === option.id ? 'bg-moss-600 text-white' : 'text-muted hover:bg-moss-50 hover:text-moss-800'}`}
                onClick={() => setDepth(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {!readingMode && (
          <textarea
            id="analysis-input"
            className="mt-4 min-h-40 w-full resize-y rounded-lg border border-[#dbe3d8] bg-white p-4 leading-7 text-ink outline-none transition focus:border-moss-600 focus:ring-4 focus:ring-moss-100"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ej. Romanos 8:29, Juan 3:16, presciencia, gracia, o pegá un texto bíblico..."
          />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-moss-600 px-5 font-extrabold text-white transition hover:bg-moss-800 disabled:opacity-70"
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
            Analizar
          </button>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                className="min-h-9 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-bold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                onClick={() => useExample(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {!readingMode && favorites.length > 0 && (
          <div className="mt-4 grid gap-2 border-t border-[#dbe3d8] pt-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-moss-800">
              <Star size={16} />
              Estudios guardados
            </div>
            <div className="flex flex-wrap gap-2">
              {favorites.slice(0, 6).map((favorite) => (
                <button
                  key={`${favorite.query}-${favorite.date}`}
                  type="button"
                  className="min-h-8 rounded-full border border-[#dbe3d8] bg-white px-3 text-sm text-muted transition hover:border-moss-600 hover:text-moss-800"
                  onClick={() => useExample(favorite.query)}
                >
                  {favorite.query} · {favorite.type} · {favorite.date}
                </button>
              ))}
            </div>
          </div>
        )}

        {!readingMode && history.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#dbe3d8] pt-4 text-muted">
            <History size={16} />
            {history.map((item) => (
              <button
                key={typeof item === 'string' ? item : `${item.query}-${item.date}`}
                type="button"
                className="min-h-8 rounded-full border border-[#dbe3d8] bg-white px-3 text-sm text-muted transition hover:border-moss-600 hover:text-moss-800"
                onClick={() => useExample(typeof item === 'string' ? item : item.query)}
              >
                {typeof item === 'string' ? item : `${item.query} · ${item.type} · ${item.date}`}
              </button>
            ))}
          </div>
        )}

        {status && <p className="mt-3 text-sm text-muted">{status}</p>}
      </form>

      <section className="rounded-lg border border-[#dbe3d8] bg-white p-5 shadow-soft md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Pill tone="gold">Marco histórico</Pill>
            <h2 className="mt-3 text-2xl font-black leading-tight text-ink md:text-3xl">Marco histórico de {historicalContext.book}</h2>
            <p className="mt-2 leading-8 text-muted">
              {historicalContext.setting}
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-4 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
            type="button"
            onClick={() => setShowHistoricalContext((value) => !value)}
          >
            <Library size={18} />
            {showHistoricalContext ? 'Ocultar contexto' : 'Abrir contexto histórico'}
          </button>
        </div>

        {showHistoricalContext && <SecondTempleContext bookContext={historicalContext} query={input} />}
      </section>

      {loading && (
        <section className="grid gap-3 rounded-lg border border-[#dbe3d8] bg-white p-4 shadow-soft md:grid-cols-4" aria-label="Progreso del análisis">
          {loadingSteps.map((step, index) => (
            <div key={step} className="min-h-20 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-3">
              <span className="grid size-7 place-items-center rounded-full bg-moss-600 text-xs font-extrabold text-white">
                {index + 1}
              </span>
              <p className="mt-2 font-bold text-muted">{step}</p>
            </div>
          ))}
        </section>
      )}

      {result && (
        <section className={`overflow-hidden rounded-lg border border-[#dbe3d8] bg-parchment shadow-soft ${readingMode ? 'grid-cols-[190px_minmax(0,860px)] justify-center' : 'lg:grid lg:grid-cols-[230px_minmax(0,1fr)]'}`}>
          <aside className="border-b border-[#dbe3d8] bg-[#f7f7ef] p-5 lg:sticky lg:top-0 lg:min-h-screen lg:border-b-0 lg:border-r">
            <strong className="mb-3 block text-moss-800">Índice</strong>
            <nav className="grid gap-1">
              <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#resumen">Resumen</a>
              {result.verses?.length > 0 && <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#texto">Texto b&iacute;blico</a>}
              {!simpleMode && result.reasoningLayers?.length > 0 && <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#metodo">Método</a>}
              {!simpleMode && result.sections?.map((section) => (
                <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" key={section.title} href={`#${sectionId(section.title)}`}>
                  {section.title}
                </a>
              ))}
              {!simpleMode && result.lexicalRows?.length > 0 && <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#lexico">Léxico</a>}
              {!simpleMode && result.certaintyRows?.length > 0 && <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#certeza">Certeza</a>}
              {!simpleMode && <a className="border-b border-[#e8ede4] py-2 text-sm leading-5 text-muted hover:text-moss-800" href="#cuidados">Cuidados</a>}
            </nav>
          </aside>

          <div className="grid gap-6 p-5 md:p-8">
            <div id="resumen">
              <Pill tone="gold">{result.mode === 'passage' ? 'Pasaje' : result.mode === 'word' ? 'Palabra' : 'Texto'}</Pill>
              <h2 className="mt-3 text-3xl font-black leading-tight text-ink md:text-5xl">{result.title}</h2>
              <p className="mt-3 max-w-4xl text-lg leading-8 text-muted">{simpleMode ? result.simpleSummary : result.explanation}</p>
              <div className="mt-4 grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white sm:inline-flex">
                {[
                  ['resumen', 'Resumen'],
                  ['completo', 'Estudio completo'],
                  ['historia', 'Historia de interpretación']
                ].map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    className={`min-h-10 px-3 text-sm font-bold transition ${studyView === view ? 'bg-moss-600 text-white' : 'text-muted hover:bg-moss-50 hover:text-moss-800'}`}
                    onClick={() => setStudyView(view)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={copyStudy}
                >
                  {copyStatus ? <Check size={16} /> : <Clipboard size={16} />}
                  {copyStatus || 'Copiar estudio'}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={saveFavorite}
                >
                  {favoriteStatus ? <Check size={16} /> : <Star size={16} />}
                  {favoriteStatus || 'Guardar estudio'}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={() => setSimpleMode((value) => !value)}
                >
                  <Wand2 size={16} />
                  {simpleMode ? 'Ver análisis completo' : 'Hacerlo más fácil'}
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] px-3 font-extrabold text-moss-800 transition hover:border-moss-600 hover:bg-moss-50"
                  type="button"
                  onClick={() => setReadingMode((value) => !value)}
                >
                  <Eye size={16} />
                  {readingMode ? 'Mostrar buscador' : 'Modo lectura'}
                </button>
                <small className="max-w-2xl leading-6 text-muted">{result.methodNote}</small>
              </div>
            </div>

            {result.verses?.length > 0 && (
              <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5" id="texto">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Pill tone="gold">Primero el texto</Pill>
                    <h3 className="mt-3 text-2xl font-black leading-tight text-ink">Texto b&iacute;blico completo</h3>
                  </div>
                  <span className="rounded-full border border-[#dbe3d8] bg-white px-3 py-2 text-sm font-extrabold text-moss-800">
                    {result.verses.length} vers&iacute;culo{result.verses.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid gap-3">
                  {result.verses.map((verse) => (
                    <div className="rounded-lg border border-[#dbe3d8] bg-white p-4" key={`${verse.reference}-${verse.text}`}>
                      <strong className="mb-2 block text-ink">{verse.reference}</strong>
                      <div className="rounded-lg border border-moss-100 bg-moss-50 p-3">
                        <small className="mb-1 block font-extrabold uppercase text-moss-800">Lectura clara</small>
                        <p className="leading-8 text-ink">{verse.clearText || verse.text}</p>
                      </div>
                      <small className="mt-2 block text-xs font-bold uppercase text-muted">Base local: {verse.version}</small>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {!simpleMode && showFullStudy && (
              <article className="rounded-lg border border-moss-100 bg-moss-50 p-5">
                <Pill>Contexto del libro</Pill>
                <h3 className="mt-3 text-xl font-black text-ink">Cómo {historicalContext.book} orienta este análisis</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
                    <strong className="block text-moss-800">Situación histórica</strong>
                    <p className="mt-2 leading-7 text-muted">{historicalContext.setting}</p>
                  </div>
                  <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
                    <strong className="block text-moss-800">Claves culturales</strong>
                    <p className="mt-2 leading-7 text-muted">{historicalContext.culture}</p>
                  </div>
                  <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
                    <strong className="block text-moss-800">Fuentes útiles</strong>
                    <p className="mt-2 leading-7 text-muted">{historicalContext.sources}</p>
                  </div>
                </div>
              </article>
            )}

            {!simpleMode && showFullStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-white p-5">
                <h3 className="mb-3 text-xl font-black text-ink">Guía paso a paso para estudiar</h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {studyGuideSteps(result, historicalContext).map(([title, body], index) => (
                    <div className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4" key={title}>
                      <span className="grid size-8 place-items-center rounded-full bg-moss-600 text-sm font-extrabold text-white">{index + 1}</span>
                      <strong className="mt-3 block text-moss-800">{title}</strong>
                      <p className="mt-2 leading-7 text-muted">{body}</p>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {result.sections?.length > 0 && !simpleMode && showFullStudy && (
              <div className="grid gap-3">
                {result.sections.map((section) => (
                  <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5" key={section.title} id={sectionId(section.title)}>
                    <h3 className="mb-2 text-lg font-black text-ink">{section.title}</h3>
                    <p className="leading-8 text-muted">{section.body}</p>
                  </article>
                ))}
              </div>
            )}

            {result.reasoningLayers?.length > 0 && !simpleMode && showFullStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5" id="metodo">
                <h3 className="mb-3 text-lg font-black text-ink">Observación, interpretación y síntesis</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {result.reasoningLayers.map((item) => (
                    <div className="rounded-lg border border-[#dbe3d8] bg-white p-4" key={item.label}>
                      <strong className="mb-2 block text-moss-800">{item.label}</strong>
                      <p className="leading-7 text-muted">{item.body}</p>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {result.lexicalRows?.length > 0 && !simpleMode && showFullStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5" id="lexico">
                <h3 className="mb-3 text-lg font-black text-ink">Léxico en lenguaje sencillo</h3>
                <div className="grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white md:grid-cols-4">
                  <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Lema</div>
                  <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Significado</div>
                  <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Uso contextual</div>
                  <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Sintaxis</div>
                  {result.lexicalRows.map((row) => (
                    <React.Fragment key={`${row.lemma}-${row.contextualUse}`}>
                      <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{row.lemma}</span>
                      <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{row.semantics}</span>
                      <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{row.contextualUse}</span>
                      <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{row.syntax}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {result.lexicalRows.slice(0, 4).map((row) => (
                    <div className="rounded-lg border border-moss-100 bg-moss-50 p-4" key={`simple-${row.lemma}-${row.contextualUse}`}>
                      <strong className="mb-1 block text-moss-800">En palabras simples: {row.lemma}</strong>
                      <p className="leading-7 text-muted">{row.semantics} En este estudio se entiende por su uso en la frase, no por una definición aislada.</p>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {!simpleMode && showFullStudy && simpleTerms.length > 0 && (
              <article className="rounded-lg border border-[#dbe3d8] bg-white p-5">
                <h3 className="mb-3 text-xl font-black text-ink">No entiendo esta palabra</h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {simpleTerms.map((item) => (
                    <div className="rounded-lg border border-moss-100 bg-moss-50 p-4" key={item.term}>
                      <strong className="capitalize text-moss-800">{item.term}</strong>
                      <p className="mt-2 leading-7 text-muted">{item.definition}</p>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {!simpleMode && showFullStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
                <h3 className="mb-3 text-xl font-black text-ink">Comparador de interpretaciones</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {interpretationViews(result, historicalContext).map((view) => (
                    <div className="rounded-lg border border-[#dbe3d8] bg-white p-4" key={view.title}>
                      <strong className="block text-moss-800">{view.title}</strong>
                      <p className="mt-2 leading-7 text-muted">{view.body}</p>
                    </div>
                  ))}
                </div>
              </article>
            )}

            {result.certaintyRows?.length > 0 && !simpleMode && showFullStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5" id="certeza">
                <h3 className="mb-3 text-lg font-black text-ink">Nivel de certeza</h3>
                <div className="grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white md:grid-cols-[180px_minmax(0,1fr)_130px]">
                  <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Tipo</div>
                  <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Afirmación</div>
                  <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Certeza</div>
                  {result.certaintyRows.map((row) => (
                    <React.Fragment key={`${row.kind}-${row.claim}`}>
                      <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{row.kind}</span>
                      <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{row.claim}</span>
                      <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{row.confidence}</span>
                    </React.Fragment>
                  ))}
                </div>
              </article>
            )}

            {!simpleMode && showFullStudy && (
              <div className="grid gap-3 lg:grid-cols-3" id="cuidados">
                <InsightCard title="Comparación textual" items={result.translationNotes} />
                <InsightCard title="Cuidados hermenéuticos" items={result.warnings} />
                <InsightCard title="Errores comunes a evitar" items={result.commonMistakes} />
              </div>
            )}

            {!simpleMode && showFullStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-white p-5">
                <h3 className="mb-2 text-lg font-black text-ink">Fuentes y transparencia</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4">
                    <strong className="block text-moss-800">Texto local</strong>
                    <p className="mt-1 leading-7 text-muted">RVA1909, libre para búsquedas y lectura base.</p>
                  </div>
                  <div className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4">
                    <strong className="block text-moss-800">Comparación ideal</strong>
                    <p className="mt-1 leading-7 text-muted">LBLA/NBLA quedan preparadas para proveedor autorizado.</p>
                  </div>
                  <div className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-4">
                    <strong className="block text-moss-800">Léxicos recomendados</strong>
                    <p className="mt-1 leading-7 text-muted">HALOT y BDAG como referencia académica cuando haya licencia.</p>
                  </div>
                </div>
              </article>
            )}

            {!simpleMode && showFullStudy && classStudy && (
              <article className="rounded-lg border border-moss-100 bg-moss-50 p-5">
                <Pill tone="gold">Modo clase bíblica</Pill>
                <h3 className="mt-3 text-xl font-black text-ink">Preparado para enseñar o compartir</h3>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
                    <strong className="block text-moss-800">Objetivo</strong>
                    <p className="mt-2 leading-7 text-muted">{classStudy.objective}</p>
                  </div>
                  <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
                    <strong className="block text-moss-800">Preguntas para grupo</strong>
                    <ul className="mt-2 grid gap-2 pl-5 text-muted">
                      {classStudy.questions.map((question) => <li className="leading-7" key={question}>{question}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
                    <strong className="block text-moss-800">Bosquejo simple</strong>
                    <ol className="mt-2 grid gap-2 pl-5 text-muted">
                      {classStudy.outline.map((step) => <li className="leading-7" key={step}>{step}</li>)}
                    </ol>
                  </div>
                </div>
              </article>
            )}

            {!simpleMode && showHistoryStudy && (
              <article className="rounded-lg border border-[#dbe3d8] bg-white p-5">
                <div className="mb-4">
                  <Pill tone="gold">Historia de interpretación</Pill>
                  <h3 className="mt-3 text-2xl font-black text-ink">Recepción histórica de {historicalContext.book}</h3>
                </div>
                <SecondTempleContext bookContext={historicalContext} query={input} />
              </article>
            )}

          </div>
        </section>
      )}

      {!result && !loading && (
        <section className="grid min-h-60 justify-items-center rounded-lg border border-[#dbe3d8] bg-white p-6 text-center text-muted shadow-soft">
          <Search size={22} />
          <h2 className="mt-3 text-2xl font-black text-ink">Vista previa del estudio</h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {['Contexto original', 'Género y estructura', 'Léxico sencillo', 'Cuidados hermenéuticos'].map((item) => (
              <span className="rounded-full border border-[#dbe3d8] bg-[#fbfcfa] px-3 py-2 text-sm font-bold text-moss-800" key={item}>
                {item}
              </span>
            ))}
          </div>
          <p className="mt-3">La respuesta aparecerá acá, con formato limpio para leer y estudiar.</p>
        </section>
      )}
    </main>
  );
}

function InsightCard({ title, items = [] }) {
  return (
    <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
      <h3 className="mb-2 text-lg font-black text-ink">{title}</h3>
      <ul className="m-0 grid gap-2 pl-5">
        {items.map((item) => (
          <li className="leading-7 text-muted" key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function SecondTempleContext({ bookContext, query }) {
  const sections = historicalSectionsForBook(bookContext);
  const theme = theologicalThemeForQuery(query, bookContext);
  const patristics = patristicContextForTheme(theme, bookContext);
  const disputes = theologicalDisputesForTheme(theme);
  const chronologyRows = chronologyRowsForTheme(theme, bookContext);

  return (
    <div className="mt-6 grid gap-5 border-t border-[#dbe3d8] pt-5">
      <article className="rounded-lg border border-moss-100 bg-moss-50 p-5">
        <Pill>Libro detectado</Pill>
        <h3 className="mt-3 text-2xl font-black leading-tight text-ink">{bookContext.book}</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Situación histórica</strong>
            <p className="mt-2 leading-7 text-muted">{bookContext.setting}</p>
          </div>
          <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Claves culturales</strong>
            <p className="mt-2 leading-7 text-muted">{bookContext.culture}</p>
          </div>
          <div className="rounded-lg border border-[#dbe3d8] bg-white p-4">
            <strong className="block text-moss-800">Fuentes útiles</strong>
            <p className="mt-2 leading-7 text-muted">{bookContext.sources}</p>
          </div>
        </div>
      </article>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
          <h3 className="mb-3 text-xl font-black text-ink">1. Cosmovisión y creencias judías en {bookContext.book}</h3>
          <p className="leading-8 text-muted">
            {sections.worldview}
          </p>
        </article>

        <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
          <h3 className="mb-3 text-xl font-black text-ink">2. Literatura, parábolas y folclore relacionados</h3>
          <p className="leading-8 text-muted">
            {sections.literature}
          </p>
        </article>
      </div>

      <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
        <h3 className="mb-3 text-xl font-black text-ink">3. Historiadores contemporáneos y cercanos útiles para {bookContext.book}</h3>
        <p className="leading-8 text-muted">{sections.historians}</p>
      </article>

      <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
        <h3 className="mb-3 text-xl font-black text-ink">4. Textos y evidencia escrita para {bookContext.book}</h3>
        <div className="grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white lg:grid-cols-[180px_220px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Autor / Fuente</div>
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Obra / Manuscrito</div>
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Semántica / Contenido clave</div>
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Uso contextual</div>
          {sections.evidence.map(([source, work, context]) => (
            <React.Fragment key={`${source}-${work}`}>
              <span className="border-t border-[#dbe3d8] p-3 text-sm font-bold leading-6 text-ink">{source}</span>
              <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{work}</span>
              <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">{context}</span>
              <span className="border-t border-[#dbe3d8] p-3 text-sm leading-6 text-muted">Ayuda a leer {bookContext.book} dentro de su marco histórico, literario y socio-cultural.</span>
            </React.Fragment>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
        <h3 className="mb-3 text-xl font-black text-ink">5. Patrística relacionada con {bookContext.book}</h3>
        <p className="mb-4 leading-8 text-muted">{patristics.emphasis}</p>
        <div className="grid gap-3 lg:grid-cols-4">
          {patristics.stages.map((stage) => (
            <div className="rounded-lg border border-[#dbe3d8] bg-white p-4" key={stage.period}>
              <strong className="block text-moss-800">{stage.period}</strong>
              <p className="mt-1 text-sm font-bold leading-6 text-ink">{stage.figures}</p>
              <p className="mt-2 leading-7 text-muted">{stage.focus}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{stage.relevance}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
        <h3 className="mb-3 text-xl font-black text-ink">6. Grandes disputas teológicas vinculadas</h3>
        <p className="mb-4 leading-8 text-muted">{disputes.highlight}</p>
        <div className="grid gap-3">
          {disputes.disputes.map((dispute) => (
            <div className="rounded-lg border border-[#dbe3d8] bg-white p-4" key={dispute.title}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-moss-800">{dispute.title}</strong>
                <span className="rounded-full bg-moss-50 px-3 py-1 text-xs font-extrabold text-moss-800">{dispute.period}</span>
              </div>
              <p className="mt-2 leading-7 text-muted"><strong>Contexto político:</strong> {dispute.context}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <p className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-3 leading-7 text-muted"><strong>Bando A:</strong> {dispute.sideA}</p>
                <p className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-3 leading-7 text-muted"><strong>Bando B:</strong> {dispute.sideB}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">{dispute.relevance}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-[#dbe3d8] bg-[#fbfcfa] p-5">
        <h3 className="mb-3 text-xl font-black text-ink">7. Tabla de síntesis cronológica</h3>
        <div className="grid overflow-hidden rounded-lg border border-[#dbe3d8] bg-white lg:grid-cols-[140px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Período / Siglo</div>
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Controversia o contexto</div>
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Núcleo del debate</div>
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Texto o manuscrito clave</div>
          <div className="bg-moss-50 p-3 text-xs font-extrabold uppercase text-moss-800">Conclusión histórica</div>
          {chronologyRows.map((row) => (
            <React.Fragment key={`${row[0]}-${row[1]}`}>
              {row.map((cell, index) => (
                <span className={`border-t border-[#dbe3d8] p-3 text-sm leading-6 ${index === 0 ? 'font-bold text-ink' : 'text-muted'}`} key={`${row[0]}-${index}`}>
                  {cell}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </article>
    </div>
  );
}
