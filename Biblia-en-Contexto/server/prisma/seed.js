import { PrismaClient } from '@prisma/client';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const exodo = await prisma.biblicalBook.upsert({
    where: { abbreviation: 'Ex' },
    update: {},
    create: {
      name: 'Éxodo',
      abbreviation: 'Ex',
      testament: 'OLD',
      order: 2,
      genre: 'Narrativa histórica y ley'
    }
  });

  const passage = await prisma.passage.upsert({
    where: { reference: 'Éxodo 12:1-14' },
    update: {},
    create: {
      reference: 'Éxodo 12:1-14',
      title: 'La Pascua',
      bookId: exodo.id,
      chapterStart: 12,
      verseStart: 1,
      chapterEnd: 12,
      verseEnd: 14,
      summary: 'Dios establece la Pascua en el contexto de la liberación de Israel de Egipto.',
      context:
        'Israel vive bajo opresión en Egipto. El pasaje prepara el juicio final contra Egipto y la liberación del pueblo.',
      genreNote:
        'Narrativa histórica con instrucciones rituales que forman la memoria comunitaria de Israel.',
      structure: [
        'Calendario y selección del cordero',
        'Señal de la sangre',
        'Juicio sobre Egipto',
        'Memorial para futuras generaciones'
      ],
      commonMistakes: [
        'Saltar a aplicaciones modernas sin entender el evento original.',
        'Separar la Pascua del juicio y rescate narrados en Éxodo.',
        'Tratar cada detalle como símbolo sin justificación textual.'
      ]
    }
  });

  const event = await prisma.chronologicalEvent.upsert({
    where: { slug: 'exodo-y-liberacion' },
    update: {
      title: 'Éxodo y liberación',
      stage: 'Éxodo',
      order: 6,
      summary:
        'Dios libera a Israel de Egipto y establece un patrón de juicio, rescate, pacto e identidad para su pueblo.',
      guideQuestion: '¿Qué revela el Éxodo sobre salvación y pacto?'
    },
    create: {
      slug: 'exodo-y-liberacion',
      title: 'Éxodo y liberación',
      stage: 'Éxodo',
      order: 6,
      summary:
        'Dios libera a Israel de Egipto y establece un patrón de juicio, rescate, pacto e identidad para su pueblo.',
      guideQuestion: '¿Qué revela el Éxodo sobre salvación y pacto?'
    }
  });

  const extraEvents = [
    {
      slug: 'creacion',
      title: 'Creación',
      stage: 'Orígenes',
      order: 1,
      summary: 'Dios crea todas las cosas y establece al ser humano como portador de su imagen.',
      guideQuestion: '¿Qué enseña la creación sobre Dios, el mundo y el propósito humano?'
    },
    {
      slug: 'caida',
      title: 'La caída',
      stage: 'Orígenes',
      order: 2,
      summary: 'El pecado rompe la comunión con Dios y afecta la relación humana con toda la creación.',
      guideQuestion: '¿Qué consecuencias produce el pecado en el relato bíblico?'
    },
    {
      slug: 'promesa-a-abraham',
      title: 'Promesa a Abraham',
      stage: 'Patriarcas',
      order: 4,
      summary: 'Dios promete descendencia, tierra y bendición para las naciones por medio de Abraham.',
      guideQuestion: '¿Cómo se desarrolla la promesa de redención?'
    },
    {
      slug: 'pacto-en-sinai',
      title: 'Pacto en Sinaí',
      stage: 'Ley y desierto',
      order: 7,
      summary: 'Dios forma a Israel como pueblo del pacto y revela su voluntad por medio de la ley.',
      guideQuestion: '¿Qué relación hay entre redención, pacto y obediencia?'
    },
    {
      slug: 'reino-de-david',
      title: 'Reino de David',
      stage: 'Monarquía',
      order: 10,
      summary: 'Dios promete a David una dinastía que sostiene la esperanza mesiánica.',
      guideQuestion: '¿Qué relación hay entre promesa, reino y Mesías?'
    },
    {
      slug: 'exilio-y-retorno',
      title: 'Exilio y retorno',
      stage: 'Profetas',
      order: 13,
      summary: 'El exilio muestra juicio por infidelidad, pero los profetas anuncian restauración.',
      guideQuestion: '¿Qué esperanza ofrece Dios después del juicio?'
    },
    {
      slug: 'vida-muerte-y-resurreccion-de-cristo',
      title: 'Vida, muerte y resurrección de Cristo',
      stage: 'Evangelios',
      order: 16,
      summary: 'Jesús cumple las promesas, muere por los pecados y resucita como centro de la historia bíblica.',
      guideQuestion: '¿Cómo cumple Cristo las promesas anteriores?'
    },
    {
      slug: 'iglesia-primitiva-y-mision',
      title: 'Iglesia primitiva y misión',
      stage: 'Hechos y cartas',
      order: 17,
      summary: 'El evangelio se extiende a las naciones y forma comunidades del nuevo pacto.',
      guideQuestion: '¿Cómo continúa la misión de Dios por medio de la iglesia?'
    },
    {
      slug: 'consumacion',
      title: 'Consumación',
      stage: 'Esperanza final',
      order: 19,
      summary: 'La historia bíblica culmina con nueva creación, presencia plena de Dios y restauración final.',
      guideQuestion: '¿Qué esperanza final sostiene la vida cristiana?'
    }
  ];

  for (const item of extraEvents) {
    await prisma.chronologicalEvent.upsert({
      where: { slug: item.slug },
      update: item,
      create: item
    });
  }

  await prisma.eventPassage.upsert({
    where: {
      eventId_passageId: {
        eventId: event.id,
        passageId: passage.id
      }
    },
    update: {},
    create: {
      eventId: event.id,
      passageId: passage.id,
      order: 1
    }
  });

  const exegesis = await prisma.exegesisStudy.findFirst({
    where: { passageId: passage.id, level: 'SIMPLE' }
  });

  if (!exegesis) {
    await prisma.exegesisStudy.create({
      data: {
        passageId: passage.id,
        level: 'SIMPLE',
        originalContext:
          'El pasaje se ubica antes de la salida de Egipto y explica cómo Israel debía prepararse para la liberación.',
        literaryGenre:
          'Narrativa histórica con instrucciones rituales. Cuenta lo que pasó y establece cómo recordarlo.',
        structureExplanation:
          'El texto avanza desde la preparación del cordero hasta la señal de la sangre y el memorial.',
        textualCriticismNote:
          'En una versión futura se podrán registrar variantes textuales relevantes cuando afecten la interpretación.',
        linguisticNotes: [
          {
            termino: 'Pascua',
            explicacion: 'La idea central es que Dios libra a su pueblo en medio del juicio.'
          }
        ],
        restrictedIntertext: [
          {
            referencia: '1 Corintios 5:7',
            razon: 'Pablo usa el lenguaje pascual de forma explícita al hablar de Cristo.'
          }
        ],
        exegeticalSynthesis:
          'Éxodo 12 presenta la liberación de Israel como juicio contra Egipto y rescate para el pueblo marcado por la sangre.',
        tensions: [
          'El texto debe entenderse primero en la historia de Israel antes de desarrollar conexiones cristológicas.'
        ],
        simpleSummary:
          'Dios rescata a su pueblo mediante una señal de sustitución y les manda recordar ese rescate.'
      }
    });
  }

  await prisma.glossaryTerm.upsert({
    where: { term: 'Exégesis' },
    update: {},
    create: {
      term: 'Exégesis',
      simpleDefinition: 'Entender qué quiso decir el texto en su contexto original.',
      deeperDefinition:
        'Estudio del texto considerando contexto histórico, género literario, gramática, estructura y uso de palabras.',
      example: 'Preguntar quién habla, a quién, por qué y qué significaban sus palabras en ese momento.'
    }
  });

  const glossaryTerms = [
    {
      term: 'Amor',
      simpleDefinition: 'Entrega fiel y comprometida que busca el bien del otro según el carácter de Dios.',
      deeperDefinition:
        'En la Biblia, el amor no es solo emoción; incluye pacto, fidelidad, obediencia, sacrificio y búsqueda del bien del prójimo.',
      example: 'Juan 3:16 presenta el amor de Dios como una entrega concreta.'
    },
    {
      term: 'Gracia',
      simpleDefinition: 'Favor inmerecido de Dios hacia personas que no podían salvarse por sí mismas.',
      deeperDefinition:
        'La gracia expresa la iniciativa libre y misericordiosa de Dios para salvar, sostener y transformar a su pueblo.',
      example: 'Efesios 2:8-9 enseña que la salvación es por gracia, no por obras.'
    },
    {
      term: 'Fe',
      simpleDefinition: 'Confiar en Dios y responder a su palabra con dependencia y obediencia.',
      deeperDefinition:
        'La fe bíblica incluye confianza, lealtad y recepción de lo que Dios promete.',
      example: 'Abraham creyó a Dios y esa fe fue contada por justicia.'
    },
    {
      term: 'Pacto',
      simpleDefinition: 'Relación formal que Dios establece con su pueblo mediante promesas y responsabilidades.',
      deeperDefinition:
        'Los pactos bíblicos estructuran la historia de la redención: Noé, Abraham, Sinaí, David y el nuevo pacto.',
      example: 'Jeremías 31 anuncia un nuevo pacto escrito en el corazón.'
    },
    {
      term: 'Justificación',
      simpleDefinition: 'Dios declara justo al pecador por medio de Cristo.',
      deeperDefinition:
        'Acto judicial de Dios por el cual el creyente es aceptado como justo, no por méritos propios, sino por la obra de Cristo.',
      example: 'Romanos 3 explica que la justificación es por gracia mediante la fe.'
    },
    {
      term: 'Santificación',
      simpleDefinition: 'Proceso por el cual Dios va formando a su pueblo en santidad.',
      deeperDefinition:
        'La santificación incluye separación para Dios y transformación progresiva de la vida.',
      example: '1 Tesalonicenses 4:3 habla de la voluntad de Dios: nuestra santificación.'
    },
    {
      term: 'Redención',
      simpleDefinition: 'Rescate o liberación mediante un precio pagado.',
      deeperDefinition:
        'En la Biblia, redención se relaciona con liberación de esclavitud, perdón y pertenencia a Dios.',
      example: 'El Éxodo es un gran modelo de redención en el Antiguo Testamento.'
    },
    {
      term: 'Expiación',
      simpleDefinition: 'La provisión de Dios para tratar el pecado y restaurar la relación con Él.',
      deeperDefinition:
        'La expiación incluye sacrificio, perdón, purificación y reconciliación dentro del marco del pacto.',
      example: 'Levítico 16 describe el día de la expiación.'
    },
    {
      term: 'Reino de Dios',
      simpleDefinition: 'El gobierno salvador de Dios manifestado en su creación y en su pueblo.',
      deeperDefinition:
        'En los evangelios, Jesús anuncia que el reino se ha acercado, mostrando la irrupción del gobierno de Dios.',
      example: 'Marcos 1:15 resume el anuncio de Jesús: el reino de Dios se ha acercado.'
    },
    {
      term: 'Mesías',
      simpleDefinition: 'El ungido prometido por Dios para traer salvación y gobierno justo.',
      deeperDefinition:
        'El título se relaciona con rey, siervo, profeta y esperanza escatológica cumplida en Cristo.',
      example: 'Lucas 1 conecta a Jesús con el trono de David.'
    },
    {
      term: 'Hermenéutica',
      simpleDefinition: 'Principios para interpretar correctamente un texto.',
      deeperDefinition:
        'La hermenéutica ayuda a leer contexto, género, autor, audiencia, estructura y propósito.',
      example: 'Antes de aplicar un pasaje, hay que entender qué significó originalmente.'
    },
    {
      term: 'Crítica textual',
      simpleDefinition: 'Comparar manuscritos antiguos para identificar la lectura más probable del texto.',
      deeperDefinition:
        'Disciplina que evalúa variantes, familias textuales y evidencia externa e interna.',
      example: 'Una variante textual puede requerir una nota, aunque no siempre cambia la doctrina.'
    },
    {
      term: 'Predestinación',
      simpleDefinition: 'La enseñanza de que Dios determinó de antemano el destino salvador de su pueblo.',
      deeperDefinition:
        'En textos como Efesios 1 y Romanos 8, la predestinación se relaciona con la iniciativa de Dios, adopción, conformidad a Cristo y propósito redentor.',
      example: 'Efesios 1:5 usa el lenguaje de predestinar para adopción por medio de Jesucristo.',
      aliases: ['predestinacion', 'predestinar', 'predestino', 'predestinó']
    },
    {
      term: 'Elección',
      simpleDefinition: 'La acción de Dios al escoger a su pueblo según su propósito.',
      deeperDefinition:
        'La elección bíblica debe leerse en su contexto literario y redentor, atendiendo a propósito, pacto, Cristo y comunidad.',
      example: 'Efesios 1:4 habla de ser escogidos en Cristo antes de la fundación del mundo.',
      aliases: ['eleccion', 'escogió', 'escogio', 'elegidos']
    },
    {
      term: 'Adopción',
      simpleDefinition: 'Dios recibe a los creyentes como hijos por medio de Cristo.',
      deeperDefinition:
        'La adopción describe identidad, herencia, relación filial y pertenencia al pueblo de Dios.',
      example: 'Efesios 1:5 conecta predestinación y adopción.',
      aliases: ['adopcion', 'hijos']
    },
    {
      term: 'Providencia',
      simpleDefinition: 'Dios gobierna y sostiene todas las cosas conforme a su propósito.',
      deeperDefinition:
        'La providencia no niega la responsabilidad humana; muestra que Dios obra incluso por medio de circunstancias difíciles.',
      example: 'Génesis 50:20 muestra a Dios obrando bien aun donde hubo mal humano.'
    }
  ];

  for (const term of glossaryTerms) {
    await prisma.glossaryTerm.upsert({
      where: { term: term.term },
      update: term,
      create: term
    });
  }

  const bibleVerses = [
    {
      reference: 'Juan 3:16',
      book: 'Juan',
      chapter: 3,
      verse: 16,
      text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
      version: 'RVA1909',
      testament: 'NEW',
      keywords: ['amor', 'Dios', 'Hijo', 'fe', 'vida eterna', 'salvación']
    },
    {
      reference: 'Efesios 1:4',
      book: 'Efesios',
      chapter: 1,
      verse: 4,
      text: 'Según nos escogió en él antes de la fundación del mundo, para que fuésemos santos y sin mancha delante de él en amor.',
      version: 'RVA1909',
      testament: 'NEW',
      keywords: ['elección', 'eleccion', 'escogió', 'escogio', 'Cristo', 'santidad', 'amor', 'predestinación', 'predestinacion']
    },
    {
      reference: 'Efesios 1:5',
      book: 'Efesios',
      chapter: 1,
      verse: 5,
      text: 'Habiéndonos predestinado para ser adoptados hijos por Jesucristo a sí mismo, según el puro afecto de su voluntad.',
      version: 'RVA1909',
      testament: 'NEW',
      keywords: ['predestinación', 'predestinacion', 'adopción', 'adopcion', 'Jesucristo', 'voluntad', 'hijos']
    },
    {
      reference: 'Romanos 8:29',
      book: 'Romanos',
      chapter: 8,
      verse: 29,
      text: 'Porque a los que antes conoció, también predestinó para que fuesen hechos conformes a la imagen de su Hijo.',
      version: 'RVA1909',
      testament: 'NEW',
      keywords: ['predestinación', 'predestinacion', 'conocimiento', 'Cristo', 'Hijo', 'conformidad']
    },
    {
      reference: 'Romanos 8:30',
      book: 'Romanos',
      chapter: 8,
      verse: 30,
      text: 'Y a los que predestinó, a éstos también llamó; y a los que llamó, a éstos también justificó; y a los que justificó, a éstos también glorificó.',
      version: 'RVA1909',
      testament: 'NEW',
      keywords: ['predestinación', 'predestinacion', 'llamamiento', 'justificación', 'justificacion', 'glorificación', 'glorificacion', 'salvación', 'salvacion']
    },
    {
      reference: 'Efesios 2:8',
      book: 'Efesios',
      chapter: 2,
      verse: 8,
      text: 'Porque por gracia sois salvos por la fe; y esto no de vosotros, pues es don de Dios.',
      version: 'RVA1909',
      testament: 'NEW',
      keywords: ['gracia', 'fe', 'salvación', 'don de Dios']
    },
    {
      reference: 'Génesis 12:3',
      book: 'Génesis',
      chapter: 12,
      verse: 3,
      text: 'Y serán benditas en ti todas las familias de la tierra.',
      version: 'RVA1909',
      testament: 'OLD',
      keywords: ['pacto', 'Abraham', 'bendición', 'naciones', 'promesa']
    },
    {
      reference: 'Jeremías 31:33',
      book: 'Jeremías',
      chapter: 31,
      verse: 33,
      text: 'Daré mi ley en sus entrañas, y escribiréla en sus corazones; y seré yo a ellos por Dios, y ellos me serán por pueblo.',
      version: 'RVA1909',
      testament: 'OLD',
      keywords: ['nuevo pacto', 'ley', 'corazón', 'pueblo de Dios']
    },
    {
      reference: 'Marcos 1:15',
      book: 'Marcos',
      chapter: 1,
      verse: 15,
      text: 'El tiempo es cumplido, y el reino de Dios está cerca: arrepentíos, y creed al evangelio.',
      version: 'RVA1909',
      testament: 'NEW',
      keywords: ['reino de Dios', 'evangelio', 'arrepentimiento', 'fe']
    },
    {
      reference: 'Génesis 50:20',
      book: 'Génesis',
      chapter: 50,
      verse: 20,
      text: 'Vosotros pensasteis mal sobre mí, mas Dios lo encaminó a bien.',
      version: 'RVA1909',
      testament: 'OLD',
      keywords: ['providencia', 'José', 'mal', 'bien', 'Dios']
    }
  ];

  for (const verse of bibleVerses) {
    await prisma.bibleVerse.upsert({
      where: { reference: verse.reference },
      update: verse,
      create: verse
    });
  }

  await prisma.user.upsert({
    where: { email: 'demo@bibliaencontexto.local' },
    update: {},
    create: {
      name: 'Usuario Demo',
      email: 'demo@bibliaencontexto.local',
      passwordHash: hashPassword('Demo1234')
    }
  });

  const biblicalSources = [
    {
      name: 'Códice de Leningrado',
      abbreviation: 'LENINGRAD_CODEX',
      language: 'HEBREW',
      scope: 'OLD_TESTAMENT',
      tradition: 'Texto Masorético',
      baseText: 'Testigo masorético completo usado como base de ediciones críticas modernas del AT hebreo.',
      century: 'Siglo XI d.C.',
      reliability: 'Fuente principal para el texto hebreo medieval completo; muy relevante para estudio del AT.',
      licenseStatus: 'PUBLIC_DOMAIN',
      licenseNote: 'El manuscrito como testigo histórico es de dominio público; ediciones modernas pueden tener derechos.',
      useInApp: 'Referencia primaria para explicar el Texto Masorético y la base hebrea del AT.',
      priority: 1
    },
    {
      name: 'Códice de Alepo',
      abbreviation: 'ALEPPO_CODEX',
      language: 'HEBREW',
      scope: 'OLD_TESTAMENT',
      tradition: 'Texto Masorético',
      baseText: 'Testigo masorético muy antiguo y altamente valorado, aunque no se conserva completo.',
      century: 'Siglo X d.C.',
      reliability: 'Muy confiable para comparar lecturas masoréticas; incompleto en secciones importantes.',
      licenseStatus: 'PUBLIC_DOMAIN',
      licenseNote: 'El manuscrito como testigo histórico es de dominio público; imágenes/ediciones pueden requerir permiso.',
      useInApp: 'Referencia comparativa para variantes y notas del AT.',
      priority: 2
    },
    {
      name: 'Rollos del Mar Muerto',
      abbreviation: 'DSS',
      language: 'HEBREW',
      scope: 'OLD_TESTAMENT',
      tradition: 'Testigos hebreos premasoréticos',
      baseText: 'Manuscritos bíblicos y sectarios hallados en Qumrán y otros sitios del desierto de Judea.',
      century: 'Siglos III a.C. - I d.C.',
      reliability: 'Muy valiosos para crítica textual del AT porque son mucho más antiguos que los códices masoréticos medievales.',
      licenseStatus: 'LICENSE_REQUIRED',
      licenseNote: 'El contenido académico, transcripciones e imágenes suelen depender de ediciones o instituciones específicas.',
      useInApp: 'Usar como referencia de crítica textual, sin reproducir transcripciones protegidas.',
      priority: 3
    },
    {
      name: 'Septuaginta Rahlfs-Hanhart',
      abbreviation: 'LXX_RH',
      language: 'GREEK',
      scope: 'OLD_TESTAMENT',
      tradition: 'Traducción griega antigua del AT',
      baseText: 'Edición crítica manual de la Septuaginta usada ampliamente en estudios bíblicos.',
      century: 'Base textual antigua; edición moderna',
      reliability: 'Muy útil para estudiar el AT griego y el uso de Escrituras en el judaísmo helenista y el NT.',
      licenseStatus: 'COPYRIGHTED',
      licenseNote: 'La edición Rahlfs-Hanhart tiene derechos; requiere licencia para uso extenso.',
      useInApp: 'Registrar referencias y notas; enlazar o licenciar antes de mostrar texto completo.',
      priority: 4
    },
    {
      name: 'Nestle-Aland 28',
      abbreviation: 'NA28',
      language: 'GREEK',
      scope: 'NEW_TESTAMENT',
      tradition: 'Texto crítico ecléctico del NT',
      baseText: 'Edición crítica estándar del Nuevo Testamento griego.',
      century: 'Base manuscrita antigua; edición moderna',
      reliability: 'Una de las ediciones académicas más usadas para exégesis y crítica textual del NT.',
      licenseStatus: 'COPYRIGHTED',
      licenseNote: 'Requiere licencia para reproducir texto o aparato crítico.',
      useInApp: 'Fuente académica recomendada para notas, referencias y análisis con licencia.',
      priority: 5
    },
    {
      name: 'SBL Greek New Testament',
      abbreviation: 'SBLGNT',
      language: 'GREEK',
      scope: 'NEW_TESTAMENT',
      tradition: 'Texto crítico del NT',
      baseText: 'Edición griega del NT publicada por la Society of Biblical Literature.',
      century: 'Edición moderna basada en tradición crítica',
      reliability: 'Útil para estudio y comparación; más accesible para proyectos digitales que NA28.',
      licenseStatus: 'OPEN_ACCESS',
      licenseNote: 'Permite ciertos usos con atribución según sus términos; revisar licencia antes de producción.',
      useInApp: 'Candidato principal para mostrar texto griego del NT si la licencia del proyecto lo permite.',
      priority: 6
    },
    {
      name: 'Westcott-Hort Greek New Testament',
      abbreviation: 'WH1881',
      language: 'GREEK',
      scope: 'NEW_TESTAMENT',
      tradition: 'Texto crítico del NT',
      baseText: 'Edición griega histórica del Nuevo Testamento.',
      century: 'Siglo XIX',
      reliability: 'Importante históricamente; no reemplaza NA28, pero es útil y de dominio público.',
      licenseStatus: 'PUBLIC_DOMAIN',
      licenseNote: 'Dominio público.',
      useInApp: 'Puede cargarse completo como texto griego inicial de dominio público.',
      priority: 7
    },
    {
      name: 'Reina-Valera Antigua',
      abbreviation: 'RVA1909',
      language: 'SPANISH',
      scope: 'WHOLE_BIBLE',
      tradition: 'Traducción española histórica',
      baseText: 'Traducción española clásica de dominio público en muchas jurisdicciones.',
      century: 'Siglo XX temprano',
      reliability: 'Útil para lectura inicial en español por disponibilidad; no sustituye traducciones modernas con licencia.',
      licenseStatus: 'PUBLIC_DOMAIN',
      licenseNote: 'Usualmente tratada como dominio público; verificar jurisdicción antes de producción.',
      useInApp: 'Candidata para mostrar texto bíblico completo en español durante el MVP.',
      priority: 8
    }
  ];

  for (const source of biblicalSources) {
    await prisma.biblicalTextSource.upsert({
      where: { abbreviation: source.abbreviation },
      update: source,
      create: source
    });
  }

  const lexicons = [
    {
      name: 'Brown-Driver-Briggs Hebrew and English Lexicon',
      abbreviation: 'BDB',
      language: 'HEBREW',
      scope: 'LEXICON_HEBREW',
      century: 'Siglo XIX-XX',
      reliability: 'Léxico hebreo clásico, antiguo y todavía útil como recurso de dominio público; debe complementarse con estudios modernos.',
      licenseStatus: 'PUBLIC_DOMAIN',
      licenseNote: 'Dominio público.',
      useInApp: 'Cargar entradas hebreas para definiciones básicas y explicación sencilla.',
      priority: 1
    },
    {
      name: 'Thayer Greek-English Lexicon of the New Testament',
      abbreviation: 'THAYER',
      language: 'GREEK',
      scope: 'LEXICON_GREEK',
      century: 'Siglo XIX',
      reliability: 'Léxico griego antiguo de dominio público; útil para MVP, aunque debe complementarse con BDAG para trabajo académico moderno.',
      licenseStatus: 'PUBLIC_DOMAIN',
      licenseNote: 'Dominio público.',
      useInApp: 'Cargar entradas griegas iniciales y mostrarlas con advertencia de actualización académica.',
      priority: 2
    },
    {
      name: 'Hebrew and Aramaic Lexicon of the Old Testament',
      abbreviation: 'HALOT',
      language: 'HEBREW',
      scope: 'LEXICON_HEBREW',
      century: 'Siglo XX',
      reliability: 'Referencia académica moderna principal para hebreo y arameo bíblico.',
      licenseStatus: 'COPYRIGHTED',
      licenseNote: 'Requiere licencia; no copiar entradas completas sin permiso.',
      useInApp: 'Usar solo como referencia bibliográfica o integrar con licencia.',
      priority: 3
    },
    {
      name: 'BDAG Greek-English Lexicon of the New Testament',
      abbreviation: 'BDAG',
      language: 'GREEK',
      scope: 'LEXICON_GREEK',
      century: 'Siglo XX-XXI',
      reliability: 'Referencia académica moderna principal para griego del NT.',
      licenseStatus: 'COPYRIGHTED',
      licenseNote: 'Requiere licencia; no copiar entradas completas sin permiso.',
      useInApp: 'Usar solo como referencia bibliográfica o integrar con licencia.',
      priority: 4
    }
  ];

  for (const lexicon of lexicons) {
    await prisma.lexiconSource.upsert({
      where: { abbreviation: lexicon.abbreviation },
      update: lexicon,
      create: lexicon
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
