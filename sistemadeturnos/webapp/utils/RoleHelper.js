sap.ui.define([
    "transener/sistemadeturnos/utils/AppManagementHelper"
], function(AppManagementHelper) {
    "use strict";
    
    return {
        // Nivel 1 — Creación y edición (CRUD completo de turnos)
        // OPE00010 Programación COT / OPE00017 Programación COTDT
        ROLES_EDITOR: [
            "ope_programacion_cotdt",
            "ope_programacion_cot"
        ],

        // Nivel 2 — Visualizan full: ven todo lo que ve un editor (tabs Turno,
        // Acciones, Resumen, Gráfico) pero sin botones/acciones de edición.
        // OPE00005 Jefe COTDT / OPE00013 Jefe COT
        // "ope_jefe_cot" confirmado por consola (usuario OPE00013). "Jefe_COTDT" es la
        // convención "Nombre_Del_Rol" confirmada para otros roles (ver ROLES_BASIC_VIEWER);
        // TODO: confirmar por consola con un usuario OPE00005 real.
        ROLES_FULL_VIEWER: [
            "ope_jefe_cot",
            "Jefe_COTDT"
        ],

        // Nivel 3 — Visualizan listados cronológicos y resumen únicamente
        // Resto de roles OPE0000x. Convención confirmada por consola (3/3 casos, incluida
        // tilde): cada usuario genérico trae un tag "Nombre_Del_Rol" = nombre de la tabla,
        // espacios reemplazados por "_", acentos y mayúsculas intactos.
        // TODO: confirmar por consola los 12 restantes; el de mayor riesgo es
        // "Tramitador_(Data_entry)" por los paréntesis, poco habitual en un tag de IAS.
        ROLES_BASIC_VIEWER: [
            "Supervisor_Mantenimiento",       // OPE00001 Supervisor Mantenimiento
            "Coordinador_Mantenimiento",      // OPE00002 Coordinador Mantenimiento — confirmado
            "Ingeniería_Regulatoria",         // OPE00003 Ingeniería Regulatoria — confirmado
            "Tramitador_(Data_entry)",        // OPE00004 Tramitador (Data entry)
            "Solicitante_Licencia_COTDT",     // OPE00006 Solicitante Licencia COTDT
            "Solicitante_Licencia",           // OPE00007 Solicitante Licencia
            "Jefe_de_Trabajo",                // OPE00008 Jefe de Trabajo
            "Jefe_de_Trabajo_Suplente",       // OPE00009 Jefe de Trabajo Suplente
            "Operador_COT",                   // OPE00011 Operador COT
            "Jefe_Turno_COT",                 // OPE00012 Jefe Turno COT
            "Visualizador",                   // OPE00014 Visualizador
            "Asistencia_de_Mantenimiento",    // OPE00015 Asistencia de Mantenimiento
            "Coordinador_Mantenimiento_COTDT", // OPE00016 Coordinador Mantenimiento COTDT
            "Operador_COTDT",                 // OPE00018 Operador COTDT
            "Jefe_Turno_COTDT"                // OPE00019 Jefe Turno COTDT
        ],

        _getUserRoles: function () {
            var oUserModel = AppManagementHelper.getModel("UserJsonModel");
            return (oUserModel && oUserModel.getProperty("/roles")) || [];
        },

        _hasAny: function (aRolesToCheck) {
            var aUserRoles = this._getUserRoles();
            return aRolesToCheck.some(function (rol) {
                return aUserRoles.indexOf(rol) !== -1;
            });
        },

        // Verifica si el actual es editor (creación y edición)
        isEditor: function () {
            return this._hasAny(this.ROLES_EDITOR);
        },

        // Verifica si el actual es "visualizador full"
        isFullViewer: function () {
            return this._hasAny(this.ROLES_FULL_VIEWER);
        },

        // Verifica si el actual es "visualizador básico" (listados y resumen)
        isBasicViewer: function () {
            return this._hasAny(this.ROLES_BASIC_VIEWER);
        },

        // Editor o Full viewer: acceso a las tabs con el detalle completo del turno
        // (Turno, Acciones para la entrega), en modo edición o solo lectura según isEditor()
        canViewFullDetail: function () {
            return this.isEditor() || this.isFullViewer();
        },

        // Cualquier rol reconocido puede ver Resumen y Gráfico
        canViewResumen: function () {
            return this.isEditor() || this.isFullViewer() || this.isBasicViewer();
        },

        // O visualizador (cualquiera que no sea editor)
        isViewer: function () {
            return !this.isEditor();
        },

        // Rol a verificar
        hasRole: function (sRole) {
            return this._getUserRoles().indexOf(sRole) !== -1;
        }
    };
});