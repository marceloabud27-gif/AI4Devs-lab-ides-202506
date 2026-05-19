# Prompts utilizados para el diseno inicial de LTI

Este archivo documenta los prompts usados para investigar, estructurar y disenar la primera version del sistema LTI, un ATS moderno con colaboracion, automatizaciones e inteligencia artificial.

## Prompt 1: Investigacion y posicionamiento del producto

```text
Actua como product manager senior especializado en HR Tech y sistemas ATS.
Necesito disenar la primera version de un producto llamado LTI, un Applicant-Tracking System para startups, pymes y equipos de reclutamiento.

Investiga conceptualmente cuales son los dolores principales de los ATS tradicionales, que funcionalidades diferencian a los productos modernos y que ventajas competitivas podria tener una solucion nueva.

Devuelve:
- descripcion breve del producto
- propuesta de valor
- ventajas competitivas
- funciones clave para una primera version
- riesgos o decisiones importantes del producto
```

## Prompt 2: Lean Canvas

```text
Con base en el producto LTI, genera un Lean Canvas completo para un ATS SaaS moderno.

Incluye:
- problema
- segmentos de clientes
- propuesta de valor unica
- solucion
- canales
- fuentes de ingresos
- estructura de costes
- metricas clave
- ventaja diferencial

Ademas, representalo como diagrama Mermaid compatible con Markdown.
```

## Prompt 3: Casos de uso principales

```text
Actua como analista funcional.
Define los 3 casos de uso principales para la primera version de LTI, un ATS con IA y automatizaciones.

Para cada caso de uso incluye:
- actor principal
- actores secundarios
- objetivo
- precondiciones
- flujo principal
- flujos alternativos
- diagrama asociado en Mermaid

Prioriza los casos que mejor representen el valor del sistema.
```

## Prompt 4: Modelo de datos

```text
Actua como arquitecto de software y modelador de datos.
Disena el modelo de datos inicial de LTI.

Debe cubrir:
- empresas u organizaciones
- usuarios y roles
- departamentos
- vacantes
- requisitos de vacantes
- candidatos
- candidaturas
- etapas del pipeline
- historial de etapas
- entrevistas
- participantes
- feedback
- comentarios
- automatizaciones
- notificaciones
- fuentes de candidatos

Para cada entidad indica atributos, nombre, tipo y descripcion.
Incluye relaciones principales y un diagrama entidad-relacion en Mermaid.
```

## Prompt 5: Diseno del sistema a alto nivel

```text
Actua como arquitecto cloud senior.
Propone un diseno de alto nivel para LTI como aplicacion SaaS multi-tenant.

Incluye:
- componentes principales
- responsabilidades de cada componente
- almacenamiento
- procesamiento asincrono
- integraciones externas
- seguridad
- observabilidad
- diagrama Mermaid de arquitectura
- decisiones tecnologicas recomendadas
```

## Prompt 6: Diagrama C4 en profundidad

```text
Actua como arquitecto de software especializado en C4 Model.
Genera diagramas C4 para profundizar en el componente AI Assistant Service de LTI.

Incluye:
- nivel 1: contexto
- nivel 2: contenedores
- nivel 3: componentes internos del AI Assistant Service

El componente debe cubrir resumen de CV, matching contra vacante, sugerencia de preguntas, explicabilidad, auditoria y control de riesgos.
Usa sintaxis Mermaid C4 compatible.
```

## Prompt 7: Revision y consolidacion final

```text
Revisa el documento completo de LTI como si fueras profesor de analisis y diseno de sistemas.

Comprueba que incluya:
- descripcion del software
- valor anadido
- ventajas competitivas
- funciones principales
- Lean Canvas
- 3 casos de uso con diagramas
- modelo de datos con entidades, atributos y relaciones
- diseno del sistema a alto nivel con diagrama
- diagrama C4 profundo de un componente

Mejora claridad, coherencia, orden y completitud. Mantiene el documento en un unico Markdown.
```

## Nota sobre el uso de IA

Los prompts anteriores fueron usados como guia para estructurar el analisis, generar alternativas y consolidar la documentacion. El contenido final fue revisado y organizado para que funcione como entrega academica y como documento inicial de producto para un equipo de desarrollo.
