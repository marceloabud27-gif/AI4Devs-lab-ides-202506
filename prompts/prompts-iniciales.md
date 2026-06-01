# Prompts iniciales

## Prompt del ejercicio

Realiza el ejercicio de frontend para crear la interfaz `position`: una pagina tipo kanban donde se visualicen y gestionen los candidatos de una posicion especifica.

## Criterios implementados

- Mostrar el titulo de la posicion en la parte superior.
- Incluir una flecha de regreso al listado de posiciones.
- Renderizar una columna por cada fase del proceso de contratacion.
- Ubicar cada candidato en su fase actual.
- Mostrar nombre completo y puntuacion media en cada tarjeta.
- Permitir mover candidatos entre fases usando drag and drop.
- Actualizar la fase con el endpoint `PUT /candidates/:id/stage`.
- Adaptar el tablero a mobile mostrando las fases en vertical.
