// Regresión del motor de horarios.
// Usa el código REAL de TurnosService, Main.controller (sorts + cascada) y Utils.
//
// #SistemaDeTurno-12-13 : acople por defecto (una hora por bloque, filas contiguas)
// #SistemaDeTurno-14    : motor único, RN-01, separación por mayor duración, RN-07
//                         14a-2: RN-02, Fijado (RN-03/04, P-03, P-04, P-07), Orden (P-06),
//                         licencias nuevas por hora de inicio (P-05), desacople en su lugar
//                         punto 14: alertas del motor solo en el campo de la fila afectada
const { loadModule, timers } = require("./harness");

const Svc = loadModule("transener/sistemadeturnos/services/TurnosService");
const Ctrl = loadModule("transener/sistemadeturnos/controller/Main.controller");
const Utils = loadModule("transener/sistemadeturnos/utils/Utils");
const Fmt = loadModule("transener/sistemadeturnos/utils/FormatHelper");

// Espías de mensajes: MessageHelper (toast) y MessageBox son los mismos objetos que
// recibe el controller, así que queda registrado todo lo que muestra.
const toasts = [];        // se vacía por paso
const toastsTodos = [];   // toda la corrida
loadModule("transener/sistemadeturnos/utils/MessageHelper").show = (s) => { toasts.push(s); toastsTodos.push(s); };
const messageBoxes = [];
loadModule("sap/m/MessageBox").error = (s, mOpts) => {
    messageBoxes.push(s);
    if (mOpts && mOpts.onClose) mOpts.onClose();   // el usuario cierra el diálogo
};
// Textos de las alertas del motor: los que se ven debajo del TimePicker de Turno
const TXT = {
    solape: "El turno comienza antes de la separación mínima con el grupo anterior.",
    antesDeInicio: "El turno comienza antes de la hora de inicio de la licencia.",
    solapeFijada: "Una fila fijada quedó solapada con el grupo anterior y no se modificó."
};
const esAlertaMotor = (s) => Object.keys(TXT).some(k => String(s).indexOf(TXT[k]) !== -1);

let pass = 0, fail = 0;
function check(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra ? "  -> " + extra : "")); }
}
const clone = (a) => JSON.parse(JSON.stringify(a));
const horas = (a) => a.map(l => l.Id + "=" + l.TurnoAsignado).join(" ");
const map = (a) => a.reduce((m, l) => (m[l.Id] = l.TurnoAsignado, m), {});
const hhmm = (h, m) => h * 60 + (m || 0);

// RN-01, definida a nivel de BLOQUE: ningún bloque arranca antes de la hora de
// inicio de su primera licencia (el mínimo; ver TurnosService._inicioBloque y la
// Figura 10 del requerimiento, criterio confirmado por el cliente).
// Ojo: NO vale por licencia — dentro de un bloque acoplado, las que empiezan más
// tarde quedan con un turno anterior a su propia hora de inicio. Es lo esperado.
function rn01PorBloque(aLicences) {
    const mBloques = {};
    aLicences.forEach(l => {
        const k = (l.Consola || "") + "|" + (l.Grupo || l.Equnr || "");
        (mBloques[k] = mBloques[k] || []).push(l);
    });
    return Object.keys(mBloques).every(k => {
        const items = mBloques[k];
        const inicios = items.map(x => x.InitHourSort).filter(x => x != null);
        if (!inicios.length) return true;
        return Svc._convertTimeToMinutes(items[0].TurnoAsignado) >= Math.min(...inicios);
    });
}

// --- Flujos de la app ---
// Pantalla, turno NUEVO
function flujoPantallaNuevo(data) {
    const a = clone(data);
    Ctrl._sortLicencesNuevoTurno(a);
    Svc.assignShiftsToLicences(a);
    Ctrl._sortLicences(a);
    Ctrl._rebuildFrontendGroupsByEquipo(a);
    return a;
}
// Pantalla, turno EXISTENTE
function flujoPantallaExistente(data) {
    const a = Svc.ordenarPorEqunr(clone(data));
    Svc.assignShiftsToLicences(a);
    Ctrl._rebuildFrontendGroupsByEquipo(a);
    Ctrl._sortLicences(a);
    return a;
}
// Reportes amplio y maniobras
function flujoReporte(data) {
    const a = Svc.ordenarPorEqunr(clone(data));
    Svc.assignShiftsToLicences(a);
    return a;
}

// --- Datos ---
// Categorías de Utils.getShiftInfo y su duración:
//   "sin10"    Jobcond 06 sin PAT ni maniobras -> SinManiobras,        10 min
//   "equipo30" Jobcond 01, equipo que no es L2/L5 -> ConsignacionEquipo, 30 min
//   "linea45"  Jobcond 01, Tipoequipo L2 -> ConsignacionLinea,          45 min
const CATEGORIAS = {
    sin10: { Jobcond: "06", Tipoequipo: "L1" },
    equipo30: { Jobcond: "01", Tipoequipo: "TR" },
    linea45: { Jobcond: "01", Tipoequipo: "L2" }
};

// Grupo arranca en Equnr, igual que hace assignShiftsToLicences al no venir del backend:
// sin él, _updateSameGroupAndConsoleShifts compara undefined === undefined y trata a todas
// las licencias como un mismo grupo.
const lic = (Id, Equnr, Consola, InitHourSort, categoria, extra) => Object.assign({
    Id, Equnr, Consola, InitHourSort, Grupo: Equnr, Tplnr: Consola + "-EST",
    Patadic: "", Intercerr: "", Interabier: "", Seleccionad: "", Bloqueo: "",
    Dateturno: new Date(Date.UTC(2026, 9, 29))
}, CATEGORIAS[categoria || "sin10"], extra || {});

// Verificación previa: las duraciones son las que suponen los escenarios
console.log("=== 0. Duraciones de referencia (Utils.getShiftInfo) ===");
{
    const d = (c) => Utils.getShiftInfo(lic("x", "E", "1AC", 0, c)).duration;
    console.log(`  sin10=${d("sin10")}  equipo30=${d("equipo30")}  linea45=${d("linea45")}`);
    check("duraciones 10 / 30 / 45", d("sin10") === 10 && d("equipo30") === 30 && d("linea45") === 45);
}

