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
                            // INI MOD TRNS #SistemaDeTurno-14
                            // Asignación eliminada: corría sobre el orden de ordenarPorEqunr y
                            // antes de que existiera InitHourSort, y _doSearchTurnos volvía a
                            // asignar enseguida. Con RN-01 esta primera pasada además sería
                            // incorrecta. Los demás llamadores de search() no usan TurnoAsignado
                            // (appendLicencesToModel lo borra al insertar).
                            // this.assignShiftsToLicences(resultadoFinal, oView);
                            // FIN MOD TRNS #SistemaDeTurno-14
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

            // INI MOD TRNS #SistemaDeTurno-14
            // Asegurar la hora de inicio: los flujos de reporte nunca la calculaban,
            // y sin ella no se puede aplicar RN-01.
            licences.forEach((license) => {
                if (license.InitHourSort == null) {
                    license.InitHourSort = Utils.getInitHourSort(license);
                }
            });
            // FIN MOD TRNS #SistemaDeTurno-14

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
                // INI MOD TRNS #SistemaDeTurno-14
                // El cursor lo lleva ahora recalcularDesde.
                // let currentTime = initialTime;

                // Las licencias con turno guardado para esta fecha no se recalculan:
                // se marcan como fijas y recalcularDesde las trata como bloque propio
                // que solo alimenta el cursor.
                const oFijos = new Set();
                // FIN MOD TRNS #SistemaDeTurno-14

                // INI MOD TRNS #SistemaDeTurno-12-13
                // let previousGrupo = "";
                // let firstShiftInGroup = "";

                // Hora ya fijada por cada grupo de esta consola.
                // Permite que licencias del mismo grupo compartan turno aunque no
                // estén contiguas en el array (p.ej. ordenadas por hora de inicio).
                // INI MOD TRNS #SistemaDeTurno-14
                // Absorbido por recalcularDesde: "una hora por bloque" es ahora la regla general.
                // const mTurnoPorGrupo = {};
                // FIN MOD TRNS #SistemaDeTurno-14
                // FIN MOD TRNS #SistemaDeTurno-12-13

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

                            // INI MOD TRNS #SistemaDeTurno-14
                            // return;
                            oFijos.add(license.Id);
                            // FIN MOD TRNS #SistemaDeTurno-14
                            return;
                        }
                        // Sin registro para esta fecha: se calcula como licencia nueva (pasos 2-4)
                        // FIN MOD TRNS #SistemaDeTurno-12-13
                    }

                    // INI MOD TRNS #SistemaDeTurno-14
                    // Los pasos 2 a 4 (duración, desacoplados y grupos normales) los resuelve
                    // ahora recalcularDesde, con la misma regla que usa la cascada al editar.
                    //
                    // // 2) Obtener duración
                    // const shiftInfo = Utils.getShiftInfo(license);
                    // const shiftDuration = shiftInfo.duration;
                    //
                    // // 3) Desacoplados
                    // if (license.Grupo && license.Grupo.startsWith("_")) {
                    //     license.TurnoAsignado = this._formatTime(currentTime);
                    //     currentTime += shiftDuration;
                    //     return;
                    // }
                    //
                    // // 4) Grupos normales
                    // // INI MOD TRNS #SistemaDeTurno-12-13
                    // // if (license.Grupo !== previousGrupo) {
                    // //     previousGrupo = license.Grupo;
                    // //
                    // //     firstShiftInGroup = this._formatTime(currentTime);
                    // //     license.TurnoAsignado = firstShiftInGroup;
                    // //
                    // //     currentTime += shiftDuration;
                    // // } else {
                    // //     license.TurnoAsignado = firstShiftInGroup;
                    // // }
                    //
                    // // La primera licencia del grupo fija la hora y avanza el cursor;
                    // // las siguientes del mismo grupo copian esa hora aunque no sean contiguas.
                    // if (mTurnoPorGrupo[license.Grupo] === undefined) {
                    //     mTurnoPorGrupo[license.Grupo] = this._formatTime(currentTime);
                    //     license.TurnoAsignado = mTurnoPorGrupo[license.Grupo];
                    //
                    //     currentTime += shiftDuration;
                    // } else {
                    //     license.TurnoAsignado = mTurnoPorGrupo[license.Grupo];
                    // }
                    // // FIN MOD TRNS #SistemaDeTurno-12-13
                    // FIN MOD TRNS #SistemaDeTurno-14
                });

                // INI MOD TRNS #SistemaDeTurno-14
                // Asignación inicial: se recorren TODOS los bloques, ordenados por hora de
                // inicio del bloque (no por su posición en el array), aplicando RN-01.
                this.recalcularDesde(groupedByConsola[consola], {
                    consola: consola,
                    desdeGrupo: 0,
                    inicial: initialTime,
                    orden: "inicio",
                    fijos: oFijos,
                    respetarValorActual: false
                });
                // FIN MOD TRNS #SistemaDeTurno-14

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


        // INI MOD TRNS #SistemaDeTurno-14
        // ---------------- MOTOR ÚNICO DE HORARIOS ----------------
        //
        // Reemplaza las tres cascadas que existían con reglas distintas
        // (assignShiftsToLicences, _cascadeGroupsDown y
        // _recalculateEmptyShift/_recalculateFollowingGroups).
        //
        // Regla, recorriendo los bloques de UNA consola:
        //
        //   inicioBloque = hora de inicio del bloque (ver _inicioBloque)  -> RN-01
        //   durBloque    = max(duration de sus licencias)                 -> separación
        //
        //   ancla (grupo editado por el usuario, o licencia con turno guardado):
        //       turno = su valor actual
        //       alerta "solape"        si turno < cursor
        //       alerta "antesDeInicio" si turno < inicioBloque
        //   resto:
        //       turno = max(cursor, inicioBloque, valorActual)
        //       (empuja si hay solape, respeta lo que ya estaba más tarde, nunca adelanta;
        //        adelantar en cascada es P-04 y va en 14a-2)
        //
        //   cursor = turno + durBloque
        //
        // RN-07: solo se alerta por conflicto real (solape o turno anterior a la hora de
        // inicio) y solo del bloque ancla. Los huecos no generan alerta.
        //
        // Opciones:
        //   consola              consola a recalcular (el motor trabaja de a una)
        //   desdeGrupo           índice del primer bloque a recalcular; los previos solo
        //                        alimentan el cursor
        //   inicial              minutos del primer turno posible (por defecto 07:00)
        //   orden                "inicio"  -> bloques por hora de inicio (asignación inicial)
        //                        "visual"  -> bloques por posición en el array (cascada al editar)
        //   anclas               claves de grupo cuyo turno no se recalcula
        //   fijos                Set de Id de licencias con turno guardado: cada una es su
        //                        propio bloque ancla
        //   respetarValorActual  incluir el valor actual en el max() de los bloques no ancla
        //
        // Devuelve { alertas: [{ grupo, tipo, turno, minimo }] }.
        recalcularDesde: function (licences, oOpciones) {
            const oOpts = oOpciones || {};
            const sConsola = oOpts.consola || "";
            const iInicial = oOpts.inicial != null ? oOpts.inicial : 7 * 60;
            const iDesdeGrupo = oOpts.desdeGrupo != null ? oOpts.desdeGrupo : 0;
            const aAnclas = oOpts.anclas || [];
            const oFijos = oOpts.fijos || new Set();
            const bRespetarValor = oOpts.respetarValorActual === true;

            const aGrupos = this._agruparPorConsola(licences, sConsola, oOpts.orden, oFijos);
            const aAlertas = [];

            let iCursor = iInicial;

            aGrupos.forEach((oGrupo, iIndex) => {
                const bAncla = oGrupo.fijo || aAnclas.indexOf(oGrupo.grupo) !== -1;
                const iActual = this._turnoDelBloque(oGrupo.items);

                // Bloques anteriores al punto de recálculo: se respetan y alimentan el cursor
                if (iIndex < iDesdeGrupo) {
                    if (iActual != null) {
                        iCursor = Math.max(iCursor, iActual + oGrupo.duracion);
                    }
                    return;
                }

                let iTurno;

                if (bAncla && iActual != null) {
                    iTurno = iActual;

                    if (iTurno < iCursor) {
                        aAlertas.push({
                            grupo: oGrupo.grupo, tipo: "solape",
                            turno: iTurno, minimo: iCursor
                        });
                    }
                    if (oGrupo.inicio != null && iTurno < oGrupo.inicio) {
                        aAlertas.push({
                            grupo: oGrupo.grupo, tipo: "antesDeInicio",
                            turno: iTurno, minimo: oGrupo.inicio
                        });
                    }
                } else {
                    iTurno = Math.max(
                        iCursor,
                        oGrupo.inicio != null ? oGrupo.inicio : 0,
                        bRespetarValor && iActual != null ? iActual : 0
                    );

                    const sTurno = this._formatTime(iTurno);
                    oGrupo.items.forEach((it) => { it.TurnoAsignado = sTurno; });
                }

                iCursor = iTurno + oGrupo.duracion;
            });

            return { alertas: aAlertas };
        },

        // Bloques de una consola: clave = Grupo (o Equnr), salvo las licencias fijas, que
        // forman bloque propio igual que antes hacían al salir por "return".
        _agruparPorConsola: function (licences, sConsola, sOrden, oFijos) {
            const mGrupos = {};
            const oSetFijos = oFijos || new Set();

            (licences || []).forEach((lic, idx) => {
                if ((lic.Consola || "") !== sConsola) return;

                const bFijo = oSetFijos.has(lic.Id);
                const sClave = bFijo ? "fijo_" + lic.Id : (lic.Grupo || lic.Equnr || "");

                if (!mGrupos[sClave]) {
                    mGrupos[sClave] = { grupo: sClave, items: [], firstIndex: idx, fijo: bFijo };
                }
                mGrupos[sClave].items.push(lic);
                if (idx < mGrupos[sClave].firstIndex) {
                    mGrupos[sClave].firstIndex = idx;
                }
            });

            const aGrupos = Object.keys(mGrupos).map((k) => mGrupos[k]);

            aGrupos.forEach((g) => {
                g.inicio = this._inicioBloque(g.items);
                g.duracion = this._duracionBloque(g.items);
                g.prioridad = this._prioridadBloque(g.items);
            });

            if (sOrden === "inicio") {
                // Asignación inicial: por hora de inicio del bloque. Un bloque fijo se ordena
                // por su turno guardado, que es la hora que efectivamente ocupa.
                const fnClave = (g) => {
                    if (g.fijo) {
                        const iTurno = this._turnoDelBloque(g.items);
                        if (iTurno != null) return iTurno;
                    }
                    return g.inicio != null ? g.inicio : Number.MAX_SAFE_INTEGER;
                };

                aGrupos.sort((a, b) => {
                    const ia = fnClave(a), ib = fnClave(b);
                    if (ia !== ib) return ia - ib;
                    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
                    return a.firstIndex - b.firstIndex;
                });
            } else {
                aGrupos.sort((a, b) => a.firstIndex - b.firstIndex);
            }

            return aGrupos;
        },

        // RN-01: hora de inicio del bloque. ÚNICO lugar donde vive este criterio;
        // cambiarlo acá cambia la regla en la asignación inicial y en las dos cascadas.
        //
        // Criterio vigente: el MÍNIMO, o sea la hora de inicio de la primera licencia
        // del bloque (Figura 10 del requerimiento: el bloque EM VSINC, con inicios de
        // 08:00 a 11:07, arranca a las 08:00 y está marcado como correcto).
        //
        // Consecuencia: dentro de un bloque acoplado, las licencias que empiezan más
        // tarde quedan con un turno anterior a su propia hora de inicio. RN-01 aplica
        // al bloque, no a cada licencia.
        //
        // Pendiente de confirmación del cliente. Para volver al máximo (el turno del
        // bloque no antes de la hora de inicio más tardía) alcanza con invertir la
        // comparación de abajo: iHora > iInicio.
        _inicioBloque: function (aItems) {
            let iInicio = null;
            (aItems || []).forEach((it) => {
                const iHora = it.InitHourSort != null ? it.InitHourSort : Utils.getInitHourSort(it);
                if (iHora == null || isNaN(iHora)) return;
                if (iInicio == null || iHora < iInicio) { iInicio = iHora; }
            });
            return iInicio;
        },

        // Separación después de un bloque: la MAYOR duración de sus licencias
        // (antes se usaba la de items[0], que podía dejar solapado al bloque siguiente).
        _duracionBloque: function (aItems) {
            let iDuracion = 0;
            (aItems || []).forEach((it) => {
                const iDur = Utils.getShiftInfo(it).duration;
                if (iDur > iDuracion) { iDuracion = iDur; }
            });
            return iDuracion;
        },

        // Prioridad del bloque = la más alta (número más bajo) de sus licencias.
        // Mismo criterio que _sortLicencesNuevoTurno en el controller.
        _prioridadBloque: function (aItems) {
            const mPrioridad = {
                "ConsignacionLinea": 1,
                "ConsignacionEquipo": 2,
                "ManiobrasSinConsignacion": 3,
                "TCTConBloqueo": 4,
                "TCTSinBloqueo": 4,
                "SinManiobras": 5
            };

            let iPrioridad = 5;
            (aItems || []).forEach((it, i) => {
                const iCat = mPrioridad[Utils.getShiftInfo(it).category] || 5;
                if (i === 0 || iCat < iPrioridad) { iPrioridad = iCat; }
            });
            return iPrioridad;
        },

        // Turno del bloque en minutos, o null si ninguna de sus licencias tiene turno.
        _turnoDelBloque: function (aItems) {
            const oConTurno = (aItems || []).find((it) => !!it.TurnoAsignado);
            return oConTurno ? this._convertTimeToMinutes(oConTurno.TurnoAsignado) : null;
        },
        // FIN MOD TRNS #SistemaDeTurno-14

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
