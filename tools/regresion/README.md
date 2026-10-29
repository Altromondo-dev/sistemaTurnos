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

- `services/TurnosService.js` → `assignShiftsToLicences`, `recalcularDesde`
  (el motor único de horarios), `_agruparPorConsola`, `ordenarPorEqunr`,
  `_formatTime`, `_convertTimeToMinutes`
- `controller/Main.controller.js` → `_recalcularDesde`, `_recalculateEmptyShift`,
  `_sortLicencesNuevoTurno`, `_sortLicences`, `_rebuildFrontendGroupsByEquipo`
- `utils/Utils.js` → `getShiftInfo` (categoría y duración), `getInitHourSort`
  (hora de inicio en minutos)

`regresion.js` reproduce los tres flujos de la app tal como los encadenan los
controllers:

| Flujo | Cadena |
|---|---|
| Pantalla, turno **nuevo** | `_sortLicencesNuevoTurno` → `assignShiftsToLicences` → `_sortLicences` → `_rebuildFrontendGroupsByEquipo` |
| Pantalla, turno **existente** | `ordenarPorEqunr` → `assignShiftsToLicences` → `_rebuildFrontendGroupsByEquipo` → `_sortLicences` |
| **Reportes** (amplio y maniobras) | `ordenarPorEqunr` → `assignShiftsToLicences` |

## Reglas que se verifican

- **RN-01** — ningún bloque arranca antes de la hora de inicio de su **primera**
  licencia: el turno del bloque es el mayor entre el cursor y el **mínimo** de las
  horas de inicio del bloque. Criterio **confirmado por el cliente**, según la
  Figura 10 del requerimiento (el bloque EM VSINC, con inicios de 08:00 a 11:07,
  arranca a las 08:00 y está marcado como correcto). Vive en un solo lugar,
  `TurnosService._inicioBloque`.

  La regla está definida a nivel de bloque, no de licencia, y por eso la regresión
  no la chequea por licencia: dentro de un bloque acoplado, las que empiezan más
  tarde quedan con un turno anterior a su propia hora de inicio. El helper
  `rn01PorBloque()` de `regresion.js` es el que codifica esto.
- **Separación** — después de un bloque se avanza la **mayor** duración de sus
  licencias, no la de `items[0]`.
- **RN-07** — se alerta solo ante conflicto real (solape con el bloque anterior, o
  turno anterior a la hora de inicio). Los huecos no alertan, y la alerta nunca
  bloquea ni corrige el valor.
- **Empujar sí, adelantar no** — un bloque posterior al editado toma
  `max(cursor, inicioBloque, valorActual)`: se empuja si quedó solapado, se respeta
  si ya estaba más tarde, y nunca se adelanta (adelantar en cascada es P-04, 14a-2).
- **Acople** (`#SistemaDeTurno-12-13`) — una sola hora por bloque y filas contiguas.

## Qué cubre cada escenario

0. **Duraciones de referencia** — fija que `getShiftInfo` devuelve 10 / 30 / 45
   minutos para las tres categorías que usan los escenarios. Si cambia la regla de
   negocio, este check falla primero y explica el resto de las fallas.
1. **Caso QAS 29.10.2026** — `1AC-DEH1` con inicios 08:00 / 10:00 / 10:00 / 12:00 y
   `1AC-BVI1` con inicio 10:00. Verifica el bloque `1AC-DEH1` → 08:00, contiguo y en
   `grp_1AC-DEH1`, y `1AC-BVI1` → 10:00.
2. **Caso QAS original de 3 licencias** — las dos de `1AC-DEH1` en 08:00 y
   contiguas, `1AC-BVI1` en 10:00. Cubre el acople de `#12-13` ya con RN-01.