console.log("\n=== 1. Caso QAS 29.10.2026 (RN-01) ===");
{
    // 1AC-DEH1: inicios 08:00 / 10:00 / 10:00 / 12:00 -> inicioBloque 12:00
    // 1AC-BVI1: inicio 10:00
    const d = [
        lic("L202600275", "1AC-DEH1", "1AC", hhmm(8)),
        lic("L202600300", "1AC-BVI1", "1AC", hhmm(10)),
        lic("L202600272", "1AC-DEH1", "1AC", hhmm(10)),
        lic("L202600281", "1AC-DEH1", "1AC", hhmm(10)),
        lic("L202600290", "1AC-DEH1", "1AC", hhmm(12))
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const deh = r.filter(l => l.Equnr === "1AC-DEH1");
    check("bloque 1AC-DEH1 -> 08:00 (hora de inicio de su primera licencia)",
        deh.every(l => l.TurnoAsignado === "08:00"), horas(r));
    check("1AC-BVI1 -> 10:00", r.find(l => l.Equnr === "1AC-BVI1").TurnoAsignado === "10:00");
    const idx = r.map((l, i) => l.Equnr === "1AC-DEH1" ? i : -1).filter(i => i >= 0);
    check("1AC-DEH1: 4 filas contiguas",
        idx.length === 4 && idx[3] - idx[0] === 3, "indices " + idx);
    check("mismo grupo frontend", new Set(deh.map(l => l.Grupo)).size === 1 && deh[0].Grupo === "grp_1AC-DEH1");
}

console.log("\n=== 2. Caso QAS original de 3 licencias (acople #12-13 + RN-01) ===");
{
    const d = [
        lic("L202600275", "1AC-DEH1", "1AC", hhmm(8)),
        lic("L202600300", "1AC-BVI1", "1AC", hhmm(10)),
        lic("L202600272", "1AC-DEH1", "1AC", hhmm(10))
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const deh = r.filter(l => l.Equnr === "1AC-DEH1");
    check("1AC-DEH1: las dos en 08:00", deh.every(l => l.TurnoAsignado === "08:00"));
    check("1AC-DEH1: filas contiguas", Math.abs(r.indexOf(deh[0]) - r.indexOf(deh[1])) === 1);
    check("1AC-BVI1 -> 10:00 (su hora de inicio, no el cursor 08:10)",
        r.find(l => l.Equnr === "1AC-BVI1").TurnoAsignado === "10:00");
}

console.log("\n=== 3. RN-01: ningún bloque antes de su hora de inicio ===");
{
    // Ejemplo del diseño: L-A 07:00 (30'), L-B 08:00 (10'), L-C 13:00 (45')
    const d = [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30"),
        lic("L-B", "EQ-B", "1AC", hhmm(8), "sin10"),
        lic("L-C", "EQ-C", "1AC", hhmm(13), "linea45")
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const m = map(r);
    check("L-A -> 07:00 (cursor manda)", m["L-A"] === "07:00");
    check("L-B -> 08:00 (hora de inicio manda sobre cursor 07:30)", m["L-B"] === "08:00");
    check("L-C -> 13:00 (hora de inicio manda sobre cursor 08:10)", m["L-C"] === "13:00");
    check("ningún bloque antes de su hora de inicio", rn01PorBloque(r), horas(r));
}

console.log("\n=== 4. Bloque mixto: separación = MAYOR duración del bloque ===");
{
    // L-B (08:00, 10') y L-C (13:00, 45') comparten equipo
    //   -> bloque inicio 08:00 (el mínimo), duración 45' (la mayor)
    // L-E arranca 08:00 también, así que su turno lo fija la separación del bloque
    // anterior: 08:00 + 45' = 08:45. Con la regla vieja (items[0] = 10') daría 08:10.
    const d = [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30"),
        lic("L-B", "EQ-BC", "1AC", hhmm(8), "sin10"),
        lic("L-C", "EQ-BC", "1AC", hhmm(13), "linea45"),
        lic("L-D", "EQ-D", "1AC", hhmm(7), "sin10"),
        lic("L-E", "EQ-E", "1AC", hhmm(8), "sin10")
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const m = map(r);
    check("L-A -> 07:00", m["L-A"] === "07:00");
    check("L-D -> 07:30 (desempate por prioridad de categoría)", m["L-D"] === "07:30");
    check("bloque {L-B, L-C} -> 08:00 (inicio de su primera licencia)",
        m["L-B"] === "08:00" && m["L-C"] === "08:00");
    check("L-E -> 08:45: separación 45' (la mayor), no 10' de items[0]",
        m["L-E"] === "08:45", "L-E=" + m["L-E"]);
}

console.log("\n=== 5. Alertas solo ante conflicto real (RN-07) ===");
{
    // Tres bloques en orden visual: A 07:00 (30'), B, C
    const base = () => [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30", { TurnoAsignado: "07:00" }),
        lic("L-B", "EQ-B", "1AC", hhmm(9), "sin10", { TurnoAsignado: "09:00" }),
        lic("L-C", "EQ-C", "1AC", hhmm(10), "sin10", { TurnoAsignado: "10:00" })
    ];
    const correr = (d, sGrupoEditado) => {
        const aGrupos = Svc._agruparPorConsola(d, "1AC", "visual", null);
        const i = aGrupos.findIndex(g => g.grupo === sGrupoEditado);
        return Svc.recalcularDesde(d, {
            consola: "1AC", desdeGrupo: i, orden: "visual",
            anclas: [sGrupoEditado], respetarValorActual: true
        });
    };

    // 5a. Sin conflicto: hueco entre A (termina 07:30) y B (09:00) -> NO alerta
    let d = base();
    let res = correr(d, "EQ-B");
    console.log("  5a hueco      : " + horas(d) + "  alertas=" + res.alertas.length);
    check("hueco no alerta", res.alertas.length === 0);
    check("hueco no corrige el valor", d.find(l => l.Id === "L-B").TurnoAsignado === "09:00");

    // 5b. Solape: el usuario pone B en 07:10, antes de que termine A (07:30)
    d = base();
    d.find(l => l.Id === "L-B").TurnoAsignado = "07:10";
    res = correr(d, "EQ-B");
    console.log("  5b solape     : " + horas(d) + "  alertas=" + JSON.stringify(res.alertas.map(a => a.tipo)));
    check("solape alerta", res.alertas.some(a => a.tipo === "solape"));
    check("solape NO corrige el valor", d.find(l => l.Id === "L-B").TurnoAsignado === "07:10");

    // 5c. Antes de la hora de inicio: B empieza 09:00, el usuario pone 08:00
    //     (08:00 > fin de A 07:30, así que NO hay solape: la alerta es solo por inicio)
    d = base();
    d.find(l => l.Id === "L-B").TurnoAsignado = "08:00";
    res = correr(d, "EQ-B");
    console.log("  5c antesInicio: " + horas(d) + "  alertas=" + JSON.stringify(res.alertas.map(a => a.tipo)));
    check("antes de la hora de inicio alerta", res.alertas.some(a => a.tipo === "antesDeInicio"));
    check("sin solape en 5c", !res.alertas.some(a => a.tipo === "solape"));
    check("antesDeInicio NO corrige el valor", d.find(l => l.Id === "L-B").TurnoAsignado === "08:00");

    // 5d. Los dos conflictos a la vez
    d = base();
    d.find(l => l.Id === "L-B").TurnoAsignado = "07:05";
    res = correr(d, "EQ-B");
    console.log("  5d ambos      : alertas=" + JSON.stringify(res.alertas.map(a => a.tipo)));
    check("se reportan los dos conflictos",
        res.alertas.some(a => a.tipo === "solape") && res.alertas.some(a => a.tipo === "antesDeInicio"));
}

// Modo "empuje" del motor (respetarValorActual): lo usan la carga y las licencias
// nuevas (P-05). La cascada al editar adelanta (P-04), ver escenario 16.
console.log("\n=== 6. Modo empuje (carga / licencias nuevas): empujar sí, adelantar no ===");
{
    const base = () => [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30", { TurnoAsignado: "07:00" }),
        lic("L-B", "EQ-B", "1AC", hhmm(7), "sin10", { TurnoAsignado: "07:30" }),
        lic("L-C", "EQ-C", "1AC", hhmm(7), "sin10", { TurnoAsignado: "16:00" })
    ];
    const correrDesdeA = (d) => {
        const aGrupos = Svc._agruparPorConsola(d, "1AC", "visual", null);
        const i = aGrupos.findIndex(g => g.grupo === "EQ-A");
        return Svc.recalcularDesde(d, {
            consola: "1AC", desdeGrupo: i, orden: "visual",
            anclas: ["EQ-A"], respetarValorActual: true
        });
    };

    // 6a. El usuario mueve A a 10:00 -> B queda solapada y se EMPUJA a 10:30
    let d = base();
    d.find(l => l.Id === "L-A").TurnoAsignado = "10:00";
    let res = correrDesdeA(d);
    console.log("  6a empuje   : " + horas(d));
    check("A mantiene 10:00 (ancla)", d.find(l => l.Id === "L-A").TurnoAsignado === "10:00");
    check("B empujada a 10:30", d.find(l => l.Id === "L-B").TurnoAsignado === "10:30");
    check("C NO se adelanta en modo empuje: sigue en 16:00",
        d.find(l => l.Id === "L-C").TurnoAsignado === "16:00");
    check("ningún posterior alerta", res.alertas.length === 0);

    // 6b. El usuario mueve A a 07:00 (temprano) -> nada que empujar, nada que adelantar
    d = base();
    res = correrDesdeA(d);
    console.log("  6b sin tocar: " + horas(d));
    check("B se queda en 07:30", d.find(l => l.Id === "L-B").TurnoAsignado === "07:30");
    check("C se queda en 16:00", d.find(l => l.Id === "L-C").TurnoAsignado === "16:00");
    check("sin alertas", res.alertas.length === 0);

    // 6c. Un posterior por debajo de su propia hora de inicio se sube a ella
    d = [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "sin10", { TurnoAsignado: "07:00" }),
        lic("L-B", "EQ-B", "1AC", hhmm(11), "sin10", { TurnoAsignado: "07:10" })
    ];
    const aG = Svc._agruparPorConsola(d, "1AC", "visual", null);
    Svc.recalcularDesde(d, {
        consola: "1AC", desdeGrupo: aG.findIndex(g => g.grupo === "EQ-A"),
        orden: "visual", anclas: ["EQ-A"], respetarValorActual: true
    });
    console.log("  6c RN-01    : " + horas(d));
    check("posterior sube a su hora de inicio (11:00)",
        d.find(l => l.Id === "L-B").TurnoAsignado === "11:00");
}

console.log("\n=== 7. Cascada desde el controller (onChangeHour / campo vaciado) ===");
{
    // _recalcularDesde: wrapper del motor, devuelve los items con TurnoWarning
    let d = [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30", { TurnoAsignado: "07:00" }),
        lic("L-B", "EQ-B", "1AC", hhmm(7), "sin10", { TurnoAsignado: "07:10" })
    ];
    let aWarn = Ctrl._recalcularDesde(d, 1);
    console.log("  7a conflicto: " + horas(d) + "  warnings=" + aWarn.length);
    check("marca TurnoWarning ante solape", aWarn.length === 1 && !!aWarn[0].TurnoWarning);
    check("no corrige el valor del ancla", d.find(l => l.Id === "L-B").TurnoAsignado === "07:10");

    d = [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30", { TurnoAsignado: "07:00" }),
        lic("L-B", "EQ-B", "1AC", hhmm(9), "sin10", { TurnoAsignado: "09:00" })
    ];
    aWarn = Ctrl._recalcularDesde(d, 1);
    console.log("  7b sin conflicto: " + horas(d) + "  warnings=" + aWarn.length);
    check("sin warnings cuando no hay conflicto", aWarn.length === 0);

    // _recalculateEmptyShift: el grupo vaciado toma max(cursor, hora de inicio)
    d = [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30", { TurnoAsignado: "07:00" }),
        lic("L-B", "EQ-B", "1AC", hhmm(9), "sin10", { TurnoAsignado: "" })
    ];
    Ctrl._recalculateEmptyShift(d, d.find(l => l.Id === "L-B"), 1);
    console.log("  7c vaciado  : " + horas(d));
    check("grupo vaciado -> 09:00 (su hora de inicio)",
        d.find(l => l.Id === "L-B").TurnoAsignado === "09:00");
}

console.log("\n=== 8. Desacoplados: cada licencia con hora propia ===");
{
    const d = [
        lic("D1", "EQ-D", "1AC", hhmm(8), "sin10", { Grupo: "_Desacoplado_D1", Desacoplado: true }),
        lic("D2", "EQ-D", "1AC", hhmm(9), "sin10", { Grupo: "_Desacoplado_D2", Desacoplado: true }),
        lic("E1", "EQ-E", "1AC", hhmm(10), "sin10")
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const hs = r.filter(l => l.Desacoplado).map(l => l.TurnoAsignado);
    check("desacoplados con horas distintas", hs[0] !== hs[1], hs.join(","));
    check("desacoplados respetan RN-01 (08:00 / 09:00)",
        hs.includes("08:00") && hs.includes("09:00"));
    check("E1 -> 10:00", r.find(l => l.Id === "E1").TurnoAsignado === "10:00");
}

console.log("\n=== 9. Turno ya guardado en backend: no se recalcula ===");
{
    const d = [
        lic("G1", "EQ-G", "1AC", hhmm(8), "sin10", {
            TurnosLicencias_nav: { results: [{ Dateturno: new Date(Date.UTC(2026, 9, 29)), Turno: "11:45", Comentarios: "x", Agrmanual: false, Desacoplado: false }] }
        }),
        lic("G2", "EQ-G", "1AC", hhmm(9), "sin10"),
        lic("H1", "EQ-H", "1AC", hhmm(10), "sin10")
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const m = map(r);
    check("G1 conserva 11:45 del backend", m["G1"] === "11:45");
    check("G2 (sin guardar) -> 09:00 por RN-01", m["G2"] === "09:00");
    check("H1 -> 10:00 por RN-01", m["H1"] === "10:00");
}

console.log("\n=== 10. Varias consolas: cursor independiente ===");
{
    const d = [
        lic("X1", "EQ-X", "1AC", hhmm(8)), lic("X2", "EQ-X", "1AC", hhmm(11)),
        lic("Y1", "EQ-Y", "2BC", hhmm(9)), lic("Y2", "EQ-Y", "2BC", hhmm(12)),
        lic("Z1", "EQ-Z", "2BC", hhmm(10))
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const m = map(r);
    check("1AC: bloque EQ-X -> 08:00 (inicio de su primera licencia)",
        m["X1"] === "08:00" && m["X2"] === "08:00");
    check("2BC: bloque EQ-Y -> 09:00", m["Y1"] === "09:00" && m["Y2"] === "09:00");
    check("2BC: EQ-Z -> 10:00 (su hora de inicio, no el cursor 09:10)", m["Z1"] === "10:00");
}

console.log("\n=== 11. Pantalla vs Reporte amplio/maniobras, mismo día ===");
{
    const sinGuardar = [
        lic("P1", "EQ-A", "1AC", hhmm(8)), lic("P2", "EQ-B", "1AC", hhmm(9)),
        lic("P3", "EQ-A", "1AC", hhmm(10)), lic("P4", "EQ-C", "1AC", hhmm(11))
    ];
    const pn = flujoPantallaNuevo(sinGuardar);
    const pe = flujoPantallaExistente(sinGuardar);
    const rep = flujoReporte(sinGuardar);
    console.log("  pantalla nuevo     : " + horas(pn));
    console.log("  pantalla existente : " + horas(pe));
    console.log("  reporte            : " + horas(rep));
    check("sin turno guardado: las 3 vistas coinciden",
        JSON.stringify(map(pn)) === JSON.stringify(map(pe)) &&
        JSON.stringify(map(pe)) === JSON.stringify(map(rep)),
        JSON.stringify(map(pn)) + " vs " + JSON.stringify(map(rep)));
    check("los reportes aplican RN-01", rn01PorBloque(rep), horas(rep));

    const guardado = sinGuardar.map(l => Object.assign({}, l, {
        TurnosLicencias_nav: { results: [{ Dateturno: new Date(Date.UTC(2026, 9, 29)), Turno: { P1: "08:00", P2: "09:00", P3: "08:00", P4: "11:00" }[l.Id], Comentarios: "", Agrmanual: false, Desacoplado: false }] }
    }));
    const pn2 = flujoPantallaNuevo(guardado), pe2 = flujoPantallaExistente(guardado), rep2 = flujoReporte(guardado);
    console.log("  con turno guardado : " + horas(rep2));
    check("con turno guardado: las 3 vistas coinciden y respetan lo grabado",
        JSON.stringify(map(pn2)) === JSON.stringify(map(pe2)) &&
        JSON.stringify(map(pe2)) === JSON.stringify(map(rep2)) &&
        map(rep2)["P1"] === "08:00" && map(rep2)["P4"] === "11:00");
}

console.log("\n=== 12. Invariantes sobre set grande ===");
{
    const eq = ["EQ-A", "EQ-B", "EQ-C", "EQ-D", "EQ-E"];
    const cat = ["sin10", "equipo30", "linea45"];
    const d = [];
    for (let i = 0; i < 30; i++) {
        d.push(lic("L" + i, eq[(i * 7) % eq.length], i % 2 ? "1AC" : "2BC",
            hhmm(7 + (i % 10), (i % 4) * 15), cat[i % 3]));
    }
    const r = flujoPantallaNuevo(d);
    const porGrupo = {};
    r.forEach((l, i) => { const k = l.Consola + "|" + l.Grupo; (porGrupo[k] = porGrupo[k] || []).push({ h: l.TurnoAsignado, i }); });
    let okHora = true, okCont = true;
    Object.keys(porGrupo).forEach(k => {
        const v = porGrupo[k];
        if (new Set(v.map(x => x.h)).size !== 1) okHora = false;
        for (let j = 1; j < v.length; j++) if (v[j].i - v[j - 1].i !== 1) okCont = false;
    });
    check("todo bloque tiene una sola hora", okHora);
    check("todo bloque queda contiguo", okCont);
    check("RN-01: ningún bloque antes de su hora de inicio", rn01PorBloque(r));
    let okOrden = true;
    for (let c of ["1AC", "2BC"]) {
        const h = r.filter(l => l.Consola === c).map(l => Svc._convertTimeToMinutes(l.TurnoAsignado));
        for (let j = 1; j < h.length; j++) if (h[j] < h[j - 1]) okOrden = false;
    }
    check("horas no decrecientes dentro de cada consola", okOrden);
    const cons = r.map(l => l.Consola);
    check("consolas agrupadas y alfabéticas", JSON.stringify(cons) === JSON.stringify(clone(cons).sort()));
    check("no se pierden ni duplican licencias", r.length === 30 && new Set(r.map(l => l.Id)).size === 30);

    // Separación: entre bloques consecutivos de una consola, el salto nunca es menor
    // que la mayor duración del bloque anterior, salvo que RN-01 lo haya empujado más.
    let okSep = true;
    for (let c of ["1AC", "2BC"]) {
        const aC = r.filter(l => l.Consola === c);
        const bloques = [];
        aC.forEach(l => {
            const ult = bloques[bloques.length - 1];
            if (ult && ult.grupo === l.Grupo) { ult.items.push(l); }
            else { bloques.push({ grupo: l.Grupo, items: [l] }); }
        });
        for (let j = 1; j < bloques.length; j++) {
            const prev = bloques[j - 1];
            const dur = Math.max(...prev.items.map(x => Utils.getShiftInfo(x).duration));
            const tPrev = Svc._convertTimeToMinutes(prev.items[0].TurnoAsignado);
            const tCur = Svc._convertTimeToMinutes(bloques[j].items[0].TurnoAsignado);
            if (tCur < tPrev + dur) okSep = false;
        }
    }
    check("separación >= mayor duración del bloque anterior", okSep);
}

// ======================= 14a-2 =======================

const ids = (a) => a.map(l => l.Id).join(",");
const t = (a, id) => a.find(l => l.Id === id).TurnoAsignado;
const L = (a, id) => a.find(l => l.Id === id);

// Núcleo de onChangeHour con hora válida (sin modelo ni TimePicker)
function editar(a, id, hora) {
    const oLic = L(a, id);
    Ctrl._updateSameGroupAndConsoleShifts(a, oLic, hora);
    Ctrl._setFijadoGrupo(a, oLic, true);
    return Ctrl._recalcularDesde(a, a.indexOf(oLic));
}
// Núcleo de onChangeHour con el campo vaciado
function vaciar(a, id) {
    const oLic = L(a, id);
    return Ctrl._recalculateEmptyShift(a, oLic, a.indexOf(oLic));
}
// Pantalla, turno guardado (successSelectTurno)
const FECHA = new Date(Date.UTC(2026, 9, 29));
const nav = (turno) => ({ results: [{ Dateturno: FECHA, Turno: turno, Comentarios: "", Agrmanual: false, Desacoplado: false }] });
function flujoCargaGuardada(data) {
    const a = Svc.ordenarPorEqunr(clone(data));
    const mGuardado = {};
    a.forEach(l => { if (l.TurnosLicencias_nav) mGuardado[l.Id] = l.TurnosLicencias_nav.results[0].Turno; });
    Svc.assignShiftsToLicences(a);
    a.forEach(l => { if (mGuardado[l.Id]) l.TurnoAsignado = mGuardado[l.Id]; }); // turnosOriginales
    Ctrl._rebuildFrontendGroupsByEquipo(a);
    let alertas = [];
    if (a.some(l => Number(l.Orden) > 0)) {
        const oRes = Svc.cargarConOrden(a);
        Ctrl._mostrarAlertasMotor(a, oRes);   // successSelectTurno, antes del setData
        alertas = oRes.alertas;
    } else {
        Ctrl._sortLicences(a);
    }
    return { a, alertas };
}
// Pantalla ya armada: una fila por bloque salvo que se indique Grupo
const fila = (Id, Equnr, inicio, cat, turno, extra) =>
    lic(Id, Equnr, "1AC", inicio, cat, Object.assign({ TurnoAsignado: turno, Grupo: "solo_" + Id }, extra || {}));

console.log("\n=== 13. RN-02: editar no reordena ===");
{
    const d = [
        fila("A", "EQ-A", hhmm(7), "equipo30", "07:00"),
        fila("B", "EQ-B", hhmm(7), "sin10", "07:30"),
        fila("C", "EQ-C", hhmm(7), "sin10", "07:40")
    ];
    const antes = ids(d);
    const aWarn = editar(d, "C", "07:10");
    console.log("  " + horas(d));
    check("C editada antes que B: el orden no cambia", ids(d) === antes, ids(d));
    check("C conserva 07:10 y alerta solape", t(d, "C") === "07:10" && aWarn.length === 1 && aWarn[0].Id === "C");
}

console.log("\n=== 14. RN-03/04: valor fijado y recálculo solo de las posteriores ===");
{
    const d = [
        fila("A", "EQ-A", hhmm(7), "equipo30", "07:00"),
        fila("B", "EQ-B", hhmm(7), "sin10", "07:30"),
        fila("C", "EQ-C", hhmm(7), "sin10", "07:40"),
        fila("D", "EQ-D", hhmm(7), "sin10", "07:50")
    ];
    editar(d, "B", "09:00");
    console.log("  " + horas(d));
    check("B queda en 09:00 y fijada", t(d, "B") === "09:00" && L(d, "B").Fijado === true);
    check("A (anterior) no cambia ni se fija", t(d, "A") === "07:00" && L(d, "A").Fijado !== true);
    check("C y D se recalculan: 09:10 / 09:20", t(d, "C") === "09:10" && t(d, "D") === "09:20");

    // Bloque acoplado: se fija entero
    const g = [
        fila("A", "EQ-A", hhmm(7), "sin10", "07:00"),
        fila("G1", "EQ-G", hhmm(7), "sin10", "07:10", { Grupo: "grp_EQ-G" }),
        fila("G2", "EQ-G", hhmm(8), "sin10", "07:10", { Grupo: "grp_EQ-G" })
    ];
    editar(g, "G2", "10:00");
    check("bloque acoplado: las dos filas en 10:00 y fijadas",
        t(g, "G1") === "10:00" && t(g, "G2") === "10:00" && L(g, "G1").Fijado && L(g, "G2").Fijado);
}

console.log("\n=== 15. P-03: la cascada se detiene en la siguiente fijada ===");
{
    const base = (turnoC) => [
        fila("A", "EQ-A", hhmm(7), "equipo30", "07:00"),
        fila("B", "EQ-B", hhmm(7), "sin10", "07:30"),
        fila("C", "EQ-C", hhmm(7), "sin10", turnoC, { Fijado: true }),
        fila("D", "EQ-D", hhmm(7), "sin10", "07:50")
    ];
    let d = base("07:40");
    let aWarn = editar(d, "A", "08:00");
    console.log("  15a choque : " + horas(d));
    check("B empujada a 08:30", t(d, "B") === "08:30");
    check("C fijada NO se modifica (07:40)", t(d, "C") === "07:40");
    check("C pisada: alerta sin modificarla", aWarn.some(it => it.Id === "C"));
    check("D, después de la fijada, no se toca", t(d, "D") === "07:50");

    d = base("10:00");
    aWarn = editar(d, "A", "08:00");
    console.log("  15b hueco  : " + horas(d));
    check("C fijada sin choque: no alerta", !aWarn.some(it => it.Id === "C") && t(d, "C") === "10:00");
}

console.log("\n=== 16. P-04: la cascada adelanta en ambos sentidos, respetando RN-01 ===");
{
    const d = [
        fila("A", "EQ-A", hhmm(7), "equipo30", "08:00"),
        fila("B", "EQ-B", hhmm(7), "sin10", "09:00"),
        fila("C", "EQ-C", hhmm(11), "sin10", "11:00"),
        fila("D", "EQ-D", hhmm(7), "sin10", "13:00")
    ];
    editar(d, "A", "07:15");
    console.log("  " + horas(d));
    check("B se adelanta a 07:45", t(d, "B") === "07:45");
    check("C no baja de su hora de inicio (11:00)", t(d, "C") === "11:00");
    check("D se adelanta a 11:10", t(d, "D") === "11:10");
    check("solo A queda fijada", d.filter(l => l.Fijado).map(l => l.Id).join() === "A");
}

console.log("\n=== 17. P-07: borrar la hora libera la fila ===");
{
    const d = [
        fila("A", "EQ-A", hhmm(7), "equipo30", "07:00"),
        fila("B", "EQ-B", hhmm(7), "sin10", "09:00", { Fijado: true }),
        fila("C", "EQ-C", hhmm(7), "sin10", "09:10"),
        fila("D", "EQ-D", hhmm(7), "sin10", "12:00", { Fijado: true }),
        fila("E", "EQ-E", hhmm(7), "sin10", "12:10")
    ];
    vaciar(d, "B");
    console.log("  " + horas(d));
    check("B deja de estar fijada", L(d, "B").Fijado === false);
    check("B vuelve al cálculo: max(cursor, inicio) = 07:30", t(d, "B") === "07:30");
    check("C se adelanta a 07:40", t(d, "C") === "07:40");
    check("D fijada no se toca y E tampoco", t(d, "D") === "12:00" && t(d, "E") === "12:10");
}

console.log("\n=== 18. P-06: el orden y las fijadas se mantienen al recargar ===");
{
    const d = [
        lic("X1", "EQ-1", "1AC", hhmm(7), "sin10", { Orden: 3, TurnosLicencias_nav: nav("09:00") }),
        lic("X2", "EQ-2", "1AC", hhmm(7), "sin10", { Orden: 1, Fijado: true, TurnosLicencias_nav: nav("08:00") }),
        lic("X3", "EQ-3", "1AC", hhmm(7), "sin10", { Orden: 2, TurnosLicencias_nav: nav("07:30") })
    ];
    const { a, alertas } = flujoCargaGuardada(d);
    console.log("  " + horas(a));
    check("se muestra por Orden (X2, X3, X1), no por hora", ids(a) === "X2,X3,X1", ids(a));
    check("sin licencias nuevas no se recalcula nada (horas = guardadas)",
        t(a, "X1") === "09:00" && t(a, "X2") === "08:00" && t(a, "X3") === "07:30");
    check("Fijado se conserva", L(a, "X2").Fijado === true && L(a, "X1").Fijado !== true);
    check("sin alertas", alertas.length === 0);
}

console.log("\n=== 19. P-05: licencia nueva al recargar, por hora de inicio ===");
{
    const base = (catS8, catN, fijS9) => [
        lic("S8", "EQ-1", "1AC", hhmm(8), catS8, { Orden: 1, TurnosLicencias_nav: nav("08:00") }),
        lic("S9", "EQ-2", "1AC", hhmm(9), "sin10", { Orden: 2, Fijado: fijS9, TurnosLicencias_nav: nav("09:00") }),
        lic("S10", "EQ-3", "1AC", hhmm(10), "sin10", { Orden: 3, TurnosLicencias_nav: nav("10:00") }),
        lic("N", "EQ-N", "1AC", hhmm(8, 30), catN)
    ];
    let r = flujoCargaGuardada(base("sin10", "sin10", false));
    console.log("  19a        : " + horas(r.a));
    check("la nueva (08:30) queda entre la de 08:00 y la de 09:00", ids(r.a) === "S8,N,S9,S10", ids(r.a));
    check("turno = max(anterior + separación, inicio) = 08:30", t(r.a, "N") === "08:30");
    check("las demás no cambian", t(r.a, "S9") === "09:00" && t(r.a, "S10") === "10:00");

    r = flujoCargaGuardada(base("linea45", "linea45", false));
    console.log("  19b empuje : " + horas(r.a));
    check("N = 08:45 (08:00 + 45')", t(r.a, "N") === "08:45");
    check("S9 pisada se empuja a 09:30", t(r.a, "S9") === "09:30");
    check("S10 no pisada no se mueve", t(r.a, "S10") === "10:00");

    r = flujoCargaGuardada(base("linea45", "linea45", true));
    console.log("  19c fijada : " + horas(r.a));
    check("S9 fijada no se mueve aunque quede pisada", t(r.a, "S9") === "09:00");
    check("alerta solapeFijada", r.alertas.some(x => x.tipo === "solapeFijada"));
    check("S10 sigue en 10:00", t(r.a, "S10") === "10:00");
}

console.log("\n=== 20. P-05: la nueva se suma al bloque de su equipo ===");
{
    const base = (fij) => [
        lic("S8", "EQ-A", "1AC", hhmm(8), "sin10", { Orden: 1, Fijado: fij, TurnosLicencias_nav: nav("08:00") }),
        lic("S9", "EQ-B", "1AC", hhmm(9), "sin10", { Orden: 2, TurnosLicencias_nav: nav("09:00") }),
        lic("N", "EQ-A", "1AC", hhmm(9, 30), "sin10")
    ];
    let r = flujoCargaGuardada(base(false));
    console.log("  " + horas(r.a));
    check("contigua a su bloque (S8, N, S9)", ids(r.a) === "S8,N,S9", ids(r.a));
    check("toma el turno del bloque (08:00) y su grupo",
        t(r.a, "N") === "08:00" && L(r.a, "N").Grupo === L(r.a, "S8").Grupo);
    check("bloque sin fijar: N sin fijar", L(r.a, "N").Fijado === false);
    r = flujoCargaGuardada(base(true));
    check("bloque fijado: N queda fijada también", L(r.a, "N").Fijado === true);
}

console.log("\n=== 21. \"+ Licencias\": varias nuevas y consola nueva ===");
{
    const pantalla = () => [
        fila("P8", "EQ-1", hhmm(8), "sin10", "08:00"),
        fila("P9", "EQ-2", hhmm(9), "sin10", "09:00"),
        lic("Z1", "EQ-Z", "2BC", hhmm(7), "sin10", { TurnoAsignado: "07:00", Grupo: "solo_Z1" })
    ];
    // Lo que arma appendLicencesToModel antes de ubicarlas
    const nueva = (Id, Equnr, Consola, inicio) =>
        lic(Id, Equnr, Consola, inicio, "sin10", { Grupo: "_Desacoplado_" + Id, Desacoplado: false, Fijado: false, Orden: 0 });

    const d = pantalla();
    Svc.ubicarNuevas(d, [nueva("N30", "EQ-N30", "1AC", hhmm(8, 30)), nueva("N20", "EQ-N20", "1AC", hhmm(8, 20)),
        nueva("B1", "EQ-B1", "1BB", hhmm(10))]);
    console.log("  " + horas(d));
    check("quedan en orden de inicio: P8, N20, N30, P9", ids(d.filter(l => l.Consola === "1AC")) === "P8,N20,N30,P9");
    check("N20 = 08:20, N30 = 08:30", t(d, "N20") === "08:20" && t(d, "N30") === "08:30");
    check("consola nueva 1BB entre 1AC y 2BC", JSON.stringify(d.map(l => l.Consola)) === JSON.stringify(["1AC", "1AC", "1AC", "1AC", "1BB", "2BC"]));
    check("1BB: turno = su hora de inicio (10:00)", t(d, "B1") === "10:00");
    check("2BC no se toca", t(d, "Z1") === "07:00");
}

console.log("\n=== 22. Turno guardado antes de 14a-2 (sin Orden ni Fijado) ===");
{
    const d = [
        lic("P1", "EQ-A", "1AC", hhmm(8), "sin10", { TurnosLicencias_nav: nav("08:00") }),
        lic("P2", "EQ-B", "1AC", hhmm(9), "sin10", { TurnosLicencias_nav: nav("09:00") }),
        lic("P3", "EQ-A", "1AC", hhmm(10), "sin10", { TurnosLicencias_nav: nav("08:00") }),
        lic("P4", "EQ-C", "1AC", hhmm(11), "sin10", { TurnosLicencias_nav: nav("11:00") })
    ];
    const { a } = flujoCargaGuardada(d);
    const e = flujoPantallaExistente(d);
    console.log("  " + horas(a));
    check("igual que 14a-1 (orden y horas)", ids(a) === ids(e) && horas(a) === horas(e), horas(e));
    a.forEach(l => { l._originalOrden = Number(l.Orden) || 0; });
    Svc.numerarOrden(a);
    check("el primer guardado migra: todas las filas cambian de Orden",
        a.every(l => l.Orden !== l._originalOrden) && ids(a) === ids(e));
}

console.log("\n=== 23. Varias consolas y licencias eliminadas ===");
{
    const d = [
        fila("A1", "EQ-A1", hhmm(7), "sin10", "07:00"),
        fila("A2", "EQ-A2", hhmm(7), "sin10", "07:10"),
        lic("B1", "EQ-B1", "2BC", hhmm(7), "sin10", { TurnoAsignado: "07:00", Grupo: "solo_B1" }),
        lic("B2", "EQ-B2", "2BC", hhmm(7), "sin10", { TurnoAsignado: "07:10", Grupo: "solo_B2" })
    ];
    editar(d, "A1", "09:00");
    check("la cascada de 1AC no toca 2BC", t(d, "A2") === "09:10" && t(d, "B1") === "07:00" && t(d, "B2") === "07:10");
    d.splice(1, 1); // onDeletePress
    Svc.numerarOrden(d);
    check("eliminada: Orden 1..n sin huecos y el resto conserva su orden",
        d.map(l => l.Orden).join() === "1,2,3" && ids(d) === "A1,B1,B2");
}

console.log("\n=== 24. Desacoplar en su lugar (Figura 4) ===");
{
    const base = (fij) => [
        fila("V1", "EM-VSINC", hhmm(8), "sin10", "08:00", { Grupo: "grp_EM-VSINC", Fijado: fij }),
        fila("V2", "EM-VSINC", hhmm(9), "sin10", "08:00", { Grupo: "grp_EM-VSINC", Fijado: fij }),
        fila("V3", "EM-VSINC", hhmm(10), "sin10", "08:00", { Grupo: "grp_EM-VSINC", Fijado: fij }),
        fila("B", "EQ-B", hhmm(7), "sin10", "08:10"),
        fila("C", "EQ-C", hhmm(7), "sin10", "12:00", { Fijado: true }),
        fila("D", "EQ-D", hhmm(7), "sin10", "12:10")
    ];
    const desacoplar = (a, id) => {
        const i = a.findIndex(l => l.Id === id);
        const oLic = a.splice(i, 1)[0];   // onDetachLicense
        return Ctrl._desacoplarEnLugar(a, oLic, i);
    };

    const d = base(false);
    desacoplar(d, "V2");
    console.log("  24a V2     : " + horas(d));
    check("V2 queda inmediatamente después de su bloque", ids(d) === "V1,V3,V2,B,C,D", ids(d));
    check("V2: desacoplada, sin fijar, grupo propio",
        L(d, "V2").Desacoplado === true && L(d, "V2").Fijado === false && L(d, "V2").Grupo === "_Desacoplado_V2");
    check("V2 = max(cursor 08:10, inicio 09:00) = 09:00", t(d, "V2") === "09:00");
    check("la cascada sigue: B 09:10", t(d, "B") === "09:10");
    check("se detiene en la fijada: C 12:00 y D 12:10 sin tocar", t(d, "C") === "12:00" && t(d, "D") === "12:10");

    desacoplar(d, "V3");
    console.log("  24b V3     : " + horas(d));
    check("las desacopladas quedan consecutivas en el orden en que se desacoplaron", ids(d) === "V1,V2,V3,B,C,D", ids(d));
    check("V3 = 10:00 (su inicio) y B 10:10", t(d, "V3") === "10:00" && t(d, "B") === "10:10");

    const f = base(true);
    desacoplar(f, "V2");
    check("bloque fijado: la desacoplada queda sin fijar y el resto sigue fijado",
        L(f, "V2").Fijado === false && L(f, "V1").Fijado === true && L(f, "V3").Fijado === true);
    check("bloque fijado: el resto conserva 08:00", t(f, "V1") === "08:00" && t(f, "V3") === "08:00");
}

console.log("\n=== 25. Invariantes con ediciones al azar ===");
{
    const eq = ["EQ-A", "EQ-B", "EQ-C", "EQ-D", "EQ-E", "EQ-F"];
    const cat = ["sin10", "equipo30", "linea45"];
    const d0 = [];
    for (let i = 0; i < 30; i++) {
        d0.push(lic("L" + i, eq[(i * 7) % eq.length], i % 2 ? "1AC" : "2BC",
            hhmm(7 + (i % 10), (i % 4) * 15), cat[i % 3]));
    }
    const d = flujoPantallaNuevo(d0);
    let seed = 12345;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

    let okOrden = true, okFijadas = true, okRn01 = true;
    const orden = ids(d);
    for (let k = 0; k < 60; k++) {
        const oLic = d[rnd(d.length)];
        const mFijadas = {};
        d.forEach(l => { if (l.Fijado && !(l.Consola === oLic.Consola && l.Grupo === oLic.Grupo)) mFijadas[l.Id] = l.TurnoAsignado; });
        if (rnd(5) === 0) { vaciar(d, oLic.Id); }
        else { editar(d, oLic.Id, Svc._formatTime(hhmm(7 + rnd(9), rnd(4) * 15))); }

        if (ids(d) !== orden) okOrden = false;
        Object.keys(mFijadas).forEach(id => { if (t(d, id) !== mFijadas[id]) okFijadas = false; });
        const noFijadas = d.filter(l => !l.Fijado);
        if (!rn01PorBloque(noFijadas)) okRn01 = false;
    }
    check("60 ediciones: el orden de las filas nunca cambia", okOrden);
    check("ninguna fila fijada cambia salvo la que se edita", okFijadas);
    check("RN-01 en todos los bloques no fijados", okRn01);
}

// Pantalla mínima para correr los handlers reales del controller (onChangeHour,
// onDetachLicense, _postAgregarLicencias): modelo JSON, TimePicker y tabla stub.
function pantallaUI(aDatos) {
    const ui = { data: aDatos, campo: {} };
    // ui.campo[Id] = mensaje que muestra el TimePicker de la fila (valueStateText ->
    // TurnoWarning). Como el binding, se actualiza en setProperty("/") y en refresh():
    // una alerta marcada después del último refresh no llega al campo.
    const binding = () => ui.data.forEach(l => { ui.campo[l.Id] = l.TurnoWarning || ""; });
    const oModel = {
        getProperty: (p) => p === "/" ? ui.data : undefined,
        setProperty: (p, v) => { if (p === "/") { ui.data = v; binding(); } },
        getData: () => ui.data,
        refresh: binding
    };
    const ctx = Object.create(Ctrl);
    ctx.getView = () => ({
        setModel() { },
        getModel: (n) => n === "i18n" ? { getResourceBundle: () => ({ getText: (k) => k }) }
            : n === "LicencesJsonModel" ? oModel : undefined
    });
    ctx.byId = () => ({ getSelectedIndex: () => -1, clearSelection() { } });
    const contexto = (idx) => ({ getPath: () => "/" + idx });

    // Usuario cambia la hora de una fila: el binding two-way escribe el valor en el
    // modelo y después el TimePicker dispara change -> onChangeHour
    ui.hora = (id, sHora) => {
        const idx = ui.data.findIndex(l => l.Id === id);
        ui.data[idx].TurnoAsignado = sHora;
        const oPicker = { getBindingContext: () => contexto(idx), setValue() { }, setValueState() { }, setValueStateText() { } };
        ctx.onChangeHour({ getSource: () => oPicker, getParameter: (k) => k === "value" ? sHora : undefined });
    };
    // Menú contextual -> Desacoplar
    ui.desacoplar = (id) => {
        const idx = ui.data.findIndex(l => l.Id === id);
        const oItem = { getParent: () => ({ getBindingContext: () => contexto(idx) }) };
        ctx.onDetachLicense({ getSource: () => oItem });
    };
    // "+ Licencias": lo que hace appendLicencesToModel sobre el modelo + el post-proceso real
    ui.agregar = (aNuevas) => {
        ctx._postAgregarLicencias(Svc.ubicarNuevas(ui.data, aNuevas));
    };
    ui.estado = (sPaso) => console.log("  " + sPaso + "\n" + ui.data.map(l =>
        `      ${l.Id.padEnd(11)} ${(l.Consola || "").padEnd(12)} ${l.TurnoAsignado}  Fijado=${l.Fijado === true}` +
        (ui.campo[l.Id] ? "  [campo: " + ui.campo[l.Id] + "]" : "")).join("\n"));
    return ui;
}

console.log("\n=== 26. Bug QAS 14a-2 (29.10.2026, CENTRO-CUYO): la cascada no empuja una fijada ===");
{
    // Secuencia exacta del reporte, por los handlers reales (no el motor directo).
    // Bloque 1AC-DEH1: L202600275 (08:00), L202600272 y L202600276 (10:00),
    // L202600279 (12:00, TcT 15'); después 1AC-BVI1 = L202600271 (10:00); 5APA en NEA.
    const tct15 = { Jobcond: "04", Tipoequipo: "L1" };
    const cc = (Id, Equnr, inicio, turno, extra) => lic(Id, Equnr, "CENTRO-CUYO", inicio, "sin10",
        Object.assign({ TurnoAsignado: turno }, extra || {}));
    const d = [
        cc("L202600275", "1AC-DEH1", hhmm(8), "08:00"),
        cc("L202600272", "1AC-DEH1", hhmm(10), "08:00"),
        cc("L202600276", "1AC-DEH1", hhmm(10), "08:00"),
        cc("L202600279", "1AC-DEH1", hhmm(12), "08:00", tct15),
        cc("L202600271", "1AC-BVI1", hhmm(10), "10:00"),
        lic("L5APA", "5APA", "NEA", hhmm(7), "sin10", { TurnoAsignado: "07:00" })
    ];
    Ctrl._rebuildFrontendGroupsByEquipo(d);   // turno ya creado: grupos armados
    const ui = pantallaUI(d);
    const DEH1 = ["L202600275", "L202600272", "L202600276", "L202600279"];
    const BVI1 = "L202600271";
    const deh = (fn) => DEH1.every(id => fn(L(ui.data, id)));
    ui.estado("inicial");

    ui.hora("L202600275", "10:00"); ui.estado("1. bloque 1AC-DEH1 -> 10:00");
    check("1: 1AC-BVI1 -> 10:15 (10:00 + TcT 15')", t(ui.data, BVI1) === "10:15");
    check("1: el bloque 1AC-DEH1 queda fijado", deh(l => l.Fijado === true));

    ui.hora("L202600275", "09:50"); ui.estado("2. bloque 1AC-DEH1 -> 09:50");
    check("2: 1AC-BVI1 se adelanta a 10:05 (P-04)", t(ui.data, BVI1) === "10:05");
    check("2: 1AC-BVI1 sigue sin fijar", L(ui.data, BVI1).Fijado !== true);

    ui.hora(BVI1, "11:00"); ui.estado("3. 1AC-BVI1 -> 11:00 a mano");
    check("3: 1AC-BVI1 en 11:00 y Fijado = true", t(ui.data, BVI1) === "11:00" && L(ui.data, BVI1).Fijado === true);
    check("3: 1AC-DEH1 no cambia (09:50, fijado)", deh(l => l.TurnoAsignado === "09:50" && l.Fijado === true));

    toasts.length = 0;
    ui.hora("L202600275", "10:50"); ui.estado("4. bloque 1AC-DEH1 -> 10:50");
    check("4: 1AC-BVI1 fijada sigue en 11:00 (no se empuja a 11:05)", t(ui.data, BVI1) === "11:00", t(ui.data, BVI1));
    check("4: 1AC-BVI1 sigue fijada", L(ui.data, BVI1).Fijado === true);
    check("4: el campo de 1AC-BVI1 (la fijada pisada, no la editada) muestra solapeFijada",
        ui.campo[BVI1] === TXT.solapeFijada, ui.campo[BVI1]);
    check("4: el bloque editado 1AC-DEH1 no alerta", deh(l => ui.campo[l.Id] === ""));
    check("4: sin toast", toasts.length === 0, toasts.join(" | "));
    check("4: 5APA (NEA) no se toca", t(ui.data, "L5APA") === "07:00");

    // Punto 4 del pedido: el mismo choque por los otros caminos
    toasts.length = 0;
    ui.hora("L202600275", ""); ui.estado("5. se borra la hora de 1AC-DEH1 (P-07)");
    check("5: 1AC-DEH1 libre, vuelve a 08:00 (su inicio)", deh(l => l.Fijado === false && l.TurnoAsignado === "08:00"));
    check("5: 1AC-BVI1 fijada sigue en 11:00", t(ui.data, BVI1) === "11:00" && L(ui.data, BVI1).Fijado === true);
    check("5: 1AC-BVI1 ya no está pisada: su campo deja de alertar", ui.campo[BVI1] === "", ui.campo[BVI1]);
    check("5: sin toast", toasts.length === 0, toasts.join(" | "));

    toasts.length = 0;
    ui.desacoplar("L202600279"); ui.estado("6. se desacopla L202600279 (TcT)");
    check("6: queda a continuación de su bloque", ids(ui.data) === "L202600275,L202600272,L202600276,L202600279,L202600271,L5APA", ids(ui.data));
    check("6: L202600279 = 12:00 (su inicio), sin fijar", t(ui.data, "L202600279") === "12:00" && L(ui.data, "L202600279").Fijado === false);
    check("6: 1AC-BVI1 fijada sigue en 11:00 y su campo alerta",
        t(ui.data, BVI1) === "11:00" && ui.campo[BVI1] === TXT.solapeFijada, ui.campo[BVI1]);
    check("6: la desacoplada no alerta", ui.campo.L202600279 === "");
    check("6: el único toast es el aviso de desacople (la alerta no)",
        toasts.length === 1 && toasts[0].indexOf("Licencia desacoplada") === 0, toasts.join(" | "));

    toasts.length = 0;

    ui.agregar([lic("LNUEVA", "1AC-NUE1", "CENTRO-CUYO", hhmm(10, 30), "sin10",
        { Grupo: "_Desacoplado_LNUEVA", Desacoplado: false, Fijado: false, Orden: 0 })]);
    ui.estado("7. \"+ Licencias\": nueva con inicio 10:30");
    check("7: la nueva queda antes del bloque de las 12:00", ids(ui.data) === "L202600275,L202600272,L202600276,LNUEVA,L202600279,L202600271,L5APA", ids(ui.data));
    check("7: nueva = 10:30 y 1AC-BVI1 fijada sigue en 11:00",
        t(ui.data, "LNUEVA") === "10:30" && t(ui.data, BVI1) === "11:00" && L(ui.data, BVI1).Fijado === true);
    check("7: 1AC-BVI1 sigue pisada y su campo sigue alertando", ui.campo[BVI1] === TXT.solapeFijada, ui.campo[BVI1]);
    check("7: la nueva no alerta y no hay toast", ui.campo.LNUEVA === "" && toasts.length === 0, toasts.join(" | "));
}

console.log("\n=== 27. Punto 14: alertas del motor en el campo de la fila afectada, sin toast ===");
{
    const cc = (Id, Equnr, inicio, cat, turno, extra) => lic(Id, Equnr, "CENTRO-CUYO", inicio, cat,
        Object.assign({ TurnoAsignado: turno }, extra || {}));
    const pantalla = (d) => { Ctrl._rebuildFrontendGroupsByEquipo(d); return pantallaUI(d); };

    // 27a. Ejemplo del pedido: la editada queda solapada y antes de su hora de inicio
    let ui = pantalla([
        cc("A", "EQ-A", hhmm(7), "equipo30", "07:00"),
        cc("B", "EQ-B", hhmm(9), "sin10", "09:00")
    ]);
    toasts.length = 0;
    ui.hora("B", "07:10"); ui.estado("27a. B -> 07:10 (A ocupa 07:00-07:30, B inicia 09:00)");
    check("27a: el campo de B muestra las dos alertas, con el texto de hoy",
        ui.campo.B === TXT.solape + " " + TXT.antesDeInicio, ui.campo.B);
    check("27a: A no alerta", ui.campo.A === "");
    check("27a: sin toast", toasts.length === 0, toasts.join(" | "));

    // 27b. Rango prohibido sobre la fila alertada: el MessageBox no cambia y el campo
    // vacío pierde la alerta (ya no la limpia el timeout de 4")
    toasts.length = 0; messageBoxes.length = 0;
    ui.hora("B", "06:00"); ui.estado("27b. B -> 06:00 (rango prohibido)");
    check("27b: el rango prohibido sigue con su MessageBox",
        messageBoxes.length === 1 && messageBoxes[0] === "invalidShiftTimeRange", messageBoxes.join(" | "));
    check("27b: B queda vacía y sin la alerta del motor", t(ui.data, "B") === "" && ui.campo.B === "", ui.campo.B);
    check("27b: sin toast", toasts.length === 0, toasts.join(" | "));

    // 27c. Cada fila con SU alerta, y el mensaje dura lo que dura el conflicto
    ui = pantalla([
        cc("A", "EQ-A", hhmm(7), "equipo30", "07:00"),
        cc("B", "EQ-B", hhmm(7), "equipo30", "07:30"),
        cc("C", "EQ-C", hhmm(7), "sin10", "08:00"),
        cc("D", "EQ-D", hhmm(7), "sin10", "08:10")
    ]);
    toasts.length = 0;
    ui.hora("C", "07:45"); ui.estado("27c-1. C -> 07:45 (B ocupa 07:30-08:00)");
    check("27c-1: C alerta solape", ui.campo.C === TXT.solape, ui.campo.C);

    ui.hora("B", "07:20"); ui.estado("27c-2. B -> 07:20: solapa con A y pisa a C (fijada)");
    check("27c-2: B (editada) muestra solo solape", ui.campo.B === TXT.solape, ui.campo.B);
    check("27c-2: C (fijada pisada) muestra solo solapeFijada", ui.campo.C === TXT.solapeFijada, ui.campo.C);
    check("27c-2: C no se mueve", t(ui.data, "C") === "07:45");
    check("27c-2: A y D sin alerta", ui.campo.A === "" && ui.campo.D === "");

    ui.hora("D", "09:00"); ui.estado("27c-3. D -> 09:00 (después de la fijada)");
    check("27c-3: editar más abajo no borra las alertas de B y C (el conflicto sigue)",
        ui.campo.B === TXT.solape && ui.campo.C === TXT.solapeFijada, ui.campo.B + " / " + ui.campo.C);

    // Pasan los segundos: se disparan los timers que programó la app. Los de UI (alto de
    // filas) fallan sin DOM y se ignoran; ninguno puede borrar las alertas.
    timers.splice(0).forEach(tm => { try { tm.fn(); } catch (e) { /* sin DOM */ } });
    check("27c-3: pasado el tiempo, B y C siguen alertando",
        ui.campo.B === TXT.solape && ui.campo.C === TXT.solapeFijada &&
        L(ui.data, "B").TurnoWarning === TXT.solape && L(ui.data, "C").TurnoWarning === TXT.solapeFijada);

    ui.hora("B", "07:30"); ui.estado("27c-4. B -> 07:30: ya no solapa con A, sigue pisando a C");
    check("27c-4: B deja de alertar", ui.campo.B === "", ui.campo.B);
    check("27c-4: C sigue alertando", ui.campo.C === TXT.solapeFijada, ui.campo.C);

    ui.hora("C", ""); ui.estado("27c-5. se borra la hora de C (P-07)");
    check("27c-5: C liberada vuelve a 08:00 y deja de alertar", t(ui.data, "C") === "08:00" && ui.campo.C === "", ui.campo.C);
    check("27c: ningún paso mostró toast", toasts.length === 0, toasts.join(" | "));

    // 27d. Carga de un turno con Orden: la nueva pisa una fijada; la alerta queda en la
    // fijada (no hay fila editada)
    const r = flujoCargaGuardada([
        lic("S8", "EQ-1", "1AC", hhmm(8), "linea45", { Orden: 1, TurnosLicencias_nav: nav("08:00") }),
        lic("S9", "EQ-2", "1AC", hhmm(9), "linea45", { Orden: 2, Fijado: true, TurnosLicencias_nav: nav("09:00") }),
        lic("S10", "EQ-3", "1AC", hhmm(10), "sin10", { Orden: 3, TurnosLicencias_nav: nav("10:00") }),
        lic("N", "EQ-N", "1AC", hhmm(8, 30), "linea45")
    ]);
    const w = (id) => L(r.a, id).TurnoWarning || "";
    console.log("  27d carga  : " + horas(r.a) + "  S9=[" + w("S9") + "]");
    check("27d: la alerta queda en S9 (la fijada pisada)", w("S9") === TXT.solapeFijada, w("S9"));
    check("27d: N, S8 y S10 sin alerta", w("N") === "" && w("S8") === "" && w("S10") === "");

    // 27e. "+ Licencias" sobre una pantalla sin alertas: la nueva pisa una fijada y la
    // alerta tiene que llegar al campo de la fijada (se marca antes del refresh)
    ui = pantalla([
        cc("F1", "EQ-F1", hhmm(8), "linea45", "08:00"),
        cc("F2", "EQ-F2", hhmm(8), "sin10", "08:45", { Fijado: true })
    ]);
    toasts.length = 0;
    ui.agregar([cc("NV", "EQ-NV", hhmm(8, 10), "linea45", "", { Orden: 0 })]);
    ui.estado("27e. \"+ Licencias\": NV (08:10, 45') entra antes de F2 fijada en 08:45");
    check("27e: NV = 08:45 y F2 fijada no se mueve", t(ui.data, "NV") === "08:45" && t(ui.data, "F2") === "08:45");
    check("27e: el campo de F2 muestra solapeFijada", ui.campo.F2 === TXT.solapeFijada, ui.campo.F2);
    check("27e: F1 y NV sin alerta, sin toast", ui.campo.F1 === "" && ui.campo.NV === "" && toasts.length === 0, toasts.join(" | "));

    // 27f. El mensaje se ve en todas las consolas: valueState = color de la consola,
    // salvo que la consola quede en Success o None (UI5 no muestra el mensaje) y haya alerta
    const vs = (c, w) => Fmt.turnoColor(c, w);
    check("27f: CENTRO-CUYO en Error, con y sin alerta", vs("CENTRO-CUYO", "") === "Error" && vs("CENTRO-CUYO", TXT.solape) === "Error");
    check("27f: NOA / NEA / LITORAL conservan su color con alerta",
        vs("NOA", TXT.solape) === "Warning" && vs("NEA", TXT.solape) === "Information" && vs("LITORAL", TXT.solape) === "Information");
    check("27f: SUR / METRO-SUR: Success sin alerta, Error con alerta",
        vs("SUR", "") === "Success" && vs("METRO-SUR", undefined) === "Success" &&
        vs("SUR", TXT.solape) === "Error" && vs("METRO-SUR", TXT.solapeFijada) === "Error");
    check("27f: consola sin color: None sin alerta, Error con alerta", vs("1AC", "") === "None" && vs("1AC", TXT.solape) === "Error");
    check("27f: sin alerta, el texto del campo sigue siendo un espacio", Fmt.turnoWarningText("") === " " && Fmt.turnoWarningText(TXT.solape) === TXT.solape);
}

console.log("\n=== Punto 14 en toda la corrida ===");
check("ninguna alerta del motor pasó por MessageHelper (toast)", !toastsTodos.some(esAlertaMotor),
    toastsTodos.filter(esAlertaMotor).join(" | "));

console.log("\n==================================================");
console.log(fail === 0 ? `TODO OK  (${pass} checks)` : `${fail} FALLAS de ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
