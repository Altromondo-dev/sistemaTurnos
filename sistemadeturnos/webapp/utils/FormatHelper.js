sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    const FormatHelper = {
        formatDate: function (oDate) {
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy"
            });
            return oDateFormat.format(oDate);
        },
        getPeriod: function (value) {
            switch (value) {
                case 'D':
                    return "Diaria";
                case "C":
                    return "Contiuna"
                default:
                    return value
            }
        },
        getEstado: function (value) {
            switch (value) {
                case "":
                    return "Fuera de Servicio";
                case "X":
                    return "En Servicio"
                default:
                    return value
            }
        },

        getJobCond: function (value) {
            switch (value) {
                case '01':
                    return 'Consignación';
                case '02':
                    return 'Trabajo sin Tensión con PaT';
                case '03':
                    return 'Trabajo con Tensión de Retorno';
                case '04':
                    return 'Trabajo con Tensión (TcT)';
                case '05':
                    return 'Trabajo Especiales (TcT)';
                case '06':
                    return 'Condiciones Especiales';
                default:
                    return value;
            }
        },

        getRegiones: function (value) {
            switch (value) {
                case '103':
                case '113':
                    return 'Norte';
                case '102':
                    return 'Centro Este';
                case '104':
                case '114':
                    return 'Sur';
                default:
                    return value;
            }
        },

        msTohoursSeconds: function (ms) {
            let date = new Date(ms);
            let hours = date.getHours().toString().padStart(2, '0');
            let minutes = date.getMinutes().toString().padStart(2, '0');
            return hours + ":" + minutes;
        },

        turnoWarningText: function (turnoWarning) {
            return turnoWarning || " ";
        },

        // INI MOD TRNS #SistemaDeTurno-14
        // El valueState del TimePicker de Turno es el color de la consola. UI5 solo
        // muestra el mensaje de valueState (valueStateText = alerta del motor) con Error,
        // Warning o Information: con una alerta, las consolas en Success o None pasan a
        // Error para que el mensaje se vea; las demás conservan su color.
        // turnoColor: function (consola) {
        turnoColor: function (consola, turnoWarning) {
            const sEstado = FormatHelper._turnoColorConsola(consola);
            if (turnoWarning && (sEstado === "Success" || sEstado === "None")) {
                return "Error";
            }
            return sEstado;
        },

        _turnoColorConsola: function (consola) {
        // FIN MOD TRNS #SistemaDeTurno-14
            switch (consola) {
                case "NOA":
                    return "Warning";
                case "NEA":
                    return "Information";
                case "METRO-SUR":
                case "SUR":
                    return "Success";
                case "CENTRO-CUYO":
                    return "Error";  // Rojo/Rosa
                case "LITORAL":
                    return "Information";  // Azul (igual que NEA)
                default:
                    return "None";
            }
        },

        edmTimeToHHMM: function (edmTime) {
            let milliseconds = edmTime;
            if (typeof edmTime === 'object' && edmTime !== null && 'ms' in edmTime) {
                milliseconds = edmTime.ms;
            }

            // Convertir milisegundos a horas y minutos
            const totalMinutes = Math.floor(milliseconds / (1000 * 60));
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            const result = hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');

            return result;
        },

        durationToTime: function (duration) {
            if (!duration || typeof duration !== 'string') {
                return "";
            }

            const hoursMatch = duration.match(/(\d+)H/);
            const minutesMatch = duration.match(/(\d+)M/);

            const hours = hoursMatch ? hoursMatch[1].padStart(2, '0') : '00';
            const minutes = minutesMatch ? minutesMatch[1].padStart(2, '0') : '00';

            const result = hours + ":" + minutes;

            return result;
        },

        formatInitHour: function (timbeg, gdate) {

            if (timbeg && typeof timbeg === 'object' && 'ms' in timbeg) {
                return FormatHelper.edmTimeToHHMM(timbeg);
            }

            if (timbeg && typeof timbeg === 'string' && timbeg !== "PT00H00M00S") {
                return FormatHelper.durationToTime(timbeg);
            }

            if (gdate) {
                return FormatHelper.msTohoursSeconds(gdate);
            }

            return "";
        },

        buildParteDiarioCammesa: function (sR500kv, sBloqueo, sBarrafs, sBarrafstx, sEquiinterv, sDescripcion, oSolend, sId) {
            let sValue = "";
            sValue += sR500kv === "X" ? " Requiere calle 500 kV abierta: Si, " : "";
            sValue += sBloqueo === "X" ? " Bloqueo de recierre: Si, " : "";
            sValue += sBarrafs === "X" ? " Requiere Barra F/S: Si, Barra Especificada: " + (sBarrafstx || "") + " " : "";

            let sFecha = "";
            if (oSolend) {
                const oDate = oSolend instanceof Date ? oSolend : new Date(oSolend);
                if (!isNaN(oDate)) {
                    const oDateOffset = new Date(oDate.getTime() + oDate.getTimezoneOffset() * 60 * 1000);
                    sFecha = sap.ui.core.format.DateFormat.getDateTimeInstance({ pattern: "dd-MM-yyyy" }).format(oDateOffset);
                }
            }

            sValue += " Equipo a Intervenir: " + (sEquiinterv || "") + " ";
            sValue += " Trabajo a realizar " + (sDescripcion || "") + " ";
            sValue += " Finaliza:" + sFecha + " LT Nº " + (sId || "") + " ";

            return sValue;
        },

        formatLicState: function (sLicstat) {
            switch (sLicstat) {
                case "01":
                    return "Autorizada";
                case "06":
                    return "NO Autorizada";
                case "07":
                    return "Coordinada";
                case "08":
                    return "Entregada";
                case "09":
                    return "Generada";
                case "10":
                    return "Suspendida";
                case "23":
                    return "En trámite";
                case "02":
                    return "Observada";
                case "30":
                    return "Creada";
                case "03":
                    return "Anulada";
                case "11":
                    return "Cancelada";
                default:
                    return sLicstat || "";
            }
        // INI MOD TRNS #SistemaDeTurno-Comentarios
        // },
        },

        // Fecha y hora de un comentario de licencia ("dd.MM.yyyy HH:mm").
        // Fecha es Edm.DateTime de fecha (medianoche UTC, por eso getters UTC) y Hora es
        // Edm.Time ({ ms }). Vacíos o inválidos no rompen: se muestra lo que haya.
        formatFechaHoraComentario: function (vFecha, vHora) {
            const pad = (n) => String(n).padStart(2, "0");

            let sFecha = "";
            const oFecha = vFecha ? new Date(vFecha) : null;
            if (oFecha && !isNaN(oFecha.getTime())) {
                sFecha = pad(oFecha.getUTCDate()) + "." + pad(oFecha.getUTCMonth() + 1) + "." + oFecha.getUTCFullYear();
            }

            let sHora = "";
            const iMs = vHora && Number(vHora.ms);
            if (iMs || iMs === 0) {
                const iMinutos = Math.floor(iMs / 60000);
                sHora = pad(Math.floor(iMinutos / 60) % 24) + ":" + pad(iMinutos % 60);
            }

            return [sFecha, sHora].filter(Boolean).join(" ");
        // INI MOD TRNS #SistemaDeTurno-EstadoEntrega
        // }
        },
        // FIN MOD TRNS #SistemaDeTurno-EstadoEntrega
        // FIN MOD TRNS #SistemaDeTurno-Comentarios

        // INI MOD TRNS #SistemaDeTurno-EstadoEntrega
        // Estado de entrega de la licencia según lo grabado por Licencias de Trabajo
        // (Licstat 01 + Substatus). Devuelve { text, state } para un sap.m.ObjectStatus:
        //   01 + "E"      -> Entregado    (Success, verde)
        //   01 + "D"      -> Devuelto     (Warning, naranja)
        //   01 + "N" / "" -> No entregado (Error, rojo)
        //   otro caso (S, R, F, Licstat != 01) o fila de grupo -> vacío
        _getEstadoEntrega: function (sLicstat, sSubstatus) {
            if (sLicstat !== "01") {
                return { text: "", state: "None" };
            }
            switch (sSubstatus) {
                case "E":
                    return { text: "Entregado", state: "Success" };
                case "D":
                    return { text: "Devuelto", state: "Warning" };
                case "N":
                case "":
                    return { text: "No entregado", state: "Error" };
                default:
                    return { text: "", state: "None" };
            }
        },

        formatEstadoEntregaText: function (sLicstat, sSubstatus) {
            return FormatHelper._getEstadoEntrega(sLicstat, sSubstatus).text;
        },

        formatEstadoEntregaState: function (sLicstat, sSubstatus) {
            return FormatHelper._getEstadoEntrega(sLicstat, sSubstatus).state;
        }
        // FIN MOD TRNS #SistemaDeTurno-EstadoEntrega
    };

    return FormatHelper;
});