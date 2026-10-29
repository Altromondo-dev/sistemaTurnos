// Regresión #SistemaDeTurno-12-13: acople por defecto en turno nuevo.
// Usa el código REAL de TurnosService y de Main.controller (sorts).
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

// --- Algoritmo ANTERIOR (previousGrupo), para contrastar ---
function assignShiftsOld(licences) {
    const initialTime = 7 * 60;
    licences.forEach(l => { if (!l.Grupo) l.Grupo = l.Equnr; });
    const g = {};
    licences.forEach(l => { const c = l.Consola || ""; (g[c] = g[c] || []).push(l); });
    Object.keys(g).forEach(c => {
        let currentTime = initialTime, previousGrupo = "", firstShiftInGroup = "";
        g[c].forEach(l => {
            const d = Utils.getShiftInfo(l).duration;
            if (l.Grupo && l.Grupo.startsWith("_")) {
                l.TurnoAsignado = Svc._formatTime(currentTime); currentTime += d; return;
            }
            if (l.Grupo !== previousGrupo) {
                previousGrupo = l.Grupo;
                firstShiftInGroup = Svc._formatTime(currentTime);
                l.TurnoAsignado = firstShiftInGroup;
                currentTime += d;
            } else { l.TurnoAsignado = firstShiftInGroup; }
        });
        g[c].sort((a, b) => Svc._convertTimeToMinutes(a.TurnoAsignado) - Svc._convertTimeToMinutes(b.TurnoAsignado));
    });
    licences.length = 0;
    Object.keys(g).forEach(c => licences.push(...g[c]));
}

// --- Flujos de la app ---
// Pantalla, turno NUEVO: _sortLicencesNuevoTurno -> assignShifts -> _sortLicences -> rebuild grupos
function flujoPantallaNuevo(data) {
    const a = clone(data);
    Ctrl._sortLicencesNuevoTurno(a);
    Svc.assignShiftsToLicences(a);
    Ctrl._sortLicences(a);
    Ctrl._rebuildFrontendGroupsByEquipo(a);
    return a;
}
// Pantalla, turno EXISTENTE: ordenarPorEqunr -> assignShifts -> ... -> _sortLicences
function flujoPantallaExistente(data) {
    const a = Svc.ordenarPorEqunr(clone(data));
    Svc.assignShiftsToLicences(a);
    Ctrl._rebuildFrontendGroupsByEquipo(a);
    Ctrl._sortLicences(a);
    return a;
}
// Reportes amplio y maniobras: ordenarPorEqunr -> assignShifts (sin sort posterior)
function flujoReporte(data) {
    const a = Svc.ordenarPorEqunr(clone(data));
    Svc.assignShiftsToLicences(a);
    return a;
}

// --- Datos ---
// Jobcond 06 sin PAT y sin interruptores/seccionadores => SinManiobras, 10 min.
const lic = (Id, Equnr, Consola, InitHourSort, extra) => Object.assign({
    Id, Equnr, Consola, InitHourSort, Tplnr: Consola + "-EST",
    Jobcond: "06", Tipoequipo: "L1", Patadic: "", Intercerr: "",
    Interabier: "", Seleccionad: "", Bloqueo: "",
    Dateturno: new Date(Date.UTC(2026, 9, 29))
}, extra || {});

// Caso QAS 29.10.2026
// 1AC-BVI1 (inicio 10:00) queda entre ambas 1AC-DEH1 al ordenar por hora de inicio,
// que es exactamente lo que rompía el acople.
const CASO_QAS = [
    lic("L202600275", "1AC-DEH1", "1AC", 8 * 60),
    lic("L202600300", "1AC-BVI1", "1AC", 10 * 60),
    lic("L202600272", "1AC-DEH1", "1AC", 10 * 60)
];

