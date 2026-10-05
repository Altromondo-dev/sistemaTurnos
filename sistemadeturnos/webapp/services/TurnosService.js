sap.ui.define([
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "transener/sistemadeturnos/utils/ModelHelper",
    "transener/sistemadeturnos/utils/Utils",
    "transener/sistemadeturnos/utils/FormatHelper",
    "transener/sistemadeturnos/utils/SocietyHelper"
], function (MessageBox, Filter, FilterOperator, ModelHelper, Utils, FormatHelper, SocietyHelper) {
    "use strict";

    return {

        search: function ({ FechaTurno, oView, isRefresh = false }) {
            var aFilters = [];

            const Fecha = FechaTurno.toISOString().split('T')[0];
            const sEmpresa = SocietyHelper.getCurrentSociety(oView);

            aFilters.push(new Filter({
                path: "Solbeg",
                operator: FilterOperator.LE,
                value1: FechaTurno
            }));

            aFilters.push(new Filter({
                path: "Solend",
                operator: FilterOperator.GE,
                value1: FechaTurno
            }));


            aFilters.push(new Filter({
                path: "Empresa",
                operator: FilterOperator.EQ,
                value1: sEmpresa
            }));

            aFilters.push(new Filter({
                path: "Tipo",
                operator: FilterOperator.EQ,
                value1: "L"
            }));

            const oDataModel = oView.getModel();
            return new Promise((resolve, reject) => {

                oDataModel.read('/LicenciaTrabajoSet', {
                    filters: aFilters,
                    success: (data) => {

                        const datosFiltrados = this.filtrarFechasTipo(
                            data.results,
                            Fecha,
                            isRefresh
                        );

                        let resultadoFinal = datosFiltrados;

                        if (datosFiltrados.length > 0) {
                            resultadoFinal = this.encontrarGrupo(
                                this.ordenarPorEqunr(datosFiltrados),
                                oView
                            );
                            this.assignShiftsToLicences(resultadoFinal, oView);
                        }

                        resolve(resultadoFinal);
                    },
                    error: (error) => {
                        MessageBox.show("No se encontraron datos en las fechas seleccionadas", {
                            icon: MessageBox.Icon.WARNING,
                            title: "Alerta",
                            onClose: function () {
                                reject(error);
                            }
                        });
                    }
                });
            });
        },

        filtrarFechasTipo: function (datos, fechaSeleccionada, isRefresh = false) {
            if (!Array.isArray(datos)) {
                throw new Error("El parámetro 'datos' debe ser un array.");
            }

            let estadosPermitidos = [];

            if (typeof fechaSeleccionada !== "string") {
                throw new Error("El parámetro 'fechaSeleccionada' debe ser un string con formato de fecha (YYYY-MM-DD).");
            }

            // Estados permitidos (EXCLUYE "06" NO Autorizada)
            estadosPermitidos = ["01", "07", "08", "10", "23"];

            const estadosEncontrados = {};
            datos.forEach(d => {
                if (!estadosEncontrados[d.Licstat]) {
                    estadosEncontrados[d.Licstat] = 0;
                }
                estadosEncontrados[d.Licstat]++;
            });

            console.log("📊 Estados encontrados en datos:", estadosEncontrados);

            const datosFiltrados = datos.filter(dato => {
                // 1) Si es agregada manualmente, SIEMPRE pasa (sin importar estado)
                if (dato.Agrmanual === true) {
                    return true;
                }

                // 2) Filtrar por estados permitidos (EXCLUYE "06" NO Autorizada)
                if (!estadosPermitidos.includes(dato.Licstat)) {
                    // 🆕 QUITAR ESTA LÍNEA que usa _getEstadoTexto (no existe aquí)
                    // console.log(`❌ Licencia ${dato.Id} excluida: Estado ${dato.Licstat} (${this._getEstadoTexto(dato.Licstat)})`);

                    // ✅ REEMPLAZAR POR:
                    console.log(`❌ Licencia ${dato.Id} excluida: Estado ${dato.Licstat}`);
                    return false;
                }

                // 3) Lógica según Period
                if (dato.Period === "D") {
                    return true;
                }

                if (dato.Period === "C") {
                    if (isRefresh) {
                        return true;
                    }

                    const fechaSolbeg = dato.Solbeg instanceof Date ? dato.Solbeg : new Date(dato.Solbeg);
                    if (isNaN(fechaSolbeg)) return false;

                    const isoSolbeg = fechaSolbeg.toISOString().split("T")[0];
                    return isoSolbeg === fechaSeleccionada;
                }

                return false;
            });

            console.log(`✅ Licencias después del filtro: ${datosFiltrados.length} de ${datos.length}`);
            return datosFiltrados;
        },

        encontrarGrupo: function (licencias, oView) {

            const sEmpresa = SocietyHelper.getCurrentSociety(oView);

            if (sEmpresa === "300") {
                licencias.forEach((licencia) => {
                    licencia.Consola = "TRANSBA";
                });
                return licencias;
            }

            const consolasModel = ModelHelper.getModel("consolasModel", oView).getData();

            if (!consolasModel || typeof consolasModel !== "object") {
                return "Modelo no encontrado o no es válido";
            }

            licencias.forEach((licencia) => {
                for (const grupo in consolasModel) {
                    const consolas = consolasModel[grupo];

                    if (Array.isArray(consolas)) {
                        const consolaEncontrada = consolas.find((consola) => consola === licencia.Tplnr);

                        if (consolaEncontrada) {
                            licencia.Consola = grupo;
                        }
                    } else {
                        console.warn(`El grupo '${grupo}' no es un array. Se ignorará.`);
                    }
                }
            });
            licencias.sort((a, b) => {
                if (a.Consola < b.Consola) return -1;
                if (a.Consola > b.Consola) return 1;
                return 0;
            });

            return licencias;
        }, ordenarPorEqunr: function (data) {
            // Ordenar los elementos por el campo 'Equnr'
            data.sort((a, b) => {
                if (a.Equnr === b.Equnr) {
                    // Si las consolas son iguales, no cambiar el orden
                    return 0;
                }
                return a.Equnr < b.Equnr ? -1 : 1;
            });
            return data;
        },
        assignShiftsToLicences: function (licences) {
            const initialTime = 7 * 60; // 7:00 AM en minutos

            // Asegurar Grupo por defecto
            licences.forEach((license) => {
                if (!license.Grupo) {
                    license.Grupo = license.Equnr;
                }
            });

            // Agrupar por Consola
            const groupedByConsola = {};
            licences.forEach((license) => {
                const consola = license.Consola || "";
                if (!groupedByConsola[consola]) {
                    groupedByConsola[consola] = [];
                }
                groupedByConsola[consola].push(license);
            });

            Object.keys(groupedByConsola).forEach((consola) => {
                let currentTime = initialTime;
                let previousGrupo = "";
                let firstShiftInGroup = "";

                groupedByConsola[consola].forEach((license) => {

                    // 1) Si ya viene con turno desde backend, respetarlo
                    if (Array.isArray(license.TurnosLicencias_nav?.results) &&
                        license.TurnosLicencias_nav.results.length > 0) {

                        // Buscar el registro que corresponde a la fecha del turno actual.
                        // TurnosLicencias_nav puede traer registros de múltiples fechas,
                        // por lo que hay que usar el que coincide con license.Dateturno.
                        // INI MOD TRNS #SistemaDeTurno-12-13
                        // let nav = license.TurnosLicencias_nav.results[0];
                        // if (license.Dateturno && license.TurnosLicencias_nav.results.length > 1) {
                        //     const targetTime = license.Dateturno instanceof Date
                        //         ? license.Dateturno.getTime()
                        //         : new Date(license.Dateturno).getTime();
                        //     const navFecha = license.TurnosLicencias_nav.results.find(function (r) {
                        //         const rTime = r.Dateturno instanceof Date
                        //             ? r.Dateturno.getTime()
                        //             : new Date(r.Dateturno).getTime();
                        //         return rTime === targetTime;
                        //     });
                        //     if (navFecha) { nav = navFecha; }
                        // }
                        //
                        // license.TurnoAsignado = nav.Turno;
                        // license.Comentarios = nav.Comentarios;
                        // license.Agrmanual = nav.Agrmanual || false;
                        //
                        // return;

                        // Solo se usa el registro de la fecha del turno, aunque sea el único:
                        // un registro de otra fecha no es el turno de este día.
                        const sFechaTurno = license.Dateturno ? this._claveFechaTurno(license.Dateturno) : "";
                        const nav = sFechaTurno
                            ? license.TurnosLicencias_nav.results.find(r => this._claveFechaTurno(r.Dateturno) === sFechaTurno)
                            : null;

                        if (nav) {
                            license.TurnoAsignado = nav.Turno;
                            license.Comentarios = nav.Comentarios;
                            license.Agrmanual = nav.Agrmanual || false;
                            license.Desacoplado = nav.Desacoplado === true;

                            return;
                        }
                        // Sin registro para esta fecha: se calcula como licencia nueva (pasos 2-4)
                        // FIN MOD TRNS #SistemaDeTurno-12-13
                    }

                    // 2) Obtener duración
                    const shiftInfo = Utils.getShiftInfo(license);
                    const shiftDuration = shiftInfo.duration;

                    // 3) Desacoplados
                    if (license.Grupo && license.Grupo.startsWith("_")) {
                        license.TurnoAsignado = this._formatTime(currentTime);
                        currentTime += shiftDuration;
                        return;
                    }

                    // 4) Grupos normales
                    if (license.Grupo !== previousGrupo) {
                        previousGrupo = license.Grupo;

                        firstShiftInGroup = this._formatTime(currentTime);
                        license.TurnoAsignado = firstShiftInGroup;

                        currentTime += shiftDuration;
                    } else {
                        license.TurnoAsignado = firstShiftInGroup;
                    }
                });

                // Ordenar por turno asignado
                groupedByConsola[consola].sort((a, b) =>
                    this._convertTimeToMinutes(a.TurnoAsignado) -
                    this._convertTimeToMinutes(b.TurnoAsignado)
                );
            });

            // Reconstruir array final
            licences.length = 0;
            Object.keys(groupedByConsola).forEach((consola) => {
                licences.push(...groupedByConsola[consola]);
            });
        }
        ,


        _formatTime: function (iMinutes) {
            // Convertir los minutos de nuevo a formato HH:mm
            var iHours = Math.floor(iMinutes / 60);
            var iRemainderMinutes = iMinutes % 60;

            // Asegurarse de que siempre tenga 2 dígitos
            return (iHours < 10 ? "0" : "") + iHours + ":" + (iRemainderMinutes < 10 ? "0" : "") + iRemainderMinutes;
        },
        _convertTimeToMinutes: function (timeString) {
            if (!timeString) return 0;
            let [hours, minutes] = timeString.split(":").map(Number);
            return hours * 60 + minutes;
        },
        // INI MOD TRNS #SistemaDeTurno-12-13
        // Clave "AAAA-M-D" de una fecha de turno. Las fechas OData (Edm.DateTime) llegan a las
        // 00:00 UTC y las del DatePicker a las 00:00 locales: se toma el día que corresponde a cada caso.
        _claveFechaTurno: function (vFecha) {
            const d = vFecha instanceof Date ? vFecha : new Date(vFecha);
            if (isNaN(d.getTime())) return "";

            const bMedianocheUTC = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
            return bMedianocheUTC
                ? d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate()
                : d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
        },
        // FIN MOD TRNS #SistemaDeTurno-12-13
        appendLicencesToModel: function (licencesToAdd, oView) {
            const aNewLicences = Array.isArray(licencesToAdd) ? licencesToAdd : [licencesToAdd];
            if (!aNewLicences.length) return;

            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            const aCurrent = oLicencesModel.getData() || [];

            const existingIds = new Set(aCurrent.map(l => l.Id));

            const aToInsert = aNewLicences
                .filter(l => !existingIds.has(l.Id))
                .map(l => {
                    const copia = { ...l };

                    // ❗ SIN turno asignado
                    delete copia.TurnoAsignado;

                    // ❗ GRUPO DESACOPLADO (clave!)
                    copia.Grupo = `_Desacoplado_${copia.Id}`;

                    // INI MOD TRNS #SistemaDeTurno-12-13
                    copia.Desacoplado = false;

                    // Si su equipo ya está en el turno (acoplado y con hora), se suma a ese grupo:
                    // se copian Grupo y TurnoAsignado, no se calcula nada.
                    const sEquipo = (copia.Equnr || "").trim();
                    const oMismoEquipo = sEquipo && aCurrent.find(c =>
                        c.Desacoplado !== true &&
                        (c.Equnr || "").trim() === sEquipo &&
                        c.TurnoAsignado
                    );
                    if (oMismoEquipo) {
                        copia.Grupo = oMismoEquipo.Grupo;
                        copia.TurnoAsignado = oMismoEquipo.TurnoAsignado;
                    }
                    // FIN MOD TRNS #SistemaDeTurno-12-13

                    return copia;
                });

            aToInsert.forEach(lic => {
                const consola = lic.Consola || "";

                let insertIndex = -1;
                for (let i = aCurrent.length - 1; i >= 0; i--) {
                    if (aCurrent[i].Consola === consola) {
                        insertIndex = i + 1;
                        break;
                    }
                }

                if (insertIndex === -1) {
                    aCurrent.push(lic);
                } else {
                    aCurrent.splice(insertIndex, 0, lic);
                }
            });
            Utils.onCountItems(oView, aCurrent)
            oLicencesModel.setData(aCurrent);

            oLicencesModel.refresh(true);
        },

        validarEstadosAntesDeGuardar: function (aLicenciasEnPantalla, oDataModel) {
            return new Promise((resolve, reject) => {

                const aIds = aLicenciasEnPantalla.map(lic => lic.Id);

                if (aIds.length === 0) {
                    resolve({ validas: [], noAutorizadas: [] });
                    return;
                }

                const aFilters = aIds.map(id =>
                    new Filter("Id", FilterOperator.EQ, id)
                );

                const oFilterOr = new Filter({
                    filters: aFilters,
                    and: false
                });

                oDataModel.read('/LicenciaTrabajoSet', {
                    filters: [oFilterOr],
                    success: (oData) => {
                        const estadosPermitidos = ["01", "07", "08", "10", "23"];

                        const aValidas = [];
                        const aNoAutorizadas = [];

                        aLicenciasEnPantalla.forEach(licPantalla => {
                            const licBackend = oData.results.find(l => l.Id === licPantalla.Id);

                            if (!licBackend) {
                                aNoAutorizadas.push({
                                    ...licPantalla,
                                    motivoRechazo: "Licencia no encontrada en el sistema"
                                });
                            } else if (!estadosPermitidos.includes(licBackend.Licstat)) {
                                // 🆕 USAR FormatHelper en lugar de _getEstadoTexto
                                aNoAutorizadas.push({
                                    ...licPantalla,
                                    estadoAnterior: licPantalla.Licstat,
                                    estadoActual: licBackend.Licstat,
                                    motivoRechazo: `Estado cambió a: ${FormatHelper.formatLicState(licBackend.Licstat)}`
                                });
                            } else {
                                aValidas.push(licPantalla);
                            }
                        });

                        console.log("✅ Licencias válidas:", aValidas.length);
                        console.log("❌ Licencias no autorizadas:", aNoAutorizadas.length);

                        resolve({
                            validas: aValidas,
                            noAutorizadas: aNoAutorizadas
                        });
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

    };
});