3. **RN-01** — el ejemplo del diseño: L-A 07:00 (30'), L-B 08:00 (10'), L-C 13:00
   (45') → 07:00 / 08:00 / 13:00. Sin RN-01 daban 07:00 / 07:30 / 07:40.
4. **Bloque mixto** — L-B (08:00, 10') y L-C (13:00, 45') en el mismo equipo. El
   bloque arranca 08:00 (el inicio mínimo) y dura 45' (la duración máxima), así que
   el bloque siguiente queda en 08:45: con la regla vieja (`items[0]` = 10') habría
   quedado en 08:10, solapado.
5. **Alertas solo ante conflicto** — cuatro variantes sobre el motor directo:
   hueco (sin alerta), solape, turno anterior a la hora de inicio, y ambos a la vez.
   En todas se comprueba además que el valor del usuario **no** se corrige.
6. **Empujar sí, adelantar no** — el bloque editado se mueve a 10:00: el siguiente
   se empuja de 07:30 a 10:30, y uno que estaba en 16:00 se queda en 16:00 sin
   alertar. Incluye un posterior que se sube a su propia hora de inicio.
7. **Cascada desde el controller** — ejercita `_recalcularDesde` (marca
   `TurnoWarning` ante conflicto, no corrige el ancla) y `_recalculateEmptyShift`
   (el grupo vaciado toma `max(cursor, hora de inicio)`).
8. **Desacoplados** — licencias con `Grupo` que empieza con `_`: hora propia cada
   una, respetando RN-01.
9. **Turno ya guardado en backend** — con registro en `TurnosLicencias_nav` para la
   fecha, se respeta la hora grabada y no se recalcula; las demás sí.
10. **Varias consolas** — cursor independiente por consola.
11. **Pantalla vs reportes, mismo día** — pantalla-nuevo, pantalla-turno-existente
    y reporte dan las **mismas** horas, con y sin turno grabado, y los reportes
    aplican RN-01. Antes de `#SistemaDeTurno-14` pantalla-nuevo podía diferir del
    reporte porque cada uno recorría los grupos en otro orden; ahora la asignación
    inicial ordena los bloques por hora de inicio y el resultado no depende del
    orden de entrada.
12. **Invariantes sobre set grande** — 30 licencias, 5 equipos, 3 categorías,
    2 consolas: una sola hora por bloque, bloques contiguos, RN-01 en todas, horas
    no decrecientes por consola, consolas agrupadas y alfabéticas, sin pérdidas ni
    duplicados, y separación nunca menor que la mayor duración del bloque anterior.

## Datos de prueba

El helper `lic(Id, Equnr, Consola, InitHourSort, categoria, extra)` arma licencias
con una de tres categorías, elegidas para que las duraciones sean distinguibles:

| `categoria` | Campos | `getShiftInfo` | Duración |
|---|---|---|---|
| `sin10` (default) | `Jobcond: "06"` sin PAT ni maniobras | `SinManiobras` | 10' |
| `equipo30` | `Jobcond: "01"`, `Tipoequipo: "TR"` | `ConsignacionEquipo` | 30' |
| `linea45` | `Jobcond: "01"`, `Tipoequipo: "L2"` | `ConsignacionLinea` | 45' |

`extra` permite pisar cualquier campo (`Grupo`, `TurnoAsignado`, `Desacoplado`,
`TurnosLicencias_nav`, etc.).

`Grupo` arranca en `Equnr`, igual que hace `assignShiftsToLicences` cuando la
licencia no trae grupo del backend. Es necesario: sin él,
`_updateSameGroupAndConsoleShifts` compara `undefined === undefined` y trata a
todas las licencias como un mismo grupo.

`Dateturno` usa objetos `Date` reales, como los entrega el modelo OData de UI5:
`_claveFechaTurno` no parsea el literal `/Date(...)/` de OData v2 en crudo.

## Build

`tools/` está fuera de `sistemadeturnos/webapp/`, que es la raíz del módulo UI5
(`ui5.yaml` / `ui5-deploy.yaml`, `type: application`). El módulo html5 de
`mta.yaml` publica únicamente `sistemadeturnos/dist`, producto de
`npm run build:cf`. Por lo tanto estos archivos nunca llegan al artefacto
desplegado. Si en algún momento el harness se mueve dentro de `webapp/`, hay que
excluirlo en `builder.resources.excludes` de `ui5-deploy.yaml`.
