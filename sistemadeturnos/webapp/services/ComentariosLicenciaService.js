// INI MOD TRNS #SistemaDeTurno-Comentarios
// Historial de comentarios por licencia (Listado Cronológico).
// Es el único lugar que conoce el contrato con el backend (tabla Z de historial
// expuesta como LicenciaComentarioSet en Z_SCP_OPERACIONES_SRV):
//   - Claves: Empresa, Tipo, Anio, Id, ComId (GUID, lo genera el backend)
//   - GET filtrado por Empresa, Tipo, Anio e Id
//   - CREATE con Empresa, Tipo, Anio, Id, Dateturno y Texto (CHAR255); el backend completa
//     ComId, Usuario, Nombre, Fecha y Hora
// Mientras el entity set no exista en la metadata, isDisponible() devuelve false y el
// popover queda en solo lectura. Al publicarlo en SEGW se activa sin tocar el controller.
sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Filter, FilterOperator) {
    "use strict";

    const ENTITY_SET = "LicenciaComentarioSet";

    return {
        // Largo máximo del texto: Texto es CHAR255 en el backend
        // (el TextArea del popover lo respeta y crear() recorta el payload)
        MAX_TEXTO: 255,

        /**
         * Indica si el entity set de comentarios ya está publicado en el servicio
         *
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - Modelo OData principal
         * @returns {Promise<boolean>} true si existe el entity set
         */
        isDisponible: function (oModel) {
            if (!oModel || typeof oModel.metadataLoaded !== "function") {
                return Promise.resolve(false);
            }

            return oModel.metadataLoaded(true)
                .then(() => {
                    const oMetadata = oModel.getServiceMetadata && oModel.getServiceMetadata();
                    const aSchemas = (oMetadata && oMetadata.dataServices && oMetadata.dataServices.schema) || [];

                    return aSchemas.some(oSchema => (oSchema.entityContainer || []).some(
                        oContainer => (oContainer.entitySet || []).some(oSet => oSet.name === ENTITY_SET)
                    ));
                })
                .catch(() => false);
        },

        /**
         * Lee el historial de comentarios de una licencia, del más reciente al más antiguo
         *
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - Modelo OData principal
         * @param {Object} oLicencia - Clave de la licencia: Empresa, Tipo, Anio, Id
         * @returns {Promise<Array>} Comentarios con Usuario, Nombre, Fecha, Hora y Texto
         */
        leer: function (oModel, oLicencia) {
            return new Promise((resolve, reject) => {
                oModel.read("/" + ENTITY_SET, {
                    filters: [
                        new Filter("Empresa", FilterOperator.EQ, oLicencia.Empresa),
                        new Filter("Tipo", FilterOperator.EQ, oLicencia.Tipo),
                        new Filter("Anio", FilterOperator.EQ, oLicencia.Anio),
                        new Filter("Id", FilterOperator.EQ, oLicencia.Id)
                    ],
                    success: (oData) => {
                        const aComentarios = ((oData && oData.results) || []).map(oComentario => ({
                            ComId: oComentario.ComId,
                            Usuario: oComentario.Usuario || "",
                            Nombre: oComentario.Nombre || oComentario.Usuario || "",
                            Fecha: oComentario.Fecha || null,
                            Hora: oComentario.Hora || null,
                            Texto: oComentario.Texto || ""
                        }));

                        // El orden no depende de que el backend implemente $orderby
                        aComentarios.sort((a, b) => this._getMomento(b) - this._getMomento(a));
                        resolve(aComentarios);
                    },
                    error: reject
                });
            });
        },

        /**
         * Registra un comentario nuevo en la licencia
         *
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - Modelo OData principal
         * @param {Object} oLicencia - Clave de la licencia: Empresa, Tipo, Anio, Id
         * @param {string} sTexto - Texto del comentario
         * @param {Date} [oFechaTurno] - Fecha del turno desde el que se comenta (informativa)
         * @returns {Promise<Object>} Comentario creado, con los datos que completa el backend
         */
        crear: function (oModel, oLicencia, sTexto, oFechaTurno) {
            const oPayload = {
                Empresa: oLicencia.Empresa,
                Tipo: oLicencia.Tipo,
                Anio: oLicencia.Anio,
                Id: oLicencia.Id,
                // Edm.DateTime de fecha: medianoche UTC, igual que Dateturno en el resto de la app
                Dateturno: oFechaTurno instanceof Date
                    ? new Date(Date.UTC(oFechaTurno.getFullYear(), oFechaTurno.getMonth(), oFechaTurno.getDate()))
                    : null,
                Texto: String(sTexto || "").substring(0, this.MAX_TEXTO)
            };

            return new Promise((resolve, reject) => {
                oModel.create("/" + ENTITY_SET, oPayload, {
                    success: resolve,
                    error: reject
                });
            });
        },

        /**
         * Mensaje de error que devuelve Gateway, si lo hay
         *
         * @param {Object} oError - Error de la llamada OData
         * @returns {string} Mensaje del backend o "" si no se puede leer
         */
        getMensajeError: function (oError) {
            try {
                const oRespuesta = JSON.parse((oError && oError.responseText) || "{}");
                return (oRespuesta.error && oRespuesta.error.message && oRespuesta.error.message.value) || "";
            } catch (e) {
                return "";
            }
        },

        // Fecha (Edm.DateTime) + Hora (Edm.Time) en milisegundos, para ordenar
        _getMomento: function (oComentario) {
            const oFecha = oComentario.Fecha ? new Date(oComentario.Fecha) : null;
            const iFecha = oFecha && !isNaN(oFecha.getTime()) ? oFecha.getTime() : 0;
            const iHora = (oComentario.Hora && Number(oComentario.Hora.ms)) || 0;
            return iFecha + iHora;
        }
    };
});
// FIN MOD TRNS #SistemaDeTurno-Comentarios
