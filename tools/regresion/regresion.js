// Regresión del motor de horarios.
// Usa el código REAL de TurnosService, Main.controller (sorts + cascada) y Utils.
//
// #SistemaDeTurno-12-13 : acople por defecto (una hora por bloque, filas contiguas)
// #SistemaDeTurno-14    : motor único, RN-01, separación por mayor duración, RN-07
const { loadModule } = require("./harness");

const Svc = loadModule("transener/sistemadeturnos/services/TurnosService");
const Ctrl = loadModule("transener/sistemadeturnos/controller/Main.controller");
const Utils = loadModule("transener/sistemadeturnos/utils/Utils");

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

console.log("\n=== 6. Grupos posteriores: empujar sí, adelantar no ===");
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
    check("C NO se adelanta: sigue en 16:00 (P-04 va en 14a-2)",
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
    let aWarn = Ctrl._recalcularDesde(d, 1, null);
    console.log("  7a conflicto: " + horas(d) + "  warnings=" + aWarn.length);
    check("marca TurnoWarning ante solape", aWarn.length === 1 && !!aWarn[0].TurnoWarning);
    check("no corrige el valor del ancla", d.find(l => l.Id === "L-B").TurnoAsignado === "07:10");

    d = [
        lic("L-A", "EQ-A", "1AC", hhmm(7), "equipo30", { TurnoAsignado: "07:00" }),
        lic("L-B", "EQ-B", "1AC", hhmm(9), "sin10", { TurnoAsignado: "09:00" })
    ];
    aWarn = Ctrl._recalcularDesde(d, 1, null);
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

console.log("\n==================================================");
console.log(fail === 0 ? `TODO OK  (${pass} checks)` : `${fail} FALLAS de ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
