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
                    return "F/S";
                case "X":
                    return "E/S"
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
                    return 'Reg. Metropolitana';
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

        turnoColor: function (consola) {
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
        }
    };

    return FormatHelper;
});