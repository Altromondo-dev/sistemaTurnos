/**
 * Helper para transformar datos planos en estructura jerárquica para TreeTable
 * Agrupa por Equipo + Horario
 */
// INI MOD TRNS #SistemaDeTurno-7
// sap.ui.define([], function () {
sap.ui.define([
    "transener/sistemadeturnos/utils/FormatHelper"
], function (FormatHelper) {
// FIN MOD TRNS #SistemaDeTurno-7
    "use strict";

    return {
        /**
         * Transforma un array plano de licencias en una estructura jerárquica
         * agrupada por Equipo + Horario
         * 
         * @param {Array} aLicencias - Array de licencias planas
         * @returns {Array} Array con estructura jerárquica para TreeTable
         */
        transformToTreeStructure: function (aLicencias) {
            if (!aLicencias || !Array.isArray(aLicencias) || aLicencias.length === 0) {
                return [];
            }

            // Agrupar por Equipo + Horario
            const grupos = {};

            aLicencias.forEach((licencia, index) => {
                const equipo = licencia.Equnr || "Sin Equipo";
                const turnoAsignado = licencia.TurnoAsignado || "Sin Turno";

                // INI MOD TRNS #SistemaDeTurno-12-13
                // const grupoKey = `${equipo}|${turnoAsignado}`;
                // Una licencia desacoplada tiene clave propia: nunca se agrupa con otras,
                // aunque coincidan equipo y hora
                const grupoKey = licencia.Desacoplado === true
                    ? `${equipo}|${turnoAsignado}|${licencia.Id}`
                    : `${equipo}|${turnoAsignado}`;
                // FIN MOD TRNS #SistemaDeTurno-12-13

                if (!grupos[grupoKey]) {
                    grupos[grupoKey] = {
                        // Propiedades del nodo padre
                        _isGroup: true,
                        Equnr: equipo,
                        TurnoAsignado: turnoAsignado,
                        // Copiar datos de la primera licencia del grupo para mostrar en el padre
                        Equstat: licencia.Equstat,
                        Jobcond: licencia.Jobcond,
                        Comments: licencia.Comments,
                        Werks: licencia.Werks,
                        Consola: licencia.Consola,
                        Timbeg: licencia.Timbeg,
                        Gdate: licencia.Gdate,
                        InitHourSort: licencia.InitHourSort,
                        // Contador de hijos
                        _childCount: 0,
                        // Array de hijos
                        children: []
                    };
                }

                // Agregar licencia como hijo
                grupos[grupoKey].children.push({
                    ...licencia,
                    _isGroup: false,
                    _parentKey: grupoKey
                });

                grupos[grupoKey]._childCount++;
            });

            // Convertir el objeto de grupos a array
            const aTreeData = Object.values(grupos);

            // INI MOD TRNS #SistemaDeTurno-7
            // Textos para el filtro de columna (lo que se ve en cada celda)
            aTreeData.forEach(grupo => this._asignarTextosFiltro(grupo));
            // FIN MOD TRNS #SistemaDeTurno-7

            // Ordenar grupos por Equipo y luego por TurnoAsignado
            aTreeData.sort((a, b) => {
                // Comparar por Equipo (string)
                if (a.Equnr !== b.Equnr) {
                    return a.Equnr.localeCompare(b.Equnr);
                }
                // Comparar por TurnoAsignado (formato HH:MM)
                const turnoA = a.TurnoAsignado || "00:00";
                const turnoB = b.TurnoAsignado || "00:00";
                return turnoA.localeCompare(turnoB);
            });


            return aTreeData;
        },

        /**
         * Aplica filtros a la estructura jerárquica
         * Si un hijo coincide con el filtro, se incluye todo el grupo padre
         * 
         * @param {Array} aTreeData - Datos con estructura jerárquica
         * @param {Array} aFilters - Array de filtros UI5
         * @returns {Array} Datos filtrados
         */
        applyFiltersToTree: function (aTreeData, aFilters) {
            if (!aFilters || aFilters.length === 0) {
                return aTreeData;
            }
            const aFilteredGroups = [];

            aTreeData.forEach(grupo => {
                // Filtrar hijos
                const aFilteredChildren = grupo.children.filter(child => {
                    return this._matchesFilters(child, aFilters);
                });

                // Si hay hijos que coinciden, incluir el grupo
                if (aFilteredChildren.length > 0) {
                    // INI MOD TRNS #SistemaDeTurno-7
                    // El grupo filtrado tiene otra cantidad de hijos: se recalculan sus textos de filtro.
                    // Los hijos se copian para no pisar los textos del árbol original.
                    // aFilteredGroups.push({
                    //     ...grupo,
                    //     children: aFilteredChildren,
                    //     _childCount: aFilteredChildren.length
                    // });
                    const oGrupoFiltrado = {
                        ...grupo,
                        children: aFilteredChildren.map(child => ({ ...child })),
                        _childCount: aFilteredChildren.length
                    };
                    this._asignarTextosFiltro(oGrupoFiltrado);
                    aFilteredGroups.push(oGrupoFiltrado);
                    // FIN MOD TRNS #SistemaDeTurno-7
                }
            });

            return aFilteredGroups;
        },

        // INI MOD TRNS #SistemaDeTurno-7
        /**
         * Asigna al grupo y a sus hijos el texto que muestra cada celda, para usarlo
         * como filterProperty en el filtro de columna
         *
         * @param {Object} oGrupo - Nodo grupo con sus hijos en children
         */
        _asignarTextosFiltro: function (oGrupo) {
            const sTextoGrupo = oGrupo._childCount + " LLTT";

            [oGrupo].concat(oGrupo.children).forEach(oNodo => {
                oNodo._txtEstado = FormatHelper.getEstado(oNodo.Equstat) || "";
                oNodo._txtCondTrabajo = FormatHelper.getJobCond(oNodo.Jobcond) || "";
                oNodo._txtRegion = FormatHelper.getRegiones(oNodo.Werks) || "";
                oNodo._txtHoraInicio = FormatHelper.formatInitHour(oNodo.Timbeg, oNodo.Gdate) || "";
            });

            // IdLicencia: el padre muestra "N LLTT" y el hijo su Id. El hijo lleva también el texto
            // del grupo, para que al filtrar por "N LLTT" el grupo se pueda expandir (igual que Equipo)
            oGrupo._txtIdLicencia = sTextoGrupo;
            oGrupo.children.forEach(oHijo => {
                oHijo._txtIdLicencia = (oHijo.Id || "") + " " + sTextoGrupo;
            });
        },
        // FIN MOD TRNS #SistemaDeTurno-7

        /**
         * Verifica si un registro coincide con los filtros
         * 
         * @param {Object} oRecord - Registro a verificar
         * @param {Array} aFilters - Array de filtros
         * @returns {Boolean} true si coincide con todos los filtros
         */
        _matchesFilters: function (oRecord, aFilters) {
            return aFilters.every(filter => {
                const sPath = filter.sPath;
                const sOperator = filter.sOperator;
                const oValue1 = filter.oValue1;

                const recordValue = oRecord[sPath];

                switch (sOperator) {
                    case "EQ":
                        return recordValue === oValue1;
                    case "Contains":
                        return recordValue && String(recordValue).toLowerCase().includes(String(oValue1).toLowerCase());
                    case "StartsWith":
                        return recordValue && String(recordValue).startsWith(oValue1);
                    case "EndsWith":
                        return recordValue && String(recordValue).endsWith(oValue1);
                    default:
                        return true;
                }
            });
        }
    };
});