// ============================================================
// TramitacionService.js - Servicio para manejar tramitaciones
// ============================================================

sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
    "use strict";

    return {
        /**
         * Obtiene las licencias con sus tramitaciones y fechas de calendario
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - Modelo OData
         * @param {Date} dFecha - Fecha seleccionada en el filtro
         * @returns {Promise} Promise con los datos de licencias y tramitaciones
         */
        getLicenciasConTramitacion: function (oModel, dFecha, sEmpresa) {
            return new Promise((resolve, reject) => {
                const aFilters = [
                    new Filter("Dateturno", FilterOperator.EQ, dFecha),
                    new Filter("Empresa", FilterOperator.EQ, sEmpresa)
                ];

                const sExpand = "TramitacionesLicencia_nav/LicenciaEstadoDiarioSet";

                oModel.read("/LicenciaTrabajoSet", {
                    filters: aFilters,
                    urlParameters: {
                        "$expand": sExpand
                    },
                    success: (oData) => {
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Valida si una licencia tiene fechas en estado problemático
         * Estados problemáticos: AS (Anulada por solicitante), NA (No autorizada), CC (Condicionada)
         * @param {Object} oLicencia - Objeto de licencia con navegación de tramitaciones
         * @param {Date} dFechaSeleccionada - Fecha seleccionada por el usuario
         * @returns {Object} Objeto con información de validación
         */
        validarEstadoTramitacion: function (oLicencia, dFechaSeleccionada) {
            const oResultado = {
                tieneProblemas: false,
                colorIndicador: null, // "red" | "yellow" | null
                estadoEncontrado: null, // "AS" | "NA" | "CC" | null
                fechasProblematicas: []
            };

            // Verificar si tiene tramitaciones
            if (!oLicencia.TramitacionesLicencia_nav || !oLicencia.TramitacionesLicencia_nav.length) {
                return oResultado;
            }

            // Solo considerar tramitaciones con Estado "02" (Autorizado)
            const aTramitacionesAutorizadas = oLicencia.TramitacionesLicencia_nav.filter(t => t.Estado === "02");

            if (!aTramitacionesAutorizadas.length) {
                return oResultado;
            }

            // Convertir fecha seleccionada a string para comparar (formato: YYYY-MM-DD)
            const sFechaSeleccionada = this._formatDateForComparison(dFechaSeleccionada);

            // Recorrer tramitaciones autorizadas
            aTramitacionesAutorizadas.forEach(oTramitacion => {
                // Verificar si tiene fechas de calendario
                if (!oTramitacion.LicenciaEstadoDiarioSet || !oTramitacion.LicenciaEstadoDiarioSet.results) {
                    return;
                }

                // Recorrer fechas del calendario
                oTramitacion.LicenciaEstadoDiarioSet.results.forEach(oFecha => {
                    const sFechaCalendario = this._formatDateForComparison(oFecha.Fecha);

                    // Si la fecha coincide con la seleccionada
                    if (sFechaCalendario === sFechaSeleccionada) {
                        // Verificar estado problemático
                        if (oFecha.Estado === "AS" || oFecha.Estado === "NA") {
                            // Anulada por solicitante o No autorizada = ROJO
                            oResultado.tieneProblemas = true;
                            oResultado.colorIndicador = "red";
                            oResultado.estadoEncontrado = oFecha.Estado;
                            oResultado.fechasProblematicas.push({
                                fecha: oFecha.Fecha,
                                estado: oFecha.Estado,
                                observaciones: oFecha.Observaciones
                            });
                        } else if (oFecha.Estado === "CC") {
                            // Condicionada = AMARILLO (solo si no hay rojo)
                            if (!oResultado.tieneProblemas) {
                                oResultado.tieneProblemas = true;
                                oResultado.colorIndicador = "yellow";
                                oResultado.estadoEncontrado = oFecha.Estado;
                                oResultado.fechasProblematicas.push({
                                    fecha: oFecha.Fecha,
                                    estado: oFecha.Estado,
                                    observaciones: oFecha.Observaciones
                                });
                            }
                        }
                    }
                });
            });

            return oResultado;
        },

        /**
         * Procesa array de licencias y agrega información de validación
         * @param {Array} aLicencias - Array de licencias
         * @param {Date} dFechaSeleccionada - Fecha seleccionada
         * @returns {Array} Array de licencias con información de validación agregada
         */
        procesarLicenciasConValidacion: function (aLicencias, dFechaSeleccionada) {

            let iLicenciasConProblemas = 0;

            aLicencias.forEach(oLicencia => {
                const oValidacion = this.validarEstadoTramitacion(oLicencia, dFechaSeleccionada);
                
                // Agregar propiedades de validación a la licencia
                oLicencia.tramitacionProblematica = oValidacion.tieneProblemas;
                oLicencia.tramitacionColor = oValidacion.colorIndicador;
                oLicencia.tramitacionEstado = oValidacion.estadoEncontrado;
                oLicencia.tramitacionDetalles = oValidacion.fechasProblematicas;

            });

            return aLicencias;
        },

        /**
         * Formatea fecha para comparación (YYYY-MM-DD)
         * @param {Date|string} dDate - Fecha a formatear
         * @returns {string} Fecha en formato YYYY-MM-DD
         */
        _formatDateForComparison: function (dDate) {
            if (!dDate) return "";
            
            let oDate = dDate;
            if (typeof dDate === "string") {
                oDate = new Date(dDate);
            }

            const sYear = oDate.getFullYear();
            const sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
            const sDay = String(oDate.getDate()).padStart(2, "0");

            return `${sYear}-${sMonth}-${sDay}`;
        },

        /**
         * Obtiene descripción legible del estado
         * @param {string} sEstado - Código de estado (AS, NA, CC)
         * @returns {string} Descripción del estado
         */
        getEstadoDescripcion: function (sEstado) {
            const mEstados = {
                "AS": "Anulada por el solicitante",
                "NA": "No Autorizada",
                "CC": "Condicionada"
            };
            return mEstados[sEstado] || sEstado;
        // INI MOD TRNS #TT-390
        // }
        },

        /**
         * Catálogos para armar empresasTextoPlano, los mismos que usa LLTT:
         * EmpresasLTSet (Codigo / Descripcion) y FixedValuesSet ZTAB_OP_TRALIC-ESTADO (Valkey / Valtext).
         * Nunca rechaza: si una lectura falla, ese catálogo queda vacío y el texto sale con los códigos.
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - Modelo OData
         * @param {string} sEmpresa - Sociedad actual
         * @returns {Promise<{empresas: Array, estados: Array}>}
         */
        getCatalogosEmpresasTexto: function (oModel, sEmpresa) {
            const fnLeer = (sEntity, aFilters) => new Promise((resolve) => {
                oModel.read(sEntity, {
                    filters: aFilters,
                    success: (oData) => resolve(oData.results || []),
                    error: () => resolve([])
                });
            });

            return Promise.all([
                fnLeer("/EmpresasLTSet", [new Filter("Empresa", FilterOperator.EQ, sEmpresa)]),
                fnLeer("/FixedValuesSet", [
                    new Filter("Tabname", FilterOperator.EQ, "ZTAB_OP_TRALIC"),
                    new Filter("Fieldname", FilterOperator.EQ, "ESTADO")
                ])
            ]).then(([aEmpresas, aEstados]) => ({ empresas: aEmpresas, estados: aEstados }));
        },

        /**
         * Tramitaciones de una licencia con sus fechas de calendario (LicenciaEstadoDiarioSet).
         * Rechaza si la lectura falla, para distinguir "sin trámites" de "no se pudo leer".
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - Modelo OData
         * @param {Object} oLicense - Licencia (Empresa, Id, Tipo, Anio)
         * @returns {Promise<Array>} Tramitaciones, cada una con CalendarDates
         */
        getTramitacionesLicencia: function (oModel, oLicense) {
            return new Promise((resolve, reject) => {
                const sPath = oModel.createKey("/LicenciaTrabajoSet", {
                    Empresa: oLicense.Empresa,
                    Id: oLicense.Id,
                    Tipo: oLicense.Tipo || "L",
                    Anio: oLicense.Anio
                });

                oModel.read(sPath, {
                    urlParameters: {
                        "$expand": "TramitacionesLicencia_nav/LicenciaEstadoDiarioSet"
                    },
                    success: (oData) => {
                        const aTramites = (oData.TramitacionesLicencia_nav && oData.TramitacionesLicencia_nav.results) || [];
                        resolve(aTramites.map(oTramite => Object.assign({}, oTramite, {
                            CalendarDates: (oTramite.LicenciaEstadoDiarioSet && oTramite.LicenciaEstadoDiarioSet.results) || []
                        })));
                    },
                    error: reject
                });
            });
        },

        /**
         * Texto plano de las empresas que tramitan la licencia, mismo formato que arma LLTT
         * para su mail (MailHelper.prepareContext): por empresa "<código> - <nombre>",
         * "Estado de tramitación: <estado>" y las fechas "dd-MM-yyyy - <estado>: <observaciones>".
         * Bloques separados por una línea en blanco; sin trámites devuelve "No hay comentarios".
         * @param {Array} aTramites - Resultado de getTramitacionesLicencia
         * @param {Object} oCatalogos - Resultado de getCatalogosEmpresasTexto
         * @returns {string}
         */
        buildEmpresasTextoPlano: function (aTramites, oCatalogos) {
            const aTramitesLicencia = Array.isArray(aTramites) ? aTramites : [];
            if (aTramitesLicencia.length === 0) {
                return "No hay comentarios";
            }

            const mNombreEmpresa = {};
            ((oCatalogos && oCatalogos.empresas) || []).forEach(e => {
                const sCodigo = String(e.Codigo || "").trim();
                if (sCodigo) mNombreEmpresa[sCodigo] = (e.Descripcion || "").trim() || `Empresa ${sCodigo}`;
            });

            const mNombreEstado = {};
            ((oCatalogos && oCatalogos.estados) || []).forEach(e => {
                const sCodigo = String(e.Valkey || "").trim();
                if (sCodigo) mNombreEstado[sCodigo] = (e.Valtext || "").trim() || sCodigo;
            });

            // Estado de cada fecha del calendario (en LLTT: FormatHelper.getEstadoTramitacion)
            const mEstadoFecha = {
                "NA": "No Autorizada",
                "CC": "Condicionada",
                "AS": "Anulada por el solicitante"
            };

            // dd-MM-yyyy con getters UTC (en LLTT: FormatHelper.formatDateLicenseWithoutUtc)
            const fnFecha = (vFecha) => {
                if (!vFecha) return "";
                const d = vFecha instanceof Date ? vFecha : new Date(vFecha);
                if (isNaN(d)) return "";
                return String(d.getUTCDate()).padStart(2, "0") + "-" +
                    String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + d.getUTCFullYear();
            };

            // Agrupación por empresa: fechas y estado de tramitación a nivel empresa
            const mPorEmpresa = new Map();
            aTramitesLicencia.forEach(oTramite => {
                const sCodigo = oTramite.EmpTramita || oTramite.Empresa || "N/A";
                const oEntrada = mPorEmpresa.get(sCodigo) || { fechas: [], estadoTramitacion: null };

                const sEstado = String(oTramite.Estado || "").trim();
                oEntrada.estadoTramitacion = mNombreEstado[sEstado] || sEstado || "-";

                (oTramite.CalendarDates || []).forEach(oFecha => {
                    oEntrada.fechas.push({
                        FechaISO: oFecha.Fecha,
                        Fecha: fnFecha(oFecha.Fecha),
                        Estado: oFecha.Estado,
                        EstadoDescripcion: mEstadoFecha[oFecha.Estado] || "",
                        Observaciones: (oFecha.Observaciones || "-").trim()
                    });
                });

                mPorEmpresa.set(sCodigo, oEntrada);
            });

            const sSalto = "\r\n";
            const aBloques = Array.from(mPorEmpresa.keys()).sort().map(sCodigo => {
                const oEntrada = mPorEmpresa.get(sCodigo);
                const sNombre = mNombreEmpresa[sCodigo] || `Empresa ${sCodigo}`;

                // Sin repetidos por (fecha | estado | observaciones), ordenadas por fecha
                const oVistos = new Set();
                const aFechas = oEntrada.fechas.filter(f => {
                    const sClave = `${f.FechaISO}|${f.Estado}|${f.Observaciones}`;
                    if (oVistos.has(sClave)) return false;
                    oVistos.add(sClave);
                    return true;
                }).sort((a, b) => new Date(a.FechaISO) - new Date(b.FechaISO));

                const sTextoFechas = aFechas
                    .map(f => `${f.Fecha} - ${f.EstadoDescripcion}: ${f.Observaciones}`)
                    .join(sSalto);

                return `${sCodigo} - ${sNombre}${sSalto}` +
                    `Estado de tramitación: ${oEntrada.estadoTramitacion || "-"}` +
                    (sTextoFechas ? `${sSalto}${sTextoFechas}` : "");
            });

            return aBloques.length === 0 ? "No hay comentarios" : aBloques.join(sSalto + sSalto);
        }
        // FIN MOD TRNS #TT-390
    };
});