console.log("\n=== 1. Caso QAS 29.10.2026 (1AC-DEH1 x2 separadas por 1AC-BVI1) ===");
{
    const antes = clone(CASO_QAS); Ctrl._sortLicencesNuevoTurno(antes); assignShiftsOld(antes);
    console.log("  antes : " + horas(antes));
    const r = flujoPantallaNuevo(CASO_QAS);
    console.log("  ahora : " + horas(r));
    const deh = r.filter(l => l.Equnr === "1AC-DEH1");
    check("1AC-DEH1: misma hora", deh[0].TurnoAsignado === deh[1].TurnoAsignado, horas(r));
    check("1AC-DEH1: 07:00", deh[0].TurnoAsignado === "07:00");
    const idx = r.map((l, i) => l.Equnr === "1AC-DEH1" ? i : -1).filter(i => i >= 0);
    check("1AC-DEH1: filas contiguas", idx[1] - idx[0] === 1, "indices " + idx);
    check("1AC-BVI1: 07:10", r.find(l => l.Equnr === "1AC-BVI1").TurnoAsignado === "07:10");
    check("mismo grupo frontend", deh[0].Grupo === deh[1].Grupo && deh[0].Grupo === "grp_1AC-DEH1");
}

console.log("\n=== 2. Grupo de 3 licencias intercaladas con otros 2 equipos ===");
{
    const d = [
        lic("A1", "EQ-A", "1AC", 7 * 60),
        lic("B1", "EQ-B", "1AC", 8 * 60),
        lic("A2", "EQ-A", "1AC", 9 * 60),
        lic("C1", "EQ-C", "1AC", 10 * 60),
        lic("A3", "EQ-A", "1AC", 11 * 60)
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  orden : " + r.map(l => l.Id).join(" ") + "   |   " + horas(r));
    const a = r.filter(l => l.Equnr === "EQ-A").map(l => l.TurnoAsignado);
    check("EQ-A: las 3 en la misma hora", new Set(a).size === 1 && a[0] === "07:00");
    const pos = r.map(l => l.Equnr);
    check("EQ-A: 3 filas contiguas", pos.indexOf("EQ-A") === 0 && pos[1] === "EQ-A" && pos[2] === "EQ-A", pos.join(","));
    check("EQ-B: 07:10", r.find(l => l.Id === "B1").TurnoAsignado === "07:10");
    check("EQ-C: 07:20", r.find(l => l.Id === "C1").TurnoAsignado === "07:20");
}

console.log("\n=== 3. Desacoplados: cada licencia con hora propia ===");
{
    const d = [
        lic("D1", "EQ-D", "1AC", 8 * 60, { Grupo: "_Desacoplado_D1", Desacoplado: true }),
        lic("D2", "EQ-D", "1AC", 9 * 60, { Grupo: "_Desacoplado_D2", Desacoplado: true }),
        lic("E1", "EQ-E", "1AC", 10 * 60)
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    const hs = r.filter(l => l.Desacoplado).map(l => l.TurnoAsignado);
    check("desacoplados con horas distintas", hs[0] !== hs[1], hs.join(","));
    check("desacoplados 07:00 / 07:10", hs.includes("07:00") && hs.includes("07:10"));
}

console.log("\n=== 4. Turno ya guardado en backend: se respeta ===");
{
    const d = [
        lic("G1", "EQ-G", "1AC", 8 * 60, {
            TurnosLicencias_nav: { results: [{ Dateturno: new Date(Date.UTC(2026, 9, 29)), Turno: "11:45", Comentarios: "x", Agrmanual: false, Desacoplado: false }] }
        }),
        lic("G2", "EQ-G", "1AC", 9 * 60),
        lic("H1", "EQ-H", "1AC", 10 * 60)
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    check("G1 conserva 11:45 del backend", r.find(l => l.Id === "G1").TurnoAsignado === "11:45");
    check("G2 (sin guardar) toma 07:00", r.find(l => l.Id === "G2").TurnoAsignado === "07:00");
}

console.log("\n=== 5. Varias consolas: cursor independiente por consola ===");
{
    const d = [
        lic("X1", "EQ-X", "1AC", 8 * 60), lic("X2", "EQ-X", "1AC", 11 * 60),
        lic("Y1", "EQ-Y", "2BC", 9 * 60), lic("Y2", "EQ-Y", "2BC", 12 * 60),
        lic("Z1", "EQ-Z", "2BC", 10 * 60)
    ];
    const r = flujoPantallaNuevo(d);
    console.log("  " + horas(r));
    check("1AC arranca 07:00", r.filter(l => l.Consola === "1AC").every(l => l.TurnoAsignado === "07:00"));
    check("2BC arranca 07:00", r.find(l => l.Id === "Y1").TurnoAsignado === "07:00");
    check("2BC: EQ-Y juntas, EQ-Z 07:10", r.find(l => l.Id === "Y2").TurnoAsignado === "07:00" && r.find(l => l.Id === "Z1").TurnoAsignado === "07:10");
}

console.log("\n=== 6. Pantalla (turno existente) vs Reporte amplio/maniobras, mismo día ===");
{
    // 6a. Día SIN turno guardado
    const sinGuardar = [
        lic("P1", "EQ-A", "1AC", 8 * 60), lic("P2", "EQ-B", "1AC", 9 * 60),
        lic("P3", "EQ-A", "1AC", 10 * 60), lic("P4", "EQ-C", "1AC", 11 * 60)
    ];
    const pe = flujoPantallaExistente(sinGuardar), rep = flujoReporte(sinGuardar);
    const map = (a) => a.reduce((m, l) => (m[l.Id] = l.TurnoAsignado, m), {});
    const mpe = map(pe), mrep = map(rep);
    console.log("  pantalla existente : " + horas(pe));
    console.log("  reporte            : " + horas(rep));
    check("sin turno guardado: pantalla-existente == reporte",
        JSON.stringify(mpe) === JSON.stringify(mrep), JSON.stringify(mpe) + " vs " + JSON.stringify(mrep));

    // 6b. Día CON turno guardado (caso real de un reporte: el turno ya se generó y grabó)
    const guardado = sinGuardar.map(l => Object.assign({}, l, {
        TurnosLicencias_nav: { results: [{ Dateturno: new Date(Date.UTC(2026, 9, 29)), Turno: { P1: "07:00", P2: "07:10", P3: "07:00", P4: "07:20" }[l.Id], Comentarios: "", Agrmanual: false, Desacoplado: false }] }
    }));
    const pn = flujoPantallaNuevo(guardado), pe2 = flujoPantallaExistente(guardado), rep2 = flujoReporte(guardado);
    console.log("  pantalla nuevo     : " + horas(pn));
    console.log("  pantalla existente : " + horas(pe2));
    console.log("  reporte            : " + horas(rep2));
    check("con turno guardado: las 3 vistas coinciden",
        JSON.stringify(map(pn)) === JSON.stringify(map(pe2)) &&
        JSON.stringify(map(pe2)) === JSON.stringify(map(rep2)));

    // 6c. Pantalla NUEVO vs reporte sobre un día sin guardar (divergencia preexistente)
    const pn2 = flujoPantallaNuevo(sinGuardar);
    const igual = JSON.stringify(map(pn2)) === JSON.stringify(mrep);
    console.log("  [info] pantalla-nuevo vs reporte sin guardar coinciden: " + igual);
    const antesPn = clone(sinGuardar); Ctrl._sortLicencesNuevoTurno(antesPn); assignShiftsOld(antesPn);
    const antesRep = Svc.ordenarPorEqunr(clone(sinGuardar)); assignShiftsOld(antesRep);
    const igualAntes = JSON.stringify(map(antesPn)) === JSON.stringify(map(antesRep));
    console.log("  [info] ... y ANTES del cambio coincidían: " + igualAntes);
    check("el cambio no empeora la paridad pantalla-nuevo/reporte", igual === igualAntes || igual);
}

console.log("\n=== 7. Invariantes generales sobre set grande ===");
{
    const eq = ["EQ-A", "EQ-B", "EQ-C", "EQ-D", "EQ-E"];
    const d = [];
    for (let i = 0; i < 30; i++) {
        d.push(lic("L" + i, eq[(i * 7) % eq.length], i % 2 ? "1AC" : "2BC", (7 + (i % 10)) * 60 + (i % 4) * 15));
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
    check("todo grupo tiene una sola hora", okHora);
    check("todo grupo queda contiguo", okCont);
    let okOrden = true;
    for (let c of ["1AC", "2BC"]) {
        const h = r.filter(l => l.Consola === c).map(l => Svc._convertTimeToMinutes(l.TurnoAsignado));
        for (let j = 1; j < h.length; j++) if (h[j] < h[j - 1]) okOrden = false;
    }
    check("horas no decrecientes dentro de cada consola", okOrden);
    const cons = r.map(l => l.Consola);
    check("consolas agrupadas y alfabéticas", JSON.stringify(cons) === JSON.stringify(clone(cons).sort()));
    check("no se pierden ni duplican licencias", r.length === 30 && new Set(r.map(l => l.Id)).size === 30);
}

console.log("\n==================================================");
console.log(fail === 0 ? `TODO OK  (${pass} checks)` : `${fail} FALLAS de ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
