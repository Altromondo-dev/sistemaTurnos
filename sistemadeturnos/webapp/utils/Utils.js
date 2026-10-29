sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    const tiposLinea = ["L1", "L2", "L3", "L4", "L5", "L6"];

    // 🔹 Regla única de negocio: categoría + duración según licencia
    function getShiftInfo(license) {
        const job = license.Jobcond;
        const tipo = license.Tipoequipo;
        const Patadic = license.Patadic;
        const Intercerr = license.Intercerr;

        // 🔍 CAMPOS PARA MANIOBRAS SIN CONSIGNACIÓN
        const interruptoresAbiertos = license.Interabier || "";
        const seccionadoresAbiertos = license.Seleccionad || "";

        // 🔍 CAMPO PARA TCT CON/SIN BLOQUEO
        const bloqueoRecierre = license.Bloqueo || "";

        let category = "Otro";
        let duration = 15; // default
        let condition = ""; // Nueva propiedad para describir la condición

        if (job === "01") { // Consignación
            if (tipo === "L2" || tipo === "L5") {
                category = "ConsignacionLinea";
                duration = 45;
                condition = "Línea L2 o L5 (500kV/220kV)";
            } else if (tiposLinea.includes(tipo)) {
                // 🆕 PARA L1, L3, L4, L6 - mostrar qué tiene
                category = "ConsignacionEquipo";
                duration = 30;

                const partes = [];
                if (Patadic && String(Patadic).trim() !== "") partes.push("PAT");
                if (Intercerr && String(Intercerr).trim() !== "") partes.push("PAT");
                if (interruptoresAbiertos && String(interruptoresAbiertos).trim() !== "") partes.push("Interruptores");
                if (seccionadoresAbiertos && String(seccionadoresAbiertos).trim() !== "") partes.push("Seccionadores");

                condition = partes.length > 0 ? partes.join(" + ") : `Línea ${tipo}`;
            } else {
                // 🆕 PARA OTROS EQUIPOS (TR, IN, etc.) - mostrar qué tiene
                category = "ConsignacionEquipo";
                duration = 30;

                const partes = [];
                if (Patadic && String(Patadic).trim() !== "") partes.push("PAT");
                if (Intercerr && String(Intercerr).trim() !== "") partes.push("PAT");
                if (interruptoresAbiertos && String(interruptoresAbiertos).trim() !== "") partes.push("Interruptores");
                if (seccionadoresAbiertos && String(seccionadoresAbiertos).trim() !== "") partes.push("Seccionadores");

                condition = partes.length > 0 ? partes.join(" + ") : `Tipo: ${tipo}`;
            }
        } else if (job === "06") { // Condiciones Especiales
            const patEstaVacio = !Patadic || String(Patadic).trim() === "" || !Intercerr || String(Intercerr).trim() === "";
            const tieneInterruptores = interruptoresAbiertos && String(interruptoresAbiertos).trim() !== "";
            const tieneSeccionadores = seccionadoresAbiertos && String(seccionadoresAbiertos).trim() !== "";

            if (patEstaVacio && (tieneInterruptores || tieneSeccionadores)) {
                category = "ManiobrasSinConsignacion";
                duration = 20;
                const equipos = [];
                if (tieneInterruptores) equipos.push("Interruptores");
                if (tieneSeccionadores) equipos.push("Seccionadores");
                condition = `PAT vacío + ${equipos.join(" y ")}`;
            } else {
                category = "SinManiobras";
                duration = 10;
                condition = "Sin equipos de maniobra";
            }
        } else if (job === "04" || job === "05") {
            // 🔍 VERIFICAR SI TIENE BLOQUEO DE RECIERRE
            const tieneBloqueo = bloqueoRecierre && String(bloqueoRecierre).trim().toUpperCase() === "X";

            if (tieneBloqueo) {
                category = "TCTConBloqueo";
                duration = 15;
                condition = "Con bloqueo de recierre";
            } else {
                category = "TCTSinBloqueo";
                duration = 15;
                condition = "Sin bloqueo de recierre";
            }
        } else {
            condition = "No clasificado";
        }

        return { category, duration, condition };
    }

    // INI MOD TRNS #SistemaDeTurno-14
    // Hora de inicio de la licencia, en minutos desde la medianoche (o null si no se puede
    // determinar). Único lugar donde se calcula: antes estaba duplicado en dos bloques del
    // controller (_doSearchTurnos y la carga de turno existente) y era inaccesible desde
    // TurnosService, que lo necesita para RN-01 (el turno nunca antes de la hora de inicio).
    function getInitHourSort(license) {
        if (!license) return null;

        const vTimbeg = license.Timbeg;

        if (vTimbeg && typeof vTimbeg === "object" && "ms" in vTimbeg) {
            return Math.floor(vTimbeg.ms / (1000 * 60));
        }

        if (typeof vTimbeg === "string" && vTimbeg !== "" && vTimbeg !== "PT00H00M00S") {
            const hoursMatch = vTimbeg.match(/(\d+)H/);
            const minutesMatch = vTimbeg.match(/(\d+)M/);
            const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
            const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
            return hours * 60 + minutes;
        }

        if (license.Gdate) {
            const d = new Date(license.Gdate);
            // El bloque original no validaba la fecha y podía dejar NaN en InitHourSort,
            // que envenenaba cualquier Math.max posterior.
            if (!isNaN(d.getTime())) {
                return d.getHours() * 60 + d.getMinutes();
            }
        }

        return null;
    }
    // FIN MOD TRNS #SistemaDeTurno-14

    // INI MOD TRNS #SistemaDeTurno-11
    // Fecha de turno → "dd/MM/yyyy". Mismo criterio que TurnosService._claveFechaTurno
    // (no se reutiliza porque TurnosService depende de Utils): las fechas OData (Edm.DateTime)
    // llegan a las 00:00 UTC → día UTC; las del DatePicker a las 00:00 locales → día local.
    function formatFechaTurno(vFecha) {
        const d = vFecha instanceof Date ? vFecha : new Date(vFecha);
        if (isNaN(d.getTime())) return "";

        const bMedianocheUTC = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
        const iDia = bMedianocheUTC ? d.getUTCDate() : d.getDate();
        const iMes = (bMedianocheUTC ? d.getUTCMonth() : d.getMonth()) + 1;
        const iAnio = bMedianocheUTC ? d.getUTCFullYear() : d.getFullYear();

        return String(iDia).padStart(2, "0") + "/" + String(iMes).padStart(2, "0") + "/" + iAnio;
    }
    // FIN MOD TRNS #SistemaDeTurno-11

    return {

        // Exportamos para que TurnosService lo use en assignShiftsToLicences
        getShiftInfo: getShiftInfo,

        // INI MOD TRNS #SistemaDeTurno-14
        getInitHourSort: getInitHourSort,
        // FIN MOD TRNS #SistemaDeTurno-14

        onCountItems: function (oView, data) {

            let consignacionLinea = 0;
            let consignacionEquipo = 0;
            let maniobrasSinConsignacion = 0;
            let sinManiobras = 0;
            let tctConBloqueo = 0;
            let tctSinBloqueo = 0;

            // 🆕 ARRAY PARA EL REPORTE
            let aReporteData = [];

            (data || []).forEach((item, index) => {
                const info = getShiftInfo(item);

                switch (info.category) {
                    case "ConsignacionLinea":
                        consignacionLinea++;
                        break;
                    case "ConsignacionEquipo":
                        consignacionEquipo++;
                        break;
                    case "ManiobrasSinConsignacion":
                        maniobrasSinConsignacion++;
                        break;
                    case "SinManiobras":
                        sinManiobras++;
                        break;
                    case "TCTConBloqueo":
                        tctConBloqueo++;
                        break;
                    case "TCTSinBloqueo":
                        tctSinBloqueo++;
                        break;
                }

                // 🆕 AGREGAR AL REPORTE SI TIENE MANIOBRAS
                const esConManiobras =
                    info.category === "ConsignacionLinea" ||
                    info.category === "ConsignacionEquipo" ||
                    info.category === "ManiobrasSinConsignacion";

                if (esConManiobras) {
                    // Formatear hora
                    var sHora = "";
                    if (item.TurnoAsignado) {
                        sHora = item.TurnoAsignado;
                    } else if (item.Timbeg && item.Timbeg.ms) {
                        // Convertir de Edm.Time a HH:mm
                        const totalMinutes = Math.floor(item.Timbeg.ms / (1000 * 60));
                        const hours = Math.floor(totalMinutes / 60);
                        const minutes = totalMinutes % 60;
                        sHora = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
                    } else if (item.Gdate) {
                        let date = new Date(item.Gdate);
                        let hours = date.getHours().toString().padStart(2, '0');
                        let mins = date.getMinutes().toString().padStart(2, '0');
                        sHora = hours + ":" + mins;
                    }

                    // Formatear fecha
                    var sFecha = "";
                    if (item.Dateturno) {
                        // INI MOD TRNS #SistemaDeTurno-11
                        // var oDate = new Date(item.Dateturno);
                        // var day = oDate.getDate().toString().padStart(2, '0');
                        // var month = (oDate.getMonth() + 1).toString().padStart(2, '0');
                        // var year = oDate.getFullYear();
                        // sFecha = day + '/' + month + '/' + year;
                        sFecha = formatFechaTurno(item.Dateturno);
                        // FIN MOD TRNS #SistemaDeTurno-11
                    }

                    // Tipo de intervención
                    var sTipoIntervencion = "";
                    switch (info.category) {
                        case "ConsignacionLinea":
                            sTipoIntervencion = "Consignación (Línea)";
                            break;
                        case "ConsignacionEquipo":
                            sTipoIntervencion = "Consignación (Equipo)";
                            break;
                        case "ManiobrasSinConsignacion":
                            sTipoIntervencion = "Condiciones especiales C/maniobra";
                            break;
                    }

                    aReporteData.push({
                        Fecha: sFecha,
                        IdLicencia: item.Id || "",
                        Equipo: item.Equnr || "",
                        Hora: sHora,
                        TipoIntervencion: sTipoIntervencion,
                        Condicion: info.condition,
                        // INI MOD TRNS #SistemaDeTurno-12-13
                        // Comentarios: item.Comentarios || ""
                        Comentarios: item.Comentarios || "",
                        // Clave de deduplicación: una fila por equipo, salvo las desacopladas (fila propia).
                        // Se basa en Desacoplado y no en Grupo porque los reportes no rearman grupos.
                        _claveGrupo: item.Desacoplado === true ? "_Desacoplado_" + item.Id : (item.Equnr || "")
                        // FIN MOD TRNS #SistemaDeTurno-12-13
                    });
                }
            });

            const LTWithManouvers =
                consignacionLinea + consignacionEquipo + maniobrasSinConsignacion;

            const LTWithoutManouvers = sinManiobras;
            const TCT = tctConBloqueo + tctSinBloqueo;
            const totalCount = LTWithManouvers + LTWithoutManouvers + TCT;

            const counts = {
                ConsignacionLinea: consignacionLinea,
                ConsignacionEquipo: consignacionEquipo,
                ManiobrasSinConsignacion: maniobrasSinConsignacion,
                SinManiobras: sinManiobras,
                TCTConBloqueo: tctConBloqueo,
                TCTSinBloqueo: tctSinBloqueo,

                LTWithManouvers,
                LTWithoutManouvers,
                TCT,
                Total: totalCount
            };

            const oModel = new JSONModel(counts);
            oView.setModel(oModel, "countsModel");

            // Deduplicar por equipo: un solo registro por Equnr
            const oEquiposVistos = {};
            const aReporteDataUnica = aReporteData.filter(function (item) {
                // INI MOD TRNS #SistemaDeTurno-12-13
                // if (oEquiposVistos[item.Equipo]) {
                //     return false;
                // }
                // oEquiposVistos[item.Equipo] = true;
                if (oEquiposVistos[item._claveGrupo]) {
                    return false;
                }
                oEquiposVistos[item._claveGrupo] = true;
                // FIN MOD TRNS #SistemaDeTurno-12-13
                return true;
            });

            // 🆕 ORDENAR REPORTE POR HORA Y ACTUALIZAR MODELO
            aReporteDataUnica.sort(function (a, b) {
                if (!a.Hora) return 1;
                if (!b.Hora) return -1;
                return a.Hora.localeCompare(b.Hora);
            });

            const oReporteModel = new JSONModel(aReporteDataUnica);
            oView.setModel(oReporteModel, "ReporteModel");

            // 🆕 ACTUALIZAR RANGO DE FECHAS
            var sMinHora = "--";
            var sMaxHora = "--";
            var sFecha = "";

            if (aReporteDataUnica.length > 0) {
                var aHoras = aReporteDataUnica.filter(d => d.Hora).map(d => d.Hora);
                if (aHoras.length > 0) {
                    sMinHora = aHoras[0];
                    sMaxHora = aHoras[aHoras.length - 1];
                }
                sFecha = aReporteDataUnica[0].Fecha;
                // INI MOD TRNS #SistemaDeTurno-11
                // El rango es del turno en pantalla: se usa el día del DatePicker
                // (en turno nuevo las licencias no traen Dateturno)
                var oDatePicker = oView.byId ? oView.byId("date") : null;
                var oFechaPicker = oDatePicker && oDatePicker.getDateValue();
                if (oFechaPicker) {
                    sFecha = formatFechaTurno(oFechaPicker);
                }
                // FIN MOD TRNS #SistemaDeTurno-11
            }

            var oDateRangeControl = oView.byId ? oView.byId("reporteDateRange") : null;
            if (oDateRangeControl) {
                var sTexto = "Horarios de maniobras previstas desde: " + sFecha + " " + sMinHora + " Hasta: " + sFecha + " " + sMaxHora;
                oDateRangeControl.setText(sTexto);
            }

            return counts;
        }
    };
});
