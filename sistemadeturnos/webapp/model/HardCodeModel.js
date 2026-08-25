sap.ui.define([
	"sap/ui/model/json/JSONModel"
], function (JSONModel) {
	"use strict";

	return {

		/**
		 * Obtiene o crea el modelo HardCode
		 * @returns {sap.ui.model.json.JSONModel} El modelo con datos hardcoded
		 */
		getModel: function () {
			// Obtiene el modelo del core
			let oModel = sap.ui.getCore().getModel("HardCodeModel");

			// Si no existe, lo crea
			if (!oModel) {
				oModel = new JSONModel(this.getData());
				oModel.setSizeLimit(9999);
				sap.ui.getCore().setModel(oModel, "HardCodeModel");
			}

			return oModel;
		},

		/**
		 * Obtiene todos los datos hardcoded para filtros
		 * @returns {Object} Objeto con todos los datos
		 */
		getData: function () {
			return {
				// ==================== FILTROS PRINCIPALES ====================

				EqustatCammesa: [
					{ key: "", value: "" },
					{ key: "X", value: "En Servicio" },
					{ key: "N", value: "Fuera de Servicio" }
				],

				// Bloqueo de Recierre
				Bloqueo: [
					{ key: "", value: "" },      // Vacío = sin selección
					{ key: "X", value: "SI" },   // X = Sí hay bloqueo
					{ key: "N", value: "NO" }    // N = No hay bloqueo
				],

				// Riesgo de Disparo
				Rdisparo: [
					{ key: "", value: "" },      // Vacío = sin selección
					{ key: "X", value: "SI" },   // X = Sí hay riesgo
					{ key: "N", value: "NO" }    // N = No hay riesgo (pero en el servicio viene vacío)
				],

				// ==================== FILTROS AVANZADOS ====================

				// Diario / Continuo
				Period: [
					{ key: "", value: "" },
					{ key: "D", value: "Diaria" },
					{ key: "C", value: "Continua" }
				],

				// Requiere calle de 500kV abierta
				R500KV: [
					{ key: "", value: "" },
					{ key: "Y", value: "NO CORRESPONDE" },
					{ key: "X", value: "SI" },
					{ key: "N", value: "NO" }
				],

				// Señales Afectadas (MultiComboBox)
				SenalesAfectadas: [
					{ key: "0", value: "Estados" },
					{ key: "1", value: "Alarmas" },
					{ key: "2", value: "Mediciones" },
					{ key: "4", value: "Ninguna" }
				],

				// Requiere alguna Barra F/S
				BarraFS: [
					{ key: "", value: "" },
					{ key: "X", value: "SI" },
					{ key: "N", value: "NO" }
				],

				// Estado Equipo/s a intervenir
				Equstat: [
					{
						key: "N",
						value: "" // o dejarlo vacío ""
					},
					{
						key: "",
						value: "Fuera de Servicio"
					},
					{
						key: "X",
						value: "En Servicio"
					}
				],

				// Coordinado ARO
				Aro: [
					{ key: "Z", value: "" },
					{ key: "N", value: "NO" },
					{ key: "X", value: "SI" }
				],

				// Condiciones de trabajo
				JobConditions: [
					{ key: "", value: "" },
					{ key: "01", value: "Consignación" },
					{ key: "04", value: "Trabajo con Tensión (TcT)" },
					{ key: "05", value: "Trabajo Especiales (TcT)" },
					{ key: "06", value: "Condiciones Especiales" }
				],

				// ==================== DATOS ADICIONALES ====================

				// Tipos de Licencia (ejemplo - ajustar según necesidad)
				TipoLicencia: [
					{ key: "", value: "" },
					{ key: "1", value: "Tipo 1" },
					{ key: "2", value: "Tipo 2" },
					{ key: "3", value: "Tipo 3" }
				],

				// Motivos de Observación (copiado del modelo original)
				Obscause: [
					{ key: "CAMP", value: "Modificación de otros campos" },
					{ key: "MSEG", value: "Modificación de medidas de seguridad" },
					{ key: "FECH", value: "Modificación de las fechas y horarios" }
				],

				// Motivos de No Autorización (copiado del modelo original)
				Motivono: [
					{ key: "COC", value: "Suspendida por CAMMESA" },
					{ key: "COT/COTD", value: "Suspendida por COT / COTDT" },
					{ key: "TERC", value: "Suspendida por Terceros" },
					{ key: "SOLI", value: "Suspendida por el Solicitante" },
					{ key: "COND", value: "Condiciones climaticas adversas" },
					{ key: "NOUT", value: "Dia no utilizado" }
				],

				// Tipos de Licencia para filtros
				TipoLicencia: [
					{ key: "", value: "" },
					{ key: "N", value: "Licencia Programada" },
					{ key: "EM", value: "Licencia de emergencia" },
					{ key: "TE", value: "Licencia de terceros" }
				],
			};
		}

	};
});