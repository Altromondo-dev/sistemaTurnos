# Harness de regresión (solo desarrollo)

Regresión en Node para la lógica de asignación de turnos. No forma parte de la
aplicación: no se despliega ni se incluye en el build (ver *Build* más abajo).

## Cómo correrlo

Desde la raíz del repositorio:

```
node tools/regresion/regresion.js
```

Sin dependencias: solo Node (módulos `fs`, `path`, `vm`). Imprime un `ok` / `FAIL`
por check y termina con código de salida `0` si pasa todo y `1` si falla alguno,
así que sirve tal cual en un pipeline.

## Cómo funciona

`harness.js` ejecuta los archivos reales de `sistemadeturnos/webapp/` dentro de un
contexto `vm` que **stubbea `sap.ui.define`**: captura la factory del módulo, le
inyecta las dependencias y devuelve lo que el módulo exporta. Las dependencias
`sap/*` y `jQuery` se resuelven con un `Proxy` laxo que acepta cualquier acceso o
llamada; para `Main.controller.js`, el stub de `Controller.extend(name, obj)`
devuelve `obj`, con lo que quedan accesibles los métodos del controller.

Es decir: **no hay copias de la lógica de negocio en el test**. Se ejercita el
código de producción:

- `services/TurnosService.js` → `assignShiftsToLicences`, `ordenarPorEqunr`,
  `_formatTime`, `_convertTimeToMinutes`
- `controller/Main.controller.js` → `_sortLicencesNuevoTurno`, `_sortLicences`,
  `_rebuildFrontendGroupsByEquipo`
- `utils/Utils.js` → `getShiftInfo` (categoría y duración por licencia)

La única excepción es `assignShiftsOld()` dentro de `regresion.js`: una copia del
algoritmo **anterior** (`previousGrupo`), que existe solo para contrastar el
"antes" contra el "ahora" en la salida.

`regresion.js` reproduce los tres flujos de la app tal como los encadenan los
controllers:

| Flujo | Cadena |
|---|---|
| Pantalla, turno **nuevo** | `_sortLicencesNuevoTurno` → `assignShiftsToLicences` → `_sortLicences` → `_rebuildFrontendGroupsByEquipo` |
| Pantalla, turno **existente** | `ordenarPorEqunr` → `assignShiftsToLicences` → `_rebuildFrontendGroupsByEquipo` → `_sortLicences` |
| **Reportes** (amplio y maniobras) | `ordenarPorEqunr` → `assignShiftsToLicences` |

## Qué cubre cada escenario

1. **Caso QAS 29.10.2026** — `1AC-DEH1` con dos licencias (inicio 08:00 y 10:00)
   separadas por `1AC-BVI1` (inicio 10:00) al ordenar por hora de inicio. Es el
   caso de `#SistemaDeTurno-12-13`: verifica que las dos de `1AC-DEH1` queden en
   07:00, contiguas y en el mismo grupo `grp_1AC-DEH1`, y `1AC-BVI1` en 07:10.
   Imprime también el resultado del algoritmo anterior para contrastar.
2. **Grupo de 3 intercalado** — tres licencias del mismo equipo separadas por otros
   dos equipos: las tres comparten hora y quedan contiguas; los equipos siguientes
   avanzan 07:10 y 07:20.
3. **Desacoplados** — licencias con `Grupo` que empieza con `_`: cada una conserva
   su hora propia y no se acoplan aunque compartan `Equnr`.
4. **Turno ya guardado en backend** — con un registro en `TurnosLicencias_nav` para
   la fecha del turno, se respeta la hora grabada (11:45) y no se recalcula; otra
   licencia del mismo equipo sin registro sí se calcula.
5. **Varias consolas** — el cursor de horas es independiente por consola: ambas
   arrancan en 07:00 y no se contaminan entre sí.
6. **Pantalla vs reportes, mismo día** —
   - *6a*: día sin turno grabado → pantalla-turno-existente y reporte dan las
     mismas horas (misma cadena de ordenamiento).
   - *6b*: día con turno grabado → las tres vistas coinciden, porque todas leen
     `TurnosLicencias_nav`. Es el caso normal de un reporte.
   - *6c*: informativo. Para un día **sin** turno grabado, pantalla-turno-**nuevo**
     puede diferir del reporte: la pantalla ordena por hora de inicio y el reporte
     por `Equnr`, así que el cursor recorre los grupos en otro orden. Es una
     divergencia **preexistente**, no la introdujo `#SistemaDeTurno-12-13`; el
     check verifica que el cambio no la agrave.
7. **Invariantes sobre set grande** — 30 licencias, 5 equipos, 2 consolas: todo
   grupo tiene una sola hora, todo grupo queda contiguo, las horas no decrecen
   dentro de cada consola, las consolas quedan agrupadas y alfabéticas, y no se
   pierden ni duplican licencias.

## Datos de prueba

El helper `lic(Id, Equnr, Consola, InitHourSort, extra)` arma licencias con
`Jobcond: "06"` sin PAT ni interruptores/seccionadores, que `getShiftInfo`
clasifica como `SinManiobras` con duración de 10 minutos — de ahí los saltos de
07:00 → 07:10 → 07:20. `extra` permite pisar cualquier campo (`Grupo`,
`Desacoplado`, `TurnosLicencias_nav`, etc.).

`Dateturno` usa objetos `Date` reales, como los entrega el modelo OData de UI5:
`_claveFechaTurno` no parsea el literal `/Date(...)/` de OData v2 en crudo.

## Build

`tools/` está fuera de `sistemadeturnos/webapp/`, que es la raíz del módulo UI5
(`ui5.yaml` / `ui5-deploy.yaml`, `type: application`). El módulo html5 de
`mta.yaml` publica únicamente `sistemadeturnos/dist`, producto de
`npm run build:cf`. Por lo tanto estos archivos nunca llegan al artefacto
desplegado. Si en algún momento el harness se mueve dentro de `webapp/`, hay que
excluirlo en `builder.resources.excludes` de `ui5-deploy.yaml`.
