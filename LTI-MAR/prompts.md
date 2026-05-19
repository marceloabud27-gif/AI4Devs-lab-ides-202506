# Prompts utilizados para el diseño inicial de LTI

Este archivo documenta los prompts usados para investigar, estructurar y diseñar la primera versión del sistema LTI, un ATS moderno con colaboración, automatizaciones e inteligencia artificial.

## Prompt 1: Investigación y posicionamiento del producto

```text
Actúa como product manager senior especializado en HR Tech y sistemas ATS.
Necesito diseñar la primera versión de un producto llamado LTI, un Applicant-Tracking System para startups, pymes y equipos de reclutamiento.

Investiga conceptualmente cuáles son los dolores principales de los ATS tradicionales, qué funcionalidades diferencian a los productos modernos y qué ventajas competitivas podría tener una solución nueva.

Devuelve:
- descripción breve del producto
- propuesta de valor
- ventajas competitivas
- funciones clave para una primera versión
- riesgos o decisiones importantes del producto
```

## Prompt 2: Lean Canvas

```text
Con base en el producto LTI, genera un Lean Canvas completo para un ATS SaaS moderno.

Incluye:
- problema
- segmentos de clientes
- propuesta de valor unica
- solución
- canales
- fuentes de ingresos
- estructura de costes
- metricas clave
- ventaja diferencial

Además, represéntalo como diagrama Mermaid compatible con Markdown.
```

## Prompt 3: Casos de uso principales

```text
Actúa como analista funcional.
Define los 3 casos de uso principales para la primera versión de LTI, un ATS con IA y automatizaciones.

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
Actúa como arquitecto de software y modelador de datos.
Diseña el modelo de datos inicial de LTI.

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

Para cada entidad indica atributos, nombre, tipo y descripción.
Incluye relaciones principales y un diagrama entidad-relación en Mermaid.
```

## Prompt 5: Diseno del sistema a alto nivel

```text
Actúa como arquitecto cloud senior.
Propone un diseño de alto nivel para LTI como aplicación SaaS multi-tenant.

Incluye:
- componentes principales
- responsabilidades de cada componente
- almacenamiento
- procesamiento asincrono
- integraciones externas
- seguridad
- observabilidad
- diagrama Mermaid de arquitectura
- decisiones tecnológicas recomendadas
```

## Prompt 6: Diagrama C4 en profundidad

```text
Actúa como arquitecto de software especializado en C4 Model.
Genera diagramas C4 para profundizar en el componente AI Assistant Service de LTI.

Incluye:
- nivel 1: contexto
- nivel 2: contenedores
- nivel 3: componentes internos del AI Assistant Service

El componente debe cubrir resumen de CV, matching contra vacante, sugerencia de preguntas, explicabilidad, auditoría y control de riesgos.
Usa sintaxis Mermaid C4 compatible.
```

## Prompt 7: Revisión y consolidación final

```text
Revisa el documento completo de LTI como si fueras profesor de análisis y diseño de sistemas.

Comprueba que incluya:
- descripción del software
- valor añadido
- ventajas competitivas
- funciones principales
- Lean Canvas
- 3 casos de uso con diagramas
- modelo de datos con entidades, atributos y relaciones
- diseño del sistema a alto nivel con diagrama
- diagrama C4 profundo de un componente

Mejora claridad, coherencia, orden y completitud. Mantén el documento en un único Markdown.
```

## Nota sobre el uso de IA

Los prompts anteriores fueron usados como guía para estructurar el análisis, generar alternativas y consolidar la documentación. El contenido final fue revisado y organizado para que funcione como entrega académica y como documento inicial de producto para un equipo de desarrollo.
