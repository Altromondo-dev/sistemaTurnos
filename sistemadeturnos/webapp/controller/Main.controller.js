// Cargar la librería XLSX
jQuery.sap.require("transener.sistemadeturnos.libs.xlsx");
jQuery.sap.require("transener.sistemadeturnos.libs.jszip");
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "transener/sistemadeturnos/utils/ModelHelper",
    "transener/sistemadeturnos/utils/FormatHelper",
    "transener/sistemadeturnos/utils/Utils",
    "transener/sistemadeturnos/utils/DateHelper",
    "transener/sistemadeturnos/services/LicenseService",
    "transener/sistemadeturnos/services/TurnosService",
    "transener/sistemadeturnos/services/TipoEquipoService",
    "transener/sistemadeturnos/services/InterventionTypesService",
    "transener/sistemadeturnos/model/HardCodeModel",
    "transener/sistemadeturnos/utils/TreeTableHelper",
    "transener/sistemadeturnos/services/TramitacionService",
    "transener/sistemadeturnos/utils/RoleHelper",
    "transener/sistemadeturnos/services/UserService",
    "transener/sistemadeturnos/services/EtMailService",
    "transener/sistemadeturnos/services/MailService",
    "transener/sistemadeturnos/utils/SocietyHelper"


], function (Controller, MessageToast, MessageBox, CoreLibrary, Filter, FilterOperator, JSONModel, Fragment,
    //utils
    ModelHelper, FormatHelper, Utils, DateHelper,
    //services
    LicenseService, TurnosService, TipoEquipoService, InterventionTypesService, HardCodeModel,
    TreeTableHelper, TramitacionService, RoleHelper, UserService, EtMailService, MailService,
    SocietyHelper
) {
    "use strict";
    let oDialog = null
    return Controller.extend("transener.sistemadeturnos.controller.Main", {
        formatter: FormatHelper,

        onInit: function () {
            // chartModel vacío: se puebla en _computeChartFromAcciones() cuando el usuario busca una fecha.
            var oChartModel = new sap.ui.model.json.JSONModel({ data: [] });
            this.getView().setModel(oChartModel, "chartModel");

            this._loadChartFragment();
            this.getBaseURL();
            UserService.loadModel(this.onUserLoaded.bind(this));

            this._pBusyDialog = null;
            this.getVersion();
            this.cargarModelos()
            this._suppressLicenseAlert = false;

            this._initAccionesEntregaModel();

            const oTreeModel = new JSONModel([]);
            this.getView().setModel(oTreeModel, "listCronoTreeModel");

            var oViewModel = new JSONModel({
                busy: false,
                delay: 0,
                isProgramacion: false,
                canViewResumen: false
            });
            this.getView().setModel(oViewModel, "viewModel");

            const oReporteModel = new JSONModel([]);
            this.getView().setModel(oReporteModel, "ReporteModel");

            // Cargar empresa y catálogo después de que el modelo OData esté listo
            const oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.metadataLoaded().then(() => {
                    SocietyHelper.loadSociety(this, oModel, () => {
                        this._cargarCatalogoCodigosDesdeBackend();
                    });
                });
            }
        },

        getBaseURL: function () {
            var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");

            // Guardar el appId en un modelo por si se necesita
            var appModel = new JSONModel();
            appModel.setData(appId);
            sap.ui.getCore().setModel(appModel, "appId");

            // Construir el path del módulo
            var appPath = appId.replaceAll(".", "/");
            var appModulePath = jQuery.sap.getModulePath(appPath);

            // Crear o actualizar el modelo appCurrentInfo
            var jsonModel = sap.ui.getCore().getModel("appCurrentInfo");
            if (!jsonModel) {
                jsonModel = new JSONModel();
                jsonModel.setSizeLimit(9999);
                sap.ui.getCore().setModel(jsonModel, "appCurrentInfo");
            }

            // Setear la URL en el modelo
            jsonModel.setData({
                appUrl: appModulePath
            });
            return appModulePath;
        },

        onUserLoaded: function () {

            // aplicar permisos basados en roles
            this._aplicarPermisosPorRol();
        },

        // Aplica permisos de visualización/edición según el rol del usuario

        _aplicarPermisosPorRol: function () {
            var bEsEditor = RoleHelper.isEditor();
            var bCanViewFullDetail = RoleHelper.canViewFullDetail();
            var bCanViewResumen = RoleHelper.canViewResumen();

            // Botón Crear Solicitud
            var btnCrear = this.byId("btnCrearSolicitud");
            if (btnCrear) {
                btnCrear.setVisible(bEsEditor);
                btnCrear.setEnabled(bEsEditor);
            }

            // Botón Guardar
            var btnGuardar = this.byId("btnGuardar");
            if (btnGuardar) {
                btnGuardar.setVisible(bEsEditor);
                btnGuardar.setEnabled(bEsEditor);
            }

            // Botón Enviar
            var btnEnviar = this.byId("btnEnviar");
            if (btnEnviar) {
                btnEnviar.setVisible(bEsEditor);
                btnEnviar.setEnabled(bEsEditor);
            }

            // Botón Editar
            var btnEditar = this.byId("btnEditar");
            if (btnEditar) {
                btnEditar.setVisible(bEsEditor);
                btnEditar.setEnabled(bEsEditor);
            }

            // Botón Eliminar
            var btnEliminar = this.byId("btnEliminar");
            if (btnEliminar) {
                btnEliminar.setVisible(bEsEditor);
                btnEliminar.setEnabled(bEsEditor);
            }

            // === COLUMNAS DE LA TABLA ===
            // Columna Comentarios
            var colComentarios = this.byId("colComentarios");
            if (colComentarios) {
                colComentarios.setVisible(bEsEditor);
            }

            // Columna Adjuntar
            var colAdjuntar = this.byId("colAdjuntar");
            if (colAdjuntar) {
                colAdjuntar.setVisible(bEsEditor);
            }

            // Columna Horario Turno
            var colHorarioTurno = this.byId("colHorarioTurno");
            if (colHorarioTurno) {
                colHorarioTurno.setVisible(bEsEditor);
            }

            // Columna Agregar Licencias (botón +)
            var colAgregarLicencias = this.byId("colAgregarLic");
            if (colAgregarLicencias) {
                colAgregarLicencias.setVisible(bEsEditor);
            }

            // === CAMPOS DE INPUTS
            // Input Instalación
            var inputInstalacion = this.byId("inputInstalacion");
            if (inputInstalacion) {
                inputInstalacion.setEditable(bEsEditor);
            }

            // Input Equipo
            var inputEquipo = this.byId("inputEquipo");
            if (inputEquipo) {
                inputEquipo.setEditable(bEsEditor);
            }

            // Input Trabajos a Realizar
            var inputTrabajos = this.byId("inputTrabajos");
            if (inputTrabajos) {
                inputTrabajos.setEditable(bEsEditor);
            }

            // DateTimePicker Inicio Programado
            var dtpInicioProg = this.byId("dtpInicioProgramado");
            if (dtpInicioProg) {
                dtpInicioProg.setEditable(bEsEditor);
            }

            // DateTimePicker Fin Programado
            var dtpFinProg = this.byId("dtpFinProgramado");
            if (dtpFinProg) {
                dtpFinProg.setEditable(bEsEditor);
            }

            // Select Empresa
            var selectEmpresa = this.byId("selectEmpresa");
            if (selectEmpresa) {
                selectEmpresa.setEnabled(bEsEditor);
            }

            // Select Categoría Licencia
            var selectCategoria = this.byId("selectCategoriaLicencia");
            if (selectCategoria) {
                selectCategoria.setEnabled(bEsEditor);
            }

            // Select Área Solicitante
            var selectAreaSolic = this.byId("selectAreaSolicitante");
            if (selectAreaSolic) {
                selectAreaSolic.setEnabled(bEsEditor);
            }

            // Checkbox Requiere PAT
            var chkPAT = this.byId("chkRequierePAT");
            if (chkPAT) {
                chkPAT.setEnabled(bEsEditor);
            }

            // Visibilidad de tabs según rol:
            // - isProgramacion: tabs de detalle completo (Turno, Acciones para la entrega) →
            //   Editor y Full viewer (el modo edición/lectura de cada campo ya lo define bEsEditor arriba)
            // - canViewResumen: tabs Resumen y Gráfico → Editor, Full viewer y Basic viewer
            var oViewModel = this.getView().getModel("viewModel");
            if (oViewModel) {
                oViewModel.setProperty("/isProgramacion", bCanViewFullDetail);
                oViewModel.setProperty("/canViewResumen", bCanViewResumen);
            }

            // Si tiene acceso al detalle completo, seleccionar la tab de Turno por defecto
            if (bCanViewFullDetail) {
                var oIconTabBar = this.byId("mainTabBar");
                if (oIconTabBar) {
                    oIconTabBar.setSelectedKey("LIC");
                }
            }
        },
        // ----------------------------------- TURNOS EDITABLES ----------------------------------------
        _updateEditableState: function () {
            const oView = this.getView();
            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();
            const bIsEditable = this._isEditableTurno(oFechaTurno);

            // Crear o actualizar modelo de habilitación para la UI
            let oEditableModel = oView.getModel("editableModel");
            if (!oEditableModel) {
                oEditableModel = new JSONModel({ isEditable: bIsEditable });
                oView.setModel(oEditableModel, "editableModel");
            } else {
                oEditableModel.setProperty("/isEditable", bIsEditable);
            }
        },
        //---------------------------------------------------------------------------------------------
        // ------------------------------------ Acciones para la entrega ------------------------------------------------------
        _initAccionesEntregaModel: function () {
            const oView = this.getView();

            const oAccionesModel = new JSONModel([]);
            oView.setModel(oAccionesModel, "AccionesEntregaModel");

            const oAccionesTreeModel = new JSONModel([]);
            oView.setModel(oAccionesTreeModel, "accionesTreeModel");
        },

        _buildAccionesTreeModel: function () {
            const oView = this.getView();
            const aAcciones = oView.getModel("AccionesEntregaModel").getData() || [];

            const mGrupos = {};

            aAcciones.forEach(function (accion) {
                const sKey = accion.idLicencia || accion.equipo || "";

                if (!mGrupos[sKey]) {
                    mGrupos[sKey] = {
                        _isGroup: true,
                        idLicencia: accion.idLicencia || "",
                        equipo: accion.equipo || "",
                        _childCount: 0,
                        children: []
                    };
                }

                mGrupos[sKey].children.push(Object.assign({}, accion, { _isGroup: false }));
                mGrupos[sKey]._childCount++;
            });

            // Calcular flags de adjuntos en nodos padre a partir de sus hijos
            const aGrupos = Object.values(mGrupos);
            aGrupos.forEach(function (grupo) {
                const aHijos = grupo.children || [];
                grupo._tieneAdjuntosHijos = aHijos.some(function (h) {
                    return h.Attachments && h.Attachments.length > 0;
                });
                grupo._totalAdjuntosHijos = aHijos.reduce(function (acc, h) {
                    return acc + ((h.Attachments && h.Attachments.length) || 0);
                }, 0);
            });

            oView.getModel("accionesTreeModel").setData(aGrupos);
        },

        onOpenAccionEntregaPopover: function (oEvent) {
            const oMenuItem = oEvent.getSource();
            const oView = this.getView();
            const oTable = this.byId("turnosTable");

            let oBindingContext = null;

            // Intento 1: Desde el source (MenuItem)
            oBindingContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            // Intento 2: Desde el parent (Context Menu)
            // Obtener el contexto de la fila (licencia) desde el MenuItem
            oBindingContext = oMenuItem.getBindingContext("LicencesJsonModel");
            if (!oBindingContext) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                if (oContextMenu) {
                    oBindingContext = oContextMenu.getBindingContext("LicencesJsonModel");
                }
            }

            // Intento 3: Desde el path del context menu (como onDeletePress)
            if (!oBindingContext) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                if (oContextMenu && oContextMenu.getBindingContext("LicencesJsonModel")) {
                    const sPath = oContextMenu.getBindingContext("LicencesJsonModel").getPath();
                    const iIndex = parseInt(sPath.split("/").pop());

                    if (!isNaN(iIndex)) {
                        oBindingContext = oTable.getContextByIndex(iIndex);
                    }
                }
            }

            // Intento 4: Fallback a índice seleccionado
            if (!oBindingContext) {
                const iSelectedIndex = oTable.getSelectedIndex();
                if (iSelectedIndex >= 0) {
                    oBindingContext = oTable.getContextByIndex(iSelectedIndex);
                }
            }

            if (!oBindingContext) {
                MessageToast.show("No se pudo obtener el contexto de la fila. Por favor, seleccione una fila.");
                return;
            }

            const oLicencia = oBindingContext.getObject();

            // Guardar referencia
            this._currentLicenciaEntrega = oLicencia;
            this._currentBindingContextEntrega = oBindingContext;

            // Destruir popover anterior si existe
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.destroy();
                this._oAccionEntregaPopover = null;
            }

            // Cargar fragment
            Fragment.load({
                id: oView.getId(),
                name: "transener.sistemadeturnos.fragments.ComboPopover",
                controller: this
            }).then(function (oPopover) {
                this._oAccionEntregaPopover = oPopover;
                oView.addDependent(oPopover);

                // Inicializar checkboxes según acciones ya seleccionadas
                this._initializeCheckBoxesEntrega();

                // Buscar la fila visual que corresponde al binding context
                const aRows = oTable.getRows();
                let oTargetRow = null;

                for (let i = 0; i < aRows.length; i++) {
                    const oRowContext = aRows[i].getBindingContext("LicencesJsonModel");
                    if (oRowContext && oRowContext.getPath() === oBindingContext.getPath()) {
                        oTargetRow = aRows[i];
                        break;
                    }
                }

                // Abrir el popover
                if (oTargetRow && oTargetRow.getDomRef()) {
                    oPopover.openBy(oTargetRow);
                } else {
                    // Fallback: usar la tabla
                    oPopover.openBy(oTable);
                }

                // Obtener la fila de la tabla desde el binding context
                var oRow = this._getTableRowFromBindingContext(oBindingContext);
                var oTarget = oRow || oMenuItem;
                oPopover.openBy(oTarget);
            }.bind(this));
        },

        _getTableRowFromControl: function (oControl) {
            var oRow = oControl;
            // Buscar el padre hasta encontrar la fila (sap.ui.table.Row)
            while (oRow && !(oRow instanceof sap.ui.table.Row)) {
                oRow = oRow.getParent();
                // Protección contra loops infinitos
                if (!oRow || oRow === oControl) {
                    break;
                }
            }
            return oRow instanceof sap.ui.table.Row ? oRow : null;
        },

        _getTableRowFromBindingContext: function (oBindingContext) {
            if (!oBindingContext) {
                return null;
            }

            // Obtener la tabla
            var oTable = this.byId("turnosTable");
            if (!oTable) {
                return null;
            }

            // Obtener el path del binding context
            var sPath = oBindingContext.getPath();

            // Obtener todas las filas de la tabla
            var aRows = oTable.getRows();

            // Buscar la fila que tiene el mismo binding context
            for (var i = 0; i < aRows.length; i++) {
                var oRow = aRows[i];
                var oRowContext = oRow.getBindingContext("LicencesJsonModel");
                if (oRowContext && oRowContext.getPath() === sPath) {
                    return oRow;
                }
            }

            return null;
        },

        _initializeCheckBoxesEntrega: function () {
            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            // Obtener todas las acciones ya guardadas para esta licencia
            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            const aAcciones = oAccionesModel.getData();
            const aAccionesLicencia = aAcciones.filter(a => a.idLicencia === oLicencia.Id);

            // Array de códigos ya seleccionados
            const aCodigosSeleccionados = aAccionesLicencia.map(a => a.accion);

            this._accionesSeleccionadasTemp = {};

            setTimeout(() => {
                // Obtener el List del popover
                const oList = this.byId("listaAccionesEntrega");

                if (!oList) {
                    return;
                }

                // Recorrer los items del List (que son los CustomListItem generados dinámicamente)
                const aItems = oList.getItems();

                aItems.forEach(oItem => {
                    // Dentro de cada CustomListItem hay un CheckBox
                    const oCheckBox = oItem.getContent()[0];

                    if (oCheckBox && oCheckBox.isA("sap.m.CheckBox")) {
                        const sKey = oCheckBox.data("key");
                        const sDescripcion = oCheckBox.data("descripcion");

                        // Verificar si este código está en los ya seleccionados
                        const bSelected = aCodigosSeleccionados.includes(sKey);
                        oCheckBox.setSelected(bSelected);

                        // Si está seleccionado, agregarlo al objeto temporal
                        if (bSelected) {
                            this._accionesSeleccionadasTemp[sKey] = {
                                codigo: sKey,
                                descripcion: sDescripcion
                            };
                        }
                    }
                });

            }, 100);
        },

        formatCodigoAccion: function (sCodigo, sAccion) {
            if (!sCodigo) return "";
            if (!sAccion) return sCodigo;
            return sCodigo + " - " + sAccion;
        },

        onCheckBoxSelectEntrega: function (oEvent) {
            const oCheckBox = oEvent.getSource();
            const sKey = oCheckBox.data("key");
            const sDescripcion = oCheckBox.data("descripcion");
            const bSelected = oCheckBox.getSelected();

            if (!sKey) {
                MessageToast.show("Error: Configuración incorrecta del checkbox");
                return;
            }

            // Asegurar que existe el objeto temporal
            if (!this._accionesSeleccionadasTemp) {
                this._accionesSeleccionadasTemp = {};
            }

            if (bSelected) {
                this._accionesSeleccionadasTemp[sKey] = {
                    codigo: sKey,
                    descripcion: sDescripcion
                };
            } else {
                delete this._accionesSeleccionadasTemp[sKey];
            }
        },

        onGuardarAccionesBackend: function () {
            const oAccionesModel = this.getView().getModel("AccionesEntregaModel");
            const aTodasLasAcciones = oAccionesModel.getData() || [];

            if (aTodasLasAcciones.length === 0) {
                this.hideGlobalBusy();
                MessageToast.show("No hay acciones para guardar");
                return;
            }

            const aAccionesSinTurno = aTodasLasAcciones.filter(acc =>
                !acc.turnoEntrega || acc.turnoEntrega.trim() === ""
            );

            if (aAccionesSinTurno.length > 0) {
                this.hideGlobalBusy();
                MessageBox.warning(
                    `Hay ${aAccionesSinTurno.length} acción(es) sin turno de entrega.`,
                    { title: "Turnos sin asignar" }
                );
                return;
            }

            this.showGlobalBusy("Guardando cambios...");

            // 🆕 USAR FUNCIÓN OPTIMIZADA EN LUGAR DE _verificarAccionesExistentes
            this._saveAccionesEnBackendOptimizado(aTodasLasAcciones)
                .then(() => {
                    this.hideGlobalBusy();

                    // Refrescar modelo
                    const oView = this.getView();
                    const oAccionesModel = oView.getModel("AccionesEntregaModel");
                    oAccionesModel.refresh();

                    MessageToast.show("Cambios guardados correctamente");
                })
                .catch((error) => {
                    this.hideGlobalBusy();

                    if (error !== "skip") {
                        let sErrorMsg = "Error al guardar las acciones";

                        if (error.responseText) {
                            try {
                                const errorObj = JSON.parse(error.responseText);
                                if (errorObj.error && errorObj.error.message) {
                                    sErrorMsg = errorObj.error.message.value || sErrorMsg;
                                }
                            } catch (e) {
                                console.error("No se pudo parsear responseText");
                            }
                        }

                        MessageBox.error(sErrorMsg);
                    }
                });
        },

        onGuardarAccionesEntrega: function () {
            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            if (!oLicencia) {
                MessageToast.show("Error: No se pudo obtener la licencia");
                return;
            }

            const oAccionesTemp = this._accionesSeleccionadasTemp || {};
            const aCodigosSeleccionados = Object.keys(oAccionesTemp);

            if (aCodigosSeleccionados.length === 0) {
                MessageToast.show("Debe seleccionar al menos una acción");
                return;
            }

            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            let aAcciones = oAccionesModel.getData();

            // ✅ NUEVO: Eliminar acciones previas que contengan cualquier ID del grupo actual
            const sIdsGrupo = this._getIdsDelGrupo(oLicencia);
            const aIdsGrupoArray = sIdsGrupo.split(" / ").map(id => id.trim());

            aAcciones = aAcciones.filter(a => {
                const sIdLicencia = a.idLicencia || "";
                const aIdsAccion = sIdLicencia.split(" / ").map(id => id.trim());

                // Si hay intersección entre los IDs del grupo y los IDs de la acción, eliminarla
                const bTieneInterseccion = aIdsAccion.some(id => aIdsGrupoArray.includes(id));
                return !bTieneInterseccion;
            });

            aCodigosSeleccionados.forEach(sCodigo => {
                const sDescripcionLarga = this._getDescripcionDesdeCategologo(sCodigo);

                // 🆕 CALCULAR HORARIO AUTOMÁTICAMENTE
                const sTurnoBase = oLicencia.TurnoAsignado || "";
                const sTurnoCalculado = this._calcularHorarioAccion(sCodigo, oLicencia, sTurnoBase);

                console.log(`📋 Agregando acción ${sCodigo} con turno calculado: ${sTurnoCalculado}`);

                aAcciones.push({
                    accion: sCodigo,
                    descripcion: oAccionesTemp[sCodigo].descripcion,
                    descripcionLarga: sDescripcionLarga,
                    idLicencia: sIdsGrupo,
                    idLicenciaOriginal: oLicencia.Id,
                    equipo: oLicencia.Equnr,
                    equipoCompleto: oLicencia.EquipoCompleto || oLicencia.Equnr,
                    trabajoRealizar: sDescripcionLarga || oLicencia.Comments || "Sin descripción",
                    turnoEntrega: sTurnoCalculado,
                    estado: oLicencia.Licstat || "",
                    condicion: oLicencia.Jobcond || "",
                    equstat: oLicencia.Equstat || "A",
                    empresa: oLicencia.Empresa || "100",
                    tipo: oLicencia.Tipo || "L",
                    anio: oLicencia.Anio || new Date().getFullYear().toString(),
                    period: oLicencia.Period || "",
                    dateturno: oLicencia.Dateturno || null,
                    _licenciaId: oLicencia.Id,
                    _estadoGuardado: false,  // 🆕 AGREGAR ESTA LÍNEA
                    Attachments: []
                });
            });

            const aAccionesOrdenadas = this._ordenarAccionesPorGrupoYHora(aAcciones);
            oAccionesModel.setData(aAccionesOrdenadas);
            this._buildAccionesTreeModel();

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const sPath = this._currentBindingContextEntrega.getPath();
            oLicencesModel.setProperty(sPath + "/accionSeleccionada", true);

            MessageToast.show(`${aCodigosSeleccionados.length} acción(es) guardada(s) para ${sIdsGrupo}`);

            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        _ordenarAccionesPorGrupoYHora: function (aAcciones) {
            if (!aAcciones || aAcciones.length === 0) {
                return aAcciones;
            }

            console.log("📋 Ordenando acciones por grupo y hora...");
            console.log("   Total acciones a ordenar:", aAcciones.length);

            // Función helper para normalizar el grupo (ordenar los IDs alfabéticamente)
            const normalizarGrupo = function (sGrupo) {
                if (!sGrupo) return "";

                // Separar los IDs, ordenarlos y volver a unir
                const aIds = sGrupo.split(" / ").map(id => id.trim()).sort();
                return aIds.join(" / ");
            };

            return aAcciones.sort((a, b) => {
                // 1. Normalizar y ordenar por grupo (idLicencia)
                const grupoA = normalizarGrupo(a.idLicencia || "");
                const grupoB = normalizarGrupo(b.idLicencia || "");

                if (grupoA !== grupoB) {
                    const resultado = grupoA.localeCompare(grupoB);
                    console.log(`   Comparando grupos: "${grupoA}" vs "${grupoB}" = ${resultado}`);
                    return resultado;
                }

                // 2. Dentro del mismo grupo, ordenar por hora (turnoEntrega)
                const horaA = a.turnoEntrega || "00:00";
                const horaB = b.turnoEntrega || "00:00";

                console.log(`   Mismo grupo "${grupoA}": comparando horas "${horaA}" vs "${horaB}"`);

                // Manejar formato de hora correctamente
                const partsA = horaA.split(":");
                const partsB = horaB.split(":");

                const horasA = parseInt(partsA[0], 10) || 0;
                const minutosA = parseInt(partsA[1], 10) || 0;

                const horasB = parseInt(partsB[0], 10) || 0;
                const minutosB = parseInt(partsB[1], 10) || 0;

                const totalMinutosA = (horasA * 60) + minutosA;
                const totalMinutosB = (horasB * 60) + minutosB;

                const resultadoHora = totalMinutosA - totalMinutosB;
                console.log(`      ${horaA} (${totalMinutosA} min) vs ${horaB} (${totalMinutosB} min) = ${resultadoHora}`);

                return resultadoHora;
            });
        },

        _verificarAccionesExistentes: function (aAcciones) {
            return new Promise((resolve) => {
                const oDataService = this.getView().getModel();
                const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

                if (!oFechaTurno) {
                    resolve({ acciones: aAcciones, timestamp: null });
                    return;
                }

                const year = oFechaTurno.getFullYear();
                const month = oFechaTurno.getMonth();
                const day = oFechaTurno.getDate();
                const timestampMs = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).getTime();
                const odataTimestamp = `/Date(${timestampMs})/`;

                const sEmpresa = SocietyHelper.getCurrentSociety(this.getView());
                const aFilters = [
                    new Filter("Dateturno", FilterOperator.EQ, new Date(timestampMs)),
                    new Filter("Empresa", FilterOperator.EQ, sEmpresa)
                ];

                oDataService.read("/CatalogoEntregaSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const setExistentes = new Set();
                        (oData.results || []).forEach(item => {
                            setExistentes.add(`${item.Id}_${item.Codigo}`);
                        });

                        const aAccionesNoGuardadas = aAcciones.filter(accion => {
                            const key = `${accion.idLicencia}_${accion.accion}`;
                            const yaExiste = setExistentes.has(key);

                            // Si tiene adjuntos, SIEMPRE guardar
                            if (accion.Attachments && accion.Attachments.length > 0) {
                                return true;
                            }

                            // Si NO tiene adjuntos, verificar si ya existe
                            return !yaExiste;
                        });

                        resolve({
                            acciones: aAccionesNoGuardadas,
                            timestamp: odataTimestamp
                        });
                    },
                    error: () => {
                        resolve({
                            acciones: aAcciones,
                            timestamp: odataTimestamp
                        });
                    }
                });
            });
        },

        _restarUnaHora: function (sTime) {
            if (!sTime || typeof sTime !== 'string') {
                return "00:00";
            }

            // Extraer horas y minutos
            const aParts = sTime.split(":");
            if (aParts.length !== 2) {
                return "00:00";
            }

            let iHoras = parseInt(aParts[0], 10);
            const iMinutos = parseInt(aParts[1], 10);

            // Restar una hora
            iHoras = iHoras - 1;

            // Si es negativo, ajustar a 23 (día anterior)
            if (iHoras < 0) {
                iHoras = 23;
            }

            // Formatear con ceros a la izquierda
            const sHorasFormateadas = iHoras.toString().padStart(2, "0");
            const sMinutosFormateados = iMinutos.toString().padStart(2, "0");

            return `${sHorasFormateadas}:${sMinutosFormateados}`;
        },

        onTurnoEntregaChange: function (oEvent) {
            const oTimePicker = oEvent.getSource();
            const sNewValue = oEvent.getParameter("value");

            if (!sNewValue || !/^\d{2}:\d{2}$/.test(sNewValue)) {
                MessageToast.show("Formato de hora inválido. Use HH:mm");
                return;
            }

            const oContext = oTimePicker.getBindingContext("AccionesEntregaModel");
            const sAccion = oContext ? oContext.getProperty("accion") : "";

            const aAccionesFinalizacion = ["FIN MAN", "FIN LT", "RET PAT", "MAN PES", "PES"];

            if (aAccionesFinalizacion.includes(sAccion)) {
                MessageBox.warning(
                    `Modificaste el horario de la acción "${sAccion}" a las ${sNewValue} hs.\n\nRecordá que:\n• FIN LT siempre debe ser mayor que FIN MAN.\n• RET PAT, MAN PES y PES nunca pueden ser menores que FIN MAN.`,
                    {
                        title: "Advertencia - Horario de finalización modificado",
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK
                    }
                );
            } else {
                MessageBox.warning(
                    `Modificaste el horario de la acción "${sAccion}" a las ${sNewValue} hs.\n\nRevisá que el orden cronológico del turno siga siendo coherente antes de guardar.`,
                    {
                        title: "Advertencia - Horario modificado",
                        actions: [MessageBox.Action.OK],
                        emphasizedAction: MessageBox.Action.OK
                    }
                );
            }
        },

        onCerrarPopoverEntrega: function () {

            // Limpiar temporal
            this._accionesSeleccionadasTemp = {};

            // Cerrar popover
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        onSelectAccionEntrega: function (sAccion) {

            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            if (!oLicencia) {
                return;
            }


            const sDescripcionLarga = this._getDescripcionDesdeCategologo(accionRow.accion);
            // Crear objeto con los datos a guardar
            const oAccionData = {
                accion: sAccion,
                equipo: oLicencia.Equnr,
                idLicencia: oLicencia.Id,
                trabajoRealizar: sDescripcionLarga || accionRow.trabajoRealizar || "Sin descripción",
                turno: oLicencia.TurnoAsignado || "Sin turno",
                estado: oLicencia.Licstat || "",
                condicion: oLicencia.Jobcond || "",
                _licenciaId: oLicencia.Id
            };

            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            const aAcciones = oAccionesModel.getData();

            const iExistingIndex = aAcciones.findIndex(a => a.idLicencia === oLicencia.Id);

            if (iExistingIndex >= 0) {
                aAcciones[iExistingIndex] = oAccionData;
                MessageToast.show(`Acción actualizada a "${sAccion}" para ${oLicencia.Id}`);
            } else {
                aAcciones.push(oAccionData);
                MessageToast.show(`Acción "${sAccion}" agregada para ${oLicencia.Id}`);
            }

            oAccionesModel.setData(aAcciones);

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const sPath = this._currentBindingContextEntrega.getPath();
            oLicencesModel.setProperty(sPath + "/accionSeleccionada", true);

            // Cerrar popover
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        onSelectAccion: function (sAccion) {
            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            if (!oLicencia) {
                MessageToast.show("Error: No se pudo obtener la licencia");
                return;
            }


            const sDescripcionLarga = this._getDescripcionDesdeCategologo(sCodigo);
            // Crear objeto con los datos a guardar
            const oAccionData = {
                accion: sAccion,
                equipo: oLicencia.Equnr,
                idLicencia: oLicencia.Id,
                trabajoRealizar: sDescripcionLarga || oLicencia.Comments || "Sin descripción",
                turno: oLicencia.TurnoAsignado || "Sin turno",
                estado: oLicencia.Licstat || "",
                condicion: oLicencia.conditionWork || "",
                _licenciaId: oLicencia.Id
            };

            // Agregar al modelo de acciones
            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            if (!oAccionesModel) {
                MessageToast.show("Error: Modelo no encontrado");
                return;
            }

            const aAcciones = oAccionesModel.getData();
            const iExistingIndex = aAcciones.findIndex(a => a.idLicencia === oLicencia.Id);

            if (iExistingIndex >= 0) {
                aAcciones[iExistingIndex] = oAccionData;
                MessageToast.show(`Acción actualizada a "${sAccion}"`);
            } else {
                aAcciones.push(oAccionData);
                MessageToast.show(`Acción "${sAccion}" agregada`);
            }

            oAccionesModel.setData(aAcciones);

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const sPath = this._currentBindingContextEntrega.getPath();
            oLicencesModel.setProperty(sPath + "/accionSeleccionada", true);

            // Cerrar popover
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        onRemoveAccionEntrega: function (oEvent) {
            const oButton = oEvent.getSource();
            const oView = this.getView();
            const oBindingContext = oButton.getBindingContext("AccionesEntregaModel");

            if (!oBindingContext) {
                MessageToast.show("No se pudo obtener el contexto de la acción");
                return;
            }

            const oAccion = oBindingContext.getObject();
            const iIndex = parseInt(oBindingContext.getPath().split("/")[1]);
            const aIdsDelGrupo = oAccion.idLicencia.split(" / ").map(id => id.trim());

            console.log("🗑️ Intentando eliminar acción:", oAccion);

            // 🆕 VERIFICAR SI EXISTE EN BACKEND consultando el primero del grupo
            this.showGlobalBusy("Verificando acción...");

            const oDataModel = this.getView().getModel();
            const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

            if (!oFechaTurno) {
                this.hideGlobalBusy();
                MessageBox.error("No se pudo obtener la fecha del turno");
                return;
            }

            const year = oFechaTurno.getFullYear();
            const month = oFechaTurno.getMonth();
            const day = oFechaTurno.getDate();
            const oFechaUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

            // Verificar si existe consultando la primera licencia del grupo
            const sKeyPrimeraLicencia = oDataModel.createKey("/CatalogoEntregaSet", {
                Empresa: oAccion.empresa || "100",
                Codigo: oAccion.accion,
                Id: aIdsDelGrupo[0],
                Tipo: oAccion.tipo || "L",
                Anio: oAccion.anio || new Date().getFullYear().toString(),
                Dateturno: oFechaUTC
            });

            oDataModel.read(sKeyPrimeraLicencia, {
                success: (oData) => {
                    this.hideGlobalBusy();
                    console.log("   ✅ Acción existe en backend - usar $batch");

                    // Existe en backend → Confirmar y eliminar con $batch
                    MessageBox.confirm(
                        `¿Eliminar esta acción para TODAS las licencias del grupo?\n\n${oAccion.idLicencia}`,
                        {
                            title: "Confirmar eliminación",
                            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                            emphasizedAction: MessageBox.Action.OK,
                            styleClass: "sapUiSizeCompact",
                            onClose: (sAction) => {
                                if (sAction === MessageBox.Action.OK) {
                                    this._eliminarAccionConBatch(oAccion, aIdsDelGrupo, iIndex);
                                }
                            }
                        }
                    );
                },
                error: (oError) => {
                    this.hideGlobalBusy();

                    // 🆕 Manejar TANTO 400 como 404 (ambos significan "no existe")
                    const statusCode = oError.statusCode?.toString() || "";
                    const bNoExiste = statusCode === "404" || statusCode === "400" ||
                        oError.statusCode === 404 || oError.statusCode === 400;

                    if (bNoExiste) {
                        console.log("   ℹ️ Acción NO existe en backend (error " + statusCode + ") - eliminar solo del modelo");

                        // NO existe en backend → Eliminar solo del modelo local
                        MessageBox.confirm(
                            `¿Eliminar la acción "${oAccion.accion}" (sin guardar)?`,
                            {
                                title: "Confirmar eliminación",
                                onClose: (sAction) => {
                                    if (sAction === MessageBox.Action.OK) {
                                        const oAccionesModel = oView.getModel("AccionesEntregaModel");
                                        let aAcciones = oAccionesModel.getData();

                                        aAcciones.splice(iIndex, 1);
                                        const aAccionesOrdenadas = this._ordenarAccionesPorGrupoYHora(aAcciones);
                                        oAccionesModel.setData(aAccionesOrdenadas);
                                        this._buildAccionesTreeModel();

                                        MessageToast.show("Acción eliminada");
                                    }
                                }
                            }
                        );
                    } else {
                        // Otro error
                        console.error("❌ Error verificando acción:", oError);
                        MessageBox.error("Error al verificar la acción: " + (oError.message || "Error desconocido"));
                    }
                }
            });
        },

        _eliminarAccionConBatch: function (oAccion, aIdsDelGrupo, iIndex) {
            const oDataModel = this.getView().getModel();
            const oView = this.getView();
            const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

            if (!oFechaTurno) {
                MessageBox.error("No se pudo obtener la fecha del turno");
                return;
            }

            // Normalizar fecha a UTC 00:00:00
            const year = oFechaTurno.getFullYear();
            const month = oFechaTurno.getMonth();
            const day = oFechaTurno.getDate();
            const oFechaUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

            console.log(`🗑️ Eliminando acción ${oAccion.accion} para ${aIdsDelGrupo.length} licencias con $batch`);

            this.showGlobalBusy("Eliminando acción...");

            // Configurar $batch
            oDataModel.setUseBatch(true);
            const sGroupId = "deleteAccionesGroup_" + Date.now();
            oDataModel.setDeferredGroups([sGroupId]);

            // Crear operaciones DELETE para cada licencia del grupo
            aIdsDelGrupo.forEach(sIdLicencia => {
                const sKey = oDataModel.createKey("/CatalogoEntregaSet", {
                    Empresa: oAccion.empresa || "100",
                    Codigo: oAccion.accion,
                    Id: sIdLicencia,
                    Tipo: oAccion.tipo || "L",
                    Anio: oAccion.anio || new Date().getFullYear().toString(),
                    Dateturno: oFechaUTC
                });

                console.log(`   🗑️ DELETE: ${sKey}`);

                oDataModel.remove(sKey, {
                    groupId: sGroupId
                });
            });

            // Ejecutar $batch
            oDataModel.submitChanges({
                groupId: sGroupId,
                success: (oData) => {
                    this.hideGlobalBusy();
                    console.log("✅ Eliminación exitosa:", oData);

                    // Eliminar del modelo local
                    const oAccionesModel = oView.getModel("AccionesEntregaModel");
                    let aAcciones = oAccionesModel.getData();

                    aAcciones.splice(iIndex, 1);
                    const aAccionesOrdenadas = this._ordenarAccionesPorGrupoYHora(aAcciones);
                    oAccionesModel.setData(aAccionesOrdenadas);
                    this._buildAccionesTreeModel();

                    // Verificar si quedan más acciones para cualquier licencia del grupo
                    const sIdOriginal = oAccion.idLicenciaOriginal || oAccion._licenciaId;
                    const bTieneAcciones = aAcciones.some(a => {
                        const sIdLicencia = a.idLicencia || "";
                        const aIds = sIdLicencia.split(" / ").map(id => id.trim());
                        return aIds.includes(sIdOriginal);
                    });

                    if (!bTieneAcciones) {
                        const oLicencesModel = oView.getModel("LicencesJsonModel");
                        const aLicencias = oLicencesModel.getData();
                        const oLicencia = aLicencias.find(lic => lic.Id === sIdOriginal);

                        if (oLicencia) {
                            oLicencia.accionSeleccionada = false;
                            oLicencesModel.refresh();
                        }
                    }

                    MessageToast.show(`Acción eliminada para ${aIdsDelGrupo.length} licencia(s)`);
                },
                error: (oError) => {
                    this.hideGlobalBusy();
                    console.error("❌ Error al eliminar con $batch:", oError);

                    let sErrorMsg = "Error al eliminar la acción del backend";

                    if (oError.responseText) {
                        try {
                            const oErrorData = JSON.parse(oError.responseText);
                            sErrorMsg = oErrorData.error.message.value || sErrorMsg;
                        } catch (e) {
                            console.error("Error parseando respuesta:", e);
                        }
                    }

                    // Si el error es 404 (no existe), eliminar del modelo local de todas formas
                    const bNoEncontrado = oError.statusCode === "404" || oError.statusCode === 404;
                    if (bNoEncontrado) {
                        const oAccionesModel = oView.getModel("AccionesEntregaModel");
                        let aAcciones = oAccionesModel.getData();
                        aAcciones.splice(iIndex, 1);
                        oAccionesModel.setData(aAcciones);
                        MessageToast.show("Acción eliminada");
                    } else {
                        MessageBox.error(sErrorMsg);
                    }
                }
            });
        },

        _limpiarAccionesEntrega: function () {
            const oView = this.getView();

            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            if (oAccionesModel) {
                const aAcciones = oAccionesModel.getData();
                const iAccionesAnteriores = Array.isArray(aAcciones) ? aAcciones.length : 0;
                oAccionesModel.setData([]);
            }

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            if (oLicencesModel) {
                const aLicencias = oLicencesModel.getData();
                if (Array.isArray(aLicencias)) {
                    let iMarcasLimpiadas = 0;
                    aLicencias.forEach(oLic => {
                        if (oLic.accionSeleccionada) {
                            oLic.accionSeleccionada = false;
                            iMarcasLimpiadas++;
                        }
                    });
                    if (iMarcasLimpiadas > 0) {
                        oLicencesModel.refresh();
                    }
                }
            }
        },

        _sincronizarAccionesConLicencias: function () {
            const oView = this.getView();
            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const oAccionesModel = oView.getModel("AccionesEntregaModel");

            if (!oLicencesModel || !oAccionesModel) {
                return;
            }

            const aLicenciasActuales = oLicencesModel.getData() || [];
            const aAcciones = oAccionesModel.getData() || [];

            const aIdsLicenciasActuales = aLicenciasActuales.map(lic => lic.Id);

            const aAccionesFiltradas = aAcciones.filter(accion => {
                const bExiste = aIdsLicenciasActuales.includes(accion.idLicencia);
                if (!bExiste) {
                }
                return bExiste;
            });

            // Actualizar modelo
            oAccionesModel.setData(aAccionesFiltradas);

            // Actualizar marcas en licencias
            aLicenciasActuales.forEach(oLic => {
                const bTieneAcciones = aAccionesFiltradas.some(a => a.idLicencia === oLic.Id);
                oLic.accionSeleccionada = bTieneAcciones;
            });

            oLicencesModel.refresh();
        },
        //------------------------------------------------------------------------------

        cargarModelos: function () {
            const oView = this.getView()
            ModelHelper.getModel("HorarioLicenciaJsonModel", oView);
            ModelHelper.getModel("consolasModel", oView)
            ModelHelper.getModel("LocalFilterJsonModel", oView);
            ModelHelper.getModel("ColorModel", oView).setProperty("/Color", "white");

            ModelHelper.getModel("tabsControl", oView).setData({ activeTab: "LIC" });
            ModelHelper.getModel("LicencesJsonModel", oView)

            const sConsolasUrl = sap.ui.require.toUrl("transener/sistemadeturnos/model/ConsolasModel.json");
            ModelHelper.getModel("consolasModel", oView).loadData(sConsolasUrl);

            const sEnabledUrl = sap.ui.require.toUrl("transener/sistemadeturnos/model/EnabledModel.json");
            ModelHelper.getModel("enabledModel", oView).loadData(sEnabledUrl);

            // ⬇️ MODELOS PARA FILTROS AVANZADOS ⬇️

            // 1. HardCodeModel (datos hardcoded)
            const oHardCodeModel = HardCodeModel.getModel();
            oView.setModel(oHardCodeModel, "HardCodeModel");

            // 2. FiltersJsonModel (estructura de filtros)
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const sFiltersPath = sap.ui.require.toUrl("transener/sistemadeturnos/model/FiltersJsonModel.json");
            oFiltersModel.loadData(sFiltersPath, "", false);

            // 3. CheckAdvancedFiltersModel (para checkboxes de filtros)
            ModelHelper.getModel("CheckAdvancedFiltersModel", oView).setData({
                Aro: false,
                Bloqueo: false,
                Rdisparo: false
            });

            // 4. Modelos adicionales para filtros (se cargan cuando sea necesario)
            ModelHelper.getModel("WorkPlacesJsonModel", oView);
            ModelHelper.getModel("PersonalHabilitadoModel", oView);
            ModelHelper.getModel("TipoEquipoJsonModel", oView);
            ModelHelper.getModel("TiposIntervencion", oView);
            ModelHelper.getModel("RepositionTimes", oView);

            // 5. Modelo de Regiones
            ModelHelper.getModel("RegionesJsonModel", oView);
            this._loadRegiones();

            // 6. Modelo de ET
            ModelHelper.getModel("EstacionesJsonModel", oView);

            // 7. Funciones de carga filtros avanzados
            this._loadEstaciones();
            this._loadPuestosTrabajo();
            this._loadTipoEquipo();
            this._loadRepositionTimes();
            this._loadPersonalHabilitado();
        },

        getVersion: function () {
            const oComponent = this.getOwnerComponent();
            let jsonModel = sap.ui.getCore().getModel("appVersion");

            if (!jsonModel) {
                jsonModel = new sap.ui.model.json.JSONModel();
                jsonModel.setSizeLimit(9999);

                const sVersion = oComponent.getManifestEntry("/sap.app/applicationVersion/version");

                jsonModel.setData({ version: sVersion });

                sap.ui.getCore().setModel(jsonModel, "appVersion");
                this.getView().setModel(jsonModel, "appVersion");
            } else if (!this.getView().getModel("appVersion")) {
                this.getView().setModel(jsonModel, "appVersion");
            }
        },

        /* getBaseURL: function () {
            const appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
            const appPath = appId.replaceAll(".", "/");
            const appModulePath = jQuery.sap.getModulePath(appPath);

            let jsonModel = sap.ui.getCore().getModel("appCurrentInfo");
            if (!jsonModel) {
                jsonModel = new sap.ui.model.json.JSONModel();
                jsonModel.setSizeLimit(9999);
                jsonModel.setData({ appUrl: appModulePath });
                sap.ui.getCore().setModel(jsonModel, "appCurrentInfo");
            }

            return appModulePath;
        }, */
        onTabSelect: function (oEvent) {
            const key = oEvent.getParameter("key");
            this.getView().getModel("tabsControl").setProperty("/activeTab", key);
            if (key === "Grafico") {
                this._computeChartFromAcciones();
            }
            if (key === "CRONO") {
                // se espera a que la solapa se muestre para poder medir la tabla
                setTimeout(() => this._ajustarAltoFilasCrono(), 0);
            }
        },

        // Recalcula el alto de filas cuando se cambia el ancho de "Trabajo a realizar"
        onColumnResizeCrono: function (oEvent) {
            if (oEvent.getParameter("column").getId() !== this.byId("toDoWorkCrono").getId()) {
                return;
            }
            this._ajustarAltoFilasCrono(parseInt(oEvent.getParameter("width"), 10));
        },

        // Ajusta el alto de todas las filas según el texto más largo de "Trabajo a realizar"
        _ajustarAltoFilasCrono: function (iAnchoColumna) {
            const MAX_LINEAS = 6;

            const oTable = this.byId("cronoTreeTable");
            const oColumn = this.byId("toDoWorkCrono");
            const oTableDom = oTable && oTable.getDomRef();
            const oColumnDom = oColumn && oColumn.getDomRef();
            const oModel = oTable && oTable.getModel("listCronoTreeModel");

            // Si la solapa no está visible no se puede medir; se recalcula al entrar a la solapa
            if (!oTableDom || !oColumnDom || !oModel) {
                return;
            }

            // Ancho disponible para el texto (ancho de columna menos el margen interno de la celda)
            const oCeldaDom = oTableDom.querySelector('[data-sap-ui-colid="' + oColumn.getId() + '"] .sapUiTableCellInner');
            const oEstilo = oCeldaDom ? getComputedStyle(oCeldaDom) : null;
            const iPaddingHorizontal = oEstilo ? parseFloat(oEstilo.paddingLeft) + parseFloat(oEstilo.paddingRight) : 16;
            const iAnchoTexto = (iAnchoColumna || oColumnDom.offsetWidth) - iPaddingHorizontal;

            // Medidor invisible con la misma fuente que las celdas
            const oMedidor = document.createElement("div");
            oMedidor.className = "sapMText";
            oMedidor.style.cssText = "position:absolute;visibility:hidden;white-space:normal;word-wrap:break-word;width:" + iAnchoTexto + "px";
            oTableDom.appendChild(oMedidor);

            oMedidor.textContent = "X";
            const iAltoLinea = oMedidor.offsetHeight;

            // Se miden todos los textos (grupos e hijos), no solo las filas visibles
            let iLineas = 1;
            const fnMedir = (aNodos) => {
                aNodos.forEach((oNodo) => {
                    if (oNodo.Comments) {
                        oMedidor.textContent = oNodo.Comments;
                        iLineas = Math.max(iLineas, Math.round(oMedidor.offsetHeight / iAltoLinea));
                    }
                    if (oNodo.children) {
                        fnMedir(oNodo.children);
                    }
                });
            };
            fnMedir(oModel.getData() || []);
            oMedidor.remove();

            iLineas = Math.min(iLineas, MAX_LINEAS);

            // El alto se define en el modo de filas de la tabla (alto del contenido, sin márgenes).
            // Con una sola línea se vuelve al alto estándar.
            oTable.getRowMode().setRowContentHeight(iLineas > 1 ? iLineas * iAltoLinea : null);
        },
        onSelectTurno: function (oEvent) {
            this.showGlobalBusy("Buscando turnos creados…");
            const oView = this.getView();
            const oDataService = this.getView().getModel();

            this._limpiarAccionesEntrega();

            const oNotificationModel = ModelHelper.getModel("LicensesNotificationModel", oView);
            oNotificationModel.setData({
                visible: false,
                count: 0,
                message: "",
                type: ""
            });

            ModelHelper.getModel("enabledModel", oView).setData({
                btnCrear: true,
                btnGuardar: true,
                btnEnviar: true
            });

            const oDatePicker = oEvent.getSource();
            const sSelectedDate = oDatePicker.getDateValue();
            const sFormattedDate = FormatHelper.formatDate(sSelectedDate);

            ModelHelper.getModel("LicencesTurnoJsonModel", oView)
                .setProperty("/FechaTurno", sFormattedDate);

            const sEmpresa = SocietyHelper.getCurrentSociety(oView);
            const aFilters = [];
            aFilters.push(new Filter("Dateturno", FilterOperator.EQ, this.byId("date").getDateValue()));
            aFilters.push(new Filter("Empresa", FilterOperator.EQ, sEmpresa));

            const sEntity = "/TurnosLicenciasSet";


            oDataService.read(sEntity, {
                filters: aFilters,
                success: (oData) => {
                    this._validateAndProcessLicenses(oData.results, sSelectedDate)
                        .then((aLicenciasProcesadas) => {

                            return this.successSelectTurno({ results: aLicenciasProcesadas });
                        })
                        .catch((err) => {
                            return this.successSelectTurno(oData);
                        })
                        .then(() => {
                            // ✅ CARGAR ACCIONES después de cargar licencias
                            return this._cargarAccionesDesdeBackend(sSelectedDate);
                        })
                        .finally(() => {
                            this.hideGlobalBusy();
                            this._generarAccionesAutomaticas();
                        });
                },
                error: (oError) => {
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    Utils.onCountItems(oView, []);
                    this.hideGlobalBusy();
                    this._generarAccionesAutomaticas();
                }
            });

            this._oFechaTurnoCreado = null;
        },


        /* ------------------------------------------ TRAMITACION---------------------- */

        _validateAndProcessLicenses: function (aLicencias, dFechaSeleccionada) {
            const oModel = this.getView().getModel();

            const aPromises = aLicencias.map((oLicencia, index) => {
                return this._validateSingleLicense(oModel, oLicencia, dFechaSeleccionada, index + 1, aLicencias.length);
            });

            return Promise.all(aPromises)
                .then((aLicenciasValidadas) => {

                    return aLicenciasValidadas;
                });
        },

        _validateSingleLicense: function (oModel, oLicencia, dFecha, current, total) {
            return new Promise((resolve) => {

                const sEmpresa = SocietyHelper.getCurrentSociety(this.getView());
                const aFilters = [
                    new Filter("Empresa", FilterOperator.EQ, oLicencia.Empresa || sEmpresa),
                    new Filter("Id", FilterOperator.EQ, oLicencia.Id),
                    new Filter("Anio", FilterOperator.EQ, String(oLicencia.Anio || "2025"))
                ];

                const startTime = Date.now();

                oModel.read("/LicenciaEstadoDiarioSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const duration = Date.now() - startTime;
                        const aResults = oData.results || [];


                        if (aResults.length === 0) {
                            resolve({
                                ...oLicencia,
                                tramitacionColor: null,
                                tramitacionProblematica: false,
                                tramitacionEstado: null,
                                tramitacionDetalles: [],
                                calendarioCompleto: [],
                                tramitacionPorFecha: {}
                            });
                            return;
                        }

                        aResults.forEach(r => {
                            const fechaFormateada = DateHelper.formatDateYYYYMMDD(r.Fecha);
                            const desc = TramitacionService.getEstadoDescripcion(r.Estado);
                        });

                        let tramitacionColor = null;
                        let tramitacionProblematica = false;
                        let tramitacionEstado = null;
                        const aEstadosProblematicos = [];
                        const tramitacionPorFecha = {};

                        aResults.forEach(item => {
                            if (item.Estado === 'AS' || item.Estado === 'NA' || item.Estado === 'CD' || item.Estado === 'CC') {
                                aEstadosProblematicos.push(item);

                                const fechaItem = DateHelper.formatDateYYYYMMDD(item.Fecha);

                                if (item.Estado === 'AS' || item.Estado === 'NA') {
                                    tramitacionPorFecha[fechaItem] = 'red';
                                } else if (item.Estado === 'CD' || item.Estado === 'CC') {
                                    if (!tramitacionPorFecha[fechaItem]) {
                                        tramitacionPorFecha[fechaItem] = 'yellow';
                                    }
                                }
                            }
                        });

                        if (aEstadosProblematicos.length > 0) {
                            aEstadosProblematicos.forEach(item => {
                                const fechaFormateada = DateHelper.formatDateYYYYMMDD(item.Fecha);
                            });
                        }

                        const hasAnulada = aEstadosProblematicos.some(item => item.Estado === 'AS');
                        const hasNoAutorizada = aEstadosProblematicos.some(item => item.Estado === 'NA');
                        const hasCondicionada = aEstadosProblematicos.some(item =>
                            item.Estado === 'CD' || item.Estado === 'CC'
                        );

                        if (hasAnulada) {
                            tramitacionColor = 'red';
                            tramitacionProblematica = true;
                            tramitacionEstado = 'AS';
                        } else if (hasNoAutorizada) {
                            tramitacionColor = 'red';
                            tramitacionProblematica = true;
                            tramitacionEstado = 'NA';
                        } else if (hasCondicionada) {
                            tramitacionColor = 'yellow';
                            tramitacionProblematica = true;
                            tramitacionEstado = 'CD';
                        }

                        resolve({
                            ...oLicencia,
                            tramitacionColor: tramitacionColor,
                            tramitacionProblematica: tramitacionProblematica,
                            tramitacionEstado: tramitacionEstado,
                            tramitacionDetalles: aEstadosProblematicos,
                            calendarioCompleto: aResults,
                            tramitacionPorFecha: tramitacionPorFecha
                        });
                    },
                    error: (oError) => {
                        const duration = Date.now() - startTime;

                        if (oError.responseText) {
                            try {
                                const errorObj = JSON.parse(oError.responseText);
                            } catch (e) {
                                console.error(`  │    ResponseText:`, oError.responseText);
                            }
                        }

                        resolve({
                            ...oLicencia,
                            tramitacionColor: null,
                            tramitacionProblematica: false,
                            tramitacionEstado: null,
                            tramitacionDetalles: [],
                            calendarioCompleto: [],
                            tramitacionPorFecha: {}
                        });
                    }
                });
            });
        },

        _getTramitacionColorPorFecha: function (oLicencia, dFechaTurno) {

            if (!oLicencia || !oLicencia.tramitacionPorFecha || !dFechaTurno) {
                return null;
            }

            const sFechaTurno = DateHelper.formatDateYYYYMMDD(dFechaTurno);

            const color = oLicencia.tramitacionPorFecha[sFechaTurno] || null;

            return color;
        },

        // Funciones movidas a servicios/helpers:
        // - _formatDateYYYYMMDD -> DateHelper.formatDateYYYYMMDD
        // - _getEstadoDescription -> TramitacionService.getEstadoDescripcion

        onOpenCalendarioTramitacion: function (oEvent) {
            const oButton = oEvent.getSource();
            const oView = this.getView();

            const oBindingContext = oButton.getBindingContext("LicencesJsonModel");
            if (!oBindingContext) {
                sap.m.MessageToast.show("No se pudo obtener información de la licencia");
                return;
            }

            const oLicencia = oBindingContext.getObject();

            if (this._oCalendarioDialog) {
                this._oCalendarioDialog.destroy();
                this._oCalendarioDialog = null;
            }

            if (!oLicencia.calendarioCompleto || oLicencia.calendarioCompleto.length === 0) {
                this._showEmptyCalendarioDialog(oLicencia.Id);
                return;
            }

            this._showCalendarioDialog(oLicencia);
        },

        _showEmptyCalendarioDialog: function (sLicenciaId) {
            const oView = this.getView();

            const oTable = new sap.m.Table({
                columns: [
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Fecha" })
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Estado" })
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Observación" })
                    })
                ]
            });

            oTable.addItem(
                new sap.m.ColumnListItem({
                    cells: [
                        new sap.m.Text({ text: "" }),
                        new sap.m.Text({
                            text: "No hay días agregados...",
                            textAlign: "Center"
                        }),
                        new sap.m.Text({ text: "" })
                    ]
                })
            );

            this._oCalendarioDialog = new sap.m.Dialog({
                title: "Calendario Tramitación",
                contentWidth: "550px",
                contentHeight: "200px",
                content: [
                    new sap.m.VBox({
                        items: [oTable]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                endButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._oCalendarioDialog.close();
                    }.bind(this)
                })
            });

            oView.addDependent(this._oCalendarioDialog);
            this._oCalendarioDialog.open();
        },

        _showCalendarioDialog: function (oLicencia) {
            const oView = this.getView();

            const aCalendarioData = oLicencia.calendarioCompleto.map(item => {
                const fechaFormateada = DateHelper.formatDateYYYYMMDD(item.Fecha);

                return {
                    FechaDisplay: this._formatDateToDisplay(item.Fecha),
                    EstadoTexto: this._getEstadoTextoCompleto(item.Estado),
                    Observaciones: item.Observaciones || '',
                    ColorIndicador: this._getColorByEstado(item.Estado),
                    _fechaOrden: fechaFormateada
                };
            });

            aCalendarioData.sort((a, b) => {
                return new Date(a._fechaOrden) - new Date(b._fechaOrden);
            });

            const oModel = new sap.ui.model.json.JSONModel({
                estados: aCalendarioData
            });

            const iRowCount = aCalendarioData.length;
            const iRowHeight = 48;
            const iHeaderHeight = 48;
            const iDialogPadding = 80;
            const iMaxHeight = 400;

            const iCalculatedHeight = Math.min(
                (iRowCount * iRowHeight) + iHeaderHeight + iDialogPadding,
                iMaxHeight
            );

            const oTable = new sap.m.Table({
                growing: false,
                columns: [
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Fecha" }),
                        width: "110px"
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Estado" }),
                        width: "240px"
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Observación" })
                    })
                ],
                items: {
                    path: "/estados",
                    template: new sap.m.ColumnListItem({
                        cells: [
                            new sap.m.Text({
                                text: "{FechaDisplay}"
                            }),
                            new sap.m.HBox({
                                alignItems: "Center",
                                items: [
                                    new sap.ui.core.Icon({
                                        src: "sap-icon://circle-task-2",
                                        color: "{ColorIndicador}",
                                        size: "0.875rem"
                                    }).addStyleClass("sapUiTinyMarginEnd"),
                                    new sap.m.Text({
                                        text: "{EstadoTexto}"
                                    })
                                ]
                            }),
                            new sap.m.Text({
                                text: "{Observaciones}"
                            })
                        ]
                    })
                }
            });

            oTable.setModel(oModel);

            this._oCalendarioDialog = new sap.m.Dialog({
                title: "Calendario Tramitación",
                contentWidth: "550px",
                contentHeight: iCalculatedHeight + "px",
                content: [
                    new sap.m.VBox({
                        items: [oTable]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                endButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._oCalendarioDialog.close();
                    }.bind(this)
                })
            });

            oView.addDependent(this._oCalendarioDialog);
            this._oCalendarioDialog.open();
        },

        _formatDateToDisplay: function (date) {
            const formatted = DateHelper.formatDateYYYYMMDD(date);
            if (!formatted) return "";

            const [year, month, day] = formatted.split('-');
            return `${day}/${month}/${year}`;
        },

        _getEstadoTextoCompleto: function (sEstado) {
            const mEstados = {
                "AS": "Anulada por el solicitante",
                "NA": "No Autorizada",
                "CD": "Condicionada",
                "CC": "Condicionada",
                "AU": "Autorizada"
            };
            return mEstados[sEstado] || `Estado ${sEstado}`;
        },

        _getColorByEstado: function (sEstado) {
            switch (sEstado) {
                case 'AS': // Anulada por solicitante
                case 'NA': // No autorizada
                    return "#BB0000"; // Rojo
                case 'CD': // Condicionada
                case 'CC':
                    return "#E78C07"; // Amarillo/Naranja
                default:
                    return "#5E696E"; // Gris
            }
        },

        /* ---------------------- TRAMITACION-------------------------- */
        onSearch: function () {
            this._openFechaTurnoPopup();
        },

        _checkExistingTurnoAndProceed: function (oDateValue) {
            const oView = this.getView();
            const oDataService = oView.getModel();

            this._oFechaTurnoCreado = oDateValue;

            const sFormattedDate = FormatHelper.formatDate(oDateValue);
            ModelHelper.getModel("LicencesTurnoJsonModel", oView).setProperty("/FechaTurno", sFormattedDate);

            this.showGlobalBusy("Buscando turnos creados…");

            const sEmpresa = SocietyHelper.getCurrentSociety(oView);

            const aFilters = [
                new sap.ui.model.Filter("Dateturno", sap.ui.model.FilterOperator.EQ, oDateValue),
                new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa)
            ];

            // sap-cache-id fuerza al SAP Gateway a no devolver respuesta cacheada.
            // También cambia la URL del request para que el OData model no lo coalezca
            // con un request idéntico anterior que tenga datos stale en su entity store.
            oDataService.read("/TurnosLicenciasSet", {
                filters: aFilters,
                urlParameters: { "sap-cache-id": Date.now().toString() },
                success: (oData) => {
                    const aRes = (oData && oData.results) ? oData.results : [];

                    if (!aRes.length) {
                        this._proceedToCreateTurno(oDateValue);
                        return;
                    }

                    // Hay registros en TurnosLicenciasSet, pero eso no alcanza para saber
                    // qué mostrar: puede haber licencias nuevas, elegibles hoy, que todavía
                    // no se guardaron nunca en un turno para esta fecha. Por eso recalculamos
                    // siempre el conjunto vigente (mismos filtros que TurnosService.search:
                    // Solbeg/Solend + estado + modalidad) y solo usamos lo guardado en
                    // TurnosLicenciasSet para rescatar el horario/comentario ya asignado.
                    const sFecha = oDateValue.toISOString().split("T")[0];
                    const oGuardadasPorId = new Map(aRes.map(r => [r.Id, r]));

                    oDataService.read("/LicenciaTrabajoSet", {
                        filters: [
                            new sap.ui.model.Filter("Solbeg", sap.ui.model.FilterOperator.LE, oDateValue),
                            new sap.ui.model.Filter("Solend", sap.ui.model.FilterOperator.GE, oDateValue),
                            new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa),
                            new sap.ui.model.Filter("Tipo", sap.ui.model.FilterOperator.EQ, "L")
                        ],
                        success: (oLicData) => {
                            // Todas las licencias elegibles hoy para esta fecha (estado + modalidad)
                            const aFiltradas = TurnosService.filtrarFechasTipo(oLicData.results || [], sFecha);

                            // Mezclar: cada elegible conserva su horario/comentario si ya estaba
                            // guardada; si no, entra "en blanco" para calcularse como nueva.
                            const aLicenciasParaTurno = aFiltradas.map((lic) => {
                                const oGuardada = oGuardadasPorId.get(lic.Id);
                                return {
                                    ...lic,
                                    Turno: oGuardada ? oGuardada.Turno : "",
                                    Comentarios: oGuardada ? oGuardada.Comentarios : "",
                                    Enviado: oGuardada ? oGuardada.Enviado : false,
                                    Agrmanual: oGuardada ? oGuardada.Agrmanual : false,
                                    Dateturno: oDateValue
                                };
                            });

                            if (!aLicenciasParaTurno.length) {
                                // Ninguna licencia elegible para esta fecha → crear nuevo
                                this._proceedToCreateTurno(oDateValue);
                                return;
                            }

                            // Hay licencias elegibles: el turno existe realmente
                            this._showTurnoExisteWarning(aLicenciasParaTurno, oData, oDateValue);
                        },
                        error: () => {
                            // Si la verificación secundaria falla, ser conservador:
                            // asumir que el turno existe para no crear duplicados.
                            this._showTurnoExisteWarning(aRes, oData, oDateValue);
                        }
                    });
                },
                error: (oError) => {
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    oLicencesModel.refresh();
                    Utils.onCountItems(this.getView(), []);
                    this.hideGlobalBusy();
                }
            });
        },

        _proceedToCreateTurno: function (oDateValue) {
            this.hideGlobalBusy();
            this._resetDefaultTurnoModel();

            const oDatePicker = this.byId("date");
            if (oDatePicker && oDateValue) {
                oDatePicker.setDateValue(oDateValue);
            }

            this._doSearchTurnos(oDateValue);
        },

        _showTurnoExisteWarning: function (aRes, oData, oDateValue) {
            const oView = this.getView();

            this.hideGlobalBusy();
            this._resetDefaultTurnoModel();
            sap.m.MessageBox.warning("Ya existe un turno para esta fecha.", {
                actions: ["Editar", "Cancelar"],
                emphasizedAction: "Editar",
                onClose: (sAction) => {
                    if (sAction === "Editar") {
                        this.showGlobalBusy("Cargando turno…");
                        this._resetDefaultTurnoModel();
                        this._limpiarAccionesEntrega();

                        ModelHelper.getModel("enabledModel", oView).setData({
                            btnCrear: true,
                            btnGuardar: true,
                            btnEnviar: true
                        });

                        const oDatePicker = this.byId("date");
                        if (oDatePicker) {
                            oDatePicker.setDateValue(oDateValue);
                        }

                        this._validateAndProcessLicenses(aRes, oDateValue)
                            .then((aLicenciasProcesadas) => {
                                return this.successSelectTurno({ results: aLicenciasProcesadas });
                            })
                            .catch(() => {
                                return this.successSelectTurno(oData);
                            })
                            .then(() => {
                                // Traer las acciones ya guardadas para ese día
                                return this._cargarAccionesDesdeBackend(oDateValue);
                            })
                            .finally(() => {
                                this.hideGlobalBusy();
                                // Completar las acciones que falten
                                this._generarAccionesAutomaticas();
                            });
                    }
                }
            });
        },


        _openFechaTurnoPopup: function () {
            var oView = this.getView();
            var that = this;

            if (this._oFechaTurnoDialog) {
                this._oFechaTurnoPicker.setDateValue(new Date());
                this._oFechaTurnoDialog.open();
                return;
            }

            var fnValidarNoAnterior = function (oFecha) {
                var oFechaNormalizada = new Date(Date.UTC(
                    oFecha.getUTCFullYear(),
                    oFecha.getUTCMonth(),
                    oFecha.getUTCDate(),
                    0, 0, 0, 0
                ));

                var oHoy = new Date();
                var oHoyNormalizada = new Date(Date.UTC(
                    oHoy.getFullYear(),
                    oHoy.getMonth(),
                    oHoy.getDate(),
                    0, 0, 0, 0
                ));

                return oFechaNormalizada.getTime() >= oHoyNormalizada.getTime();
            };

            this._oFechaTurnoPicker = new sap.m.DatePicker({
                width: "100%",
                dateValue: new Date(),
                displayFormat: "dd/MM/yyyy",
                valueFormat: "yyyy-MM-dd",
                placeholder: "Seleccione una fecha"
            });

            this._oFechaTurnoDialog = new sap.m.Dialog({
                title: "Seleccionar fecha",
                contentWidth: "30rem",
                content: [
                    new sap.m.HBox({
                        width: "100%",
                        justifyContent: "Center",
                        items: [
                            this._oFechaTurnoPicker.addStyleClass("sapUiSmallMarginTop")
                        ]
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Crear",
                    type: "Emphasized",
                    press: function () {
                        var oDateValue = that._oFechaTurnoPicker.getDateValue();
                        if (!oDateValue) {
                            sap.m.MessageToast.show("Seleccione una fecha");
                            return;
                        }

                        // ✅ VALIDACIÓN: No permitir crear turnos con fecha anterior a hoy
                        if (!fnValidarNoAnterior(new Date(oDateValue))) {
                            sap.m.MessageBox.error(
                                "No se puede crear un turno con fecha anterior al día de hoy. Por favor, seleccione una fecha válida.",
                                {
                                    title: "Fecha no válida"
                                }
                            );
                            return;
                        }

                        that._oFechaTurnoDialog.close();
                        that._checkExistingTurnoAndProceed(oDateValue);
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Cancelar",
                    press: function () {
                        that._oFechaTurnoDialog.close();
                    }
                })
            });

            oView.addDependent(this._oFechaTurnoDialog);
            this._oFechaTurnoDialog.open();
        },


        _doSearchTurnos: function (FechaTurno) {
            var oTable = this.byId("turnosTable");
            var oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());

            this._limpiarAccionesEntrega();

            oLicencesModel.setData([]);
            oTable.setBusy(true);

            TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: true })
                .then((data) => {
                    const bIsEditable = this._isEditableTurno(FechaTurno);

                    data.forEach(item => {
                        item.isEditable = bIsEditable;
                    });

                    // Calcular InitHourSort para poder ordenar por hora de inicio
                    data.forEach(item => {
                        if (item.Timbeg && typeof item.Timbeg === 'object' && 'ms' in item.Timbeg) {
                            item.InitHourSort = Math.floor(item.Timbeg.ms / (1000 * 60));
                        } else if (item.Timbeg && typeof item.Timbeg === 'string' && item.Timbeg !== "PT00H00M00S") {
                            const hoursMatch = item.Timbeg.match(/(\d+)H/);
                            const minutesMatch = item.Timbeg.match(/(\d+)M/);
                            const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
                            const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
                            item.InitHourSort = hours * 60 + minutes;
                        } else if (item.Gdate) {
                            const d = new Date(item.Gdate);
                            item.InitHourSort = d.getHours() * 60 + d.getMinutes();
                        } else {
                            item.InitHourSort = null;
                        }
                    });

                    // Ordenar por consola → hora de inicio → prioridad de maniobras
                    this._sortLicencesNuevoTurno(data);

                    // Reasignar turnos según el nuevo orden
                    TurnosService.assignShiftsToLicences(data);

                    // OBTENER DESCRIPCIONES DE EQUIPOS
                    const aEquiposUnicos = data
                        .map(item => ({
                            Equnr: (item.Equnr || "").trim(),
                            Tplnr: (item.Tplnr || "").trim()
                        }))
                        .filter(item => item.Equnr && item.Tplnr);

                    const aEquiposUnicosDedup = Array.from(
                        new Map(aEquiposUnicos.map(item => [JSON.stringify(item), item])).values()
                    );

                    if (aEquiposUnicosDedup.length === 0) {
                        // Sin equipos, cargar sin descripciones
                        oLicencesModel.setData(data);
                        oLicencesModel.refresh();
                        oTable.setBusy(false);
                        Utils.onCountItems(this.getView(), data);
                        this._updateEditableState();
                        this._generarAccionesAutomaticas();
                        return;
                    }

                    // Obtener descripciones
                    this._obtenerDescripcionesEquipos(aEquiposUnicosDedup)
                        .then((oDescripcionesEquipos) => {
                            // Agregar descripciones
                            data.forEach(item => {
                                const sEquipoNormalizado = (item.Equnr || "").trim();
                                item.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                                item.EquipoCompleto = item.DescEquipo
                                    ? item.Equnr + " - " + item.DescEquipo
                                    : item.Equnr;
                            });

                            oLicencesModel.setData(data);
                            oLicencesModel.refresh();
                            oTable.setBusy(false);
                            Utils.onCountItems(this.getView(), data);
                            this._updateEditableState();
                            this._generarAccionesAutomaticas();

                        })
                        .catch((error) => {
                            oLicencesModel.setData(data);
                            oLicencesModel.refresh();
                            oTable.setBusy(false);
                            Utils.onCountItems(this.getView(), data);
                            this._updateEditableState();
                            this._generarAccionesAutomaticas();

                        });
                })
                .catch((error) => {
                    oLicencesModel.setData([]);
                    oLicencesModel.refresh();
                    oTable.setBusy(false);
                    Utils.onCountItems(this.getView(), []);
                });
        },

        _generarReporteAutomatico: function (aLicencias, oFecha) {
            if (!aLicencias || aLicencias.length === 0) {
                console.log("⚠️ No hay licencias para generar reporte automático");
                return;
            }

            console.log("📊 Generando reporte automático para fecha:", oFecha);

            // Usar la misma lógica que _procesarDatosComoExcel pero para una sola fecha
            var oFormatter = this.formatter;
            var aDatosTabla = [];
            var sFechaFormateada = oFormatter.formatDate(oFecha);

            // Filtrar solo licencias con maniobras (igual que tu lógica actual)
            var aLicenciasFecha = aLicencias.filter(function (license) {
                // Obtener categoría
                var oInfo = Utils.getShiftInfo(license);

                // Solo incluir equipos CON maniobras
                return oInfo.category === "ConsignacionLinea" ||
                    oInfo.category === "ConsignacionEquipo" ||
                    oInfo.category === "ManiobrasSinConsignacion";
            });

            console.log("📊 Licencias con maniobras encontradas:", aLicenciasFecha.length);

            // Eliminar duplicados: un solo registro por equipo (Equnr)
            var aLicenciasUnicas = [];
            var oMapaDuplicados = {};

            aLicenciasFecha.forEach(function (license) {
                var sEquipo = license.Equnr || "";

                if (!oMapaDuplicados[sEquipo]) {
                    oMapaDuplicados[sEquipo] = true;
                    aLicenciasUnicas.push(license);
                }
            });

            // Procesar cada licencia (IGUAL QUE EL EXCEL)
            aLicenciasUnicas.forEach(function (license) {
                var oInfo = Utils.getShiftInfo(license);
                var sEquipo = license.Equnr || "";
                var sHora = license.TurnoAsignado ||
                    (license.Horainicio ? oFormatter.durationToTime(license.Horainicio) :
                        (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""));
                var sComentarios = license.Comments || license.Patadic || "";

                aDatosTabla.push({
                    Fecha: sFechaFormateada,
                    Equipo: sEquipo,
                    Hora: sHora,
                    TipoIntervencion: this._getTipoIntervencionTexto(oInfo.category),
                    Condicion: oInfo.condition,
                    Comentarios: sComentarios
                });
            }.bind(this)); // ← ESTE ERA EL ERROR: faltaba cerrar el .bind(this)

            // Ordenar por hora
            aDatosTabla.sort(function (a, b) {
                if (!a.Hora) return 1;
                if (!b.Hora) return -1;
                return a.Hora.localeCompare(b.Hora);
            });

            console.log("✅ Reporte automático generado con", aDatosTabla.length, "equipos");

            // CARGAR DATOS EN EL MODELO
            var oReporteModel = this.getView().getModel("ReporteModel");
            if (!oReporteModel) {
                oReporteModel = new JSONModel();
                this.getView().setModel(oReporteModel, "ReporteModel");
            }
            oReporteModel.setData(aDatosTabla);

            // Actualizar el rango de fechas
            var oDateRangeControl = this.byId("reporteDateRange");
            if (oDateRangeControl) {
                var sMinHora = "--";
                var sMaxHora = "--";

                if (aDatosTabla.length > 0) {
                    var aHoras = aDatosTabla.filter(function (d) { return d.Hora; }).map(function (d) { return d.Hora; });
                    if (aHoras.length > 0) {
                        sMinHora = aHoras[0];
                        sMaxHora = aHoras[aHoras.length - 1];
                    }
                }

                oDateRangeControl.setText("Horarios de maniobras previstas desde: " + sFechaFormateada + " " + sMinHora + " Hasta: " + sFechaFormateada + " " + sMaxHora);
            }

            // Guardar datos para el excel
            this._datosReporteProcesados = aLicencias;
            this._reporteFechaInicio = oFecha;
            this._reporteFechaFin = oFecha;
        },
        // 🆕 FUNCIÓN AUXILIAR: Obtener texto del tipo de intervención
        _getTipoIntervencionTexto: function (sCategoria) {
            switch (sCategoria) {
                case "ConsignacionLinea":
                    return "Consignación (Línea)";
                case "ConsignacionEquipo":
                    return "Consignación (Equipo)";
                case "ManiobrasSinConsignacion":
                    return "Condiciones especiales C/maniobra";
                default:
                    return "";
            }
        },

        // 🆕 FUNCIÓN AUXILIAR: Actualizar rango de fechas del reporte
        _actualizarRangoFechasReporte: function (aData, sFecha) {
            var sMinHora = "--";
            var sMaxHora = "--";

            if (aData.length > 0) {
                var aHoras = aData.filter(d => d.Hora).map(d => d.Hora);
                if (aHoras.length > 0) {
                    sMinHora = aHoras[0]; // Ya está ordenado
                    sMaxHora = aHoras[aHoras.length - 1];
                }
            }

            var sTexto = "Horarios de maniobras previstas desde: " + sMinHora + " Hasta: " + sMaxHora;
            if (sFecha) {
                sTexto += " (Fecha: " + sFecha + ")";
            }

            this.byId("reporteDateRange").setText(sTexto);
        },

        // onSearch: function () {
        //     var dateTurno = this.byId("date");
        //     var oTable = this.byId("turnosTable");

        //     var oDateValue = dateTurno.getDateValue();

        //     if (!oDateValue) {
        //         sap.m.MessageToast.show("Seleccione una fecha");
        //         return;
        //     }


        //     const FechaTurno = oDateValue;

        //     var oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
        //     oLicencesModel.setData([]);
        //     oTable.setBusy(true);


        //     TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: false })
        //         .then((data) => {
        //             oLicencesModel.setData(data);
        //             oLicencesModel.refresh();
        //             oTable.setBusy(false);
        //             Utils.onCountItems(this.getView(), aLicencias);
        //         })
        //         .catch((error) => {
        //             console.error("Error en la búsqueda:", error);
        //             oLicencesModel.setData([]);
        //             oLicencesModel.refresh();
        //             oTable.setBusy(false);
        //         });

        //     this.closeDialog();
        // },
        _resetDefaultTurnoModel: function () {
            const oView = this.getView();

            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            if (oLicencesModel) {
                oLicencesModel.setData([]);
                oLicencesModel.refresh(true);
            }

            Utils.onCountItems(oView, []);
        },


        successSelectTurno: function (data, mComentariosPreservados) {
            const oView = this.getView();
            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            const oDataModel = this.getView().getModel();

            const aResults = Array.isArray(data?.results) ? data.results : [];

            if (!aResults.length) {
                oLicencesModel.setData([]);
                Utils.onCountItems(oView, []);
                return Promise.resolve();
            }

            // FILTRO DE ESTADOS PERMITIDOS
            // Estados permitidos según requisitos:
            // 01 = Autorizada 
            // 07 = Coordinada 
            // 08 = Entregada 
            // 10 = Suspendida 
            // 23 = En Trámite 
            const ESTADOS_PERMITIDOS = ["01", "07", "08", "10", "23"];

            const aPromises = aResults.map((turnoLicencia) => {
                return new Promise((resolve, reject) => {
                    const sPath = oDataModel.createKey("/LicenciaTrabajoSet", {
                        Empresa: turnoLicencia.Empresa,
                        Id: turnoLicencia.Id,
                        Tipo: turnoLicencia.Tipo,
                        Anio: turnoLicencia.Anio
                    });

                    oDataModel.read(sPath, {
                        urlParameters: {
                            "$expand": "HorariosPorLicencia_nav,CoordinacionesLicencia_nav,ObservacionesLicencia_nav,TramitacionesLicencia_nav,SuspensionLicencia_nav,ReanudacionLicencia_nav,TransferenciaJefeTrabajo_nav,DevolucionLicencia_nav,EntregasLicencia_nav,AttachmentXLicencia_nav,EsquemaUnifilar_nav,TurnosLicencias_nav"
                        },
                        success: (oData) => {
                            // Si es agregada manualmente, SIEMPRE pasa (sin validar estado)
                            const bAgrmanual = turnoLicencia.Agrmanual === true;

                            if (!bAgrmanual && !ESTADOS_PERMITIDOS.includes(oData.Licstat)) {
                                resolve(null);
                                return;
                            }

                            const sComentariosCargados = turnoLicencia.Comentarios || oData.Comentarios || (mComentariosPreservados && mComentariosPreservados[turnoLicencia.Id]) || "";
                            const licenciaCompleta = {
                                ...oData,
                                Timbeg: oData.Timbeg || null,
                                Timend: oData.Timend || null,
                                Gdate: oData.Gdate || null,
                                TurnoAsignado: turnoLicencia.Turno || "",
                                Dateturno: turnoLicencia.Dateturno || null,
                                Agrmanual: turnoLicencia.Agrmanual || false,
                                Comentarios: sComentariosCargados,
                                _originalComentarios: sComentariosCargados,
                                _originalTurno: turnoLicencia.Turno || "",
                                Enviado: turnoLicencia.Enviado || false,
                                tramitacionColor: turnoLicencia.tramitacionColor || null,
                                tramitacionProblematica: turnoLicencia.tramitacionProblematica || false,
                                tramitacionEstado: turnoLicencia.tramitacionEstado || null,
                                tramitacionDetalles: turnoLicencia.tramitacionDetalles || [],
                                calendarioCompleto: turnoLicencia.calendarioCompleto || [],
                                tramitacionPorFecha: turnoLicencia.tramitacionPorFecha || {}
                            };

                            resolve(licenciaCompleta);
                        },
                        error: (oError) => {
                            LicenseService.FIND(turnoLicencia, oDataModel)
                                .then(result => {
                                    const bAgrmanual = turnoLicencia.Agrmanual === true;

                                    if (!bAgrmanual && !ESTADOS_PERMITIDOS.includes(result.Licstat)) {
                                        resolve(null);
                                        return;
                                    }

                                    if (!result.Timbeg && turnoLicencia.Timbeg) {
                                        result.Timbeg = turnoLicencia.Timbeg;
                                    }

                                    result.Agrmanual = turnoLicencia.Agrmanual || false;
                                    const sComentariosError = turnoLicencia.Comentarios || result.Comentarios || (mComentariosPreservados && mComentariosPreservados[turnoLicencia.Id]) || "";
                                    result.Comentarios = sComentariosError;
                                    result._originalComentarios = sComentariosError;
                                    result._originalTurno = turnoLicencia.Turno || "";
                                    result.Enviado = turnoLicencia.Enviado || false;
                                    result.TurnoAsignado = turnoLicencia.Turno || "";

                                    resolve(result);
                                })
                                .catch(err => {
                                    reject(err);
                                });
                        }
                    });
                });
            });

            return Promise.all(aPromises)
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x !== null);

                    if (!results.length) {
                        oLicencesModel.setData([]);
                        Utils.onCountItems(oView, []);
                        return;
                    }

                    const turnosOriginales = {};
                    aResults.forEach(item => {
                        if (item.Id && item.Turno) {
                            turnosOriginales[item.Id] = item.Turno;
                        }
                    });

                    results.forEach(item => {
                        if (item.Timbeg && typeof item.Timbeg === 'object' && 'ms' in item.Timbeg) {
                            const totalMinutes = Math.floor(item.Timbeg.ms / (1000 * 60));
                            item.InitHourSort = totalMinutes;
                        }
                        else if (item.Timbeg && typeof item.Timbeg === 'string' && item.Timbeg !== "PT00H00M00S") {
                            const hoursMatch = item.Timbeg.match(/(\d+)H/);
                            const minutesMatch = item.Timbeg.match(/(\d+)M/);

                            const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
                            const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;

                            item.InitHourSort = hours * 60 + minutes;
                        }
                        else if (item.Gdate) {
                            const d = new Date(item.Gdate);
                            item.InitHourSort = d.getHours() * 60 + d.getMinutes();
                        } else {
                            item.InitHourSort = null;
                        }
                    });

                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        oView
                    );

                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    const aEquiposConEstacion = arrayOrdenado
                        .map(item => {
                            const oCombo = {
                                Equnr: (item.Equnr || "").trim(),
                                Tplnr: (item.Tplnr || "").trim()
                            };
                            return oCombo;
                        })
                        .filter(item => {
                            const bTieneAmbos = item.Equnr && item.Tplnr;
                            return bTieneAmbos;
                        });

                    const aEquiposUnicos = Array.from(
                        new Map(aEquiposConEstacion.map(item => [JSON.stringify(item), item])).values()
                    );

                    return this._obtenerDescripcionesEquipos(aEquiposUnicos)
                        .then((oDescripcionesEquipos) => {

                            arrayOrdenado.forEach(item => {
                                const sEquipoNormalizado = (item.Equnr || "").trim();
                                item.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                                item.EquipoCompleto = item.DescEquipo ? item.Equnr + " - " + item.DescEquipo : item.Equnr;
                            });

                            const oDatePicker = this.byId("date");
                            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

                            const bIsEditable = this._isEditableTurno(oFechaTurno);

                            arrayOrdenado.forEach((item, index) => {
                                item.isEditable = bIsEditable;

                                if (turnosOriginales[item.Id]) {
                                    item.TurnoAsignado = turnosOriginales[item.Id];
                                }

                                if (item.tramitacionPorFecha && oFechaTurno) {
                                    const colorEspecifico = this._getTramitacionColorPorFecha(item, oFechaTurno);
                                    item.tramitacionColorFecha = colorEspecifico;
                                } else {
                                    item.tramitacionColorFecha = null;
                                }
                            });

                            arrayOrdenado.forEach(item => {
                                const iconoColor = item.tramitacionColorFecha === 'red' ? '🔴' :
                                    item.tramitacionColorFecha === 'yellow' ? '🟡' : '⚪';
                            });

                            this._rebuildFrontendGroupsByEquipoHora(arrayOrdenado);
                            this._assignGroupColors(arrayOrdenado);

                            // Ordenar por consola y luego por hora dentro de cada consola
                            this._sortLicences(arrayOrdenado);

                            // Sincronizar valores originales con los valores finales mostrados al usuario
                            arrayOrdenado.forEach(function (item) {
                                item._originalComentarios = item.Comentarios || "";
                                item._originalTurno = item.TurnoAsignado || "";
                            });

                            oLicencesModel.setData(arrayOrdenado);
                            Utils.onCountItems(oView, arrayOrdenado);

                            //CLONAR Y AGREGAR DESCRIPCIONES TAMBIÉN AL CLON
                            const arrayClonado = JSON.parse(JSON.stringify(arrayOrdenado));
                            arrayClonado.forEach(item => {
                                item.isEditable = bIsEditable;
                            });

                            // Modelo que usa la tabla cronológica
                            const oListCronoModel = new JSONModel(arrayClonado);
                            oView.setModel(oListCronoModel, "listCronoModel");

                            // Transformar datos para TreeTable
                            const aTreeData = TreeTableHelper.transformToTreeStructure(arrayClonado);

                            function preserveNodeData(nodes) {
                                nodes.forEach(node => {
                                    // Preservar tramitación
                                    if (!node.tramitacionColorFecha && node.Id) {
                                        const original = arrayClonado.find(item => item.Id === node.Id);
                                        if (original && original.tramitacionColorFecha) {
                                            node.tramitacionColorFecha = original.tramitacionColorFecha;
                                        }
                                    }

                                    // Preservar descripciones de equipo para nodos grupo
                                    if (node._isGroup && node.Equnr) {
                                        const original = arrayClonado.find(item => item.Equnr === node.Equnr);
                                        if (original) {
                                            node.DescEquipo = original.DescEquipo || "";
                                            node.EquipoCompleto = original.EquipoCompleto || node.Equnr;
                                        }
                                    }

                                    // 🆕 COPIAR ADJUNTOS DE LICENCESJONMODEL A LISTCRONOTREEMODEL
                                    if (node._isGroup === false && node.Id) {
                                        // Buscar la licencia original en LicencesJsonModel
                                        const original = arrayClonado.find(item => item.Id === node.Id);
                                        if (original) {
                                            // Copiar AttachmentXLicencia_nav
                                            node.AttachmentXLicencia_nav = original.AttachmentXLicencia_nav || { results: [] };
                                            node.Attachments = original.Attachments || [];

                                            // Marcar si tiene adjuntos
                                            const aAdjuntos = node.AttachmentXLicencia_nav?.results ||
                                                node.AttachmentXLicencia_nav ||
                                                node.Attachments ||
                                                [];

                                            node._tieneAdjuntos = aAdjuntos.length > 0;
                                            node._adjuntos = aAdjuntos;
                                            node._cantidadAdjuntos = aAdjuntos.length;

                                            if (aAdjuntos.length > 0) {
                                                console.log(`      📎 Copiados ${aAdjuntos.length} adjunto(s) para ${node.Id}`);
                                            }
                                        }
                                    }

                                    // Recursivo para hijos
                                    if (node.children && node.children.length > 0) {
                                        preserveNodeData(node.children);
                                    }
                                });
                            }
                            preserveNodeData(aTreeData);

                            const oTreeModel = ModelHelper.getModel("listCronoTreeModel", oView);
                            oTreeModel.setData(aTreeData);
                            oTreeModel.refresh();
                            this._marcarAdjuntosEnListadoCronologico();
                            this._ajustarAltoFilasCrono();

                            function sortByTurnoAsignado(a, b) {
                                const toMinutes = (hora) => {
                                    if (!hora) return 0;
                                    const [h, m] = hora.split(":").map(Number);
                                    return h * 60 + m;
                                };

                                return toMinutes(a.TurnoAsignado) - toMinutes(b.TurnoAsignado);
                            }

                            this._loadAttachmentsForLicensesAsync(arrayOrdenado)
                                .then(() => {
                                })
                                .catch((error) => {
                                    console.error("Error al cargar adjuntos:", error);
                                });

                            this._checkUnassignedLicenses(oFechaTurno);
                            this._updateEditableState();
                        });
                })
                .catch((error) => {
                    oLicencesModel.setData([]);
                });
        },

        // POR SI FALLA ESTE BUSCARIA EN SERIE NO EN PARALELO COMO EL PROMISE.ALL
        // successSelectTurno: async function (data) {
        //     const oView = this.getView()
        //     const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
        //     const oDataModel = this.getView().getModel();

        //     try {
        //         const aResults = Array.isArray(data?.results) ? data.results : [];

        //         if (!aResults.length) {
        //             oLicencesModel.setData([]);
        //             Utils.onCountItems(this,[]);
        //             return;
        //         }

        //         // Buscar una licencia por vez (sin Promise.all)
        //         const results = [];
        //         for (const licencia of aResults) {
        //             try {
        //                 const licData = await LicenseService.FIND(licencia, oDataModel);
        //                 results.push(licData);
        //             } catch (err) {
        //                 // Si querés seguir aunque falle una licencia:
        //                 console.error("Error en FIND para licencia", licencia, err);
        //                 // Si en vez de seguir querés cortar, podés hacer: throw err;
        //             }
        //         }

        //         if (!results.length) {
        //             oLicencesModel.setData([]);
        //             Utils.onCountItems(this,[]);
        //             return;
        //         }

        //         // Procesar lógica de negocio
        //         const arrayOrdenado = TurnosService.encontrarGrupo(
        //             TurnosService.ordenarPorEqunr(results), this.getView()
        //         );

        //         TurnosService.assignShiftsToLicences(arrayOrdenado);

        //         console.log(oLicencesModel)

        //         oLicencesModel.setData(arrayOrdenado);


        //         Utils.onCountItems(this,arrayOrdenado);

        //     } catch (error) {
        //         console.error("Error en successSelectTurno:", error);
        //         oLicencesModel.setData([]);
        //         Utils.onCountItems(this,[]);

        //     }
        // },

        onChangeHour: function (oEvent) {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oSource = oEvent.getSource();
            const sPath = oSource.getBindingContext("LicencesJsonModel").getPath();
            const iLicenseIndex = parseInt(sPath.split("/")[1], 10);

            const oModel = this.getView().getModel("LicencesJsonModel");
            const aLicences = oModel.getProperty("/");
            const sNewTime = oEvent.getParameter("value");
            const oSelectedLicence = aLicences[iLicenseIndex];

            // ✅ NUEVO: Si el campo quedó vacío, recalcular según la regla
            if (!sNewTime || sNewTime.trim() === "") {
                this._recalculateEmptyShift(aLicences, oSelectedLicence, iLicenseIndex);

                oModel.setProperty("/", aLicences);
                oModel.refresh(true);
                return;
            }

            // Validación: rango prohibido 5:30 - 6:30
            if (this._isTimeInRestrictedRange(sNewTime)) {
                MessageBox.error(
                    oResourceBundle.getText("invalidShiftTimeRange"),
                    {
                        title: oResourceBundle.getText("validationError"),
                        onClose: function () {
                            oSource.setValue("");
                            oSource.setValueState(CoreLibrary.ValueState.Error);
                            //oSource.setValueStateText(oResourceBundle.getText("invalidShiftTimeRange"));

                            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, "");

                            this._rebuildFrontendGroupsByEquipoHora(aLicences);

                            // ordenar y refrescar el modelo completo
                            this._sortLicences(aLicences);
                            oModel.setProperty("/", aLicences);
                            oModel.refresh(true);
                        }.bind(this)
                    }
                );
                return;
            }

            oSource.setValueState(CoreLibrary.ValueState.None);
            oSource.setValueStateText("");

            // Solo actualizar licencia individual
            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, sNewTime);
            this._rebuildFrontendGroupsByEquipoHora(aLicences);
            this._assignGroupColors(aLicences);

            this._sortLicences(aLicences);

            const iNewIndex = aLicences.findIndex(function (lic) {
                return lic === oSelectedLicence;
            });

            var aWarningItems = this._cascadeGroupsDown(aLicences, iNewIndex, oSource);

            this._rebuildFrontendGroupsByEquipoHora(aLicences);
            this._assignGroupColors(aLicences);

            oModel.setProperty("/", aLicences);
            oModel.refresh(true);

            // Limpiar el warning del modelo tras 4 segundos (se muestra una sola vez)
            if (aWarningItems && aWarningItems.length > 0) {
                setTimeout(function () {
                    aWarningItems.forEach(function (it) { it.TurnoWarning = ""; });
                    oModel.refresh(true);
                }, 4000);
            }
        },

        _recalculateEmptyShift: function (aLicences, oSelectedLicence, iLicenseIndex) {
            const consola = oSelectedLicence.Consola;

            if (!consola) {
                return;
            }

            // 1) Actualizar el grupo actual a vacío
            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, "");

            // 2) Agrupar por consola
            const groupsMap = {};
            aLicences.forEach(function (lic, idx) {
                if (lic.Consola !== consola) return;

                const grupo = lic.Grupo || lic.Equnr || "";
                if (!groupsMap[grupo]) {
                    groupsMap[grupo] = {
                        grupo: grupo,
                        items: [],
                        firstIndex: idx
                    };
                }
                groupsMap[grupo].items.push(lic);
                if (idx < groupsMap[grupo].firstIndex) {
                    groupsMap[grupo].firstIndex = idx;
                }
            });

            const groups = Object.keys(groupsMap).map(k => groupsMap[k]);
            groups.sort((a, b) => a.firstIndex - b.firstIndex);

            // 3) Encontrar el grupo actual
            const currentGroupIndex = groups.findIndex(g =>
                g.items.indexOf(oSelectedLicence) !== -1
            );

            if (currentGroupIndex === -1) {
                return;
            }

            // 4) Buscar el grupo anterior con turno
            let prevGroupWithShift = null;
            let prevStartMinutes = null;

            for (let i = currentGroupIndex - 1; i >= 0; i--) {
                const prevGroup = groups[i];
                const firstWithTurno = prevGroup.items.find(it => !!it.TurnoAsignado);

                if (firstWithTurno) {
                    prevGroupWithShift = prevGroup;
                    prevStartMinutes = this._convertShiftToMinutes(firstWithTurno.TurnoAsignado);
                    break;
                }
            }

            // 5) Si hay grupo anterior, calcular el nuevo turno según la regla
            if (prevGroupWithShift && prevStartMinutes !== null) {
                const prevInfo = Utils.getShiftInfo(prevGroupWithShift.items[0]);
                const calculatedStart = prevStartMinutes + prevInfo.duration;
                const newTimeStr = this._formatTime(calculatedStart);

                // Asignar el turno calculado al grupo actual
                groups[currentGroupIndex].items.forEach(it => {
                    it.TurnoAsignado = newTimeStr;
                });

                // 6) Recalcular grupos siguientes en cascada
                this._recalculateFollowingGroups(groups, currentGroupIndex);
            } else {
                // Si no hay grupo anterior, usar el turno inicial por defecto (7:00)
                const defaultStart = 7 * 60; // 7:00 AM
                const newTimeStr = this._formatTime(defaultStart);

                groups[currentGroupIndex].items.forEach(it => {
                    it.TurnoAsignado = newTimeStr;
                });

                // Recalcular grupos siguientes
                this._recalculateFollowingGroups(groups, currentGroupIndex);
            }

            this._rebuildFrontendGroupsByEquipoHora(aLicences);
            this._assignGroupColors(aLicences);
            this._sortLicences(aLicences);
        },

        _recalculateFollowingGroups: function (groups, startIndex) {
            let prevStart = null;
            let prevGroup = null;

            // Obtener el inicio del grupo actual
            const currentGroup = groups[startIndex];
            const currentFirstWithTurno = currentGroup.items.find(it => !!it.TurnoAsignado);

            if (currentFirstWithTurno) {
                prevStart = this._convertShiftToMinutes(currentFirstWithTurno.TurnoAsignado);
                prevGroup = currentGroup;
            } else {
                return; // No hay turno para calcular
            }

            // Recalcular grupos siguientes
            for (let i = startIndex + 1; i < groups.length; i++) {
                const group = groups[i];
                const gFirstWithTurno = group.items.find(it => !!it.TurnoAsignado);

                if (!gFirstWithTurno) {
                    continue; // Saltar grupos sin turno
                }

                const prevInfo = Utils.getShiftInfo(prevGroup.items[0]);
                const expectedStart = prevStart + prevInfo.duration;
                const currentStart = this._convertShiftToMinutes(gFirstWithTurno.TurnoAsignado);

                // Si el turno actual está adelante del esperado, no recalcular (respeta manual)
                if (currentStart > expectedStart) {
                    prevGroup = group;
                    prevStart = currentStart;
                    continue;
                }

                // Recalcular el grupo
                const newTimeStr = this._formatTime(expectedStart);
                group.items.forEach(it => {
                    it.TurnoAsignado = newTimeStr;
                });

                prevGroup = group;
                prevStart = expectedStart;
            }
        },

        _updateSameGroupAndConsoleShifts: function (aLicences, oSelectedLicence, sNewTime) {
            // Recorre las licencias y actualiza el horario solo de aquellas que comparten el mismo Grupo y Consola
            aLicences.forEach(function (oLicence) {
                if (oLicence.Consola === oSelectedLicence.Consola && oLicence.Grupo === oSelectedLicence.Grupo) {
                    oLicence.TurnoAsignado = sNewTime;
                }
            });
        },
        _sortLicences: function (aLicences) {
            // Ordena por consola (alfabético) y dentro de cada consola por TurnoAsignado (hora asignada).
            var mPorConsola = {};
            aLicences.forEach(function (lic, index) {
                var consola = lic.Consola || "";
                if (!mPorConsola[consola]) {
                    mPorConsola[consola] = [];
                }
                mPorConsola[consola].push({ lic: lic, originalIndex: index });
            });

            var toMinutes = function (hora) {
                if (!hora) return Number.MAX_SAFE_INTEGER;
                var parts = hora.split(":");
                return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            };

            var result = [];

            // 1. Ordenar consolas alfabéticamente
            Object.keys(mPorConsola).sort().forEach(function (consola) {
                var aItems = mPorConsola[consola];

                // 2. Dentro de cada consola: por TurnoAsignado (hora asignada al turno)
                aItems.sort(function (a, b) {
                    var turnoA = toMinutes(a.lic.TurnoAsignado);
                    var turnoB = toMinutes(b.lic.TurnoAsignado);
                    if (turnoA !== turnoB) return turnoA - turnoB;
                    return a.originalIndex - b.originalIndex;
                });

                aItems.forEach(function (item) {
                    result.push(item.lic);
                });
            });

            // Reemplazamos el contenido del array original
            aLicences.length = 0;
            Array.prototype.push.apply(aLicences, result);
        },

        // Ordenamiento para creación de nuevo turno:
        // consola → hora de inicio (Timbeg) → prioridad de condición de entrega/maniobras
        _sortLicencesNuevoTurno: function (aLicences) {
            // Prioridad por categoría (Condición de Entrega):
            // 1 Consignación de línea
            // 2 Consignación de Equipo
            // 3 Maniobras s/Consignación
            // 4 TcT (con o sin bloqueo)
            // 5 Sin Maniobras / resto
            var mCategoryPriority = {
                "ConsignacionLinea": 1,
                "ConsignacionEquipo": 2,
                "ManiobrasSinConsignacion": 3,
                "TCTConBloqueo": 4,
                "TCTSinBloqueo": 4,
                "SinManiobras": 5
            };

            var mPorConsola = {};
            aLicences.forEach(function (lic, index) {
                var consola = lic.Consola || "";
                if (!mPorConsola[consola]) {
                    mPorConsola[consola] = [];
                }
                mPorConsola[consola].push({ lic: lic, originalIndex: index });
            });

            var result = [];

            // 1. Ordenar consolas alfabéticamente
            Object.keys(mPorConsola).sort().forEach(function (consola) {
                var aItems = mPorConsola[consola];

                // 2. Dentro de cada consola: hora de inicio → prioridad categoría → orden original
                aItems.sort(function (a, b) {
                    var horaA = a.lic.InitHourSort != null ? a.lic.InitHourSort : Number.MAX_SAFE_INTEGER;
                    var horaB = b.lic.InitHourSort != null ? b.lic.InitHourSort : Number.MAX_SAFE_INTEGER;
                    if (horaA !== horaB) return horaA - horaB;

                    var catA = Utils.getShiftInfo(a.lic).category;
                    var catB = Utils.getShiftInfo(b.lic).category;
                    var prioA = mCategoryPriority[catA] || 5;
                    var prioB = mCategoryPriority[catB] || 5;
                    if (prioA !== prioB) return prioA - prioB;

                    return a.originalIndex - b.originalIndex;
                });

                aItems.forEach(function (item) {
                    result.push(item.lic);
                });
            });

            aLicences.length = 0;
            Array.prototype.push.apply(aLicences, result);
        },


        _convertShiftToMinutes: function (shift) {
            const [hours, minutes] = shift.split(":").map(Number);
            return hours * 60 + minutes;
        },

        onDeletePress: function (oEvent) {
            const oTable = this.getView().byId("turnosTable");

            // Intentar obtener índice del contexto del menú (clic derecho)
            let aIndicesToDelete = [];

            if (oEvent && oEvent.getSource) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                // Si viene del menú contextual, obtener la fila del binding context
                if (oContextMenu && oContextMenu.getBindingContext("LicencesJsonModel")) {
                    const sPath = oContextMenu.getBindingContext("LicencesJsonModel").getPath();
                    const iIndex = parseInt(sPath.split("/").pop());

                    if (!isNaN(iIndex)) {
                        aIndicesToDelete = [iIndex];
                    }
                }
            }

            if (aIndicesToDelete.length === 0) {
                const aSelectedIndices = oTable.getSelectedIndices();

                if (!aSelectedIndices || aSelectedIndices.length === 0) {
                    MessageToast.show("Por favor, seleccione al menos una fila para eliminar.");
                    return;
                }

                aIndicesToDelete = aSelectedIndices;
            }

            // Tomar fecha del turno (para la key Dateturno)
            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

            if (!oFechaTurno) {
                MessageBox.warning("Debe seleccionar una fecha de turno para poder eliminar.");
                return;
            }

            //  Obtener modelo local
            const oJsonModel = this.getView().getModel("LicencesJsonModel");
            let aLicenses = oJsonModel.getProperty("/") || [];

            if (!Array.isArray(aLicenses) || aLicenses.length === 0) {
                MessageToast.show("No hay datos para eliminar.");
                return;
            }

            //  Ordenar índices de mayor a menor para eliminar sin problemas
            const aSortedIndices = aIndicesToDelete.slice().sort(function (a, b) {
                return b - a;
            });

            const aDataToDelete = [];

            // Armar payload para backend y eliminar del modelo local
            aSortedIndices.forEach(function (index) {
                if (index >= 0 && index < aLicenses.length) {
                    const oRowData = aLicenses[index];

                    // Armo objeto clave para el OData
                    aDataToDelete.push({
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Tipo: oRowData.Tipo || "L",
                        Anio: oRowData.Anio,
                        Dateturno: oFechaTurno
                    });

                    // Eliminar del array local
                    aLicenses.splice(index, 1);
                }
            });

            if (aDataToDelete.length === 0) {
                MessageToast.show("No se encontraron filas válidas para eliminar.");
                return;
            }

            // 🔹 Actualizar modelo local y limpiar selección
            oJsonModel.setProperty("/", aLicenses);
            oJsonModel.refresh(true);
            oTable.clearSelection();

            // 🔹 Llamar al backend para eliminar en TurnosLicenciasSet
            const oDataService = this.getView().getModel();
            const entity = "/TurnosLicenciasSet";

            const aDeletePromises = aDataToDelete.map((item) => {
                return new Promise((resolve, reject) => {
                    const sKeyPath = oDataService.createKey(entity, {
                        Id: item.Id,
                        Empresa: item.Empresa,
                        Tipo: item.Tipo,
                        Anio: item.Anio,
                        Dateturno: item.Dateturno
                    });

                    oDataService.remove("/" + sKeyPath, {
                        success: () => {
                            resolve();
                        },
                        error: (oError) => {
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aDeletePromises)
                .then(() => {
                    Utils.onCountItems(this.getView(), aLicenses);
                    const iCount = aDataToDelete.length;
                    const sMsg = iCount === 1
                        ? "Se ha eliminado 1 licencia."
                        : "Se han eliminado " + iCount + " licencias.";
                    MessageToast.show(sMsg);
                })
                .catch((error) => {
                    MessageBox.error("Ocurrió un error al eliminar en backend.");
                });
        },


        onDetachLicense: function (oEvent) {
            var oTable = this.byId("turnosTable");
            var iSelectedIndex = -1;

            if (oEvent && oEvent.getSource) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                if (oContextMenu && oContextMenu.getBindingContext("LicencesJsonModel")) {
                    const sPath = oContextMenu.getBindingContext("LicencesJsonModel").getPath();
                    iSelectedIndex = parseInt(sPath.split("/").pop());

                    if (!isNaN(iSelectedIndex)) {
                    } else {
                        iSelectedIndex = -1;
                    }
                }
            }

            if (iSelectedIndex === -1) {
                iSelectedIndex = oTable.getSelectedIndex();

                if (iSelectedIndex === -1) {
                    MessageToast.show("Por favor, seleccione una fila para desacoplar.");
                    return;
                }
            }

            var oModel = this.getView().getModel("LicencesJsonModel");
            var aLicences = oModel.getData();

            // Check if the model data is available and the index is valid
            if (!oModel || !aLicences || iSelectedIndex < 0 || iSelectedIndex >= aLicences.length) {
                MessageToast.show("Datos no válidos.");
                return;
            }

            // Detach the selected license
            var oDetachedLicense = aLicences.splice(iSelectedIndex, 1)[0];
            var groupConsola = oDetachedLicense.Consola;  // Get the Consola value (group identifier)

            // Find the last item in the same group
            var groupLastIndex = -1;
            for (var i = aLicences.length - 1; i >= 0; i--) {
                if (aLicences[i].Consola === groupConsola) {
                    groupLastIndex = i;
                    break;
                }
            }

            if (groupLastIndex === -1) {
                MessageToast.show("No se encontró el grupo de la licencia.");
                return;
            }

            // Get the last license in the group to calculate the new time 
            var oLastLicenseInGroup = aLicences[groupLastIndex];
            var currentTime = this._convertShiftToMinutes(oLastLicenseInGroup.TurnoAsignado);
            const shiftInfo = Utils.getShiftInfo(oDetachedLicense);
            const shiftDuration = shiftInfo.duration;

            currentTime += shiftDuration;
            oDetachedLicense.TurnoAsignado = this._formatTime(currentTime);

            // Assign a unique group for the detached license
            oDetachedLicense.Grupo = "_Desacoplado_" + oDetachedLicense.Id;

            // Insert the detached license after the last element of the group
            aLicences.splice(groupLastIndex + 1, 0, oDetachedLicense);

            this._rebuildFrontendGroupsByEquipoHora(aLicences);
            this._assignGroupColors(aLicences);

            // Update the model
            oModel.setProperty("/", aLicences);
            oModel.refresh(true);

            // Clear selection in the table
            oTable.clearSelection();

            // Notify the user
            MessageToast.show("Licencia desacoplada, asignada después del último elemento del grupo con nuevo turno y grupo individual.");
        },

        _formatTime: function (iMinutes) {
            // Convertir los minutos de nuevo a formato HH:mm
            var iHours = Math.floor(iMinutes / 60);
            var iRemainderMinutes = iMinutes % 60;

            // Asegurarse de que siempre tenga 2 dígitos
            return (iHours < 10 ? "0" : "") + iHours + ":" + (iRemainderMinutes < 10 ? "0" : "") + iRemainderMinutes;
        },
        onAddLicense: function () {
            this.onSelectLicense()
                .then(function () {
                    this.openDialog("transener.sistemadeturnos.fragments.addLicenses");
                }.bind(this));
        },
        onSelectLicense: function () {
            const oSearchModel = ModelHelper.getModel("SearchLicense", this.getView());
            this.getView().setModel(oSearchModel, "SearchLicense");

            var dateTurno = this.byId('date');

            const FechaTurno = dateTurno.getDateValue()


            return TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: true })
                .then((resultadoFinal) => {

                    // 1) Tomamos las licencias ya agregadas
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
                    const aLicenciasExistentes = oLicencesModel?.getData() || [];

                    // 2) Armamos un Set con los Id ya existentes
                    const idsExistentes = new Set(
                        aLicenciasExistentes.map((l) => l.Id)   // 🔁 CAMBIAR "Id" por tu campo real (p.ej. "IdLicencia")
                    );

                    // 3) Nos quedamos SOLO con las nuevas
                    const aNuevas = resultadoFinal.filter(item =>
                        !idsExistentes.has(item.Id)             // 🔁 mismo campo que arriba
                    );

                    // 4) Guardamos SOLO las nuevas en el modelo de búsqueda
                    oSearchModel.setData(aNuevas);
                    oSearchModel.refresh();


                })
                .catch((error) => {
                    oSearchModel.setData([]);
                    oSearchModel.refresh();
                });
        },
        showGlobalBusy: function (sText) {
            var oView = this.getView();

            if (!this._pBusyDialog) {
                this._pBusyDialog = Fragment.load({
                    id: oView.getId(), // 👈 MUY IMPORTANTE
                    name: "transener.sistemadeturnos.fragments.BusyDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pBusyDialog.then(function (oDialog) {
                // Ahora this.byId sí ve el Text del fragment
                var oLabel = this.byId("busyLabel");
                if (oLabel) {
                    oLabel.setText(sText || "");
                }
                oDialog.open();
            }.bind(this));
        },

        hideGlobalBusy: function () {
            if (this._pBusyDialog) {
                this._pBusyDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },
        openDialog: function (fragment) {
            var oView = this.getView();

            // Si ya había un diálogo, lo destruyo
            if (oDialog) {
                oDialog.destroy();
                oDialog = null;
            }

            Fragment.load({
                id: oView.getId(),
                name: fragment,
                controller: this,
            }).then(function (oFragment) {
                oDialog = oFragment;

                // Lo cuelgo de la vista
                oView.addDependent(oDialog);

                var oSearchLicenseModel = oView.getModel("SearchLicense");
                if (oSearchLicenseModel) {
                    oDialog.setModel(oSearchLicenseModel, "SearchLicense");
                }

                oDialog.open();
            }.bind(this));
        },


        closeDialog: function () {
            if (oDialog) {
                oDialog.close();
            }
        },

        onPressAdd: function () {
            var oTable = this.byId("idLicensesTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageBox.warning("Debe seleccionar al menos un elemento.");
                return;
            }

            // Datos seleccionados desde SearchLicense
            var aSelectedData = aSelectedItems.map(oItem =>
                oItem.getBindingContext("SearchLicense").getObject()
            );

            // Modelo actual que ya contiene turnos asignados
            var oLicencesModel = this.getView().getModel("LicencesJsonModel");
            var aCurrentData = oLicencesModel.getProperty("/") || [];

            // Filtrar los que ya existen (según tu regla de Id)
            var aNewData = aSelectedData.filter(item =>
                !aCurrentData.some(existing => existing.Id === item.Id)
            );

            if (aNewData.length === 0) {
                MessageBox.information("Los elementos seleccionados ya están en la lista.");
                return;
            }

            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();
            const bIsEditable = this._isEditableTurno(oFechaTurno);

            aNewData.forEach(item => {
                item.isEditable = bIsEditable;
            });

            // Extraer combinaciones únicas de Equnr + Tplnr
            const aEquiposUnicos = aNewData
                .map(item => ({
                    Equnr: (item.Equnr || "").trim(),
                    Tplnr: (item.Tplnr || "").trim()
                }))
                .filter(item => item.Equnr && item.Tplnr);

            // Eliminar duplicados
            const aEquiposUnicosDedup = Array.from(
                new Map(aEquiposUnicos.map(item => [JSON.stringify(item), item])).values()
            );

            if (aEquiposUnicosDedup.length === 0) {
                TurnosService.appendLicencesToModel(aNewData, this.getView());
                MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");
                return;
            }

            // Obtener descripciones
            this._obtenerDescripcionesEquipos(aEquiposUnicosDedup)
                .then((oDescripcionesEquipos) => {

                    aNewData.forEach(item => {
                        const sEquipoNormalizado = (item.Equnr || "").trim();
                        item.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                        item.EquipoCompleto = item.DescEquipo
                            ? item.Equnr + " - " + item.DescEquipo
                            : item.Equnr;
                    });

                    TurnosService.appendLicencesToModel(aNewData, this.getView());
                    MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");
                })
                .catch((error) => {
                    TurnosService.appendLicencesToModel(aNewData, this.getView());
                    MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");
                });
        },

        // ==================== CÓDIGO CORREGIDO - POPOVER COMBO ====================

        onOpenAccionesMultiplePopover: function (oEvent) {
            var oButton = oEvent.getSource();
            var oView = this.getView();

            this._oRowContext = oButton.getBindingContext("LicencesJsonModel");
            if (!this._oRowContext) {
                sap.m.MessageToast.show("No se pudo obtener el contexto de la fila.");
                return;
            }

            var oModel = oView.getModel("LicencesJsonModel");
            var sPath = this._oRowContext.getPath();
            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas");

            if (!Array.isArray(aAccionesEntregas)) {
                aAccionesEntregas = [];
                oModel.setProperty(sPath + "/accionesEntregas", aAccionesEntregas);
            }

            if (this._oComboPopover) {
                this._oComboPopover.destroy();
                this._oComboPopover = null;
            }

            Fragment.load({
                id: oView.getId(),
                name: "transener.sistemadeturnos.fragments.ComboPopover",
                controller: this
            }).then(function (oPopover) {
                this._oComboPopover = oPopover;
                oView.addDependent(oPopover);

                const oCell = oButton.getParent();

                this._initializeCheckBoxes(aAccionesEntregas);

                oPopover.openBy(oCell);
                // Obtener la fila de la tabla en lugar del botón
                var oRow = this._getTableRowFromControl(oButton);
                var oTarget = oRow || oButton;
                oPopover.openBy(oTarget);
            }.bind(this));
        },

        _initializeCheckBoxesEntrega: function () {
            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            // Obtener todas las acciones ya guardadas
            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            const aAcciones = oAccionesModel.getData();

            // ✅ NUEVO: Buscar acciones que contengan el ID de esta licencia
            const aAccionesLicencia = aAcciones.filter(a => {
                const sIdLicencia = a.idLicencia || "";
                const aIds = sIdLicencia.split(" / ").map(id => id.trim());
                return aIds.includes(oLicencia.Id);
            });

            // Array de códigos ya seleccionados
            const aCodigosSeleccionados = aAccionesLicencia.map(a => a.accion);

            this._accionesSeleccionadasTemp = {};

            setTimeout(() => {
                const oList = this.byId("listaAccionesEntrega");

                if (!oList) {
                    return;
                }

                const aItems = oList.getItems();

                aItems.forEach(oItem => {
                    const oCheckBox = oItem.getContent()[0];

                    if (oCheckBox && oCheckBox.isA("sap.m.CheckBox")) {
                        const sKey = oCheckBox.data("key");
                        const sDescripcion = oCheckBox.data("descripcion");

                        const bSelected = aCodigosSeleccionados.includes(sKey);
                        oCheckBox.setSelected(bSelected);

                        if (bSelected) {
                            this._accionesSeleccionadasTemp[sKey] = {
                                codigo: sKey,
                                descripcion: sDescripcion
                            };
                        }
                    }
                });

            }, 100);
        },

        onClosePopover: function () {
            if (this._oComboPopover) {
                this._oComboPopover.close();
            }
            this._oRowContext = null;
        },

        onCheckBoxSelect: function (oEvent) {
            var oCheckBox = oEvent.getSource();

            var aCustomData = oCheckBox.getCustomData();
            var sKey = null;

            if (aCustomData && aCustomData.length > 0) {
                for (var i = 0; i < aCustomData.length; i++) {
                    if (aCustomData[i].getKey() === "key") {
                        sKey = aCustomData[i].getValue();
                        break;
                    }
                }
            }

            if (!sKey) {
                return;
            }

            if (!this._oRowContext) {
                sap.m.MessageToast.show("No se pudo obtener el contexto de la fila.");
                return;
            }

            var oModel = this.getView().getModel("LicencesJsonModel");
            var sPath = this._oRowContext.getPath();
            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas") || [];

            if (oCheckBox.getSelected()) {
                var bExiste = aAccionesEntregas.some(function (oEntry) {
                    return oEntry && oEntry.nombre === sKey;
                });

                if (!bExiste) {
                    aAccionesEntregas.push({
                        nombre: sKey,
                        descripcion: "Descripción para " + sKey
                    });
                }
            } else {
                aAccionesEntregas = aAccionesEntregas.filter(function (oEntry) {
                    return oEntry && oEntry.nombre !== sKey;
                });
            }

            oModel.setProperty(sPath + "/accionesEntregas", aAccionesEntregas);
        },

        formatCheckBoxSelected: function (aAccionesEntregas, sCheckBoxKey) {
            return aAccionesEntregas && aAccionesEntregas.some(function (oEntry) {
                return oEntry.nombre === sCheckBoxKey;
            });
        },


        // --------------------------- POP UP CONSOLA ------------

        onSaveTurnoPress: function () {
            let Fecha = this._oFechaTurnoCreado || this.getView().byId('date').getDateValue();

            if (!RoleHelper.isEditor()) {
                MessageBox.error("No tenés permisos para realizar esta acción");
                return;
            }

            if (!Fecha) {
                MessageBox.warning("Debe seleccionar una fecha para guardar el turno.");
                return;
            }

            const oModel = this.getView().getModel("LicencesJsonModel");
            const aAllLicences = oModel.getProperty("/") || [];

            if (!aAllLicences || aAllLicences.length === 0) {
                MessageBox.warning("No hay datos para guardar.");
                return;
            }

            aAllLicences.forEach((lic, idx) => {
                if (lic.Attachments && lic.Attachments.length > 0) {
                    lic.Attachments.forEach((att, attIdx) => {
                        console.log(`   📎 Adjunto ${attIdx + 1}:`, {
                            AttachmentName: att.AttachmentName,
                            TieneAttindex: !!att.Attindex,
                            AttachmentType: att.AttachmentType,
                            AttachmentSize: att.AttachmentSize
                        });
                    });
                }
            });

            // VALIDACIÓN: Verificar que todas las licencias tengan horario asignado
            const aLicenciasSinHorario = aAllLicences.filter(lic => {
                const turno = lic.TurnoAsignado;
                return !turno || turno.trim() === "";
            });

            if (aLicenciasSinHorario.length > 0) {
                const sLicenciasDetalle = aLicenciasSinHorario
                    .map(lic => `• Licencia ${lic.Id} (${lic.Equnr || 'Sin equipo'})`)
                    .join("\n");

                MessageBox.error(
                    `No se puede guardar el turno porque hay ${aLicenciasSinHorario.length} licencia(s) sin horario asignado:\n\n${sLicenciasDetalle}\n\nPor favor, asigne un horario a todas las licencias antes de guardar.`,
                    {
                        title: "Horarios sin asignar",
                        styleClass: "sapUiSizeCompact"
                    }
                );
                return;
            }

            this._checkNewLicensesBeforeSave(Fecha)
                .then((bContinue) => {
                    if (!bContinue) {
                        return;
                    }

                    const aData = [];

                    aAllLicences
                        .filter(function (oRowData) {
                            return oRowData.Comentarios !== oRowData._originalComentarios
                                || oRowData.TurnoAsignado !== oRowData._originalTurno;
                        })
                        .forEach(function (oRowData) {
                            const row = {
                                Id: oRowData.Id,
                                Empresa: oRowData.Empresa,
                                Tipo: oRowData.Tipo,
                                Anio: oRowData.Anio,
                                Fecha: Fecha,
                                Turno: oRowData.TurnoAsignado,
                                Comentarios: oRowData.Comentarios,
                                Enviado: false,
                                Agrmanual: oRowData.Agrmanual || false
                            };

                            aData.push(row);
                        });

                    if (aData.length === 0) {
                        MessageToast.show("No hay cambios para guardar");
                        this.hideGlobalBusy();
                        return;
                    }

                    this.createTurno(aData, aAllLicences, false);
                })
                .catch((error) => {
                    const aData = [];

                    aAllLicences
                        .filter(function (oRowData) {
                            return oRowData.Comentarios !== oRowData._originalComentarios
                                || oRowData.TurnoAsignado !== oRowData._originalTurno;
                        })
                        .forEach(function (oRowData) {
                            const row = {
                                Id: oRowData.Id,
                                Empresa: oRowData.Empresa,
                                Tipo: oRowData.Tipo,
                                Anio: oRowData.Anio,
                                Fecha: Fecha,
                                Turno: oRowData.TurnoAsignado,
                                Comentarios: oRowData.Comentarios,
                                Enviado: false,
                                Agrmanual: oRowData.Agrmanual || false
                            };

                            aData.push(row);
                        });

                    if (aData.length === 0) {
                        MessageToast.show("No hay cambios para guardar");
                        this.hideGlobalBusy();
                        return;
                    }

                    this.createTurno(aData, aAllLicences, false);
                });
        },

        createTurno: function (licencias, aAttachments, bEnviado) {
            const entity = "/TurnosLicenciasSet";
            const oDataService = this.getView().getModel();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            const sMensajeBusy = bEnviado ? "Enviando turno..." : "Guardando cambios...";
            this.showGlobalBusy(sMensajeBusy);

            const oComponent = this.getOwnerComponent();
            const aPromises = licencias.map((licencia) => {
                return new Promise((resolve, reject) => {
                    // Convertir Fecha a Date nativo si es necesario
                    let oFechaDate = licencia.Fecha;
                    if (!(oFechaDate instanceof Date)) {
                        if (typeof oFechaDate === 'string') {
                            // Intentar parsear formato DD/MM/YYYY o DD-MM-YYYY
                            const dateMatch = oFechaDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                            if (dateMatch) {
                                // Formato DD/MM/YYYY o DD-MM-YYYY
                                const day = parseInt(dateMatch[1], 10);
                                const month = parseInt(dateMatch[2], 10) - 1; // Los meses en Date son 0-indexados
                                const year = parseInt(dateMatch[3], 10);
                                oFechaDate = new Date(year, month, day, 0, 0, 0, 0);
                            } else {
                                // Intentar parseo estándar
                                oFechaDate = new Date(oFechaDate);
                            }
                        } else if (oFechaDate && typeof oFechaDate.getTime === 'function') {
                            // Es un objeto tipo Date (como SAP UI5 Date)
                            oFechaDate = new Date(oFechaDate.getTime());
                        } else {
                            oFechaDate = new Date();
                        }
                    }

                    // Asegurar que la fecha tenga hora 00:00:00 UTC para formato OData
                    if (oFechaDate instanceof Date && !isNaN(oFechaDate.getTime())) {
                        // Normalizar a UTC con hora 00:00:00
                        const year = oFechaDate.getFullYear();
                        const month = oFechaDate.getMonth();
                        const day = oFechaDate.getDate();
                        oFechaDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                    }

                    const license = {
                        "Id": licencia.Id,
                        "Empresa": licencia.Empresa,
                        "Tipo": licencia.Tipo || "L",
                        "Anio": licencia.Anio,
                        "Dateturno": oFechaDate,
                        "Turno": licencia.Turno,
                        "Comentarios": licencia.Comentarios,
                        "Enviado": bEnviado !== undefined ? bEnviado : licencia.Enviado,
                        "Agrmanual": licencia.Agrmanual || false
                    };

                    // Si bEnviado es true, primero intentar actualizar el turno existente
                    if (bEnviado === true) {
                        // Usar createKey del modelo OData para construir la key automáticamente desde el metadata
                        const sKey = oDataService.createKey(entity, {
                            Id: license.Id,
                            Empresa: license.Empresa,
                            Tipo: license.Tipo,
                            Anio: license.Anio,
                            Dateturno: license.Dateturno
                        });

                        // Intentar actualizar primero (PUT para no requerir GET_ENTITY)
                        oDataService.update(sKey, license, {
                            merge: false,
                            success: () => {
                                resolve();
                            },
                            error: (oError) => {
                                // Si el update falla (turno no existe), crear nuevo
                                oDataService.create(entity, license, {
                                    success: () => {
                                        resolve();
                                    },
                                    error: (oCreateError) => {
                                        reject(oCreateError);
                                    }
                                });
                            }
                        });
                    } else {
                        // Intentar actualizar primero (para preservar todos los campos como Comentarios)
                        const sKey = oDataService.createKey(entity, {
                            Id: license.Id,
                            Empresa: license.Empresa,
                            Tipo: license.Tipo,
                            Anio: license.Anio,
                            Dateturno: license.Dateturno
                        });

                        oDataService.update(sKey, license, {
                            merge: false,
                            success: () => {
                                resolve();
                            },
                            error: () => {
                                // Si el update falla (turno no existe aún), crear nuevo
                                oDataService.create(entity, license, {
                                    success: () => {
                                        resolve();
                                    },
                                    error: (oCreateError) => {
                                        reject(oCreateError);
                                    }
                                });
                            }
                        });
                    }
                });
            });

            Promise.all(aPromises)
                .then(() => {

                    const sMensajeExito = bEnviado
                        ? "Turno enviado exitosamente"
                        : "Cambios guardados correctamente";
                    MessageToast.show(sMensajeExito);
                    this._suppressLicenseAlert = true;

                    if (licencias && licencias.length > 0) {
                        this._saveAttachments(licencias)
                            .then(() => {
                                this._recargarDatosDespuesDeGuardar();
                            });
                    } else {
                        this._recargarDatosDespuesDeGuardar();
                    }
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al guardar los turnos");
                });
        },

        _recargarDatosDespuesDeGuardar: function () {
            const oView = this.getView();
            const oDataService = this.getView().getModel();
            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

            if (!oFechaTurno) {
                this.hideGlobalBusy();
                return;
            }

            // Preservar los Comentarios actuales antes de recargar desde el backend,
            // por si el backend no los devuelve (campo no soportado aún en TurnosLicencias)
            const oCurrentLicencesModel = this.getView().getModel("LicencesJsonModel");
            const aCurrentLicences = oCurrentLicencesModel ? oCurrentLicencesModel.getData() : [];
            const mComentariosPreservados = {};
            if (Array.isArray(aCurrentLicences)) {
                aCurrentLicences.forEach(function (item) {
                    if (item.Id && item.Comentarios) {
                        mComentariosPreservados[item.Id] = item.Comentarios;
                    }
                });
            }

            const sEmpresa = SocietyHelper.getCurrentSociety(oView);
            const aFilters = [
                new Filter("Dateturno", FilterOperator.EQ, oFechaTurno),
                new Filter("Empresa", FilterOperator.EQ, sEmpresa)
            ];

            const sEntity = "/TurnosLicenciasSet";
            oDataService.read(sEntity, {
                filters: aFilters,
                success: (oData) => {
                    const aResults = oData?.results || [];

                    if (aResults.length === 0) {
                        this.hideGlobalBusy();
                        MessageToast.show("Turno guardado correctamente");
                        return;
                    }

                    this.successSelectTurno(oData, mComentariosPreservados)
                        .then(() => {
                            setTimeout(() => {
                                this.hideGlobalBusy();
                                MessageToast.show("Turno guardado y actualizado correctamente");
                            }, 500);
                        })
                        .catch((err) => {
                            this.hideGlobalBusy();
                        });
                },
                error: (oError) => {
                    this.hideGlobalBusy();
                    MessageToast.show("Turno guardado (no se pudo recargar automáticamente)");
                }
            });
        },

        // ------------ FILTROS AVANZADOS ----------------------------------
        openAdvancedFilters: function () {
            const oView = this.getView();
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const oHardCodeModel = ModelHelper.getModel("HardCodeModel", oView);
            const PersonalHabilitadoModel = ModelHelper.getModel("PersonalHabilitadoModel", oView);
            const oRepModel = ModelHelper.getModel("RepositionTimes", oView);
            const oSelectModel = ModelHelper.getModel("SelectModel", oView);
            const society = this.society;

            // Carga servicios
            TipoEquipoService.loadTipoEquipo(society, oView);
            InterventionTypesService.getPromise(oView);

            // Si el diálogo no existe
            if (!this.advancedFilters) {

                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.advancedFilters",
                    controller: this
                }).then((oDialogContent) => {

                    const oDialog = new sap.m.Dialog({
                        title: "Filtros Avanzados",
                        contentWidth: "60%",
                        modal: true,
                        content: oDialogContent,
                        buttons: [
                            new sap.m.Button({
                                text: "Cancelar",
                                icon: "sap-icon://decline",
                                press: () => this.closeAdvancedFilters()
                            }).addStyleClass("buttonInverted floatLeft"),

                            new sap.m.Button({
                                text: "Limpiar",
                                icon: "sap-icon://document",
                                press: () => this.clearAdvancedFilters()
                            }).addStyleClass("buttonInverted floatLeft"),

                            new sap.m.Button({
                                text: "Aplicar",
                                icon: "sap-icon://search",
                                press: () => this.makeFilters()
                            }).addStyleClass("buttonInverted floatRight")
                        ]
                    }).addStyleClass("customDialog");

                    // Set models
                    oDialog.setModel(ModelHelper.getModel("WorkPlacesJsonModel", oView), "WorkPlacesJsonModel");
                    oDialog.setModel(oView.getModel("GrupoPlanificador"), "GrupoPlanificador");
                    oDialog.setModel(ModelHelper.getModel("TiposIntervencion", oView), "TiposIntervencion");
                    oDialog.setModel(ModelHelper.getModel("TipoEquipoJsonModel", oView), "TipoEquipoJsonModel");
                    oDialog.setModel(oSelectModel, "SelectModel");
                    oDialog.setModel(oFiltersModel, "FiltersJsonModel");
                    oDialog.setModel(oHardCodeModel, "HardCodeModel");
                    oDialog.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                    oDialog.setModel(oRepModel, "RepositionTimes");
                    oDialog.setModel(ModelHelper.getModel("TipoLicFiltersModel", oView), "TipoLicFiltersModel");
                    oDialog.setModel(ModelHelper.getModel("CheckAdvancedFiltersModel", oView), "CheckAdvancedFiltersModel");

                    this.advancedFilters = oDialog;
                    this.advancedFilters.open();
                });

            } else {
                // Si ya existe
                this.advancedFilters.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                this.advancedFilters.setModel(oSelectModel, "SelectModel");
                this.advancedFilters.setModel(oHardCodeModel, "HardCodeModel");
                this.advancedFilters.setModel(oFiltersModel, "FiltersJsonModel");
                this.advancedFilters.setModel(oRepModel, "RepositionTimes");
                this.advancedFilters.setModel(oView.getModel("RepositionTimes"), "RepositionTimes");
                this.advancedFilters.setModel(ModelHelper.getModel("WorkPlacesJsonModel", oView), "WorkPlacesJsonModel");
                this.advancedFilters.setModel(oView.getModel("GrupoPlanificador"), "GrupoPlanificador");
                this.advancedFilters.setModel(ModelHelper.getModel("TipoLicFiltersModel", oView), "TipoLicFiltersModel");
                this.advancedFilters.setModel(ModelHelper.getModel("CheckAdvancedFiltersModel", oView), "CheckAdvancedFiltersModel");
                this.advancedFilters.open();
            }
        },

        closeAdvancedFilters: function () {
            if (this.advancedFilters) {
                this.advancedFilters.close();
            }
        },

        clearAdvancedFilters: function () {
            const oView = this.getView();

            // Resetear el modelo de filtros a sus valores por defecto
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const sPath = sap.ui.require.toUrl("transener/sistemadeturnos/model/FiltersJsonModel.json");
            oFiltersModel.loadData(sPath, "", false);

            // Resetear el modelo de filtros locales
            const oLocalFiltersModel = ModelHelper.getModel("LocalFilterJsonModel", oView);
            oLocalFiltersModel.setData({});

            // Resetear checkboxes de filtros avanzados
            const oCheckModel = ModelHelper.getModel("CheckAdvancedFiltersModel", oView);
            oCheckModel.setData({
                Aro: false,
                Bloqueo: false,
                Rdisparo: false
            });

            MessageToast.show("Filtros limpiados");
        },

        makeFilters: function () {
            const oView = this.getView();
            const oDatePicker = this.byId("date");
            const oSelectedDate = oDatePicker.getDateValue();

            if (!oSelectedDate) {
                MessageBox.warning("Por favor seleccione una fecha primero");
                return;
            }

            // Cerrar el diálogo de filtros avanzados si está abierto
            this.closeAdvancedFilters();

            // Ver qué filtros están activos
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const oFilters = oFiltersModel.getData();

            for (const key in oFilters) {
                const filter = oFilters[key];
                if (filter.value !== null && filter.value !== undefined && filter.value !== "" &&
                    (Array.isArray(filter.value) ? filter.value.length > 0 : true)) {
                }
            }

            const sEmpresa = SocietyHelper.getCurrentSociety(oView);
            const aBackendFilters = [
                new Filter("Empresa", FilterOperator.EQ, sEmpresa),
                new Filter("Dateturno", FilterOperator.EQ, oSelectedDate)
            ];

            this.showGlobalBusy("Cargando turnos...");

            const oDataService = oView.getModel();

            oDataService.read("/TurnosLicenciasSet", {
                filters: aBackendFilters,
                success: (oData) => {

                    if (oData.results.length === 0) {
                        this.successSelectTurno({ results: [] });
                        this.hideGlobalBusy();
                        MessageToast.show("No hay turnos para esta fecha");
                        return;
                    }

                    let loadedCount = 0;
                    let errorCount = 0;

                    const aPromises = oData.results.map((turno, index) => {
                        return new Promise((resolve) => {
                            const sLicenciaPath = `/LicenciaTrabajoSet(Empresa='${turno.Empresa}',Id='${turno.Id}',Tipo='${turno.Tipo}',Anio='${turno.Anio}')`;

                            oDataService.read(sLicenciaPath, {
                                success: (oLicencia) => {
                                    turno.LicenciaTrabajo = oLicencia;
                                    loadedCount++;
                                    resolve(turno);
                                },
                                error: (oError) => {
                                    errorCount++;
                                    resolve(turno);
                                }
                            });
                        });
                    });

                    Promise.all(aPromises).then((aTurnosWithLicencias) => {
                        if (errorCount > 0) console.warn(`  - Errores al cargar: ${errorCount}`);

                        const withLicencia = aTurnosWithLicencias.filter(t => t.LicenciaTrabajo).length;

                        const aFiltered = this._applyAdvancedFiltersInMemory(aTurnosWithLicencias);
                        this.successSelectTurno({ results: aFiltered })
                            .then(() => {
                                const message = aFiltered.length === aTurnosWithLicencias.length
                                    ? `Mostrando turnos`
                                    : `Filtros aplicados`;
                                MessageToast.show(message);
                            })
                            .catch((err) => {
                            })
                            .finally(() => {
                                this.hideGlobalBusy();
                            });
                    });
                },
                error: (oError) => {
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    Utils.onCountItems(oView, []);
                    this.hideGlobalBusy();
                    MessageBox.error("Error al cargar turnos");
                }
            });
        },

        //FILTROS AVANZADOS - REGIONES
        _loadRegiones: function () {
            const oView = this.getView();
            const oRegionesModel = ModelHelper.getModel("RegionesJsonModel", oView);

            const oModel = this.getOwnerComponent().getModel();

            if (!oModel) {
                oRegionesModel.setData({
                    Regiones: [
                        { Werks: "102", Name1: "Transener - Reg Centro Este", Bukrs: "100" },
                        { Werks: "103", Name1: "Transener - Reg Norte", Bukrs: "100" },
                        { Werks: "104", Name1: "Transener - Reg Sur", Bukrs: "100" },
                        { Werks: "120", Name1: "ARO Transener", Bukrs: "100" }
                    ]
                });
                return;
            }

            const sEmpresa = SocietyHelper.getCurrentSociety(oView);
            const aFilters = [
                new sap.ui.model.Filter("Bukrs", sap.ui.model.FilterOperator.EQ, sEmpresa)
            ];

            oModel.read("/RegionesSet", {
                filters: aFilters,
                success: (oData) => {
                    oRegionesModel.setData({ Regiones: oData.results });
                },
                error: (oError) => {
                    oRegionesModel.setData({
                        Regiones: [
                            { Werks: "102", Name1: "Transener - Reg Centro Este", Bukrs: "100" },
                            { Werks: "103", Name1: "Transener - Reg Norte", Bukrs: "100" },
                            { Werks: "104", Name1: "Transener - Reg Sur", Bukrs: "100" },
                            { Werks: "120", Name1: "ARO Transener", Bukrs: "100" }
                        ]
                    });
                }
            });
        },

        _loadEstaciones: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oEstacionesModel = ModelHelper.getModel("EstacionesJsonModel", this.getView());

            if (!oModel) {
                oEstacionesModel.setData({ Estaciones: [] });
                return;
            }

            oModel.read("/EstacionesRolesSet", {
                success: (oData) => {
                    const aEstaciones = oData.results.sort((a, b) => a.Codigo.localeCompare(b.Codigo));
                    oEstacionesModel.setData({ Estaciones: aEstaciones });
                },
                error: () => {
                    oEstacionesModel.setData({ Estaciones: [] });
                }
            });
        },

        _loadPuestosTrabajo: function () {
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            const oWorkPlacesModel = ModelHelper.getModel("WorkPlacesJsonModel", oView);

            if (!oModel) {
                oWorkPlacesModel.setData({ WorkPlaces: [], FilteredWorkPlaces: [] });
                return;
            }

            oModel.read("/PuestoTrabajoSet", {
                success: (oData) => {
                    const aWerksTransener = ["102", "103", "104", "120"];
                    const aTransenerOnly = oData.results.filter(oWP => {
                        return aWerksTransener.includes(oWP.Werks);
                    });

                    const aPorRegion = aTransenerOnly.reduce((acc, oWP) => {
                        acc[oWP.Werks] = (acc[oWP.Werks] || 0) + 1;
                        return acc;
                    }, {});

                    const aWorkPlaces = aTransenerOnly.sort((a, b) => {
                        return (a.Ktext || "").localeCompare(b.Ktext || "");
                    });

                    console.groupEnd();

                    oWorkPlacesModel.setData({
                        WorkPlaces: aWorkPlaces,
                        FilteredWorkPlaces: aWorkPlaces
                    });
                },
                error: (oError) => {
                    console.groupEnd();

                    oWorkPlacesModel.setData({ WorkPlaces: [], FilteredWorkPlaces: [] });
                }
            });
        },

        _loadTipoEquipo: function () {
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            const oTipoEquipoModel = ModelHelper.getModel("TipoEquipoJsonModel", oView);
            const society = this.society;

            if (!oModel) {
                oTipoEquipoModel.setData({ TipoEquipo: [] });
                return;
            }

            const aFilters = [];
            if (society && society !== "null") {
                aFilters.push(new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, society));
            }

            oModel.read("/NSTipoEquipoSet", {
                filters: aFilters.length > 0 ? aFilters : undefined,
                success: (oData) => {
                    const aTipoEquipo = oData.results.sort((a, b) => {
                        return (a.Descripcion || "").localeCompare(b.Descripcion || "");
                    });

                    oTipoEquipoModel.setData({ TipoEquipo: aTipoEquipo });
                },
                error: (oError) => {
                    oTipoEquipoModel.setData({ TipoEquipo: [] });
                }
            });
        },

        _loadRepositionTimes: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oRepositionTimesModel = ModelHelper.getModel("RepositionTimes", this.getView());

            if (!oModel) {
                oRepositionTimesModel.setData({ RepositionTimes: [] });
                return;
            }

            const aFilters = [
                new sap.ui.model.Filter("Tabname", sap.ui.model.FilterOperator.EQ, "ZTAB_LICENCIAS"),
                new sap.ui.model.Filter("Fieldname", sap.ui.model.FilterOperator.EQ, "TIEMPOREP")
            ];

            oModel.read("/FixedValuesSet", {
                filters: aFilters,
                success: (oData) => {
                    oRepositionTimesModel.setData({ RepositionTimes: oData.results });
                },
                error: () => {
                    oRepositionTimesModel.setData({ RepositionTimes: [] });
                }
            });
        },

        _loadPersonalHabilitado: function () {
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            const oPersonalModel = ModelHelper.getModel("PersonalHabilitadoModel", oView);
            const sEmpresa = this.society || "100";

            if (!oModel) {
                oPersonalModel.setData({
                    Solicitante: [],
                    JefeDeTrabajo: []
                });
                return;
            }

            Promise.all([
                this._getSolicitantesPromise(oModel, sEmpresa),
                this._getJefesTrabajoPromise(oModel, sEmpresa)
            ]).then(([aSolicitantes, aJefes]) => {

                aSolicitantes.sort((a, b) => (a.Nombre || "").localeCompare(b.Nombre || ""));
                aJefes.sort((a, b) => (a.Nombre || "").localeCompare(b.Nombre || ""));

                console.groupEnd();

                oPersonalModel.setData({
                    Solicitante: aSolicitantes,
                    JefeDeTrabajo: aJefes
                });

            }).catch((error) => {
                oPersonalModel.setData({
                    Solicitante: [],
                    JefeDeTrabajo: []
                });
                console.groupEnd();
            });
        },

        _getSolicitantesPromise: function (oModel, sEmpresa) {
            return new Promise((resolve, reject) => {

                const aFilters = [
                    new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa),
                    new sap.ui.model.Filter("TipoHab", sap.ui.model.FilterOperator.EQ, "SO")
                ];

                oModel.read("/PersonalHabilitadoSet", {
                    filters: aFilters,
                    success: (oData) => {
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _getJefesTrabajoPromise: function (oModel, sEmpresa) {
            return new Promise((resolve, reject) => {

                const aFilters = [
                    new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa),
                    new sap.ui.model.Filter("TipoHab", sap.ui.model.FilterOperator.EQ, "JT"),
                    new sap.ui.model.Filter("ClaseHab", sap.ui.model.FilterOperator.EQ, "H0001")
                ];

                oModel.read("/PersonalHabilitadoSet", {
                    filters: aFilters,
                    success: (oData) => {
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _applyAdvancedFiltersInMemory: function (aData) {
            const oView = this.getView();
            const oFilters = ModelHelper.getModel("FiltersJsonModel", oView).getData();

            const DEBUG = true;
            const MAX_SAMPLES = 10;

            const stats = {
                total: aData.length,
                withLicencia: 0,
                included: 0,
                excluded: 0,
                reasons: {},
                samples: []
            };

            const norm = (v) => String(v ?? "").trim();
            const normUpper = (v) => norm(v).toUpperCase();

            const isActive = (f) => {
                if (!f) return false;
                const v = f.value;
                if (Array.isArray(v)) return v.length > 0;
                return v !== null && v !== undefined && String(v) !== "";
            };

            const licVal = (lic, key) => lic?.[key] ?? lic?.[key.toLowerCase()] ?? lic?.[key.toUpperCase()];

            const pushReason = (id, field, expected, actual, lic) => {
                stats.reasons[field] = (stats.reasons[field] || 0) + 1;
                if (DEBUG && stats.samples.length < MAX_SAMPLES) {
                    stats.samples.push({
                        id,
                        reason: field,
                        expected,
                        actual,
                        licSnapshot: {
                            R500kv: licVal(lic, "R500kv"),
                            Barrafs: licVal(lic, "Barrafs"),
                            Aro: licVal(lic, "Aro"),
                            Bloqueo: licVal(lic, "Bloqueo"),
                            Period: licVal(lic, "Period"),
                            Tiemporep: licVal(lic, "Tiemporep"),
                            Tipinterv: licVal(lic, "Tipinterv"),
                            Tipolicencia: licVal(lic, "Tipolicencia"),
                            Equstatnocam: licVal(lic, "Equstatnocam"),
                            Equstat: licVal(lic, "Equstat"),
                            Rdisparo: licVal(lic, "Rdisparo")
                        }
                    });
                }
            };

            const checkEQ = (id, lic, fieldName, expectedRaw, actualRaw, normalizeFn = norm) => {
                const expected = normalizeFn(expectedRaw);
                const actual = normalizeFn(actualRaw);
                if (expected === "") return true;

                if (actual === expected) return true;

                pushReason(id, fieldName, expected, actual, lic);
                return false;
            };

            const aFiltered = [];

            aData.forEach((item, index) => {
                const id = item.Id || `registro-${index}`;
                const lic = item.LicenciaTrabajo;

                if (!lic) {
                    pushReason(id, "SinLicenciaTrabajo", "(licencia requerida)", "(null/undefined)", {});
                    return;
                }
                stats.withLicencia++;

                // Arbpl
                if (isActive(oFilters.Arbpl) && !checkEQ(id, lic, "Arbpl", oFilters.Arbpl.value, licVal(lic, "Arbpl"), norm)) return;

                // Period
                if (isActive(oFilters.Period) && !checkEQ(id, lic, "Period", oFilters.Period.value, licVal(lic, "Period"), norm)) return;

                // Solicitante
                if (isActive(oFilters.Solicitante) && !checkEQ(id, lic, "Solicitante", oFilters.Solicitante.value, licVal(lic, "Solicitante"), norm)) return;

                // Tipoequipo
                if (isActive(oFilters.Tipoequipo) && !checkEQ(id, lic, "Tipoequipo", oFilters.Tipoequipo.value, licVal(lic, "Tipoequipo"), norm)) return;

                // R500kv (N/X)
                if (isActive(oFilters.R500kv) && !checkEQ(id, lic, "R500kv", oFilters.R500kv.value, licVal(lic, "R500kv"), normUpper)) return;

                // Barrafs (N/X)
                if (isActive(oFilters.Barrafs) && !checkEQ(id, lic, "Barrafs", oFilters.Barrafs.value, licVal(lic, "Barrafs"), normUpper)) return;

                // Tipinterv
                if (isActive(oFilters.Tipinterv) && !checkEQ(id, lic, "Tipinterv", oFilters.Tipinterv.value, licVal(lic, "Tipinterv"), norm)) return;

                // Tiemporep
                if (isActive(oFilters.Tiemporep) && !checkEQ(id, lic, "Tiemporep", oFilters.Tiemporep.value, licVal(lic, "Tiemporep"), norm)) return;

                // Tipolicencia
                if (isActive(oFilters.Tipolicencia) && !checkEQ(id, lic, "Tipolicencia", oFilters.Tipolicencia.value, licVal(lic, "Tipolicencia"), normUpper)) return;

                // SolSuplente
                if (isActive(oFilters.SolSuplente) && !checkEQ(id, lic, "SolSuplente", oFilters.SolSuplente.value, licVal(lic, "SolSuplente"), norm)) return;

                // Jobcond
                if (isActive(oFilters.Jobcond) && !checkEQ(id, lic, "Jobcond", oFilters.Jobcond.value, licVal(lic, "Jobcond"), norm)) return;

                // Jefe
                if (isActive(oFilters.Jefe) && !checkEQ(id, lic, "Jefe", oFilters.Jefe.value, licVal(lic, "Jefe"), norm)) return;

                // Aro (si viene vacío, se considera "todos")
                if (isActive(oFilters.Aro) && !checkEQ(id, lic, "Aro", oFilters.Aro.value, licVal(lic, "Aro"), normUpper)) return;

                // JefeSuplente
                if (isActive(oFilters.JefeSuplente) && !checkEQ(id, lic, "JefeSuplente", oFilters.JefeSuplente.value, licVal(lic, "JefeSuplente"), norm)) return;

                // Bloqueo (si viene vacío, se considera "todos")
                if (isActive(oFilters.Bloqueo) && !checkEQ(id, lic, "Bloqueo", oFilters.Bloqueo.value, licVal(lic, "Bloqueo"), normUpper)) return;

                // Equstatnocam (si viene vacío, se considera "todos")
                if (isActive(oFilters.Equstatnocam) && !checkEQ(id, lic, "Equstatnocam", oFilters.Equstatnocam.value, licVal(lic, "Equstatnocam"), normUpper)) return;

                // Rdisparo (si viene vacío, se considera "todos")
                if (isActive(oFilters.Rdisparo) && !checkEQ(id, lic, "Rdisparo", oFilters.Rdisparo.value, licVal(lic, "Rdisparo"), normUpper)) return;

                // SenalesC (array)
                if (isActive(oFilters.SenalesC)) {
                    const expectedSignals = oFilters.SenalesC.value;
                    const has = expectedSignals.some(s => {
                        switch (s) {
                            case "0": return normUpper(licVal(lic, "Senalestados")) === "X";
                            case "1": return normUpper(licVal(lic, "Senalalarmas")) === "X";
                            case "2": return normUpper(licVal(lic, "Senalmedicion")) === "X";
                            case "4": return normUpper(licVal(lic, "Senalninguna")) === "X";
                            default: return false;
                        }
                    });

                    if (!has) {
                        pushReason(id, "SenalesC", expectedSignals, {
                            Senalestados: licVal(lic, "Senalestados"),
                            Senalalarmas: licVal(lic, "Senalalarmas"),
                            Senalmedicion: licVal(lic, "Senalmedicion"),
                            Senalninguna: licVal(lic, "Senalninguna")
                        }, lic);
                        return;
                    }
                }

                // Si pasó todo:
                aFiltered.push(item);
                stats.included++;
            });

            stats.excluded = stats.total - stats.included;
            return aFiltered;
        },

        _acceptEmptyValues: function (sAttribute, oFilterConfig) {
            switch (sAttribute) {
                case "Equstatnocam":
                case "Equstat":
                case "Bloqueo":
                case "Rdisparo":
                    return true;
                default:
                    return oFilterConfig.value !== "" && oFilterConfig.value !== null;
            }
        },

        _getFilterObject: function (sAttribute, sValue) {
            const oObject = {};

            // Casos especiales para señales
            switch (sValue) {
                case "0":
                    oObject.attribute = "Senalestados";
                    oObject.value = "X";
                    break;
                case "1":
                    oObject.attribute = "Senalalarmas";
                    oObject.value = "X";
                    break;
                case "2":
                    oObject.attribute = "Senalmedicion";
                    oObject.value = "X";
                    break;
                case "3":
                    oObject.attribute = "Precauciones";
                    oObject.value = "X";
                    break;
                case "4":
                    oObject.attribute = "Senalninguna";
                    oObject.value = "X";
                    break;
                default:
                    oObject.attribute = sAttribute;
                    oObject.value = sValue;
                    break;
            }

            return oObject;
        },



        // ---------------------------------------------------------------
        _cascadeGroupsDown: function (aLicences, startIndex, oTimeControl) {

            var ValueState = CoreLibrary.ValueState;

            if (startIndex < 0 || startIndex >= aLicences.length) {
                return;
            }

            var baseLicence = aLicences[startIndex];
            var consola = baseLicence.Consola;

            if (!consola) {
                return;
            }

            // 1) Armamos grupos SOLO de esa consola
            var groupsMap = {};
            aLicences.forEach(function (lic, idx) {
                if (lic.Consola !== consola) return;

                var grupo = lic.Grupo || lic.Equnr || "";
                if (!groupsMap[grupo]) {
                    groupsMap[grupo] = {
                        grupo: grupo,
                        items: [],
                        firstIndex: idx
                    };
                }
                groupsMap[grupo].items.push(lic);
                if (idx < groupsMap[grupo].firstIndex) {
                    groupsMap[grupo].firstIndex = idx;
                }
            });

            var groups = Object.keys(groupsMap).map(function (k) {
                return groupsMap[k];
            });

            groups.sort(function (a, b) {
                return a.firstIndex - b.firstIndex;
            });

            var editedGroupIndex = groups.findIndex(function (g) {
                return g.items.indexOf(baseLicence) !== -1;
            });

            if (editedGroupIndex === -1) {
                return;
            }

            var upperWarning = false;

            var prevGroup = groups[editedGroupIndex];
            var firstWithTurno = prevGroup.items.find(function (it) { return !!it.TurnoAsignado; });

            if (!firstWithTurno) {
                return;
            }

            // VALIDAR contra el grupo anterior
            if (editedGroupIndex > 0) {
                var upperGroup = groups[editedGroupIndex - 1];
                var upperFirstWithTurno = upperGroup.items.find(function (it) { return !!it.TurnoAsignado; });

                if (upperFirstWithTurno) {
                    var upperStart = this._convertShiftToMinutes(upperFirstWithTurno.TurnoAsignado);

                    var upperInfo = Utils.getShiftInfo(upperGroup.items[0]);
                    var minAllowedStart = upperStart + upperInfo.duration;

                    var newStart = this._convertShiftToMinutes(firstWithTurno.TurnoAsignado);

                    if (newStart < minAllowedStart) {
                        upperWarning = true;
                    }
                }
            }

            // Limpiar warnings previos de todos los grupos de esta consola
            groups.forEach(function (g) {
                g.items.forEach(function (it) { it.TurnoWarning = ""; });
            });

            // CASCADA HACIA ABAJO
            var prevStart = this._convertShiftToMinutes(firstWithTurno.TurnoAsignado);
            var warnings = [];

            for (var i = editedGroupIndex + 1; i < groups.length; i++) {
                var group = groups[i];

                var gFirstWithTurno = group.items.find(function (it) { return !!it.TurnoAsignado; });
                if (!gFirstWithTurno) {
                    continue;
                }

                var prevInfo = Utils.getShiftInfo(prevGroup.items[0]);
                var expectedStart = prevStart + prevInfo.duration;
                var currentStart = this._convertShiftToMinutes(gFirstWithTurno.TurnoAsignado);

                if (expectedStart < currentStart) {
                    warnings.push(group);
                    prevGroup = group;
                    prevStart = currentStart;
                    continue;
                }

                var newTimeStr = this._formatTime(expectedStart);
                group.items.forEach(function (it) {
                    it.TurnoAsignado = newTimeStr;
                    it.TurnoWarning = "";
                });

                prevGroup = group;
                prevStart = expectedStart;
            }

            // Marcar inline los grupos que no se ajustaron
            warnings.forEach(function (g) {
                g.items.forEach(function (it) {
                    it.TurnoWarning = "Algunos grupos no se ajustaron para evitar adelantar turnos.";
                });
            });

            // Mensajes
            if (upperWarning && warnings.length > 0) {
                MessageToast.show("El turno comienza antes de la separación mínima con el grupo anterior.");
            } else if (upperWarning) {
                MessageToast.show("El turno comienza antes de la separación mínima con el grupo anterior.");
            }

            // VALUE STATE
            if (oTimeControl) {
                if (upperWarning) {
                    oTimeControl.setValueState(ValueState.Error);
                    oTimeControl.setValueStateText("El turno comienza antes de la separación mínima con el grupo anterior.");
                } else {
                    oTimeControl.setValueState(ValueState.None);
                    oTimeControl.setValueStateText("");
                }
            }

            // Retornar items con warning para que el caller pueda limpiarlos tras mostrarlos una vez
            var aWarningItems = [];
            warnings.forEach(function (g) {
                g.items.forEach(function (it) { aWarningItems.push(it); });
            });
            return aWarningItems;
        },

        // ==================== MÉTODOS PARA ADJUNTAR ARCHIVOS PDF ====================

        onAttachFile: function (oEvent) {
            console.log("\n=== onAttachFile ===");

            // Guardar el contexto de la licencia
            this._currentAttachmentContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!this._currentAttachmentContext) {
                console.error("❌ No se pudo obtener el contexto");
                MessageToast.show("No se pudo obtener la licencia");
                return;
            }

            const oLicencia = this._currentAttachmentContext.getObject();
            console.log("Licencia:", oLicencia.Id);

            // Crear input de archivo si no existe
            if (!this._fileInput) {
                console.log("ℹ️ Creando file input");
                this._fileInput = document.createElement("input");
                this._fileInput.type = "file";
                this._fileInput.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt";
                this._fileInput.style.display = "none";

                this._fileInput.addEventListener("change", function (e) {
                    this._handleFileSelection(e);
                }.bind(this));

                document.body.appendChild(this._fileInput);
            }

            this._fileInput.value = null;
            this._fileInput.click();
            console.log("✅ File input activado\n");
        },


        _handleFileSelection: function (oEvent) {
            console.log("\n=== _handleFileSelection ===");

            const file = oEvent.target.files[0];

            if (!file) {
                console.log("⚠️ No se seleccionó archivo");
                return;
            }

            console.log("Archivo seleccionado:", file.name);
            console.log("Tamaño:", file.size, "bytes");

            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                console.error("❌ Archivo demasiado grande");
                MessageBox.error("El archivo es demasiado grande. Máximo 10MB");
                return;
            }

            console.log("✅ Convirtiendo a base64...");
            this._convertFileToBase64(file);
        },

        _convertFileToBase64: function (file) {
            console.log("\n=== _convertFileToBase64 ===");
            console.log("Archivo:", file.name);

            const reader = new FileReader();

            reader.onload = function (e) {
                console.log("✅ Archivo leído exitosamente");
                const base64String = e.target.result;

                if (this._currentAttachmentContext) {
                    const oLicencia = this._currentAttachmentContext.getObject();
                    console.log("Licencia:", oLicencia.Id);

                    // Asegurar que existe el array de adjuntos
                    if (!oLicencia.Attachments && !oLicencia.AttachmentXLicencia_nav) {
                        console.log("ℹ️ Creando array Attachments");
                        oLicencia.Attachments = [];
                    } else if (oLicencia.AttachmentXLicencia_nav && !oLicencia.AttachmentXLicencia_nav.results) {
                        console.log("ℹ️ Inicializando AttachmentXLicencia_nav.results");
                        oLicencia.AttachmentXLicencia_nav.results = [];
                    } else if (!oLicencia.Attachments) {
                        console.log("ℹ️ Creando array Attachments (caso 2)");
                        oLicencia.Attachments = [];
                    }

                    // Obtener fecha del turno
                    const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

                    // ✅ Extraer el base64 puro (sin el prefijo data:...)
                    const base64Pure = base64String.includes(',') ? base64String.split(',')[1] : base64String;

                    const nuevoAdjunto = {
                        Id: oLicencia.Id,
                        Empresa: "100",
                        Tipo: "L",
                        Anio: new Date().getFullYear().toString(),
                        Dateturno: oFechaTurno,
                        Codigo: "",
                        Accion: "",
                        Descripcion: oLicencia.Comments || "",
                        Equnr: (oLicencia.Equnr || "").substring(0, 18),
                        Comments: file.name.substring(0, 255),
                        Licstat: (oLicencia.Licstat || "01").substring(0, 2),
                        Attachment: base64Pure,  // ✅ Solo el base64 puro
                        AttachmentData: base64String,  // ✅ Con el prefijo data:...
                        AttachmentName: file.name,
                        AttachmentSize: file.size,
                        AttachmentType: file.type,
                        Timestamp: new Date().getTime()
                    };

                    console.log("📎 Agregando adjunto:", nuevoAdjunto.AttachmentName);
                    console.log("  AttachmentType:", nuevoAdjunto.AttachmentType);
                    console.log("  AttachmentData:", nuevoAdjunto.AttachmentData.substring(0, 50) + "...");

                    oLicencia.Attachments.push(nuevoAdjunto);
                    console.log("Total adjuntos ahora:", oLicencia.Attachments.length);

                    const oModel = this.getView().getModel("LicencesJsonModel");
                    oModel.refresh(true);
                    console.log("✅ Modelo refrescado");

                    this._saveAttachments([oLicencia]);
                    MessageToast.show("Archivo agregado: " + file.name);
                } else {
                    console.error("❌ No hay contexto de licencia");
                }

                console.log("=== _convertFileToBase64 FIN ===\n");
            }.bind(this);

            reader.onerror = function () {
                console.error("❌ Error al leer el archivo");
                MessageBox.error("Error al leer el archivo");
            };

            reader.readAsDataURL(file);
        },


        onViewAttachment: function (oEvent) {
            console.log("\n=== onViewAttachment ===");

            const oContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!oContext) {
                console.error("❌ No se pudo obtener el contexto");
                MessageToast.show("No se pudo obtener la licencia");
                return;
            }

            const oLicencia = oContext.getObject();
            console.log("Licencia:", oLicencia.Id);

            // Verificar si hay adjuntos usando función normalizada
            const aAttachments = this._getNormalizedAttachments(oLicencia);
            console.log("Adjuntos encontrados:", aAttachments.length);

            if (!aAttachments || aAttachments.length === 0) {
                console.log("⚠️ No hay adjuntos, mostrando mensaje");
                MessageToast.show("No hay archivos adjuntos");
                return;
            }

            console.log("✅ Mostrando selector de adjuntos");
            this._showAttachmentSelector(oLicencia, oContext);
        },

        _showAttachmentSelector: function (oLicencia, oContext) {
            const oView = this.getView();

            // Guardar el contexto para eliminar
            this._currentAttachmentContext = oContext;
            this._currentLicenciaForAttachments = oLicencia;

            // Destruir diálogo anterior si existe
            if (this._attachmentSelectorDialog) {
                this._attachmentSelectorDialog.destroy();
                this._attachmentSelectorDialog = null;
            }

            const oList = new sap.m.List({
                mode: "None",
                items: {
                    path: "/attachments",
                    template: new sap.m.CustomListItem({
                        content: [
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                items: [
                                    new sap.m.HBox({
                                        justifyContent: "End",
                                        alignItems: "Center",
                                        items: [
                                            new sap.ui.core.Icon({
                                                src: "{icon}",
                                                size: "2rem",
                                                color: "#0854a0"
                                            }).addStyleClass("sapUiSmallMarginEnd"),
                                            new sap.m.VBox({
                                                items: [
                                                    new sap.m.Text({
                                                        text: "{name}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiSmallMarginBottom"),
                                                    new sap.m.Text({
                                                        text: "{info}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiTinyText")
                                                ]
                                            })
                                        ]
                                    }),
                                    // Botones de acción
                                    new sap.m.HBox({
                                        justifyContent: "End",
                                        alignItems: "Center",
                                        items: [
                                            // Botón Ver
                                            new sap.m.Button({
                                                icon: "sap-icon://show",
                                                type: "Emphasized",
                                                tooltip: "Ver archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const aAttachments = this._getNormalizedAttachments(oLicencia);
                                                    const oAttachment = aAttachments[iIndex];
                                                    this._openAttachment(oAttachment);
                                                }.bind(this)
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            // Botón Eliminar
                                            new sap.m.Button({
                                                icon: "sap-icon://delete",
                                                type: "Reject",
                                                tooltip: "Eliminar archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const aAttachments = this._getNormalizedAttachments(oLicencia);
                                                    const oAttachment = aAttachments[iIndex];
                                                    this._deleteAttachmentFromList(oAttachment, iIndex);
                                                }.bind(this)
                                            })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiSmallMargin")
                        ]
                    })
                }
            });

            // Usar adjuntos normalizados
            const aAttachments = this._getNormalizedAttachments(oLicencia);
            const aListData = aAttachments.map((att, idx) => ({
                name: att.AttachmentName,
                info: this._formatSize(att.AttachmentSize) + " • " + this._getFileTypeName(att.AttachmentType),
                icon: this.getFileIcon(att.AttachmentType),
                index: idx
            }));

            const oDialogModel = new sap.ui.model.json.JSONModel({
                attachments: aListData
            });

            this._attachmentSelectorDialog = new sap.m.Dialog({
                title: "Archivos Adjuntos - Licencia " + oLicencia.Id,
                contentWidth: "750px",
                contentHeight: "400px",
                content: [oList],
                beginButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._attachmentSelectorDialog.close();
                    }.bind(this)
                }),
                afterClose: function () {
                    this._attachmentSelectorDialog.destroy();
                    this._attachmentSelectorDialog = null;
                }.bind(this)
            });

            // Establecer modelo
            this._attachmentSelectorDialog.setModel(oDialogModel);

            // Agregar a la vista
            oView.addDependent(this._attachmentSelectorDialog);

            // Abrir
            this._attachmentSelectorDialog.open();
        },

        _deleteAttachmentFromList: function (oAttachment, iIndex) {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            MessageBox.confirm(
                "¿Desea eliminar el archivo '" + oAttachment.AttachmentName + "'?",
                {
                    title: "Confirmar eliminación",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.DELETE) {
                            this._deleteAttachment(oAttachment, iIndex);
                        }
                    }.bind(this)
                }
            );
        },

        // ==================== FIN SOLUCIÓN BOTÓN ELIMINAR ====================

        /**
         * Formatea el tamaño del archivo
         */
        _formatSize: function (iSize) {
            if (!iSize) return "Desconocido";

            if (iSize < 1024) {
                return iSize + " B";
            } else if (iSize < 1024 * 1024) {
                return (iSize / 1024).toFixed(2) + " KB";
            } else {
                return (iSize / (1024 * 1024)).toFixed(2) + " MB";
            }
        },

        /**
         * Abre un adjunto seleccionado desde la lista
         */
        onSelectAttachmentFromList: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oAttachment = oItem.getBindingContext("attachmentSelector").getObject();

            this._openAttachment(oAttachment);
            this._attachmentSelectorDialog.close();
        },

        /**
         * Abre un archivo adjunto (PDF, imagen, etc)
         */
        _openAttachment: function (oAttachment) {
            console.log("\n=== _openAttachment ===");
            console.log("Archivo:", oAttachment.AttachmentName);
            console.log("Tipo:", oAttachment.AttachmentType);
            console.log("AttachmentData existe?", !!oAttachment.AttachmentData);

            if (!oAttachment.AttachmentData) {
                console.error("❌ No hay AttachmentData");
                MessageBox.error("Error: El archivo no tiene datos para visualizar");
                return;
            }

            const sType = oAttachment.AttachmentType;

            // Para PDFs
            if (sType === "application/pdf") {
                console.log("📄 Abriendo PDF");
                this._openPDFViewer(oAttachment.AttachmentData);
                return;
            }

            // Para imágenes
            if (sType && sType.startsWith("image/")) {
                console.log("🖼️ Abriendo imagen");
                this._openImageViewer(oAttachment);
                return;
            }

            // Para otros archivos, descargar
            console.log("📥 Descargando archivo");
            this._downloadFile(oAttachment);
        },


        /**
         * Abre el visor de PDF
         */
        _openPDFViewer: function (base64Data) {
            const oView = this.getView();

            if (!this._pdfViewerDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.PDFViewer",
                    controller: this
                }).then(function (oDialog) {
                    this._pdfViewerDialog = oDialog;
                    oView.addDependent(oDialog);
                    this._setPDFContent(base64Data);
                    oDialog.open();
                }.bind(this));
            } else {
                this._setPDFContent(base64Data);
                this._pdfViewerDialog.open();
            }
        },

        _setPDFContent: function (base64Data) {
            const oHTMLControl = this.byId("pdfViewerContent");
            if (oHTMLControl) {
                const sHTMLContent =
                    '<embed src="' + base64Data + '" ' +
                    'type="application/pdf" ' +
                    'width="100%" ' +
                    'height="600px" ' +
                    'style="border: none;">' +
                    '</embed>';
                oHTMLControl.setContent(sHTMLContent);
            }
        },

        onAcceptPDFViewer: function () {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            MessageToast.show(oResourceBundle.getText("pdfViewedSuccess"));
            this._pdfViewerDialog.close();
        },

        onClosePDFViewer: function () {
            this._pdfViewerDialog.close();
        },

        onDownloadFromViewer: function () {
            if (this._currentPDFData) {
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                const link = document.createElement("a");
                link.href = this._currentPDFData.data;
                link.download = this._currentPDFData.name;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                MessageToast.show(oResourceBundle.getText("downloadingFile", [this._currentPDFData.name]));
            }
        },

        /**
         * Abre un visor simple de imágenes
         */
        _openImageViewer: function (oAttachment) {
            if (!this._imageDialog) {
                this._imageDialog = new sap.m.Dialog({
                    title: "Vista de Imagen",
                    contentWidth: "80%",
                    contentHeight: "80%",
                    content: new sap.m.Image({
                        id: this.createId("imageViewer"),
                        densityAware: false
                    }),
                    endButton: new sap.m.Button({
                        text: "Cerrar",
                        press: function () {
                            this._imageDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._imageDialog);
            }

            const oImage = sap.ui.getCore().byId(this.createId("imageViewer"));
            oImage.setSrc(oAttachment.AttachmentData);

            this._imageDialog.open();
        },

        /**
         * Descarga un archivo
         */
        _downloadFile: function (oAttachment) {
            console.log("📥 Descargando:", oAttachment.AttachmentName);
            console.log("  AttachmentData existe?", !!oAttachment.AttachmentData);
            console.log("  AttachmentData preview:", oAttachment.AttachmentData?.substring(0, 50));

            if (!oAttachment.AttachmentData) {
                console.error("❌ No hay AttachmentData");
                MessageBox.error("Error: El archivo no tiene datos para descargar");
                return;
            }

            const link = document.createElement("a");
            link.href = oAttachment.AttachmentData;
            link.download = oAttachment.AttachmentName;
            link.click();

            console.log("✅ Descarga iniciada");
            MessageToast.show("Descargando: " + oAttachment.AttachmentName);
        },

        /**
         * Elimina un adjunto específico de la licencia
         */
        onDeleteSpecificAttachment: function (oEvent) {
            const oItem = oEvent.getSource();
            const oAttachment = oItem.getBindingContext("attachmentSelector").getObject();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            MessageBox.confirm("¿Desea eliminar " + oAttachment.AttachmentName + "?", {
                title: "Confirmar eliminación",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._deleteAttachment(oAttachment);
                    }
                }.bind(this)
            });
        },

        _deleteAttachment: function (oAttachment, iIndex) {
            console.log("\n=== _deleteAttachment ===");
            console.log("Adjunto a eliminar:", oAttachment.AttachmentName);
            console.log("Índice:", iIndex);

            const oLicencia = this._currentLicenciaForAttachments;

            if (!oLicencia) {
                console.error("❌ No se encontró oLicencia");
                MessageToast.show("Error: No se pudo encontrar la licencia");
                return;
            }

            console.log("Licencia:", oLicencia.Id);

            // ✅ Normalizar adjuntos primero
            let aAttachments = this._getNormalizedAttachments(oLicencia);
            console.log("Adjuntos actuales:", aAttachments.length);

            if (!aAttachments || aAttachments.length === 0) {
                console.error("❌ No hay adjuntos para eliminar");
                MessageToast.show("Error: No hay adjuntos para eliminar");
                return;
            }

            // ✅ Asegurar que oLicencia.Attachments existe
            if (!oLicencia.Attachments) {
                console.log("⚠️ Creando oLicencia.Attachments desde normalizados");
                oLicencia.Attachments = [...aAttachments];
            }

            console.log("Adjuntos antes de eliminar:", oLicencia.Attachments.length);

            // Eliminar del array
            oLicencia.Attachments.splice(iIndex, 1);

            console.log("Adjuntos después de eliminar:", oLicencia.Attachments.length);

            // ✅ Limpiar AttachmentXLicencia_nav si se eliminó el último
            if (oLicencia.Attachments.length === 0) {
                console.log("⚠️ Último adjunto eliminado, limpiando AttachmentXLicencia_nav");
                if (oLicencia.AttachmentXLicencia_nav) {
                    if (oLicencia.AttachmentXLicencia_nav.results) {
                        oLicencia.AttachmentXLicencia_nav.results = [];
                    } else if (Array.isArray(oLicencia.AttachmentXLicencia_nav)) {
                        oLicencia.AttachmentXLicencia_nav = [];
                    }
                }
            }

            // Forzar actualización del modelo
            const oModel = this.getView().getModel("LicencesJsonModel");
            oModel.updateBindings(true);
            console.log("✅ Modelo actualizado");

            // Refrescar tabla
            const oTable = this.byId("turnosTable");
            if (oTable) {
                oTable.getBinding("rows").refresh();
                console.log("✅ Tabla refrescada");
            }

            // Si se guardó en backend, eliminarlo también
            if (oAttachment.Attindex) {
                console.log("🗑️ Eliminando del backend, Attindex:", oAttachment.Attindex);
                this._deleteAttachmentFromBackend(oAttachment);
            } else {
                console.log("ℹ️ Adjunto local, no está en backend");
                MessageToast.show("Archivo eliminado: " + oAttachment.AttachmentName);
            }

            // Cerrar el diálogo
            if (this._attachmentSelectorDialog) {
                this._attachmentSelectorDialog.close();
                console.log("✅ Diálogo cerrado");
            }

            // Mensaje si se eliminaron todos
            if (oLicencia.Attachments.length === 0) {
                MessageToast.show("Todos los archivos fueron eliminados");
            }

            console.log("=== _deleteAttachment FIN ===\n");
        },


        openExcelViewer: function (oAttachment) {
            this._downloadFile(oAttachment);
            MessageToast.show("Descargando: " + oAttachment.AttachmentName);
        },


        // ==================== BACKEND DE ADJUNTOS ====================

        _loadAttachmentsForLicensesAsync: function (aLicencias) {

            const oLicencesModel = this.getView().getModel("LicencesJsonModel");

            const aPromises = aLicencias.map((licencia, idx) => {

                return new Promise((resolve) => {
                    // Verificar si los adjuntos ya están disponibles en AttachmentXLicencia_nav.results
                    const expandedAttachments = licencia.AttachmentXLicencia_nav?.results ||
                        licencia.AttachmentXLicencia_nav ||
                        null;

                    resolve();
                });
            });

            return Promise.all(aPromises).then(() => {
                oLicencesModel.updateBindings(true);

                const oTable = this.byId("turnosTable");
                if (oTable) {
                    oTable.getBinding("rows").refresh();
                }
            });
        },

        _saveAttachments: function (aLicencias) {
            const oDataService = this.getView().getModel();
            const aPromises = [];

            aLicencias.forEach((licencia, idx) => {

                if (licencia.Attachments && licencia.Attachments.length > 0) {
                    licencia.Attachments.forEach((attachment, attIdx) => {
                        if (!attachment.Attindex) {

                            const promise = new Promise((resolve, reject) => {
                                let base64Data = attachment.AttachmentData;
                                if (base64Data.includes(",")) {
                                    base64Data = base64Data.split(",")[1];
                                }

                                const oAttachment = {
                                    "Id": attachment.Id,
                                    "Empresa": attachment.Empresa,
                                    "Anio": attachment.Anio,
                                    "Attachment": base64Data,
                                    "Filename": attachment.AttachmentName,
                                    "Doctype": attachment.AttachmentType
                                };

                                oDataService.create("/AttachmentLicenciasSet", oAttachment, {
                                    success: function (oData) {
                                        attachment.Attindex = oData.Attindex;
                                        resolve();
                                    },
                                    error: function (oError) {
                                        reject(oError);
                                    }
                                });
                            });

                            aPromises.push(promise);
                        }
                    });
                }
            });

            if (aPromises.length === 0) {
                return Promise.resolve();
            }

            return Promise.all(aPromises)
                .then(() => {
                    MessageToast.show("Adjuntos guardados exitosamente");
                })
                .catch((error) => {
                    MessageBox.warning("Algunos adjuntos no se pudieron guardar");
                });
        },

        //Elimina un adjunto del backend

        _deleteAttachmentFromBackend: function (oAttachment) {
            const oDataModel = this.getView().getModel();

            this.showGlobalBusy("Eliminando archivo...");

            const sPath = oDataModel.createKey("/AttachmentLicenciasSet", {
                Id: oAttachment.Id,
                Empresa: oAttachment.Empresa,
                Anio: oAttachment.Anio,
                Attindex: oAttachment.Attindex
            });

            oDataModel.remove(sPath, {
                success: function () {
                    this.hideGlobalBusy();

                    const oModel = this.getView().getModel("LicencesJsonModel");
                    oModel.updateBindings(true);

                    const oTable = this.byId("turnosTable");
                    if (oTable) {
                        oTable.getBinding("rows").refresh();
                    }

                    MessageToast.show("Archivo eliminado correctamente");
                }.bind(this),
                error: function (oError) {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al eliminar el archivo del servidor");
                }.bind(this)
            });
        },

        // ==================== FIN SECCIÓN DE ADJUNTOS ====================

        // ==================== HELPERS Y FORMATTERS PARA ADJUNTOS ====================

        formatAttachmentInfo: function (iSize, sType) {
            let sSize = "Desconocido";

            if (iSize) {
                if (iSize < 1024) {
                    sSize = iSize + " B";
                } else if (iSize < 1024 * 1024) {
                    sSize = (iSize / 1024).toFixed(2) + " KB";
                } else {
                    sSize = (iSize / (1024 * 1024)).toFixed(2) + " MB";
                }
            }

            const sTypeName = this._getFileTypeName(sType);

            return sSize + " • " + sTypeName;
        },

        _getFileTypeName: function (sType) {
            const mTypes = {
                "application/pdf": "PDF",
                "application/msword": "Word",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
                "application/vnd.ms-excel": "Excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
                "image/jpeg": "Imagen JPEG",
                "image/jpg": "Imagen JPG",
                "image/png": "Imagen PNG",
                "text/plain": "Texto"
            };

            return mTypes[sType] || "Archivo";
        },

        getFileIcon: function (sType) {
            if (!sType) return "sap-icon://document";

            if (sType === "application/pdf") {
                return "sap-icon://pdf-attachment";
            }

            if (sType.startsWith("image/")) {
                return "sap-icon://image-viewer";
            }

            if (sType.includes("word")) {
                return "sap-icon://doc-attachment";
            }

            if (sType.includes("excel") || sType.includes("spreadsheet")) {
                return "sap-icon://excel-attachment";
            }

            if (sType === "text/plain") {
                return "sap-icon://document-text";
            }

            return "sap-icon://document";
        },

        _getNormalizedAttachments: function (oLicencia) {
            if (!oLicencia) {
                console.log("📎 _getNormalizedAttachments: oLicencia es null");
                return [];
            }

            console.log("📎 _getNormalizedAttachments para licencia:", oLicencia.Id);
            console.log("  Attachments local:", oLicencia.Attachments?.length || 0);
            console.log("  AttachmentXLicencia_nav:", oLicencia.AttachmentXLicencia_nav ? "existe" : "no existe");

            // ✅ PRIORIDAD 1: Verificar Attachments locales (adjuntos recién agregados)
            if (oLicencia.Attachments && Array.isArray(oLicencia.Attachments) && oLicencia.Attachments.length > 0) {
                console.log("  ✅ Usando Attachments locales:", oLicencia.Attachments.length);
                // ✅ NUEVO: Asegurar que todos tienen AttachmentData
                return oLicencia.Attachments.map(att => {
                    if (!att.AttachmentData && att.Attachment) {
                        // Construir AttachmentData si no existe
                        const mimeType = att.AttachmentType || this._inferMimeType(att.AttachmentName);
                        att.AttachmentData = `data:${mimeType};base64,${att.Attachment}`;
                        console.log("    ⚠️ AttachmentData construido para:", att.AttachmentName);
                    }
                    return att;
                });
            }

            // ✅ PRIORIDAD 2: Verificar AttachmentXLicencia_nav (datos del backend)
            let aRawAttachments = null;
            if (oLicencia.AttachmentXLicencia_nav?.results && Array.isArray(oLicencia.AttachmentXLicencia_nav.results)) {
                aRawAttachments = oLicencia.AttachmentXLicencia_nav.results;
                console.log("  ✅ Usando AttachmentXLicencia_nav.results:", aRawAttachments.length);
            } else if (oLicencia.AttachmentXLicencia_nav && Array.isArray(oLicencia.AttachmentXLicencia_nav)) {
                aRawAttachments = oLicencia.AttachmentXLicencia_nav;
                console.log("  ✅ Usando AttachmentXLicencia_nav (array):", aRawAttachments.length);
            }

            if (!aRawAttachments || aRawAttachments.length === 0) {
                console.log("  ⚠️ No hay adjuntos");
                return [];
            }

            // Normalizar desde formato OData expandido a formato esperado
            const aNormalizados = aRawAttachments.map(att => {
                // ✅ Construir AttachmentData con el MIME type correcto
                let sAttachmentData = att.AttachmentData;
                if (!sAttachmentData && att.Attachment) {
                    const sMimeType = att.Doctype || this._inferMimeType(att.Filename || att.AttachmentName);
                    sAttachmentData = `data:${sMimeType};base64,${att.Attachment}`;
                }

                return {
                    Id: att.Id,
                    Empresa: att.Empresa,
                    Anio: att.Anio,
                    Attachment: att.Attachment,
                    AttachmentData: sAttachmentData,  // ✅ Siempre con formato correcto
                    AttachmentName: att.Filename || att.AttachmentName,
                    AttachmentType: att.Doctype || att.AttachmentType || this._inferMimeType(att.Filename || att.AttachmentName),
                    AttachmentSize: att.Size || att.AttachmentSize,
                    Attindex: att.Attindex,
                    Timestamp: att.Timestamp || new Date().getTime() + Math.random()
                };
            });

            console.log("  ✅ Normalizados:", aNormalizados.length);
            return aNormalizados;
        },

        _inferMimeType: function (sFilename) {
            if (!sFilename) return "application/octet-stream";

            const sExt = sFilename.split('.').pop().toLowerCase();

            const mimeTypes = {
                'pdf': 'application/pdf',
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'txt': 'text/plain',
                'csv': 'text/csv'
            };

            return mimeTypes[sExt] || 'application/octet-stream';
        },


        hasAttachments: function (oLicencia) {
            const aAttachments = this._getNormalizedAttachments(oLicencia);
            return aAttachments && aAttachments.length > 0;
        },

        getAttachmentCount: function (oLicencia) {
            const aAttachments = this._getNormalizedAttachments(oLicencia);
            return aAttachments ? aAttachments.length : 0;
        },

        onCloseAttachmentSelector: function () {
            if (this._attachmentSelectorDialog) {
                this._attachmentSelectorDialog.close();
            }
        },

        // ==================== FIN HELPERS Y FORMATTERS ====================

        //----------------------------------------------------------------------------------

        onLicenseSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue")?.trim() || "";
            const oTable = this.byId("idLicensesTable");
            const oBinding = oTable.getBinding("items");

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            const aFilters = [
                new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.Contains, sQuery),
                new sap.ui.model.Filter("Equnr", sap.ui.model.FilterOperator.Contains, sQuery),
                new sap.ui.model.Filter("Comments", sap.ui.model.FilterOperator.Contains, sQuery)
            ];

            const oOrFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: false  // OR
            });

            oBinding.filter([oOrFilter]);
        },

        onReportsPress: function (oEvent) {
            var oView = this.getView();
            var sReportType = "amplio"; // Por defecto
            var sDialogTitle = "Reporte Amplio";

            // Obtener el tipo de reporte desde el CustomData del MenuItem
            if (oEvent && oEvent.getSource) {
                var oMenuItem = oEvent.getSource();
                var aCustomData = oMenuItem.getCustomData();
                if (aCustomData && aCustomData.length > 0) {
                    for (var i = 0; i < aCustomData.length; i++) {
                        if (aCustomData[i].getKey() === "reportType") {
                            sReportType = aCustomData[i].getValue();
                            sDialogTitle = sReportType === "maniobras" ? "Resumen maniobras" : "Reporte Amplio";
                            break;
                        }
                    }
                }
            }

            // Si el diálogo no existe, lo creamos
            if (!this._oReportsDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.reportsDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oReportsDialog = oDialog;
                    oView.addDependent(oDialog);
                    // Cambiar el título según el tipo de reporte
                    oDialog.setTitle(sDialogTitle);
                    // Guardar el tipo de reporte en el diálogo para uso futuro
                    oDialog.data("reportType", sReportType);
                    oDialog.open();
                }.bind(this));
            } else {
                // Si ya existe, cambiar el título y abrirlo
                this._oReportsDialog.setTitle(sDialogTitle);
                this._oReportsDialog.data("reportType", sReportType);

                var oBtnVisualizar = sap.ui.core.Fragment.byId(oView.getId(), "btnVisualizar");
                if (oBtnVisualizar) {
                    oBtnVisualizar.setVisible(sReportType === "maniobras");
                }

                this._oReportsDialog.open();
            }
        },

        onDownloadExcel: function () {
            var oDialog = this._oReportsDialog;
            if (!oDialog) {
                return;
            }

            // Intentar obtener los DatePickers usando this.byId (ya que el fragment se carga con id de la vista)
            var oFechaInicio = this.byId("fechaInicio");
            var oFechaFin = this.byId("fechaFin");

            // Si no se encuentran, intentar con Fragment.byId
            if (!oFechaInicio) {
                oFechaInicio = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaInicio");
            }
            if (!oFechaFin) {
                oFechaFin = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaFin");
            }

            if (!oFechaInicio || !oFechaFin) {
                MessageToast.show("No se pudieron obtener los DatePickers.");
                return;
            }

            var oDateInicio = oFechaInicio.getDateValue();
            var oDateFin = oFechaFin.getDateValue();

            if (!oDateInicio || !oDateFin) {
                MessageBox.warning("Por favor, seleccione ambas fechas (Inicio y Fin).");
                return;
            }

            if (oDateInicio > oDateFin) {
                MessageBox.warning("La fecha de inicio no puede ser mayor que la fecha de fin.");
                return;
            }

            // Obtener el tipo de reporte del diálogo
            var sReportType = oDialog.data("reportType") || "amplio"; // Por defecto "amplio"

            // Mostrar diálogo de carga
            this.showGlobalBusy("Buscando turnos para el reporte...");

            const oView = this.getView();
            const oDataService = this.getView().getModel();
            const sEmpresa = SocietyHelper.getCurrentSociety(oView);

            // Generar array de fechas del rango (desde fecha inicio hasta fecha fin, día por día)
            // Usar UTC para que OData las serialice como 00:00:00 UTC
            const aFechas = [];
            const oFechaInicioUTC = new Date(Date.UTC(
                oDateInicio.getFullYear(),
                oDateInicio.getMonth(),
                oDateInicio.getDate(),
                0, 0, 0, 0
            ));
            const oFechaFinUTC = new Date(Date.UTC(
                oDateFin.getFullYear(),
                oDateFin.getMonth(),
                oDateFin.getDate(),
                0, 0, 0, 0
            ));

            // Incluir también la fecha fin (agregar un día)
            const oFechaFinLimiteUTC = new Date(oFechaFinUTC);
            oFechaFinLimiteUTC.setUTCDate(oFechaFinLimiteUTC.getUTCDate() + 1);

            const oFechaActualUTC = new Date(oFechaInicioUTC);
            while (oFechaActualUTC < oFechaFinLimiteUTC) {
                // Crear nueva fecha en UTC a las 00:00:00
                const oFechaNormalizada = new Date(Date.UTC(
                    oFechaActualUTC.getUTCFullYear(),
                    oFechaActualUTC.getUTCMonth(),
                    oFechaActualUTC.getUTCDate(),
                    0, 0, 0, 0
                ));
                aFechas.push(oFechaNormalizada);
                oFechaActualUTC.setUTCDate(oFechaActualUTC.getUTCDate() + 1);
            }

            const sEntity = "/TurnosLicenciasSet";

            // Crear array de Promises, una llamada por cada fecha
            const aPromises = aFechas.map((oFecha) => {
                return new Promise((resolve, reject) => {
                    const aFilters = [];
                    // La fecha ya está en UTC a las 00:00:00
                    aFilters.push(new Filter("Dateturno", FilterOperator.EQ, oFecha));
                    aFilters.push(new Filter("Empresa", FilterOperator.EQ, sEmpresa));

                    oDataService.read(sEntity, {
                        filters: aFilters,
                        success: (oData) => {
                            // Retornar los results de esta fecha (puede ser array vacío)
                            resolve(oData.results || []);
                        },
                        error: (oError) => {
                            resolve([]);
                        }
                    });
                });
            });

            // Ejecutar todas las llamadas en paralelo y acumular resultados
            Promise.all(aPromises)
                .then((aResultadosPorFecha) => {
                    // Acumular todos los resultados en un único array
                    const aTodosLosResultados = [];
                    aResultadosPorFecha.forEach((aResultados) => {
                        if (Array.isArray(aResultados) && aResultados.length > 0) {
                            aTodosLosResultados.push(...aResultados);
                        }
                    });

                    // Crear objeto con formato similar al que espera processReportData
                    const oDataAcumulado = {
                        results: aTodosLosResultados
                    };

                    // Procesar todos los datos acumulados, pasando el tipo de reporte
                    return this.processReportData(oDataAcumulado, oDateInicio, oDateFin, sReportType);
                })
                .catch((err) => {
                    MessageToast.show("Error al procesar los datos del reporte.");
                })
                .finally(() => {
                    this.hideGlobalBusy();
                });
        },

        processReportData: function (data, oDateInicio, oDateFin, sReportType) {
            const oView = this.getView();
            const oDataModel = this.getView().getModel();

            // Si no se pasa el tipo de reporte, usar "amplio" por defecto
            sReportType = sReportType || "amplio";

            const aResults = Array.isArray(data?.results) ? data.results : [];

            if (!aResults.length) {
                MessageBox.information("No se encontraron turnos para el rango de fechas seleccionado.");
                return Promise.resolve();
            }

            // Buscar información de cada licencia usando LicenseService.FIND()
            // Mantener la fecha del turno (Dateturno) de cada resultado
            const aPromises = aResults.map((licencia) => {
                var oDateturno = licencia.Dateturno; // Guardar la fecha del turno
                return LicenseService.FIND(licencia, oDataModel)
                    .then(result => {
                        // Agregar la fecha del turno al resultado
                        if (result) {
                            result.Dateturno = oDateturno;
                        }
                        return result;
                    })
                    .catch(err => {
                        return null;
                    });
            });

            return Promise.all(aPromises)
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x);

                    if (!results.length) {
                        MessageBox.information("No se encontró información para las licencias del rango de fechas.");
                        return;
                    }

                    // Aplicar las mismas funciones de procesamiento que se usan en la tabla principal
                    // Esto se aplica a ambos tipos de reporte (amplio y maniobras)
                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        oView
                    );
                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    // Decidir qué función llamar según el tipo de reporte
                    if (sReportType === "amplio") {
                        // Generar el Excel con los datos procesados y las fechas del rango
                        this.createExcelReport(arrayOrdenado, oDateInicio, oDateFin);
                    } else if (sReportType === "maniobras") {
                        // Generar el Excel de resumen de maniobras
                        this.createExcelReportManiobras(arrayOrdenado, oDateInicio, oDateFin);
                    }
                })
                .catch((error) => {
                    MessageToast.show("Error al procesar las licencias.");
                });
        },

        createExcelReport: function (aData, oDateInicio, oDateFin) {
            // Cargar la librería XLSX
            jQuery.sap.require("transener.sistemadeturnos.libs.xlsx");

            // Verificar que XLSX esté disponible
            if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
                MessageBox.error("No se pudo cargar la librería XLSX. Asegúrese de que el archivo esté en webapp/libs/xlsx/xlsx.full.min.js");
                return;
            }

            // Si existe make_xlsx_lib, inicializarlo (como en el código que funciona)
            if (typeof make_xlsx_lib === 'function') {
                make_xlsx_lib(XLSX);
            }

            try {
                // Crear workbook
                var Workbook = XLSX.utils.book_new();

                // SOLAPA 1: Datos de Licencias
                var aDatosLicencias = this.prepareLicenciasData(aData);
                var ws1 = XLSX.utils.aoa_to_sheet([]);
                var sheet1 = XLSX.utils.sheet_add_json(ws1, aDatosLicencias, {
                    origin: "A1"
                });
                XLSX.utils.book_append_sheet(Workbook, sheet1, "Licencias");

                // SOLAPA 2: Resumen por Fecha
                var aDatosResumen = this.prepareResumenPorFecha(aData, oDateInicio, oDateFin);
                var sheet2 = XLSX.utils.aoa_to_sheet(aDatosResumen);
                XLSX.utils.book_append_sheet(Workbook, sheet2, "Resumen por Fecha");

                // Descargar el archivo
                var sFileName = "Reporte Amplio.xlsx";
                XLSX.writeFile(Workbook, sFileName, {
                    cellStyles: true
                });

                MessageToast.show("Reporte Excel generado correctamente.");

                // Cerrar el diálogo y limpiar las fechas
                this.onCancelReports();
                this.clearReportDates();
            } catch (error) {
                MessageBox.error("Error al generar el archivo Excel: " + error.message);
            }
        },

        createExcelReportManiobras: function (aData, oDateInicio, oDateFin) {
            // Cargar la librería XLSX
            jQuery.sap.require("transener.sistemadeturnos.libs.xlsx");

            // Verificar que XLSX esté disponible
            if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
                MessageBox.error("No se pudo cargar la librería XLSX. Asegúrese de que el archivo esté en webapp/libs/xlsx/xlsx.full.min.js");
                return;
            }

            // Si existe make_xlsx_lib, inicializarlo
            if (typeof make_xlsx_lib === 'function') {
                make_xlsx_lib(XLSX);
            }

            try {
                var oFormatter = this.formatter;
                // Crear workbook
                var Workbook = XLSX.utils.book_new();

                // SOLAPA 1: Resumen por Fecha
                var aDatosResumen = this.prepareResumenPorFecha(aData, oDateInicio, oDateFin);
                var sheet1 = XLSX.utils.aoa_to_sheet(aDatosResumen);

                // Calcular dónde empezar las nuevas grillas
                var iFilaInicioGrillas = aDatosResumen.length + 3;

                // Función helper para convertir número de columna a letra de Excel
                var getColumnLetter = function (colNum) {
                    var result = "";
                    while (colNum >= 0) {
                        result = String.fromCharCode(65 + (colNum % 26)) + result;
                        colNum = Math.floor(colNum / 26) - 1;
                    }
                    return result;
                };

                // Variable para rastrear en qué columna empezar la siguiente grilla
                var iColumnaActual = 0;

                // Generar array de fechas del rango
                var aFechas = [];
                var oFechaActual = new Date(oDateInicio);
                var oFechaFin = new Date(oDateFin);
                oFechaFin.setDate(oFechaFin.getDate() + 1);

                while (oFechaActual < oFechaFin) {
                    aFechas.push(new Date(oFechaActual));
                    oFechaActual.setDate(oFechaActual.getDate() + 1);
                }

                var todosLosDatosExcel = [];

                // Para cada fecha, crear una grilla
                aFechas.forEach(function (oFecha) {
                    var sFechaFormateada = oFormatter.formatDate(oFecha);

                    // Filtrar licencias de esta fecha
                    var aLicenciasFecha = aData.filter(function (license) {
                        if (!license.Dateturno) {
                            return false;
                        }

                        // Normalizar fecha del turno a UTC 00:00:00
                        var oFechaTurno = new Date(license.Dateturno);
                        var iAnioUTC = oFechaTurno.getUTCFullYear();
                        var iMesUTC = oFechaTurno.getUTCMonth();
                        var iDiaUTC = oFechaTurno.getUTCDate();
                        var oFechaTurnoNormalizada = new Date(Date.UTC(iAnioUTC, iMesUTC, iDiaUTC, 0, 0, 0, 0));

                        // Normalizar fecha actual a UTC 00:00:00
                        var oFechaNormalizada = new Date(Date.UTC(
                            oFecha.getFullYear(),
                            oFecha.getMonth(),
                            oFecha.getDate(),
                            0, 0, 0, 0
                        ));

                        // Comparar las fechas normalizadas en UTC
                        return oFechaNormalizada.getTime() === oFechaTurnoNormalizada.getTime();
                    });


                    // Eliminar duplicados basados en Equnr + TurnoAsignado
                    var aLicenciasUnicas = [];
                    var oMapaDuplicados = {};

                    aLicenciasFecha.forEach(function (license) {
                        var sEquipo = license.Equnr || "";
                        var sTurno = license.TurnoAsignado || "";
                        var sClave = sEquipo + "|" + sTurno;

                        if (!oMapaDuplicados[sClave]) {
                            oMapaDuplicados[sClave] = true;
                            aLicenciasUnicas.push(license);
                        }
                    });

                    // Crear la grilla para esta fecha
                    var aGrillaFecha = [];
                    aGrillaFecha.push(["Horarios de maniobras previstos " + sFechaFormateada]);
                    aGrillaFecha.push(["Equipo", "Hora", "Comentarios"]);

                    // Datos
                    aLicenciasUnicas.forEach(function (license) {
                        var sEquipo = license.Equnr || "";
                        var sHora = license.TurnoAsignado || (license.Horainicio ? oFormatter.durationToTime(license.Horainicio)
                            : (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""));
                        var sComentarios = license.Comments || license.Patadic || "";

                        aGrillaFecha.push([sEquipo, sHora, sComentarios]);

                        // Acumular para comparación
                        todosLosDatosExcel.push({
                            Fecha: sFechaFormateada,
                            Equipo: sEquipo,
                            Hora: sHora,
                            Comentarios: sComentarios
                        });
                    });

                    // Agregar la grilla al sheet
                    var sColumnaInicio = getColumnLetter(iColumnaActual);
                    var iFilaInicio = iFilaInicioGrillas + 1;
                    XLSX.utils.sheet_add_aoa(sheet1, aGrillaFecha, {
                        origin: sColumnaInicio + iFilaInicio.toString()
                    });

                    // Avanzar columnas
                    iColumnaActual += 3 + 2;
                }.bind(this));

                XLSX.utils.book_append_sheet(Workbook, sheet1, "Resumen por Fecha");

                // Descargar el archivo
                var sFileName = "Resumen Maniobras.xlsx";
                XLSX.writeFile(Workbook, sFileName, {
                    cellStyles: true
                });

                MessageToast.show("Reporte Excel de maniobras generado correctamente.");

                // Cerrar el diálogo y limpiar las fechas
                this.onCancelReports();
                this.clearReportDates();
            } catch (error) {
                MessageBox.error("Error al generar el archivo Excel: " + error.message);
            }
        },


        clearReportDates: function () {
            // Obtener los DatePickers del fragment
            var oFechaInicio = this.byId("fechaInicio");
            var oFechaFin = this.byId("fechaFin");

            // Si no se encuentran, intentar con Fragment.byId
            if (!oFechaInicio) {
                oFechaInicio = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaInicio");
            }
            if (!oFechaFin) {
                oFechaFin = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaFin");
            }

            // Limpiar las fechas
            if (oFechaInicio) {
                oFechaInicio.setValue("");
            }
            if (oFechaFin) {
                oFechaFin.setValue("");
            }
        },

        prepareLicenciasData: function (aData) {
            var that = this;
            var oFormatter = this.formatter;

            return aData.map(function (license) {
                return {
                    "Equipo": license.Equnr || "",
                    "IdLicencia": license.Id || "",
                    "Estado": oFormatter.getEstado(license.Equstat) || "",
                    "CondTrabajo": oFormatter.getJobCond(license.Jobcond) || "",
                    "HoraInicio": license.Horainicio ? oFormatter.durationToTime(license.Horainicio) : (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""),
                    "TrabajoRealizar": license.Comments || "",
                    "Region": oFormatter.getRegiones(license.Werks) || "",
                    "Consola": license.Consola || "",
                    "Turno": license.TurnoAsignado || "",
                    "Comentario": license.Comentarios || "",
                    "Licstat": license.Licstat || ""
                };
            });
        },

        prepareResumenPorFecha: function (aData, oDateInicio, oDateFin) {
            var that = this;
            var oFormatter = this.formatter;
            var aResultado = [];

            // Encabezados
            aResultado.push([
                "Fecha",
                "Cantidad de LLTT",
                "LLTT con maniobras",
                "Cantidad de TcT",
                "Cantidad de LLTT sin maniobras"
            ]);

            // Generar array de fechas del rango
            var aFechas = [];
            var oFechaActual = new Date(oDateInicio);
            var oFechaFin = new Date(oDateFin);

            // Agregar un día a la fecha fin para incluirla en el rango
            oFechaFin.setDate(oFechaFin.getDate() + 1);

            while (oFechaActual < oFechaFin) {
                aFechas.push(new Date(oFechaActual));
                oFechaActual.setDate(oFechaActual.getDate() + 1);
            }

            // Para cada fecha, agrupar las licencias y calcular contadores
            aFechas.forEach(function (oFecha) {
                // Filtrar licencias de esta fecha
                var aLicenciasFecha = aData.filter(function (license) {
                    if (!license.Dateturno) return false;

                    // Convertir Dateturno a Date
                    var oFechaTurno = new Date(license.Dateturno);

                    // Usar los métodos UTC para obtener la fecha real que representa
                    // El backend envía en UTC pero se muestra en zona local
                    // Ejemplo: Mon Nov 03 2025 21:00:00 GMT-0300 representa Tue Nov 04 2025 00:00:00 UTC
                    var iAnioUTC = oFechaTurno.getUTCFullYear();
                    var iMesUTC = oFechaTurno.getUTCMonth();
                    var iDiaUTC = oFechaTurno.getUTCDate();

                    // Crear fecha normalizada usando UTC (fecha real del backend)
                    var oFechaTurnoNormalizada = new Date(Date.UTC(iAnioUTC, iMesUTC, iDiaUTC, 0, 0, 0, 0));

                    // Normalizar la fecha del rango también a UTC para comparar
                    var oFechaNormalizada = new Date(Date.UTC(
                        oFecha.getFullYear(),
                        oFecha.getMonth(),
                        oFecha.getDate(),
                        0, 0, 0, 0
                    ));

                    // Comparar las fechas normalizadas en UTC
                    return oFechaNormalizada.getTime() === oFechaTurnoNormalizada.getTime();
                });

                // Calcular contadores usando la misma lógica que Utils.onCountItems
                // Crear una vista temporal para evitar errores
                var oTempView = { setModel: function () { } }; // Vista dummy
                var oCounts = Utils.onCountItems(oTempView, aLicenciasFecha);

                // Formatear fecha
                var sFechaFormateada = oFormatter.formatDate(oFecha);

                // Agregar fila al resultado
                aResultado.push([
                    sFechaFormateada,
                    oCounts.Total,
                    oCounts.LTWithManouvers,
                    oCounts.TCT,
                    oCounts.LTWithoutManouvers
                ]);
            });

            return aResultado;
        },


        onCancelReports: function () {
            if (this._oReportsDialog) {
                this._oReportsDialog.close();
            }
        },

        // ==================== MÉTODOS DE FILTRADO Y BÚSQUEDA ====================

        onColumnFilter: function (oEvent) {
            var sFilterProp = oEvent.getParameter("column").getFilterProperty();
            var oBinding = this.byId("turnosTable").getBinding("rows");
            var Filter = sap.ui.model.Filter;
            var FilterOperator = sap.ui.model.FilterOperator;

            // ── Equstat: "En Servicio" → "X", "Fuera de Servicio" → "" ──
            if (sFilterProp === "Equstat") {
                oEvent.preventDefault();

                var sValue = (oEvent.getParameter("value") || "").trim().toUpperCase();

                if (!sValue) {
                    oBinding.filter([], sap.ui.model.FilterType.Control);
                    return;
                }

                var sTextoES = "EN SERVICIO";
                var sTextoFS = "FUERA DE SERVICIO";

                // Prioridad: coincidencia desde el inicio ("E" → En Servicio, "F" → Fuera de Servicio)
                var bMatchES = sTextoES.indexOf(sValue) === 0;
                var bMatchFS = sTextoFS.indexOf(sValue) === 0;

                // Si no coincide desde el inicio, se acepta coincidencia parcial ("SERVICIO" → ambos)
                if (!bMatchES && !bMatchFS) {
                    bMatchES = sTextoES.indexOf(sValue) !== -1;
                    bMatchFS = sTextoFS.indexOf(sValue) !== -1;
                }

                var oFilter;
                if (bMatchES && bMatchFS) {
                    // ambos coinciden (ej: "SERVICIO") → mostrar todos
                    oBinding.filter([], sap.ui.model.FilterType.Control);
                    return;
                } else if (bMatchES) {
                    // En Servicio → Equstat = "X"
                    oFilter = new Filter("Equstat", FilterOperator.EQ, "X");
                } else if (bMatchFS) {
                    // Fuera de Servicio → Equstat vacío o null
                    oFilter = new Filter({
                        filters: [
                            new Filter("Equstat", FilterOperator.EQ, ""),
                            new Filter("Equstat", FilterOperator.EQ, null)
                        ],
                        and: false
                    });
                } else {
                    // sin coincidencia → tabla vacía
                    oFilter = new Filter("Equstat", FilterOperator.EQ, "__NO_MATCH__");
                }

                oBinding.filter([oFilter], sap.ui.model.FilterType.Control);
                return;
            }

            // ── Jobcond: texto → código numérico ("01", "04", "05", "06") ─
            if (sFilterProp === "Jobcond") {
                oEvent.preventDefault();

                var sRaw = (oEvent.getParameter("value") || "").trim();

                if (!sRaw) {
                    oBinding.filter([], sap.ui.model.FilterType.Control);
                    return;
                }

                var fnNorm = function (s) {
                    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                };
                var sNorm = fnNorm(sRaw);

                var aMap = [
                    { code: "01", label: fnNorm("Consignacion") },
                    { code: "04", label: fnNorm("Trabajo con Tension (Tct)") },
                    { code: "05", label: fnNorm("Trabajo Especiales (TcT)") },
                    { code: "06", label: fnNorm("Condiciones Especiales") }
                ];

                var aMatches = aMap.filter(function (m) {
                    return m.label.indexOf(sNorm) !== -1;
                });

                var oJobcondFilter;
                if (aMatches.length === 0) {
                    oJobcondFilter = new Filter("Jobcond", FilterOperator.EQ, "__NO_MATCH__");
                } else if (aMatches.length === 1) {
                    oJobcondFilter = new Filter("Jobcond", FilterOperator.EQ, aMatches[0].code);
                } else {
                    oJobcondFilter = new Filter({
                        filters: aMatches.map(function (m) {
                            return new Filter("Jobcond", FilterOperator.EQ, m.code);
                        }),
                        and: false
                    });
                }

                oBinding.filter([oJobcondFilter], sap.ui.model.FilterType.Control);
                return;
            }

            // ── Werks: texto → código(s) de región (dinámico desde RegionesJsonModel) ─
            if (sFilterProp === "Werks") {
                oEvent.preventDefault();

                var sRawW = (oEvent.getParameter("value") || "").trim();

                if (!sRawW) {
                    oBinding.filter([], sap.ui.model.FilterType.Control);
                    return;
                }

                var fnNormW = function (s) {
                    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                };
                var sNormW = fnNormW(sRawW);

                var oRegionesModel = this.getView().getModel("RegionesJsonModel");
                var aRegiones = (oRegionesModel && oRegionesModel.getProperty("/Regiones")) || [];

                var oFormatterW = this.formatter;
                var aCodeFiltersW = aRegiones
                    .filter(function (r) {
                        var sFormattedName = fnNormW((oFormatterW && oFormatterW.getRegiones(r.Werks)) || "");
                        return fnNormW(r.Name1 || "").indexOf(sNormW) !== -1 ||
                            sFormattedName.indexOf(sNormW) !== -1;
                    })
                    .map(function (r) {
                        return new Filter("Werks", FilterOperator.EQ, r.Werks);
                    });

                var oWerksFilter;
                if (aCodeFiltersW.length === 0) {
                    oWerksFilter = new Filter("Werks", FilterOperator.EQ, "__NO_MATCH__");
                } else if (aCodeFiltersW.length === 1) {
                    oWerksFilter = aCodeFiltersW[0];
                } else {
                    oWerksFilter = new Filter({ filters: aCodeFiltersW, and: false });
                }

                oBinding.filter([oWerksFilter], sap.ui.model.FilterType.Control);
                return;
            }

            // Resto de columnas: la tabla las maneja normalmente
        },

        onFilter: function () {
            const oView = this.getView();
            const oTable = this.byId("turnosTable");
            const oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                sap.m.MessageToast.show("No hay datos para filtrar");
                return;
            }

            const aFilters = [];

            const oFiltersModel = this.getView().getModel("FiltersJsonModel");
            const oFiltersData = oFiltersModel.getData();

            // 1. Región
            const sRegion = oFiltersData.Werks?.value;
            if (sRegion) {
                aFilters.push(new sap.ui.model.Filter("Werks", sap.ui.model.FilterOperator.EQ, sRegion));
            }

            // 2. E.T. (Estaciones) - MultiComboBox
            const oEstacionesCombo = this.byId("Estaciones");
            const aEstacionesKeys = oEstacionesCombo.getSelectedKeys();
            if (aEstacionesKeys && aEstacionesKeys.length > 0) {
                const aEstacionesFilters = aEstacionesKeys.map(sKey =>
                    new sap.ui.model.Filter("Tplnr", sap.ui.model.FilterOperator.EQ, sKey)
                );
                aFilters.push(new sap.ui.model.Filter({
                    filters: aEstacionesFilters,
                    and: false // OR
                }));
            }

            // 3. Equipo Solicitado CAMMESA
            const sEquipCammesa = oFiltersData.Equnr?.value;
            if (sEquipCammesa) {
                aFilters.push(new sap.ui.model.Filter("Equnr", sap.ui.model.FilterOperator.EQ, sEquipCammesa));
            }

            // 4. Estado Equipo CAMMESA - CON SOPORTE PARA VALORES VACÍOS
            const oEqustatFilter = oFiltersData.Equstat;
            if (oEqustatFilter && oEqustatFilter.value !== "N") {
                if (this.acceptEmptyValues("Equstat", oEqustatFilter)) {
                    if (oEqustatFilter.value === "") {
                        aFilters.push(
                            new sap.ui.model.Filter({
                                filters: [
                                    new sap.ui.model.Filter("Equstat", sap.ui.model.FilterOperator.EQ, ""),
                                    new sap.ui.model.Filter("Equstat", sap.ui.model.FilterOperator.EQ, null)
                                ],
                                and: false
                            })
                        );
                    } else {
                        // Filtro normal para "X"
                        aFilters.push(new sap.ui.model.Filter("Equstat", sap.ui.model.FilterOperator.EQ, oEqustatFilter.value));
                    }
                }
            }

            // 5. Bloqueo de Recierre
            const oBloqueoFilter = oFiltersData.Bloqueo;
            if (oBloqueoFilter && oBloqueoFilter.value !== "") {
                if (oBloqueoFilter.value === "X" || oBloqueoFilter.value === "N") {
                    aFilters.push(new sap.ui.model.Filter("Bloqueo", sap.ui.model.FilterOperator.EQ, oBloqueoFilter.value));
                }
            }

            // 6. Riesgo de disparo
            const oRdisparoFilter = oFiltersData.Rdisparo;
            if (oRdisparoFilter && oRdisparoFilter.value !== "") {
                if (oRdisparoFilter.value === "X") {
                    // SI = buscar X en el backend
                    aFilters.push(new sap.ui.model.Filter("Rdisparo", sap.ui.model.FilterOperator.EQ, "X"));
                } else if (oRdisparoFilter.value === "N") {
                    // NO = buscar valores vacíos en el backend
                    aFilters.push(
                        new sap.ui.model.Filter({
                            filters: [
                                new sap.ui.model.Filter("Rdisparo", sap.ui.model.FilterOperator.EQ, ""),
                                new sap.ui.model.Filter("Rdisparo", sap.ui.model.FilterOperator.EQ, null)
                            ],
                            and: false
                        })
                    );
                }
            }

            // 7. Búsqueda rápida (si existe)
            const oFastSearchInput = this.byId("fastSearchInput");
            if (oFastSearchInput) {
                const sFastSearch = oFastSearchInput.getValue();
                if (sFastSearch) {
                    const aFastSearchFilters = [
                        new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.Contains, sFastSearch),
                        new sap.ui.model.Filter("Equnr", sap.ui.model.FilterOperator.Contains, sFastSearch),
                    ];
                    aFilters.push(new sap.ui.model.Filter({
                        filters: aFastSearchFilters,
                        and: false // OR
                    }));
                }
            }

            console.groupEnd();

            // Aplicar filtros
            if (aFilters.length > 0) {
                oBinding.filter(aFilters);
                sap.m.MessageToast.show(`Filtros aplicados`);
            } else {
                oBinding.filter([]);
                sap.m.MessageToast.show("No hay filtros seleccionados");
            }

            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                if (aFilters.length > 0) {
                    const oTreeModel = this.getView().getModel("listCronoTreeModel");
                    const aOriginalData = oTreeModel.getData();
                    const aFilteredData = TreeTableHelper.applyFiltersToTree(aOriginalData, aFilters);
                    const oFilteredModel = new JSONModel(aFilteredData);
                    oTreeTable.setModel(oFilteredModel, "listCronoTreeModel");
                    this._marcarAdjuntosEnListadoCronologico();
                    this._ajustarAltoFilasCrono();

                    console.log("✅ Listado Cronológico creado con adjuntos marcados");
                } else {
                    const oTreeModel = this.getView().getModel("listCronoTreeModel");
                    oTreeTable.setModel(oTreeModel, "listCronoTreeModel");
                    this._marcarAdjuntosEnListadoCronologico();
                    this._ajustarAltoFilasCrono();

                    console.log("✅ Listado Cronológico creado con adjuntos marcados");
                }
            }
        },

        changeUbicacion: function (oEvent) {
            const oMultiComboBox = oEvent.getSource();
            const aSelectedKeys = oMultiComboBox.getSelectedKeys();
            const oEquipCammesaCombo = this.byId("EquipCammesa");

            // Si no hay estaciones seleccionadas, deshabilitar y limpiar EquipCammesa
            if (!aSelectedKeys || aSelectedKeys.length === 0) {
                oEquipCammesaCombo.setEnabled(false);
                oEquipCammesaCombo.setSelectedKey("");

                // Limpiar el modelo de equipos
                const oEquiposModel = this.getView().getModel("EquiposJsonModel");
                if (oEquiposModel) {
                    oEquiposModel.setData({ Equipos: [] });
                }

                return;
            }

            // Mostrar indicador de carga
            this.getView().setBusy(true);

            // Preparar los filtros para el OData
            const aFilters = [];

            // Filtro por Estaciones (OR entre las seleccionadas)
            const aEstacionFilters = aSelectedKeys.map(sEstacion =>
                new sap.ui.model.Filter("Estacion", sap.ui.model.FilterOperator.EQ, sEstacion)
            );
            if (aEstacionFilters.length > 0) {
                aFilters.push(new sap.ui.model.Filter({
                    filters: aEstacionFilters,
                    and: false // OR
                }));
            }

            // Filtros fijos
            const sEmpresa = SocietyHelper.getCurrentSociety(this.getView());
            aFilters.push(new sap.ui.model.Filter("Rol", sap.ui.model.FilterOperator.EQ, "hab_Aprobacion_habilitaciones"));
            aFilters.push(new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa));

            // Obtener el modelo OData
            const oModel = this.getView().getModel(); // Tu modelo OData principal

            // Realizar la llamada
            oModel.read("/EquiposRolesSet", {
                filters: aFilters,
                success: (oData) => {

                    // Guardar los datos en el modelo JSON
                    const oEquiposModel = this.getView().getModel("EquiposJsonModel");
                    if (!oEquiposModel) {
                        const oNewModel = new sap.ui.model.json.JSONModel();
                        oNewModel.setData({ Equipos: oData.results });
                        this.getView().setModel(oNewModel, "EquiposJsonModel");
                    } else {
                        oEquiposModel.setData({ Equipos: oData.results });
                    }

                    // Habilitar el ComboBox de Equipos
                    oEquipCammesaCombo.setEnabled(true);

                    // Limpiar selección previa
                    oEquipCammesaCombo.setSelectedKey("");

                    // Limpiar el valor en el modelo de filtros
                    const oFiltersModel = this.getView().getModel("FiltersJsonModel");
                    if (oFiltersModel) {
                        oFiltersModel.setProperty("/Equnr/value", "");
                    }

                    this.getView().setBusy(false);

                    if (oData.results.length === 0) {
                        sap.m.MessageToast.show("No se encontraron equipos para las estaciones seleccionadas");
                    }
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    sap.m.MessageBox.error("Error al cargar los equipos. Por favor intente nuevamente.");

                    // Deshabilitar el combo en caso de error
                    oEquipCammesaCombo.setEnabled(false);
                }
            });
        },
        // Limpia todos los filtros aplicados a la tabla

        onClearFilter: function () {

            this._limpiarAccionesEntrega();

            // 1. Limpiar Región
            const oRegionCombo = this.byId("Region");
            if (oRegionCombo) {
                oRegionCombo.setSelectedKey("");
            }

            // 2. Limpiar Estaciones (MultiComboBox)
            const oEstacionesCombo = this.byId("Estaciones");
            if (oEstacionesCombo) {
                oEstacionesCombo.setSelectedKeys([]);
            }

            // 3. Limpiar Equipo CAMMESA
            const oEquipCammesaCombo = this.byId("EquipCammesa");
            if (oEquipCammesaCombo) {
                oEquipCammesaCombo.setSelectedKey("");
                oEquipCammesaCombo.setEnabled(false);
            }

            // 4. Limpiar Estado Equipo CAMMESA
            const oStatusECammesaCombo = this.byId("StatusECammesa");
            if (oStatusECammesaCombo) {
                oStatusECammesaCombo.setSelectedKey("N");
            }

            // Limpiar Bloqueo de Recierre
            const oERecierreCombo = this.byId("ERecierre");
            if (oERecierreCombo) {
                oERecierreCombo.setSelectedKey("");
            }

            // Limpiar Riesgo de Disparo
            const oEDisparoCombo = this.byId("EDisparo");
            if (oEDisparoCombo) {
                oEDisparoCombo.setSelectedKey("");
            }

            // 7. Limpiar búsqueda rápida
            const oFastSearchInput = this.byId("fastSearchInput");
            if (oFastSearchInput) {
                oFastSearchInput.setValue("");
            }

            // 8. Limpiar filtros de la tabla
            const oTable = this.byId("turnosTable");
            const oBinding = oTable.getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }

            sap.m.MessageToast.show("Filtros limpiados");

            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                const oTreeModel = this.getView().getModel("listCronoTreeModel");
                if (oTreeModel) {
                    oTreeTable.setModel(oTreeModel, "listCronoTreeModel");
                    this._marcarAdjuntosEnListadoCronologico();
                    this._ajustarAltoFilasCrono();
                }
            }
        },

        acceptEmptyValues: function (sAttribute, oFilterObject) {
            switch (sAttribute) {
                case "Equstatnocam":
                case "Equstat":
                case "Bloqueo":
                case "Rdisparo":
                    return true;
                default:
                    return oFilterObject.value !== "";
            }
        },

        // Handler para cuando se expande/colapsa un nodo en TreeTable

        onToggleOpenState: function (oEvent) {
            const iRowIndex = oEvent.getParameter("rowIndex");
            const oRowContext = oEvent.getParameter("rowContext");
            const bExpanded = oEvent.getParameter("expanded");

            console.log(
                bExpanded ? "📂 Expandido:" : "📁 Colapsado:",
                oRowContext.getProperty("Equnr"),
                "-",
                oRowContext.getProperty("InitHourSort")
            );
        },

        // Expandir todos los grupos en TreeTable

        onExpandAllGroups: function () {
            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                oTreeTable.expandToLevel(1);
                MessageToast.show("Todos los grupos expandidos");
            }
        },

        // Colapsar todos los grupos en TreeTable

        onCollapseAllGroups: function () {
            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                oTreeTable.collapseAll();
                MessageToast.show("Todos los grupos colapsados");
            }
        },

        // Refresca los datos de la tabla cargando nuevamente el turno actual

        onRefresh: function () {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oDatePicker = this.byId("date");
            const oDateValue = oDatePicker.getDateValue();

            if (!oDateValue) {
                sap.m.MessageToast.show("Seleccione una fecha primero");
                return;
            }

            // Recargar datos
            this.showGlobalBusy(oResourceBundle.getText("updatingData") || "Actualizando datos...");

            const oView = this.getView();
            const oDataService = this.getView().getModel();

            const sEmpresa = SocietyHelper.getCurrentSociety(oView);
            const aFilters = [
                new sap.ui.model.Filter("Dateturno", sap.ui.model.FilterOperator.EQ, oDateValue),
                new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa)
            ];

            oDataService.read("/TurnosLicenciasSet", {
                filters: aFilters,
                success: (oData) => {

                    this.successSelectTurno(oData)
                        .then(() => {
                            this.hideGlobalBusy();
                            sap.m.MessageToast.show("Datos actualizados correctamente");
                        })
                        .catch((error) => {
                            this.hideGlobalBusy();
                            sap.m.MessageBox.error("Error al procesar los datos");
                        });
                },
                error: (oError) => {
                    console.groupEnd();

                    this.hideGlobalBusy();
                    sap.m.MessageBox.error("Error al actualizar los datos");
                }
            });
        },

        //-------------------------------- Editar turnos -------------------------

        _isEditableTurno: function (fechaTurno) {
            // Validación de fecha (lógica existente)
            const bIsEditableByDate = this._checkEditableByDate(fechaTurno);

            // Validación de rol (nueva lógica)
            const bIsEditableByRole = this._checkEditableByRole();

            // Ambas condiciones deben cumplirse
            return bIsEditableByDate && bIsEditableByRole;
        },

        _checkEditableByDate: function (fechaTurno) {
            if (!fechaTurno) {
                return false;
            }

            const oFechaTurno = new Date(fechaTurno);
            const oFechaTurnoNormalizada = new Date(Date.UTC(
                oFechaTurno.getUTCFullYear(),
                oFechaTurno.getUTCMonth(),
                oFechaTurno.getUTCDate(),
                0, 0, 0, 0
            ));

            const oHoy = new Date();
            const oHoyNormalizada = new Date(Date.UTC(
                oHoy.getFullYear(),
                oHoy.getMonth(),
                oHoy.getDate(),
                0, 0, 0, 0
            ));

            return oFechaTurnoNormalizada.getTime() >= oHoyNormalizada.getTime();
        },

        _checkEditableByRole: function () {
            return RoleHelper.isEditor();
        },


        _isTimeInRestrictedRange: function (sTime) {
            if (!sTime || typeof sTime !== "string") {
                return false;
            }

            const aTimeParts = sTime.split(":");
            if (aTimeParts.length !== 2) {
                return false;
            }

            const iHours = parseInt(aTimeParts[0], 10);
            const iMinutes = parseInt(aTimeParts[1], 10);

            if (isNaN(iHours) || isNaN(iMinutes)) {
                return false;
            }

            const iTotalMinutes = iHours * 60 + iMinutes;
            const iStartRestricted = 5 * 60 + 30;  // 05:30 = 330 minutos
            const iEndRestricted = 6 * 60 + 30;    // 06:30 = 390 minutos

            return iTotalMinutes > iStartRestricted && iTotalMinutes < iEndRestricted;
        },

        // ==================== MÉTODOS DE ALERTAS DE LICENCIAS SIN ASIGNAR ====================


        _checkUnassignedLicenses: function (oFechaTurno) {
            if (!oFechaTurno) {
                return;
            }

            if (this._suppressLicenseAlert === true) {
                this._suppressLicenseAlert = false;
                return;
            }

            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
            const aLicenciasAsignadas = oLicencesModel?.getData() || [];

            TurnosService.search({ FechaTurno: oFechaTurno, oView: this.getView(), isRefresh: true })
                .then((aTodasLasLicencias) => {
                    const idsAsignados = new Set(aLicenciasAsignadas.map(l => l.Id));
                    const aLicenciasSinAsignar = aTodasLasLicencias.filter(lic => !idsAsignados.has(lic.Id));

                    if (aLicenciasSinAsignar.length > 0) {
                        const sMessage = oResourceBundle.getText("licensesWithoutShiftMessage", [aLicenciasSinAsignar.length]);

                        MessageBox.confirm(sMessage, {
                            title: oResourceBundle.getText("licensesWithoutShift"),
                            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                            emphasizedAction: MessageBox.Action.YES,
                            styleClass: "sapUiSizeCompact",
                            onClose: (sAction) => {
                                if (sAction === MessageBox.Action.YES) {
                                    this.onAddLicense();
                                }
                            }
                        });
                    }
                })
                .catch((error) => {
                    console.error("Error al verificar licencias sin asignar:", error);
                });
        },


        _checkNewLicensesBeforeSave: function (oFechaTurno) {
            return new Promise((resolve, reject) => {
                if (!oFechaTurno) {
                    resolve(true);
                    return;
                }

                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
                const aLicenciasAsignadas = oLicencesModel?.getData() || [];

                TurnosService.search({ FechaTurno: oFechaTurno, oView: this.getView(), isRefresh: true })
                    .then((aTodasLasLicencias) => {
                        const idsAsignados = new Set(aLicenciasAsignadas.map(l => l.Id));
                        const aLicenciasSinAsignar = aTodasLasLicencias.filter(lic => !idsAsignados.has(lic.Id));

                        if (aLicenciasSinAsignar.length > 0) {
                            const sMessage = oResourceBundle.getText("newLicensesWithoutShiftMessage", [aLicenciasSinAsignar.length]);

                            MessageBox.confirm(sMessage, {
                                title: oResourceBundle.getText("newLicensesAvailable"),
                                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                emphasizedAction: MessageBox.Action.YES,
                                styleClass: "sapUiSizeCompact",
                                onClose: (sAction) => {
                                    if (sAction === MessageBox.Action.YES) {
                                        this.onAgregarLicencia();
                                        resolve(false);
                                    } else {
                                        resolve(true);
                                    }
                                }
                            });
                        } else {
                            resolve(true);
                        }
                    })
                    .catch((error) => {
                        console.error("Error al verificar licencias antes de guardar:", error);
                        resolve(true);
                    });
            });
        },

        // ---------------------- REORDENAMIENTO GRUPOS ----------------
        /**
         * Recalcula el campo Grupo SOLO para el frontend:
         * - Si Equnr + TurnoAsignado es igual => mismo Grupo
         * - Si no coincide con nadie => grupo solo
         * - Si es desacoplado => mantiene "desacoplado_idLicencia(<Id>)"
         */
        _rebuildFrontendGroupsByEquipoHora: function (aLicences) {
            if (!Array.isArray(aLicences)) return;

            const mCount = Object.create(null);

            const buildKey = (lic) => {
                const equipo = (lic.Equnr || "").trim();
                const hora = (lic.TurnoAsignado || "").trim();
                return equipo + "|" + hora;
            };

            aLicences.forEach((lic) => {
                const sGrupo = String(lic.Grupo || "");
                const bIsDetached = sGrupo.startsWith("desacoplado_idLicencia(");
                if (bIsDetached) return;

                const key = buildKey(lic);
                mCount[key] = (mCount[key] || 0) + 1;
            });

            aLicences.forEach((lic) => {
                const sGrupo = String(lic.Grupo || "");
                const bIsDetached = sGrupo.startsWith("desacoplado_idLicencia(");
                if (bIsDetached) return;

                const key = buildKey(lic);
                if (mCount[key] > 1) {
                    const equipo = (lic.Equnr || "").trim();
                    const hora = (lic.TurnoAsignado || "").trim().replaceAll(":", "");
                    lic.Grupo = `grp_${equipo}_${hora}`;
                } else {
                    lic.Grupo = `solo_${lic.Id}`;
                }
            });
        },

        _assignGroupColors: function (aLicences) {
            if (!Array.isArray(aLicences)) return;

            const aColors = [
                "#2196F3",
                "#4CAF50",
                "#F44336",
                "#FF9800",
                "#9C27B0",
                "#009688"
            ];

            const mGroupColor = {};
            let iColorIndex = 0;

            aLicences.forEach((lic) => {
                const sGrupo = lic.Grupo;

                if (!sGrupo) {
                    lic.ColorGrupo = "";
                    return;
                }

                if (!mGroupColor[sGrupo]) {
                    mGroupColor[sGrupo] = aColors[iColorIndex % aColors.length];
                    iColorIndex++;
                }

                lic.ColorGrupo = mGroupColor[sGrupo];
            });
        },

        /* ----------------------------- TRAMITACIONES --------------------- */
        getTramitacionHighlight: function (sColor) {
            if (sColor === 'red') return 'Error';
            if (sColor === 'yellow') return 'Warning';
            return 'None';
        },

        // Obtener tooltip informativo
        getTramitacionTooltip: function (oLicencia) {
            if (!oLicencia || !oLicencia.tramitacionProblematica) return "";

            const mEstados = {
                "AS": "Anulada por el solicitante",
                "NA": "No Autorizada",
                "CC": "Condicionada"
            };

            const sEstado = mEstados[oLicencia.tramitacionEstado] || oLicencia.tramitacionEstado;

            if (oLicencia.tramitacionDetalles && oLicencia.tramitacionDetalles.length > 0) {
                const oDetalle = oLicencia.tramitacionDetalles[0];
                return `Estado: ${sEstado}${oDetalle.observaciones ? '\nObservaciones: ' + oDetalle.observaciones : ''}`;
            }

            return `Estado: ${sEstado}`;
        },

        getCalendarioColor: function (sColor) {
            if (sColor === 'red') {
                return '#BB0000';
            }
            if (sColor === 'yellow') {
                return '#E78C07';
            }
            return '#0854A0';
        },

        // ------------------------------ AGREGAR LICENCIA --------------------------------------

        // ------------------------------- TAB REPORTES ------------------------------------------

        onVisualizarReporte: function () {
            var oDialog = this._oReportsDialog;
            if (!oDialog) {
                return;
            }

            // Obtener DatePickers
            var oFechaInicio = this.byId("fechaInicio") || sap.ui.core.Fragment.byId(this.getView().getId(), "fechaInicio");
            var oFechaFin = this.byId("fechaFin") || sap.ui.core.Fragment.byId(this.getView().getId(), "fechaFin");

            if (!oFechaInicio || !oFechaFin) {
                MessageToast.show("No se pudieron obtener los DatePickers.");
                return;
            }

            var oDateInicio = oFechaInicio.getDateValue();
            var oDateFin = oFechaFin.getDateValue();

            if (!oDateInicio || !oDateFin) {
                MessageBox.warning("Por favor, seleccione ambas fechas (Inicio y Fin).");
                return;
            }

            if (oDateInicio > oDateFin) {
                MessageBox.warning("La fecha de inicio no puede ser mayor que la fecha de fin.");
                return;
            }

            // Guardar fechas para uso posterior
            this._reporteFechaInicio = oDateInicio;
            this._reporteFechaFin = oDateFin;

            // Obtener tipo de reporte
            var sReportType = oDialog.data("reportType") || "maniobras";

            // Cerrar el diálogo
            oDialog.close();

            // Mostrar busy
            this.showGlobalBusy("Cargando datos del reporte...");

            const oView = this.getView();
            const oDataService = this.getView().getModel();
            const sEmpresa = SocietyHelper.getCurrentSociety(oView);

            // Generar array de fechas
            const aFechas = [];
            const oFechaInicioUTC = new Date(Date.UTC(
                oDateInicio.getFullYear(),
                oDateInicio.getMonth(),
                oDateInicio.getDate(),
                0, 0, 0, 0
            ));
            const oFechaFinUTC = new Date(Date.UTC(
                oDateFin.getFullYear(),
                oDateFin.getMonth(),
                oDateFin.getDate(),
                0, 0, 0, 0
            ));

            const oFechaFinLimiteUTC = new Date(oFechaFinUTC);
            oFechaFinLimiteUTC.setUTCDate(oFechaFinLimiteUTC.getUTCDate() + 1);

            const oFechaActualUTC = new Date(oFechaInicioUTC);
            while (oFechaActualUTC < oFechaFinLimiteUTC) {
                const oFechaNormalizada = new Date(Date.UTC(
                    oFechaActualUTC.getUTCFullYear(),
                    oFechaActualUTC.getUTCMonth(),
                    oFechaActualUTC.getUTCDate(),
                    0, 0, 0, 0
                ));
                aFechas.push(oFechaNormalizada);
                oFechaActualUTC.setUTCDate(oFechaActualUTC.getUTCDate() + 1);
            }

            const sEntity = "/TurnosLicenciasSet";

            // Crear promesas para cada fecha
            const aPromises = aFechas.map((oFecha) => {
                return new Promise((resolve, reject) => {
                    const aFilters = [
                        new Filter("Dateturno", FilterOperator.EQ, oFecha),
                        new Filter("Empresa", FilterOperator.EQ, sEmpresa)
                    ];

                    oDataService.read(sEntity, {
                        filters: aFilters,
                        success: (oData) => {
                            resolve(oData.results || []);
                        },
                        error: (oError) => {
                            resolve([]);
                        }
                    });
                });
            });

            // Ejecutar todas las promesas
            Promise.all(aPromises)
                .then((aResultadosPorFecha) => {
                    // Acumular resultados
                    const aTodosLosResultados = [];
                    aResultadosPorFecha.forEach((aResultados) => {
                        if (Array.isArray(aResultados) && aResultados.length > 0) {
                            aTodosLosResultados.push(...aResultados);
                        }
                    });

                    if (!aTodosLosResultados.length) {
                        this.hideGlobalBusy();
                        MessageBox.information("No se encontraron turnos para el rango de fechas seleccionado.");
                        return;
                    }

                    // PROCESAR IGUAL QUE processReportData
                    const oDataModel = this.getView().getModel();
                    const aPromisesLicense = aTodosLosResultados.map((licencia) => {
                        var oDateturno = licencia.Dateturno;
                        return LicenseService.FIND(licencia, oDataModel)
                            .then(result => {
                                if (result) {
                                    result.Dateturno = oDateturno;
                                }
                                return result;
                            })
                            .catch(err => {
                                console.error("Error en FIND para licencia", licencia, err);
                                return null;
                            });
                    });

                    return Promise.all(aPromisesLicense);
                })
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x);

                    if (!results.length) {
                        this.hideGlobalBusy();
                        MessageBox.information("No se encontró información para las licencias del rango de fechas.");
                        return;
                    }

                    // APLICAR MISMO PROCESAMIENTO QUE EL EXCEL
                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        this.getView()
                    );
                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    this._datosReporteProcesados = arrayOrdenado;

                    var aDatosTabla = this._procesarDatosComoExcel(arrayOrdenado, oDateInicio, oDateFin);

                    // CARGAR DATOS PROCESADOS EN EL MODELO
                    var oReporteModel = this.getView().getModel("ReporteModel");
                    oReporteModel.setData(aDatosTabla);

                    // Actualizar título y rango de fechas
                    var oTitleControl = this.byId("reporteTitle");
                    var oDateRangeControl = this.byId("reporteDateRange");

                    if (oTitleControl) {
                        oTitleControl.setText(sReportType === "maniobras" ? "Resumen Maniobras" : "Reporte Amplio");
                    }

                    if (oDateRangeControl) {
                        var sFormatter = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                        var sFechaInicioStr = sFormatter.format(oDateInicio);
                        var sFechaFinStr = sFormatter.format(oDateFin);
                        oDateRangeControl.setText(`Horarios de maniobras previstas desde: ${sFechaInicioStr} Hasta: ${sFechaFinStr}`);
                    }

                    // Mostrar la tab del reporte
                    var oIconTabBar = this.byId("mainTabBar");
                    if (oIconTabBar) {
                        var oReporteTab = oIconTabBar.getItems().find(item => item.getKey() === "REPORTE");
                        if (oReporteTab) {
                            oReporteTab.setVisible(true);
                        }
                        oIconTabBar.setSelectedKey("REPORTE");
                    }

                    this.hideGlobalBusy();
                    MessageToast.show(`Reporte cargado`);
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al cargar el reporte: " + error.message);
                });
        },

        _procesarDatosComoExcel: function (aData, oDateInicio, oDateFin) {

            var oFormatter = this.formatter;
            var aDatosAplanados = [];

            // Generar array de fechas del rango (IGUAL QUE EL EXCEL)
            var aFechas = [];
            var oFechaActual = new Date(oDateInicio);
            var oFechaFin = new Date(oDateFin);
            oFechaFin.setDate(oFechaFin.getDate() + 1);

            while (oFechaActual < oFechaFin) {
                aFechas.push(new Date(oFechaActual));
                oFechaActual.setDate(oFechaActual.getDate() + 1);
            }

            // Para cada fecha, procesar IGUAL QUE EL EXCEL
            aFechas.forEach(function (oFecha) {
                var sFechaFormateada = oFormatter.formatDate(oFecha);

                // Filtrar licencias de esta fecha (IGUAL QUE EL EXCEL)
                var aLicenciasFecha = aData.filter(function (license) {
                    if (!license.Dateturno) {
                        return false;
                    }

                    // Normalizar fecha del turno a UTC 00:00:00
                    var oFechaTurno = new Date(license.Dateturno);
                    var iAnioUTC = oFechaTurno.getUTCFullYear();
                    var iMesUTC = oFechaTurno.getUTCMonth();
                    var iDiaUTC = oFechaTurno.getUTCDate();
                    var oFechaTurnoNormalizada = new Date(Date.UTC(iAnioUTC, iMesUTC, iDiaUTC, 0, 0, 0, 0));

                    // Normalizar fecha actual a UTC 00:00:00
                    var oFechaNormalizada = new Date(Date.UTC(
                        oFecha.getFullYear(),
                        oFecha.getMonth(),
                        oFecha.getDate(),
                        0, 0, 0, 0
                    ));

                    // Comparar las fechas normalizadas en UTC
                    return oFechaNormalizada.getTime() === oFechaTurnoNormalizada.getTime();
                });

                // Eliminar duplicados basados en Equnr + TurnoAsignado (IGUAL QUE EL EXCEL)
                var aLicenciasUnicas = [];
                var oMapaDuplicados = {};

                aLicenciasFecha.forEach(function (license) {
                    var sEquipo = license.Equnr || "";
                    var sTurno = license.TurnoAsignado || "";
                    var sClave = sEquipo + "|" + sTurno;

                    if (!oMapaDuplicados[sClave]) {
                        oMapaDuplicados[sClave] = true;
                        aLicenciasUnicas.push(license);
                    }
                });

                aLicenciasUnicas.forEach(function (license) {
                    var sEquipo = license.Equnr || "";
                    var sHora = license.TurnoAsignado || (license.Horainicio ? oFormatter.durationToTime(license.Horainicio)
                        : (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""));
                    var sComentarios = license.Comments || license.Patadic || "";

                    aDatosAplanados.push({
                        Fecha: sFechaFormateada,
                        Equipo: sEquipo,
                        Hora: sHora,
                        Comentarios: sComentarios,
                        Licencia: license.Id,
                        FechaOriginal: license.Dateturno
                    });

                });
            }.bind(this));

            return aDatosAplanados;
        },

        _obtenerDatosReporte: function (oDateInicio, oDateFin, sReportType) {
            return new Promise((resolve, reject) => {
                const oDataService = this.getView().getModel();
                const sEmpresa = SocietyHelper.getCurrentSociety(this.getView());

                // Generar array de fechas
                const aFechas = [];
                const oFechaInicioUTC = new Date(Date.UTC(
                    oDateInicio.getFullYear(),
                    oDateInicio.getMonth(),
                    oDateInicio.getDate(),
                    0, 0, 0, 0
                ));
                const oFechaFinUTC = new Date(Date.UTC(
                    oDateFin.getFullYear(),
                    oDateFin.getMonth(),
                    oDateFin.getDate(),
                    0, 0, 0, 0
                ));

                const oFechaFinLimiteUTC = new Date(oFechaFinUTC);
                oFechaFinLimiteUTC.setUTCDate(oFechaFinLimiteUTC.getUTCDate() + 1);

                const oFechaActualUTC = new Date(oFechaInicioUTC);
                while (oFechaActualUTC < oFechaFinLimiteUTC) {
                    const oFechaNormalizada = new Date(Date.UTC(
                        oFechaActualUTC.getUTCFullYear(),
                        oFechaActualUTC.getUTCMonth(),
                        oFechaActualUTC.getUTCDate(),
                        0, 0, 0, 0
                    ));
                    aFechas.push(oFechaNormalizada);
                    oFechaActualUTC.setUTCDate(oFechaActualUTC.getUTCDate() + 1);
                }

                const sEntity = "/TurnosLicenciasSet";

                // Crear promesas para cada fecha
                const aPromises = aFechas.map((oFecha) => {
                    return new Promise((resolveInner, rejectInner) => {
                        const aFilters = [
                            new Filter("Dateturno", FilterOperator.EQ, oFecha),
                            new Filter("Empresa", FilterOperator.EQ, sEmpresa)
                        ];

                        oDataService.read(sEntity, {
                            filters: aFilters,
                            success: (oData) => {
                                resolveInner(oData.results || []);
                            },
                            error: (oError) => {
                                resolveInner([]);
                            }
                        });
                    });
                });

                // Ejecutar todas las promesas
                Promise.all(aPromises)
                    .then((aResultadosPorFecha) => {
                        const aTodosLosResultados = [];
                        aResultadosPorFecha.forEach((aResultados) => {
                            if (Array.isArray(aResultados) && aResultados.length > 0) {
                                aTodosLosResultados.push(...aResultados);
                            }
                        });
                        resolve(aTodosLosResultados);
                    })
                    .catch(reject);
            });
        },


        // Función para descargar el reporte actual (desde la tab)
        onDescargarReporteActual: function () {
            if (!this._reporteFechaInicio || !this._reporteFechaFin) {
                MessageToast.show("No hay datos de reporte cargados");
                return;
            }

            // USAR LOS DATOS PROCESADOS GUARDADOS
            if (!this._datosReporteProcesados || this._datosReporteProcesados.length === 0) {
                MessageToast.show("No hay datos para descargar");
                return;
            }

            this.createExcelReportManiobras(
                this._datosReporteProcesados,
                this._reporteFechaInicio,
                this._reporteFechaFin
            );
        },

        onCerrarReporte: function () {
            var oIconTabBar = this.byId("mainTabBar");
            if (oIconTabBar) {
                // Ocultar la tab del reporte
                var oReporteTab = oIconTabBar.getItems().find(item => item.getKey() === "REPORTE");
                if (oReporteTab) {
                    oReporteTab.setVisible(false);
                }
                // Volver a la primera tab
                oIconTabBar.setSelectedKey("LIC");
            }
        },

        // ------------------------------------------------ DESCRIPCIONES PARA EQUIPOS ------------------------------------------------------------------------
        _obtenerDescripcionesEquipos: function (aEquipos) {
            return new Promise((resolve) => {
                if (!aEquipos || aEquipos.length === 0) {
                    resolve({});
                    return;
                }

                const oDataModel = this.getView().getModel();
                const sEntity = "/EquiposRolesSet";
                const sEmpresa = SocietyHelper.getCurrentSociety(this.getView());

                const estacionesUnicas = [...new Set(aEquipos.map(e => e.Tplnr).filter(Boolean))];

                const aPromises = estacionesUnicas.map((sTplnr) => {
                    return new Promise((resolveEstacion) => {
                        const aFilters = [
                            new Filter("Estacion", FilterOperator.EQ, sTplnr),
                            new Filter("Rol", FilterOperator.EQ, "hab_Aprobacion_habilitaciones"),
                            new Filter("Empresa", FilterOperator.EQ, sEmpresa)
                        ];

                        oDataModel.read(sEntity, {
                            filters: aFilters,
                            success: (oData) => {
                                resolveEstacion(oData.results || []);
                            },
                            error: () => {
                                resolveEstacion([]);
                            }
                        });
                    });
                });

                Promise.all(aPromises)
                    .then((aResultadosPorEstacion) => {
                        const todosLosEquipos = aResultadosPorEstacion.flat();

                        const oMapaDescripciones = {};
                        todosLosEquipos.forEach(equipo => {
                            const sCodigo = (equipo.CodigoEquipo || "").trim();
                            if (sCodigo) {
                                oMapaDescripciones[sCodigo] = equipo.DescEquipo || "";
                            }
                        });

                        resolve(oMapaDescripciones);
                    })
                    .catch(() => {
                        resolve({});
                    });
            });
        },

        // ----------------------------------------------------- ENVIAR ----------------------------------------------------------------

        // onSendEmailPress: function () {
        //     const Fecha = this._oFechaTurnoCreado || this.getView().byId('date').getDateValue();

        //     if (!Fecha) {
        //         MessageBox.warning("Debe seleccionar una fecha para enviar el turno.");
        //         return;
        //     }

        //     const oModel = this.getView().getModel("LicencesJsonModel");
        //     const aAllLicences = oModel.getProperty("/") || [];

        //     if (!aAllLicences || aAllLicences.length === 0) {
        //         MessageBox.warning("No hay datos para enviar.");
        //         return;
        //     }

        //     const aLicenciasSinHorario = aAllLicences.filter(lic => {
        //         const turno = lic.TurnoAsignado;
        //         return !turno || turno.trim() === "";
        //     });

        //     if (aLicenciasSinHorario.length > 0) {
        //         const sLicenciasDetalle = aLicenciasSinHorario
        //             .map(lic => `• Licencia ${lic.Id} (${lic.Equnr || 'Sin equipo'})`)
        //             .join("\n");

        //         MessageBox.error(
        //             `No se puede enviar el turno porque hay ${aLicenciasSinHorario.length} licencia(s) sin horario asignado:\n\n${sLicenciasDetalle}\n\nPor favor, asigne un horario a todas las licencias antes de enviar.`,
        //             {
        //                 title: "Horarios sin asignar",
        //                 styleClass: "sapUiSizeCompact"
        //             }
        //         );
        //         return;
        //     }

        //     const aLicenciasAEnviar = aAllLicences.filter(lic => lic.Enviado !== true);

        //     if (aLicenciasAEnviar.length === 0) {
        //         MessageBox.information("Todas las licencias ya fueron enviadas. No hay cambios pendientes.");
        //         return;
        //     }

        //     // Preparar datos SOLO de las licencias a enviar
        //     const aData = [];
        //     aLicenciasAEnviar.forEach(function (oRowData) {
        //         const row = {
        //             Id: oRowData.Id,
        //             Empresa: oRowData.Empresa,
        //             Tipo: oRowData.Tipo,
        //             Anio: oRowData.Anio,
        //             Fecha: Fecha,
        //             Turno: oRowData.TurnoAsignado,
        //             Comentarios: oRowData.Comentarios,
        //             Enviado: true
        //         };
        //         aData.push(row);
        //     });

        //     this.createTurno(aData, aLicenciasAEnviar, true);
        // },
        onSendEmailPress: function () {
            var oFormatter = this.formatter;
            const oView = this.getView();
            const FechaTurno = ModelHelper.getModel("LicencesTurnoJsonModel", oView).getProperty("/FechaTurno");
            const oModel = this.getView().getModel();
            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            const aLicencias = oLicencesModel.getData() || [];

            if (!aLicencias || aLicencias.length === 0) {
                MessageBox.warning("No hay licencias en el modelo para procesar");
                return;
            }

            // 🆕 VALIDACIÓN DE ESTADOS ANTES DE ENVIAR MAILS
            console.log("🔍 Iniciando validación de estados antes de enviar mails...");
            this.showGlobalBusy("Validando estados de licencias antes de enviar...");
            this._validarEstadosAntesDeEnviarMail(aLicencias, FechaTurno, oFormatter);
        },

        _validarEstadosAntesDeEnviar: function (aLicenciasEnPantalla, Fecha) {
            const oDataModel = this.getView().getModel();
            const estadosPermitidos = ["01", "07", "08", "10", "23"];

            console.log("🔍 Validando estados de", aLicenciasEnPantalla.length, "licencias antes de enviar...");

            // Consultar estado actual de cada licencia UNA POR UNA
            const aPromises = aLicenciasEnPantalla.map(oLic => {
                return new Promise((resolve) => {
                    // Construir clave compuesta
                    const sPath = oDataModel.createKey("/LicenciaTrabajoSet", {
                        Empresa: oLic.Empresa || "100",
                        Id: oLic.Id,
                        Tipo: oLic.Tipo || "L",
                        Anio: oLic.Anio || "2026"
                    });

                    console.log(`   🔍 Consultando: ${oLic.Id}`);

                    oDataModel.read(sPath, {
                        urlParameters: {
                            "$expand": "TurnosLicencias_nav"
                        },
                        success: (oData) => {
                            const esValida = estadosPermitidos.includes(oData.Licstat);

                            if (!esValida) {
                                console.log(`   ❌ ${oLic.Id}: Estado ${oData.Licstat} NO permitido`);
                            } else {
                                console.log(`   ✅ ${oLic.Id}: Estado ${oData.Licstat} OK`);
                            }

                            resolve({
                                id: oLic.Id,
                                estadoActual: oData.Licstat,
                                estadoTexto: this.formatter.formatLicState(oData.Licstat),
                                esValida: esValida
                            });
                        },
                        error: (oError) => {
                            console.error(`   ❌ ${oLic.Id}: Error al consultar`);
                            resolve({
                                id: oLic.Id,
                                estadoActual: 'ERROR',
                                estadoTexto: 'Error al verificar',
                                esValida: false
                            });
                        }
                    });
                });
            });

            // Esperar todas las validaciones
            Promise.all(aPromises).then((resultados) => {
                this.hideGlobalBusy();

                const invalidas = resultados.filter(r => !r.esValida);
                const validas = resultados.filter(r => r.esValida);

                console.log("📊 Resultado de validación:");
                console.log("   ✅ Licencias válidas:", validas.length);
                console.log("   ❌ Licencias con estado no permitido:", invalidas.length);

                if (invalidas.length > 0) {
                    // Filtrar licencias
                    const aLicenciasValidas = aLicenciasEnPantalla.filter(lic =>
                        validas.find(v => v.id === lic.Id)
                    );

                    const aLicenciasInvalidas = aLicenciasEnPantalla.filter(lic =>
                        invalidas.find(inv => inv.id === lic.Id)
                    );

                    // MARCAR COMO NO ENVIADAS
                    this.showGlobalBusy("Actualizando estados de envío...");
                    this._marcarLicenciasComoNoEnviadas(aLicenciasInvalidas, Fecha)
                        .then((resultadosUpdate) => {
                            this.hideGlobalBusy();

                            const exitosas = resultadosUpdate.filter(r => r.success).length;
                            console.log(`✅ ${exitosas} licencias marcadas como NO enviadas`);

                            // Actualizar modelo
                            const oModel = this.getView().getModel("LicencesJsonModel");
                            oModel.setData(aLicenciasValidas);
                            this.getLicencesArray = aLicenciasValidas;
                            Utils.onCountItems(this.getView(), aLicenciasValidas);

                            // Mensaje informativo
                            let sMsg = `Se detectaron ${invalidas.length} licencia(s) con cambio de estado:\n\n`;

                            invalidas.forEach(inv => {
                                const lic = aLicenciasInvalidas.find(l => l.Id === inv.id);
                                sMsg += `• ${inv.id} (${lic?.Equnr || 'Sin equipo'})\n`;
                                sMsg += `  Estado: ${inv.estadoTexto}\n\n`;
                            });


                            // SOLO MOSTRAR INFORMACIÓN
                            MessageBox.information(sMsg, {
                                title: "Licencias excluidas",
                                styleClass: "sapUiSizeCompact"
                            });

                            // CONTINUAR AUTOMÁTICAMENTE
                            console.log("✅ Continuando con envío de", aLicenciasValidas.length, "licencias válidas");
                            this._ejecutarEnvio(aLicenciasValidas, Fecha);
                        })
                        .catch((error) => {
                            this.hideGlobalBusy();
                            console.error("❌ Error al marcar como NO enviadas:", error);
                            MessageBox.error("Error al actualizar estados: " + (error.message || "Error desconocido"));
                        });
                } else {
                    console.log("✅ Todas válidas");
                    this._ejecutarEnvio(aLicenciasEnPantalla, Fecha);
                }
            }).catch((error) => {
                this.hideGlobalBusy();
                console.error("❌ Error en validación de estados:", error);
                MessageBox.error("Error al validar estados: " + (error.message || "Error desconocido"));
            });
        },

        _ejecutarEnvio: function (aLicencias, Fecha) {
            console.log("📤 Ejecutando envío de", aLicencias.length, "licencias");

            const aData = [];

            aLicencias.forEach(function (oRowData) {
                const row = {
                    Id: oRowData.Id,
                    Empresa: oRowData.Empresa,
                    Tipo: oRowData.Tipo,
                    Anio: oRowData.Anio,
                    Fecha: Fecha,
                    Turno: oRowData.TurnoAsignado,
                    Comentarios: oRowData.Comentarios,
                    Enviado: true,
                    Agrmanual: oRowData.Agrmanual || false
                };
                aData.push(row);
            });

            this.createTurno(aData, aLicencias, true);
        },

        _validarEstadosAntesDeEnviarMail: function (aLicenciasEnPantalla, FechaTurno, oFormatter) {
            const oDataModel = this.getView().getModel();
            const estadosPermitidos = ["01", "07", "08", "10", "23"];

            console.log("🔍 Validando estados de", aLicenciasEnPantalla.length, "licencias antes de enviar mails...");

            // Consultar estado actual de cada licencia UNA POR UNA
            const aPromises = aLicenciasEnPantalla.map(oLic => {
                return new Promise((resolve) => {
                    // Construir clave compuesta
                    const sPath = oDataModel.createKey("/LicenciaTrabajoSet", {
                        Empresa: oLic.Empresa || "100",
                        Id: oLic.Id,
                        Tipo: oLic.Tipo || "L",
                        Anio: oLic.Anio || "2026"
                    });

                    console.log(`   🔍 Consultando: ${oLic.Id}`);

                    // Leer con expand de turnos
                    oDataModel.read(sPath, {
                        urlParameters: {
                            "$expand": "TurnosLicencias_nav"
                        },
                        success: (oData) => {
                            const esValida = estadosPermitidos.includes(oData.Licstat);

                            if (!esValida) {
                                console.log(`   ❌ ${oLic.Id}: Estado ${oData.Licstat} (${this.formatter.formatLicState(oData.Licstat)}) NO permitido`);
                            } else {
                                console.log(`   ✅ ${oLic.Id}: Estado ${oData.Licstat} (${this.formatter.formatLicState(oData.Licstat)}) OK`);
                            }

                            resolve({
                                id: oLic.Id,
                                estadoActual: oData.Licstat,
                                estadoTexto: this.formatter.formatLicState(oData.Licstat),
                                esValida: esValida
                            });
                        },
                        error: (oError) => {
                            console.error(`   ❌ ${oLic.Id}: Error al consultar`, oError);

                            // Si hay error, asumir que no es válida
                            resolve({
                                id: oLic.Id,
                                estadoActual: 'ERROR',
                                estadoTexto: 'Error al verificar',
                                esValida: false
                            });
                        }
                    });
                });
            });

            // Esperar todas las validaciones
            Promise.all(aPromises).then((resultados) => {
                this.hideGlobalBusy();

                const invalidas = resultados.filter(r => !r.esValida);
                const validas = resultados.filter(r => r.esValida);

                console.log("📊 Resultado de validación:");
                console.log("   ✅ Licencias válidas:", validas.length);
                console.log("   ❌ Licencias con estado no permitido:", invalidas.length);

                if (invalidas.length > 0) {
                    // Filtrar licencias válidas e inválidas
                    const aLicenciasValidas = aLicenciasEnPantalla.filter(lic =>
                        validas.find(v => v.id === lic.Id)
                    );

                    const aLicenciasInvalidas = aLicenciasEnPantalla.filter(lic =>
                        invalidas.find(inv => inv.id === lic.Id)
                    );

                    // MARCAR COMO NO ENVIADAS EN EL BACKEND
                    this.showGlobalBusy("Actualizando estados de envío...");
                    this._marcarLicenciasComoNoEnviadas(aLicenciasInvalidas, FechaTurno)
                        .then((resultadosUpdate) => {
                            this.hideGlobalBusy();

                            const exitosas = resultadosUpdate.filter(r => r.success).length;
                            const fallidas = resultadosUpdate.filter(r => !r.success).length;

                            console.log(`✅ ${exitosas} licencias marcadas como NO enviadas`);
                            if (fallidas > 0) {
                                console.log(`❌ ${fallidas} licencias no se pudieron actualizar`);
                            }

                            // ACTUALIZAR MODELO (quitar las inválidas de la vista)
                            const oView = this.getView();
                            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                            oLicencesModel.setData(aLicenciasValidas);
                            this.getLicencesArray = aLicenciasValidas;
                            Utils.onCountItems(this.getView(), aLicenciasValidas);

                            // Construir mensaje informativo
                            let sMsg = `Se detectaron ${invalidas.length} licencia(s) con cambio de estado:\n\n`;

                            invalidas.forEach(inv => {
                                const lic = aLicenciasInvalidas.find(l => l.Id === inv.id);
                                sMsg += `• ${inv.id} (${lic?.Equnr || 'Sin equipo'})\n`;
                                sMsg += `  Estado: ${inv.estadoTexto}\n\n`;
                            });


                            // SOLO MOSTRAR INFORMACIÓN (sin preguntar)
                            MessageBox.information(sMsg, {
                                title: "Licencias excluidas",
                                styleClass: "sapUiSizeCompact"
                            });

                            // CONTINUAR AUTOMÁTICAMENTE CON EL ENVÍO DE MAILS
                            const aLicenciasParaEnviar = aLicenciasValidas.filter(l => !l.Enviado);

                            if (aLicenciasParaEnviar.length > 0) {
                                console.log("✅ Continuando con envío de", aLicenciasParaEnviar.length, "mails");
                                this._ejecutarEnvioMail(aLicenciasValidas, FechaTurno, oFormatter);
                            } else {
                                console.log("ℹ️ No hay licencias para enviar (todas ya fueron enviadas)");
                            }
                        })
                        .catch((error) => {
                            this.hideGlobalBusy();
                            console.error("❌ Error al marcar licencias como NO enviadas:", error);
                            MessageBox.error("Error al actualizar estados: " + (error.message || "Error desconocido"));
                        });
                } else {
                    // Todas válidas
                    console.log("✅ Todas las licencias siguen con estados permitidos");
                    this._ejecutarEnvioMail(aLicenciasEnPantalla, FechaTurno, oFormatter);
                }
            }).catch((error) => {
                this.hideGlobalBusy();
                console.error("❌ Error en validación de estados:", error);
                MessageBox.error("Error al validar estados: " + (error.message || "Error desconocido"));
            });
        },

        _marcarLicenciasComoNoEnviadas: function (aLicenciasInvalidas, FechaTurno) {
            console.log("🔄 Marcando", aLicenciasInvalidas.length, "licencias como NO enviadas (Enviado=false)...");

            // Preparar datos igual que en onSendEmailPress original
            const aDataParaGuardar = aLicenciasInvalidas.map((oLicense) => {
                return {
                    Id: oLicense.Id,
                    Empresa: oLicense.Empresa,
                    Tipo: oLicense.Tipo || "L",
                    Anio: oLicense.Anio,
                    Fecha: FechaTurno,
                    Turno: oLicense.TurnoAsignado || oLicense.Turno || "",
                    Comentarios: oLicense.Comentarios || "",
                    Enviado: false,  // ← Marcar como NO enviado
                    Agrmanual: oLicense.Agrmanual || false
                };
            });

            console.log("📦 Datos preparados para marcar como NO enviadas:", aDataParaGuardar);

            // Llamar a createTurno (reutilizar tu lógica que ya funciona)
            return new Promise((resolve) => {
                this.createTurno(aDataParaGuardar, aLicenciasInvalidas, false);

                // Simular éxito para mantener compatibilidad
                const resultados = aLicenciasInvalidas.map(lic => ({
                    success: true,
                    id: lic.Id
                }));

                setTimeout(() => {
                    console.log(`✅ ${aLicenciasInvalidas.length} licencias procesadas con Enviado=false`);
                    resolve(resultados);
                }, 500);
            });
        },

        _ejecutarEnvioMail: function (aLicencias, FechaTurno, oFormatter) {
            console.log("📧 Ejecutando envío de", aLicencias.length, "mails");

            // 🔽 AQUÍ EMPIEZA TU LÓGICA ORIGINAL DE onSendEmailPress (desde la línea del oComponent)
            const oView = this.getView();
            const oModel = this.getView().getModel();
            const oComponent = this.getOwnerComponent();
            var currentUser = ModelHelper.getModel("CurrentUser", oView).getData();
            var oUserJson = ModelHelper.getModel("UserJsonModel", oView).getData();

            // Variable para almacenar el token actual (se puede renovar si expira)
            let currentCsrfToken = null;

            // Función para renovar el token cuando expire
            const renewToken = function () {
                return MailService.getCSRFToken(oComponent)
                    .then((newToken) => {
                        currentCsrfToken = newToken;
                        return newToken;
                    });
            };

            // Obtener el token CSRF una sola vez para todos los envíos
            const csrfTokenPromise = MailService.getCSRFToken(oComponent);

            // Procesar cada licencia del modelo
            csrfTokenPromise.then((csrfToken) => {
                currentCsrfToken = csrfToken;

                const aPromises = aLicencias.map((oLicense) => {
                    return new Promise((resolve, reject) => {

                        // Verificar si ya fue enviado - evitar reenviar mails
                        if (oLicense.Enviado === true) {
                            resolve({ success: true, licenciaId: oLicense.Id, skipped: true, reason: "Ya enviado" });
                            return;
                        }

                        // Obtener permisos y emails ET para esta licencia
                        let promises = [LicenseService.getPermisos(oLicense, oModel)];
                        promises.push(
                            EtMailService.getPromise(
                                oLicense.Empresa,
                                oLicense.Tplnr,
                                LicenseService.getSelectionArea(oLicense.Tipo, "01")
                            )
                        );

                        Promise.all(promises)
                            .then(res => {
                                console.log("Permisos (res[0]):", res[0]);
                                console.log("ET Mails (res[1]):", res[1]);

                                let emails = [];
                                let hashPermisos = {};
                                let permisos = res[0] || [];

                                permisos.forEach(permiso => {
                                    hashPermisos[permiso.Rol] = permiso;
                                });

                                emails = [
                                    hashPermisos["Creador"],
                                    hashPermisos["ope_solic-lic_transener"],
                                    hashPermisos["Solicitante_Suplente"],
                                    hashPermisos["Jefe_Trabajo"],
                                    hashPermisos["Jefe_Trabajo_Suplente"],
                                    hashPermisos["Solicitante_Suplente_Auxiliar"]
                                ].map(permiso => permiso && permiso.Mail);

                                let sEmailEt =
                                    res[1].results && res[1].results.length
                                        ? res[1].results.map(e => e.Mail).join(",")
                                        : "chiara.signori@altromondo.com.ar";

                                const sDestinatario2 = emails.filter(e => e).join(",") || sEmailEt || "chiara.signori@altromondo.com.ar";
                                const sDestinatario = "chiara.signori@altromondo.com.ar";

                                // Construir objeto licencia para el mail
                                const oLicenciaParaMail = {
                                    society: oLicense.Empresa,
                                    Destinatario: sDestinatario,
                                    Email: sDestinatario,
                                    Id: oLicense.Id || "",
                                    Equnr: oLicense.Equnr || "",
                                    Equstat: oFormatter.getEstado(oLicense.Equstat) || "",
                                    Jobcond: oFormatter.getJobCond(oLicense.Jobcond) || "",
                                    Fecha: FechaTurno || "",
                                    Turno: oLicense.Turno || oLicense.TurnoAsignado || "",
                                    TurnoAsignado: oLicense.TurnoAsignado || "",
                                    Comments: oLicense.Comentarios || "",
                                    Comentarios: oLicense.Comentarios || "",
                                    DescEquipo: oLicense.DescEquipo || "",
                                    DescripcionEquipo: oLicense.DescEquipo || "",
                                    Consola: oLicense.Consola || "",
                                    Empresa: oLicense.Empresa || "",
                                    Tipo: oLicense.Tipo || "L",
                                    Anio: oLicense.Anio || "",
                                    Period: oFormatter.getPeriod(oLicense.Period),
                                };

                                console.log("Destinatario:", sDestinatario);

                                // Enviar mail usando MailService con el token CSRF reutilizado
                                MailService.sendLicenseEmail(oLicenciaParaMail, oComponent, currentCsrfToken, renewToken)
                                    .then((result) => {
                                        resolve({ success: true, licenciaId: oLicense.Id });
                                    })
                                    .catch((error) => {
                                        // No rechazar para que continúe con las demás licencias
                                        resolve({ success: false, licenciaId: oLicense.Id, error: error });
                                    });
                            })
                            .catch(err => {
                                // No rechazar para que continúe con las demás licencias
                                resolve({ success: false, licenciaId: oLicense.Id, error: err });
                            });
                    });
                });

                // Esperar a que se procesen todas las licencias
                return Promise.all(aPromises);
            })
                .then((results) => {
                    const aExitosos = results.filter(r => r.success && !r.skipped);
                    const aSaltadas = results.filter(r => r.skipped);
                    const aFallidos = results.filter(r => !r.success && !r.skipped);

                    if (aSaltadas.length > 0) {
                        console.log("Licencias saltadas (ya enviadas):", aSaltadas.map(r => r.licenciaId));
                    }
                    if (aFallidos.length > 0) {
                        console.log("Licencias con errores:", aFallidos.map(r => r.licenciaId));
                    }

                    if (aExitosos.length > 0) {
                        MessageToast.show(`${aExitosos.length} mail(s) enviado(s) correctamente${aSaltadas.length > 0 ? ` (${aSaltadas.length} ya enviados)` : ''}`);

                        // Guardar los turnos con Enviado = true solo para las licencias que tuvieron éxito (no saltadas)
                        const aLicenciasExitosas = aLicencias.filter(lic =>
                            aExitosos.some(r => r.licenciaId === lic.Id)
                        );

                        // Preparar datos para createTurno
                        const aDataParaGuardar = aLicenciasExitosas.map((oLicense) => {
                            return {
                                Id: oLicense.Id,
                                Empresa: oLicense.Empresa,
                                Tipo: oLicense.Tipo || "L",
                                Anio: oLicense.Anio,
                                Fecha: FechaTurno || oLicense.Fecha || new Date(),
                                Turno: oLicense.Turno || oLicense.TurnoAsignado || "",
                                Comentarios: oLicense.Comentarios || "",
                                Enviado: true, // Marcar como enviado
                                Agrmanual: oLicense.Agrmanual || false
                            };
                        });

                        this.createTurno(aDataParaGuardar, aLicenciasExitosas, true);
                    } else {
                        MessageBox.warning("No se realizaron modificaciones en el turno, ni se reenviaron mails ya enviados.");
                    }

                    if (aFallidos.length > 0) {
                        MessageBox.warning(`${aFallidos.length} licencia(s) tuvieron errores al enviar el mail y no se guardarán`);
                    }
                })
                .catch(err => {
                    console.error("❌ Error al obtener token CSRF o procesar las licencias:", err);
                    MessageBox.error("Error al procesar las licencias: " + (err.message || err));
                });
        },
        //-------------------------------------------- ADJUNTAR EN TAB ACCIONES  ------------------------------------------------

        onAttachFileAccion: function (oEvent) {
            // Guardar el contexto de la acción
            this._currentAccionAttachmentContext = oEvent.getSource().getBindingContext("AccionesEntregaModel");

            if (!this._currentAccionAttachmentContext) {
                MessageToast.show("No se pudo obtener la acción");
                return;
            }

            const oAccion = this._currentAccionAttachmentContext.getObject();

            // Crear input de archivo si no existe
            if (!this._fileInputAccion) {
                this._fileInputAccion = document.createElement("input");
                this._fileInputAccion.type = "file";
                this._fileInputAccion.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt";
                this._fileInputAccion.style.display = "none";

                this._fileInputAccion.addEventListener("change", function (e) {
                    this._handleFileSelectionAccion(e);
                }.bind(this));

                document.body.appendChild(this._fileInputAccion);
            }

            this._fileInputAccion.value = null;
            this._fileInputAccion.click();
        },


        _handleFileSelectionAccion: function (oEvent) {
            const file = oEvent.target.files[0];

            if (!file) {
                return;
            }

            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                MessageBox.error("El archivo es demasiado grande. Máximo 10MB");
                return;
            }

            // Convertir a base64
            this._convertFileToBase64Accion(file);
        },

        _convertFileToBase64Accion: function (file) {
            // ✅ CRÍTICO: Capturar el contexto ANTES de la operación async
            if (!this._currentAccionAttachmentContext) {
                MessageBox.error("Error: No se pudo encontrar el contexto");
                return;
            }

            const oAccion = this._currentAccionAttachmentContext.getObject();
            const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

            if (!oAccion) {
                MessageBox.error("Error: No se pudo encontrar la acción");
                return;
            }

            const reader = new FileReader();

            reader.onload = function (e) {
                const base64String = e.target.result;

                // Inicializar array de adjuntos si no existe
                if (!oAccion.Attachments) {
                    oAccion.Attachments = [];
                }

                const sIdLicencia = oAccion.idLicencia || "";
                const aIds = sIdLicencia.split(" / ").map(id => id.trim());

                if (aIds.length === 1 && oAccion._idsDelGrupo && oAccion._idsDelGrupo.length > 1) {
                    aIds.length = 0;
                    aIds.push(...oAccion._idsDelGrupo);
                }

                aIds.forEach(sId => {
                    const nuevoAdjunto = {
                        Id: sId,
                        Empresa: "100",
                        Tipo: "L",
                        Anio: new Date().getFullYear().toString(),
                        Dateturno: oFechaTurno,
                        Codigo: oAccion.accion || "",
                        Descripcion: oAccion.descripcion || "",
                        Equnr: oAccion.equipo || "",
                        Jobcond: oAccion.condicion || "",
                        Turnoentrega: oAccion.turnoEntrega || "",
                        Comments: file.name,
                        Licstat: oAccion.estado || "",
                        Attachment: base64String.split(',')[1],
                        AttachmentName: file.name,
                        AttachmentSize: file.size,
                        AttachmentType: file.type,
                        Timestamp: new Date().getTime()
                    };

                    oAccion.Attachments.push(nuevoAdjunto);
                });

                // Refrescar modelo
                const oModel = this.getView().getModel("AccionesEntregaModel");
                oModel.refresh(true);

                const sMensaje = aIds.length > 1
                    ? `Archivo agregado para ${aIds.length} licencias: ${file.name}`
                    : `Archivo agregado: ${file.name}`;

                MessageToast.show(sMensaje);
            }.bind(this);

            reader.onerror = function () {
                MessageBox.error("Error al leer el archivo");
            };

            reader.readAsDataURL(file);
        },

        onViewAttachmentAccion: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("AccionesEntregaModel")
                || oSource.getBindingContext("accionesTreeModel");

            if (!oContext) {
                MessageToast.show("No se pudo obtener la acción");
                return;
            }

            const oAccion = oContext.getObject();

            // Verificar si hay adjuntos
            if (!oAccion.Attachments || oAccion.Attachments.length === 0) {
                MessageToast.show("No hay archivos adjuntos");
                return;
            }

            this._showAttachmentSelectorAccion(oAccion, oContext);
        },

        _showAttachmentSelectorAccion: function (oAccion, oContext) {
            const oView = this.getView();

            // Guardar el contexto
            this._currentAccionAttachmentContext = oContext;
            this._currentAccionForAttachments = oAccion;

            // Destruir diálogo anterior si existe
            if (this._attachmentSelectorDialogAccion) {
                this._attachmentSelectorDialogAccion.destroy();
                this._attachmentSelectorDialogAccion = null;
            }

            const oList = new sap.m.List({
                mode: "None",
                items: {
                    path: "/attachments",
                    template: new sap.m.CustomListItem({
                        content: [
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                items: [
                                    new sap.m.HBox({
                                        alignItems: "Center",
                                        items: [
                                            new sap.ui.core.Icon({
                                                src: "{icon}",
                                                size: "2rem",
                                                color: "#0854a0"
                                            }).addStyleClass("sapUiSmallMarginEnd"),
                                            new sap.m.VBox({
                                                items: [
                                                    new sap.m.Text({
                                                        text: "{name}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiSmallMarginBottom"),
                                                    new sap.m.Text({
                                                        text: "{info}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiTinyText")
                                                ]
                                            })
                                        ]
                                    }),
                                    // Botones de acción
                                    new sap.m.HBox({
                                        justifyContent: "End",
                                        alignItems: "Center",
                                        items: [
                                            // Botón Ver
                                            new sap.m.Button({
                                                icon: "sap-icon://show",
                                                type: "Emphasized",
                                                tooltip: "Ver archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const oAttachment = oAccion.Attachments[iIndex];
                                                    this._openAttachmentAccion(oAttachment);
                                                }.bind(this)
                                            }).addStyleClass("sapUiTinyMarginEnd"),

                                            // Botón Eliminar
                                            new sap.m.Button({
                                                icon: "sap-icon://delete",
                                                type: "Reject",
                                                tooltip: "Eliminar archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const oAttachment = oAccion.Attachments[iIndex];
                                                    this._deleteAttachmentFromListAccion(oAttachment, iIndex);
                                                }.bind(this)
                                            })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiSmallMargin")
                        ]
                    })
                }
            });

            const aListData = oAccion.Attachments.map((att, idx) => ({
                name: att.AttachmentName,
                info: this._formatSize(att.AttachmentSize) + " • " + this._getFileTypeName(att.AttachmentType),
                icon: this.getFileIcon(att.AttachmentType),
                index: idx
            }));

            const oDialogModel = new sap.ui.model.json.JSONModel({
                attachments: aListData
            });

            this._attachmentSelectorDialogAccion = new sap.m.Dialog({
                title: "Archivos Adjuntos - Acción: " + oAccion.accion,
                contentWidth: "850px",
                contentHeight: "500px",
                resizable: true,
                draggable: true,
                content: [oList],
                beginButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._attachmentSelectorDialogAccion.close();
                    }.bind(this)
                }),
                afterClose: function () {
                    this._attachmentSelectorDialogAccion.destroy();
                    this._attachmentSelectorDialogAccion = null;
                }.bind(this)
            });

            // Establecer modelo
            this._attachmentSelectorDialogAccion.setModel(oDialogModel);

            // Agregar a la vista
            oView.addDependent(this._attachmentSelectorDialogAccion);

            // Abrir
            this._attachmentSelectorDialogAccion.open();
        },

        _downloadAttachmentAccion: function (oAttachment) {
            try {
                // Reconstruir data URL completa si es necesario
                let dataUrl = oAttachment.Attachment;

                // Si no tiene el prefijo data:, agregarlo
                if (!dataUrl.startsWith('data:')) {
                    const mimeType = oAttachment.AttachmentType || 'application/octet-stream';
                    dataUrl = `data:${mimeType};base64,${dataUrl}`;
                }

                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = oAttachment.AttachmentName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                MessageToast.show("Descargando: " + oAttachment.AttachmentName);
            } catch (error) {
                MessageBox.error("Error al descargar el archivo");
            }
        },

        _deleteAttachmentFromListAccion: function (oAttachment, iIndex) {
            MessageBox.confirm(
                "¿Desea eliminar el archivo '" + oAttachment.AttachmentName + "'?",
                {
                    title: "Confirmar eliminación",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.DELETE) {
                            this._deleteAttachmentAccion(oAttachment, iIndex);
                        }
                    }.bind(this)
                }
            );
        },

        _deleteAttachmentAccion: function (oAttachment, iIndex) {
            const oAccion = this._currentAccionForAttachments;

            if (!oAccion || !oAccion.Attachments) {
                MessageToast.show("Error: No se pudo encontrar la acción");
                return;
            }

            const tieneKeysBackend = oAttachment.Id && oAttachment.Empresa &&
                oAttachment.Tipo && oAttachment.Anio &&
                oAttachment.Dateturno && oAttachment.Codigo;

            if (tieneKeysBackend) {
                this.showGlobalBusy("Eliminando adjunto...");

                const oDataService = this.getView().getModel();

                const sKey = oDataService.createKey("/CatalogoEntregaSet", {
                    Id: oAttachment.Id,
                    Empresa: oAttachment.Empresa,
                    Tipo: oAttachment.Tipo,
                    Anio: oAttachment.Anio,
                    Dateturno: oAttachment.Dateturno,
                    Codigo: oAttachment.Codigo
                });

                oDataService.remove(sKey, {
                    success: () => {
                        oAccion.Attachments.splice(iIndex, 1);

                        const oModel = this.getView().getModel("AccionesEntregaModel");
                        oModel.updateBindings(true);

                        if (this._attachmentSelectorDialogAccion) {
                            this._attachmentSelectorDialogAccion.close();
                        }

                        MessageToast.show("Archivo eliminado: " + oAttachment.AttachmentName);

                        this.onGuardarAccionesBackend();
                    },
                    error: (oError) => {
                        this.hideGlobalBusy();
                        MessageBox.error("Error al eliminar el archivo del backend. Intente nuevamente.");
                    }
                });

            } else {
                oAccion.Attachments.splice(iIndex, 1);

                const oModel = this.getView().getModel("AccionesEntregaModel");
                oModel.updateBindings(true);

                MessageToast.show("Archivo eliminado: " + oAttachment.AttachmentName);

                // Cerrar diálogo
                if (this._attachmentSelectorDialogAccion) {
                    this._attachmentSelectorDialogAccion.close();
                }

                if (oAccion.Attachments.length === 0) {
                    MessageToast.show("Todos los archivos fueron eliminados. Recuerde guardar los cambios.");
                }
            }
        },

        _openAttachmentAccion: function (oAttachment) {
            const sType = oAttachment.AttachmentType;

            let sDataUrl = oAttachment.Attachment;

            if (!sDataUrl.startsWith('data:')) {
                const mimeType = sType || 'application/octet-stream';
                sDataUrl = `data:${mimeType};base64,${sDataUrl}`;
            }

            // Para PDFs
            if (sType === "application/pdf") {
                this._openPDFViewer(sDataUrl);
                return;
            }

            // Para imágenes 
            if (sType && sType.startsWith("image/")) {
                // Crear objeto compatible con _openImageViewer
                const oImageAttachment = {
                    AttachmentData: sDataUrl,
                    AttachmentName: oAttachment.AttachmentName
                };
                this._openImageViewer(oImageAttachment);
                return;
            }

            // Para otros archivos, descargar
            this._downloadAttachmentAccion(oAttachment);
        },

        // ------------------------ AGREGAR LICENCIAS SIN FILTRO DE ESTADO ------------------------

        onAgregarLicencia: function (oEvent) {
            const oView = this.getView();

            // Obtener fecha seleccionada
            const oDatePicker = this.byId("date");
            const oFechaSeleccionada = oDatePicker.getDateValue();

            if (!oFechaSeleccionada) {
                MessageBox.warning("Por favor, seleccione una fecha primero.");
                return;
            }

            // Mostrar busy
            this.showGlobalBusy("Cargando licencias disponibles...");

            // Cargar licencias sin filtro de estado
            this._cargarLicenciasDisponibles(oFechaSeleccionada)
                .then((aLicencias) => {
                    this.hideGlobalBusy();

                    if (aLicencias.length === 0) {
                        MessageBox.information("No hay licencias disponibles para esta fecha.");
                        return;
                    }

                    // Crear/Abrir fragment
                    this._mostrarDialogoAgregarLicencias(aLicencias);
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al cargar las licencias disponibles.");
                });
        },

        _cargarLicenciasDisponibles: function (oFecha) {
            return new Promise((resolve, reject) => {
                const oDataModel = this.getView().getModel();

                // Filtros: Solo fecha y empresa, SIN filtro de estado
                const sEmpresa = SocietyHelper.getCurrentSociety(this.getView());
                const aFilters = [
                    new Filter("Solbeg", FilterOperator.LE, oFecha),
                    new Filter("Solend", FilterOperator.GE, oFecha),
                    new Filter("Empresa", FilterOperator.EQ, sEmpresa),
                    new Filter("Tipo", FilterOperator.EQ, "L")
                ];


                oDataModel.read('/LicenciaTrabajoSet', {
                    filters: aFilters,
                    success: (oData) => {
                        const aLicencias = oData.results || [];

                        // Filtrar solo las que ya NO están en la tabla
                        const aLicenciasFiltradas = this._filtrarLicenciasYaAgregadas(aLicencias);

                        resolve(aLicenciasFiltradas);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _filtrarLicenciasYaAgregadas: function (aLicencias) {
            const oLicencesModel = this.getView().getModel("LicencesJsonModel");
            const aLicenciasActuales = oLicencesModel.getData() || [];

            // Set de IDs ya agregados
            const setIdsActuales = new Set(aLicenciasActuales.map(l => l.Id));

            // Filtrar las que NO están
            const aDisponibles = aLicencias.filter(lic => !setIdsActuales.has(lic.Id));

            return aDisponibles;
        },

        _mostrarDialogoAgregarLicencias: function (aLicencias) {
            const oView = this.getView();

            // Crear modelo para el diálogo
            const oAgregarLicenciaModel = new sap.ui.model.json.JSONModel(aLicencias);
            oView.setModel(oAgregarLicenciaModel, "AgregarLicenciaModel");

            // Cargar fragment si no existe
            if (!this._dialogAgregarLicencia) {
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.agregarLicenciaDisponible",
                    controller: this
                }).then((oDialog) => {
                    this._dialogAgregarLicencia = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._dialogAgregarLicencia.open();
            }
        },

        onSearchAgregarLicencia: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue") || "";
            const oTable = this.byId("tablaAgregarLicencias");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) return;

            const aFilters = [];

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Id", FilterOperator.Contains, sQuery),
                        new Filter("Equnr", FilterOperator.Contains, sQuery),
                        new Filter("Comments", FilterOperator.Contains, sQuery),
                        new Filter("Licstat", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            oBinding.filter(aFilters);

        },

        onConfirmarAgregarLicencias: function () {
            const oTable = this.byId("tablaAgregarLicencias");
            const aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor, seleccione al menos una licencia.");
                return;
            }

            // Obtener las licencias seleccionadas
            const aLicenciasSeleccionadas = aSelectedItems.map(item => {
                return item.getBindingContext("AgregarLicenciaModel").getObject();
            });

            // Mostrar busy
            this.showGlobalBusy("Procesando licencias...");

            this._procesarLicenciasAntesDeAgregar(aLicenciasSeleccionadas)
                .then((aLicenciasProcesadas) => {

                    // MARCAR como agregadas manualmente
                    aLicenciasProcesadas.forEach(lic => {
                        lic.Agrmanual = true;
                    });

                    // Agregar a la tabla
                    TurnosService.appendLicencesToModel(aLicenciasProcesadas, this.getView());

                    this.hideGlobalBusy();

                    // Mensaje de éxito
                    MessageToast.show(`${aLicenciasProcesadas.length} licencia(s) agregada(s) correctamente`);

                    // Cerrar diálogo
                    this._dialogAgregarLicencia.close();

                    // Limpiar selección
                    oTable.removeSelections();
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al procesar las licencias.");
                });
        },

        _procesarLicenciasAntesDeAgregar: function (aLicencias) {
            return new Promise((resolve, reject) => {
                const oView = this.getView();

                // 1. Obtener descripciones de equipos
                this._obtenerDescripcionesEquiposParaLicencias(aLicencias)
                    .then((aLicenciasConDescripciones) => {

                        // 2. Asignar consolas
                        const aLicenciasCompletas = this._asignarConsolasALicencias(aLicenciasConDescripciones);

                        resolve(aLicenciasCompletas);
                    })
                    .catch((error) => {

                        // Si falla, al menos asignar consolas
                        const aLicenciasConConsola = this._asignarConsolasALicencias(aLicencias);
                        resolve(aLicenciasConConsola);
                    });
            });
        },

        _obtenerDescripcionesEquiposParaLicencias: function (aLicencias) {
            // Extraer combinaciones únicas de Equnr + Tplnr
            const aEquiposUnicos = aLicencias
                .map(item => ({
                    Equnr: (item.Equnr || "").trim(),
                    Tplnr: (item.Tplnr || "").trim()
                }))
                .filter(item => item.Equnr && item.Tplnr);

            // Deduplicar
            const aEquiposUnicosDedup = Array.from(
                new Map(aEquiposUnicos.map(item => [JSON.stringify(item), item])).values()
            );

            if (aEquiposUnicosDedup.length === 0) {
                return Promise.resolve(aLicencias);
            }

            // Llamar a la función existente
            return this._obtenerDescripcionesEquipos(aEquiposUnicosDedup)
                .then((oDescripcionesEquipos) => {

                    // Agregar descripciones a las licencias
                    aLicencias.forEach(lic => {
                        const sEquipoNormalizado = (lic.Equnr || "").trim();
                        lic.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                        lic.EquipoCompleto = lic.DescEquipo
                            ? lic.Equnr + " - " + lic.DescEquipo
                            : lic.Equnr;
                    });

                    return aLicencias;
                });
        },

        _asignarConsolasALicencias: function (aLicencias) {
            const oView = this.getView();
            const oConsolasModel = ModelHelper.getModel("consolasModel", oView);

            if (!oConsolasModel) {
                return aLicencias;
            }

            const oConsolasData = oConsolasModel.getData();

            if (!oConsolasData || typeof oConsolasData !== "object") {
                return aLicencias;
            }

            // Asignar consola a cada licencia
            aLicencias.forEach((licencia) => {
                for (const grupo in oConsolasData) {
                    const consolas = oConsolasData[grupo];

                    if (Array.isArray(consolas)) {
                        const consolaEncontrada = consolas.find((consola) => consola === licencia.Tplnr);

                        if (consolaEncontrada) {
                            licencia.Consola = grupo;
                            break;
                        }
                    }
                }

                // Si no se encontró consola, asignar vacío
                if (!licencia.Consola) {
                    licencia.Consola = "";
                }
            });

            return aLicencias;
        },

        onCancelarAgregarLicencias: function () {
            if (this._dialogAgregarLicencia) {
                this._dialogAgregarLicencia.close();

                // Limpiar selección
                const oTable = this.byId("tablaAgregarLicencias");
                if (oTable) {
                    oTable.removeSelections();
                }
            }
        },

        _saveAccionesEnBackend: function (aAcciones, timestampOData) {

            const oDataService = this.getView().getModel();
            const sEntity = "/CatalogoEntregaSet";

            if (aAcciones.length === 0) {
                return Promise.resolve();
            }

            if (!timestampOData) {
                const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();
                if (oFechaTurno) {
                    const timestampMs = oFechaTurno.getTime();
                    timestampOData = `/Date(${timestampMs})/`;
                } else {
                    MessageBox.error("Error: No se pudo obtener la fecha del turno");
                    return Promise.reject("No hay fecha de turno");
                }
            }

            const aPromises = [];

            aAcciones.forEach((accion, idx) => {

                const bExisteEnBackend = accion._licenciaId && accion.idLicencia && accion.accion;

                if (accion.Attachments && accion.Attachments.length > 0) {
                    // ========== CON ADJUNTOS ==========
                    accion.Attachments.forEach((att, attIdx) => {

                        const bAdjuntoExiste = att.Id && att.Empresa && att.Tipo && att.Anio && att.Dateturno && att.Codigo;

                        aPromises.push(
                            new Promise((resolve, reject) => {
                                let base64Data = att.Attachment || "";
                                if (base64Data.includes(',')) {
                                    base64Data = base64Data.split(',')[1];
                                }

                                const payload = {
                                    Id: att.Id,
                                    Empresa: accion.empresa || "100",
                                    Tipo: accion.tipo || "L",
                                    Anio: accion.anio || new Date().getFullYear().toString(),
                                    Dateturno: timestampOData,
                                    Codigo: (accion.accion || "").substring(0, 10),
                                    Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                    Descripcion: accion.trabajoRealizar || "Sin descripción",
                                    Equnr: (accion.equipo || "").substring(0, 18),
                                    Equstat: accion.equstat || "A",
                                    Jobcond: (accion.condicion || "01").substring(0, 2),
                                    Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                    Comments: (att.AttachmentName || `Adjunto ${attIdx + 1}`).substring(0, 255),
                                    Licstat: (accion.estado || "01").substring(0, 2),
                                    Attachment: base64Data
                                };

                                if (bAdjuntoExiste) {
                                    const sKey = oDataService.createKey(sEntity, {
                                        Id: att.Id,
                                        Empresa: att.Empresa,
                                        Tipo: att.Tipo,
                                        Anio: att.Anio,
                                        Dateturno: att.Dateturno,
                                        Codigo: att.Codigo
                                    });

                                    oDataService.update(sKey, payload, {
                                        success: () => {
                                            resolve();
                                        },
                                        error: () => {
                                            oDataService.create(sEntity, payload, {
                                                success: () => {
                                                    resolve();
                                                },
                                                error: () => {
                                                    reject();
                                                }
                                            });
                                        }
                                    });
                                } else {

                                    oDataService.create(sEntity, payload, {
                                        success: () => {
                                            resolve();
                                        },
                                        error: () => {
                                            reject();
                                        }
                                    });
                                }
                            })
                        );
                    });

                } else {
                    // ========== SIN ADJUNTOS ==========

                    const sIdLicencia = accion.idLicencia || "";
                    const aIds = sIdLicencia.split(" / ").map(id => id.trim());

                    if (bExisteEnBackend) {
                        // UPDATE: un request por ID (cada registro ya existe con su propia clave)
                        aIds.forEach(sId => {
                            aPromises.push(
                                new Promise((resolve, reject) => {
                                    const payload = {
                                        Id: sId,
                                        Empresa: accion.empresa || "100",
                                        Tipo: accion.tipo || "L",
                                        Anio: accion.anio || new Date().getFullYear().toString(),
                                        Dateturno: timestampOData,
                                        Codigo: (accion.accion || "").substring(0, 10),
                                        Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                        Descripcion: accion.trabajoRealizar || "Sin descripción",
                                        Equnr: (accion.equipo || "").substring(0, 18),
                                        Equstat: accion.equstat || "A",
                                        Jobcond: (accion.condicion || "01").substring(0, 2),
                                        Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                        Comments: "Sin adjuntos",
                                        Licstat: (accion.estado || "01").substring(0, 2),
                                        Attachment: ""
                                    };

                                    const sKey = oDataService.createKey(sEntity, {
                                        Id: sId,
                                        Empresa: accion.empresa || "100",
                                        Tipo: accion.tipo || "L",
                                        Anio: accion.anio || new Date().getFullYear().toString(),
                                        Dateturno: timestampOData,
                                        Codigo: accion.accion
                                    });

                                    oDataService.update(sKey, payload, {
                                        success: () => {
                                            resolve();
                                        },
                                        error: () => {
                                            oDataService.create(sEntity, payload, {
                                                success: () => {
                                                    resolve();
                                                },
                                                error: () => {
                                                    reject();
                                                }
                                            });
                                        }
                                    });
                                })
                            );
                        });
                    } else {
                        // CREATE: bulk request con ToIDs para todo el grupo
                        aPromises.push(
                            new Promise((resolve, reject) => {
                                const payload = {
                                    Empresa: accion.empresa || "100",
                                    Tipo: accion.tipo || "L",
                                    Anio: accion.anio || new Date().getFullYear().toString(),
                                    Dateturno: timestampOData,
                                    Codigo: (accion.accion || "").substring(0, 10),
                                    Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                    Descripcion: accion.trabajoRealizar || "Sin descripción",
                                    Equnr: (accion.equipo || "").substring(0, 18),
                                    Equstat: accion.equstat || "A",
                                    Jobcond: (accion.condicion || "01").substring(0, 2),
                                    Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                    Comments: "Sin adjuntos",
                                    Licstat: (accion.estado || "01").substring(0, 2),
                                    Attachment: "",
                                    EstadoGuardado: true,
                                    ToIDs: aIds.map(sId => ({ Id: sId }))
                                };

                                oDataService.create("/CatalogoEntregaBulkSet", payload, {
                                    success: () => {
                                        resolve();
                                    },
                                    error: (oError) => {
                                        const sErrorMsg = oError?.message || "";
                                        if (sErrorMsg.includes("ya existe")) {
                                            resolve();
                                        } else {
                                            reject();
                                        }
                                    }
                                });
                            })
                        );
                    }
                }
            });
            return Promise.all(aPromises).then(() => {
            }).catch((error) => {
                throw error;
            });
        },

        _convertODataTimestampToDate: function (timestampOData) {
            if (!timestampOData) return null;

            // Extraer el número del formato /Date(1769040000000)/
            const match = timestampOData.match(/\/Date\((\d+)\)\//);
            if (match && match[1]) {
                return new Date(parseInt(match[1]));
            }

            return null;
        },

        _cargarAccionesDesdeBackend: function (oFecha) {
            return new Promise((resolve) => {
                const oDataService = this.getView().getModel();

                if (!oFecha) {
                    resolve();
                    return;
                }

                const year = oFecha.getFullYear();
                const month = oFecha.getMonth();
                const day = oFecha.getDate();
                const oFechaUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

                const sEmpresa = SocietyHelper.getCurrentSociety(this.getView());
                const aFilters = [
                    new Filter("Dateturno", FilterOperator.EQ, oFechaUTC),
                    new Filter("Empresa", FilterOperator.EQ, sEmpresa)
                ];

                oDataService.read("/CatalogoEntregaSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const aResultados = oData.results || [];

                        if (aResultados.length > 0) {
                            this._procesarAccionesCargadas(aResultados);
                        }

                        resolve();
                    },
                    error: () => {
                        resolve();
                    }
                });
            });
        },

        _procesarAccionesCargadas: function (aResultados) {

            const oView = this.getView();
            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const aLicencias = oLicencesModel.getData() || [];

            // PASO 1: Crear mapa Id → Grupo, Id → Period e Id → Solbeg
            const mIdToGrupo = {};
            const mIdToPeriod = {};
            const mIdToSolbeg = {};
            aLicencias.forEach(lic => {
                if (lic.Grupo) {
                    mIdToGrupo[lic.Id] = lic.Grupo;
                }
                if (lic.Period) {
                    mIdToPeriod[lic.Id] = lic.Period;
                }
                if (lic.Solbeg) {
                    mIdToSolbeg[lic.Id] = lic.Solbeg;
                }
            });

            // PASO 2: Agrupar por Equipo + Codigo + Grupo
            const mAccionesAgrupadas = {};

            aResultados.forEach(item => {
                const sGrupo = mIdToGrupo[item.Id] || item.Id;
                const sKey = `${item.Equnr}_${item.Codigo}_${sGrupo}`;

                if (!mAccionesAgrupadas[sKey]) {
                    const sDescripcionLarga = this._getDescripcionDesdeCategologo(item.Codigo);

                    mAccionesAgrupadas[sKey] = {
                        accion: item.Codigo,
                        descripcion: item.Accion || "",
                        descripcionLarga: sDescripcionLarga,
                        equipo: item.Equnr || "",
                        equipoCompleto: item.Equnr || "",
                        idLicencia: item.Id,
                        idLicenciaOriginal: item.Id,
                        trabajoRealizar: sDescripcionLarga || item.Descripcion || "Sin descripción",
                        turnoEntrega: item.Turnoentrega || "",
                        estado: item.Licstat || "",
                        condicion: item.Jobcond || "",
                        equstat: item.Equstat || "A",
                        empresa: item.Empresa || "100",
                        tipo: item.Tipo || "L",
                        anio: item.Anio || "",
                        period: mIdToPeriod[item.Id] || "",
                        solbeg: mIdToSolbeg[item.Id] || null,
                        dateturno: item.Dateturno || null,
                        _licenciaId: item.Id,
                        _idsDelGrupo: [item.Id],
                        _estadoGuardado: true,  // Ya está en backend
                        // 🆕 SNAPSHOT ORIGINAL para detección de cambios
                        _snapshotOriginal: {
                            turnoEntrega: item.Turnoentrega || "",
                            attachmentsCount: 0  // Se actualizará al agregar adjuntos
                        },
                        Attachments: []
                    };
                } else {
                    const accionExistente = mAccionesAgrupadas[sKey];

                    if (!accionExistente._idsDelGrupo.includes(item.Id)) {
                        accionExistente._idsDelGrupo.push(item.Id);
                        accionExistente.idLicencia = accionExistente._idsDelGrupo.join(" / ");
                    }
                }

                // PASO 3: Agregar adjuntos (deduplicados)
                const esSinAdjuntos = (item.Comments || "").toLowerCase().includes("sin adjunto");

                if (item.Attachment && item.Attachment.trim() !== "" && !esSinAdjuntos) {
                    const bAdjuntoYaExiste = mAccionesAgrupadas[sKey].Attachments.some(att =>
                        att.Attachment === item.Attachment &&
                        att.AttachmentName === (item.Comments || "Adjunto")
                    );

                    if (!bAdjuntoYaExiste) {
                        mAccionesAgrupadas[sKey].Attachments.push({
                            Id: item.Id,
                            Empresa: item.Empresa,
                            Tipo: item.Tipo,
                            Anio: item.Anio,
                            Dateturno: item.Dateturno,
                            Codigo: item.Codigo,
                            Descripcion: item.Descripcion || "",
                            Equnr: item.Equnr || "",
                            Equstat: item.Equstat || "",
                            Jobcond: item.Jobcond || "",
                            Turnoentrega: item.Turnoentrega || "",
                            Comments: item.Comments || "",
                            Licstat: item.Licstat || "",
                            Attachment: item.Attachment,
                            AttachmentName: item.Comments || "Adjunto",
                            AttachmentSize: Math.floor((item.Attachment.length * 3) / 4),
                            AttachmentType: this._inferirTipoArchivo(item.Attachment),
                            Timestamp: new Date().getTime(),
                            _idsCompartidos: [item.Id],
                            _guardado: true,  // 🆕 Marcar como guardado
                            // 🆕 SNAPSHOT del adjunto para detección de cambios
                            _snapshotOriginal: {
                                Attachment: item.Attachment,
                                AttachmentName: item.Comments || "Adjunto"
                            }
                        });

                        // 🆕 ACTUALIZAR contador de adjuntos en snapshot de la acción
                        mAccionesAgrupadas[sKey]._snapshotOriginal.attachmentsCount = mAccionesAgrupadas[sKey].Attachments.length;
                    } else {
                        const adjuntoExistente = mAccionesAgrupadas[sKey].Attachments.find(att =>
                            att.Attachment === item.Attachment &&
                            att.AttachmentName === (item.Comments || "Adjunto")
                        );

                        if (adjuntoExistente && adjuntoExistente._idsCompartidos) {
                            if (!adjuntoExistente._idsCompartidos.includes(item.Id)) {
                                adjuntoExistente._idsCompartidos.push(item.Id);
                            }
                        }
                    }
                }
            });

            const aAcciones = Object.values(mAccionesAgrupadas);

            const aAccionesOrdenadas = this._ordenarAccionesPorGrupoYHora(aAcciones);
            oAccionesModel.setData(aAccionesOrdenadas);
            oAccionesModel.refresh(true);
            this._buildAccionesTreeModel();

            if (aAcciones.length > 0) {
                MessageToast.show(`${aAcciones.length} acción(es) cargada(s)`);
            }
        },

        _inferirTipoArchivo: function (base64) {
            if (!base64) return "application/octet-stream";

            if (base64.startsWith("JVBERi")) return "application/pdf";
            if (base64.startsWith("/9j/")) return "image/jpeg";
            if (base64.startsWith("iVBORw")) return "image/png";
            if (base64.startsWith("UEsD")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

            return "application/octet-stream";
        },

        //-------------- ACCIONES DESDE SERVIDOR ----------------------------------
        _cargarCatalogoCodigosDesdeBackend: function () {
            // Usar getOwnerComponent() en lugar de getView()
            const oModel = this.getOwnerComponent().getModel();

            if (!oModel) {
                MessageBox.error("No se pudo cargar el modelo OData");
                return;
            }

            oModel.read("/CatalogoCodigosSet", {
                success: (oData) => {
                    const aResultados = oData.results || [];
                    console.log("aResultados", aResultados)
                    console.log(oData)

                    // Crear o actualizar el modelo JSON
                    let oCatalogoModel = this.getView().getModel("CatalogoCodigosModel");

                    if (!oCatalogoModel) {
                        // Si no existe, crear el modelo
                        oCatalogoModel = new JSONModel();
                        this.getView().setModel(oCatalogoModel, "CatalogoCodigosModel");
                    }

                    // Setear los datos en el modelo
                    oCatalogoModel.setData(aResultados);
                    oCatalogoModel.refresh(true);
                },
                error: (oError) => {
                    MessageBox.error("Error al cargar el catálogo de códigos");
                }
            });
        },

        _getDescripcionDesdeCategologo: function (sCodigo) {
            const oCatalogoModel = this.getView().getModel("CatalogoCodigosModel");

            if (!oCatalogoModel) {
                return "";
            }

            const aCatalogo = oCatalogoModel.getData() || [];
            const oAccion = aCatalogo.find(item => item.Codigo === sCodigo);

            return oAccion ? oAccion.Descripcion : "";
        },

        // --------------------------------------------- ACCIONES POR GRUPO ------------------------------
        //Obtiene todos los IDs de licencias que pertenecen al mismo grupo

        _getIdsDelGrupo: function (oLicencia) {
            const oView = this.getView();
            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const aTodasLasLicencias = oLicencesModel.getData() || [];

            // Obtener el grupo de la licencia seleccionada
            const sGrupoSeleccionado = oLicencia.Grupo;

            if (!sGrupoSeleccionado) {
                // Si no tiene grupo, devolver solo su ID
                return oLicencia.Id;
            }

            // Buscar todas las licencias del mismo grupo
            const aLicenciasDelGrupo = aTodasLasLicencias.filter(lic =>
                lic.Grupo === sGrupoSeleccionado
            );

            // Si es un grupo individual (solo 1 licencia), devolver solo ese ID
            if (aLicenciasDelGrupo.length === 1) {
                return oLicencia.Id;
            }

            // Si hay múltiples licencias en el grupo, devolver todos los IDs separados
            const aIds = aLicenciasDelGrupo.map(lic => lic.Id);
            return aIds.join(" / ");
        },

        onNavigateToGrafico: function () {
            // ✅ ID CORRECTO: mainTabBar (no idIconTabBar)
            var oIconTabBar = this.byId("mainTabBar");

            if (oIconTabBar) {
                // ✅ KEY CORRECTO: "Grafico" (con G mayúscula, sin tilde)
                oIconTabBar.setSelectedKey("Grafico");

                // Cargar el gráfico si aún no está cargado
                this._loadChartFragment();
                this._computeChartFromAcciones();

                sap.m.MessageToast.show("📊 Mostrando gráfico");
            } else {
                sap.m.MessageBox.error("No se pudo encontrar la pestaña de gráfico");
            }
        },

        _loadChartFragment: function () {
            var oView = this.getView();

            if (!this._oChartFragment) {
                this._oChartFragment = sap.ui.xmlfragment(
                    oView.getId(),
                    "transener.sistemadeturnos.fragments.LineChart",
                    this
                );
                oView.addDependent(this._oChartFragment);
                this._configureChartProperties();
            }

            this.byId("chartContainer").addItem(this._oChartFragment);
        },

        _configureChartProperties: function () {
            var oVizFrame = this._oChartFragment;
            if (!oVizFrame) return;

            oVizFrame.setVizProperties({
                title: {
                    visible: true,
                    text: "Desvíos por Hito — Diferencia respecto al Previsto (min)"
                },
                legend: {
                    visible: true
                },
                valueAxis: {
                    title: { visible: true, text: "Desvío (min)" }
                },
                categoryAxis: {
                    title: { visible: false }
                },
                plotArea: {
                    // Colores en el mismo orden que las medidas en el FeedItem:
                    // Promedio, Mínimo, Máximo
                    colorPalette: ["#FF8C00", "#2ECC71", "#E74C3C"]
                }
            });
        },

        onChartDataSelect: function (oEvent) {
            var aData = oEvent.getParameter("data");

            if (!aData || aData.length === 0) {
                return;
            }

            var oSelectedData = aData[0].data;
            var sAccion = oSelectedData.Accion || oSelectedData["Accion"] || "";

            if (!sAccion) {
                sap.m.MessageToast.show("Error: No se pudo identificar la acción");
                return;
            }

            var oChartModel = this.getView().getModel("chartModel");
            var aAllData = oChartModel.getProperty("/data");

            var oCompleteData = aAllData.find(function (item) {
                return item.Accion === sAccion;
            });

            if (!oCompleteData) {
                sap.m.MessageToast.show("No se encontraron datos completos");
                return;
            }

            var fPrevisto = oCompleteData._previsto || 0;
            var fPromedio = oCompleteData.Promedio || 0;
            var fMin = oCompleteData.DesvioMin || 0;
            var fMax = oCompleteData.DesvioMax || 0;
            var aDesvios = oCompleteData._desvios || [];

            // Formatear hora prevista como HH:MM
            var hPrev = Math.floor(fPrevisto);
            var mPrev = Math.round((fPrevisto - hPrev) * 60);
            if (mPrev >= 60) { hPrev += Math.floor(mPrev / 60); mPrev = mPrev % 60; }
            var sPrevisto = hPrev + ":" + (mPrev < 10 ? "0" : "") + mPrev;

            // Helper para mostrar desvío con signo explícito
            var fnFmtDev = function (v) {
                return (v >= 0 ? "+" : "") + v.toFixed(1) + " min";
            };

            // Detalle de valores individuales
            var sIndividuales = aDesvios.length
                ? aDesvios.map(function (v, i) {
                    return "   [" + (i + 1) + "] " + fnFmtDev(v);
                }).join("\n")
                : "   (sin datos)";

            var sDetalles =
                "Acción: " + sAccion + "\n" +
                "Hora prevista (referencia): " + sPrevisto + " hs\n\n" +
                "Desvíos individuales (real − previsto):\n" + sIndividuales + "\n\n" +
                "Mínimo:              " + fnFmtDev(fMin) + "\n" +
                "Máximo:              " + fnFmtDev(fMax) + "\n" +
                "Promedio |abs|:      +" + fPromedio.toFixed(1) + " min";

            sap.m.MessageBox.information(sDetalles, {
                title: "Detalle de la Acción",
                styleClass: "sapUiSizeCompact"
            });
        },

        // ─── GRÁFICO: Reporte de Desvíos ────────────────────────────────────────────

        onDescargarReporteDesvios: function () {
            jQuery.sap.require("transener.sistemadeturnos.libs.xlsx");
            if (typeof XLSX === "undefined" || !XLSX || !XLSX.utils) {
                MessageBox.error("No se pudo cargar la librería XLSX.");
                return;
            }
            if (typeof make_xlsx_lib === "function") {
                make_xlsx_lib(XLSX);
            }
            this._createExcelReportDesvios();
        },

        _createExcelReportDesvios: function () {
            var oView = this.getView();
            var oAccModel = oView.getModel("AccionesEntregaModel");
            var oLicModel = ModelHelper.getModel("LicencesJsonModel", oView);
            var oFormatter = this.formatter;

            // ── Mapa de hitos: mismo que en _computeChartFromAcciones ──────────────
            // origen: dónde viene el tiempo real ("Módulo Licencias" o "Libro de Guardia")
            var mAcciones = {
                "SOL COC": { nombre: "Solicitud al COC", previsto: 6.0, origen: "Hardcode" },
                "SOL TEC": { nombre: "Solicitud técnica", previsto: 6.667, origen: "Hardcode" },
                "AUT COC": { nombre: "Autorización del COC", previsto: 6.833, origen: "Hardcode" },
                "INI MAN": { nombre: "Inicio de maniobras", previsto: 7.0, origen: "Hardcode" },
                "COL PAT": { nombre: "Colocación de PAT", previsto: 7.75, origen: "Hardcode" },
                "FIN MAN": { nombre: "Fin de maniobras", previsto: 7.75, origen: "Hardcode" },
                "FIN LT": { nombre: "Finalización de LT", previsto: 16.0, origen: "Hardcode" },
                "RET PAT": { nombre: "Retiro de PAT", previsto: 16.25, origen: "Hardcode" },
                "MAN PES": { nombre: "Maniobras para la PES", previsto: 16.25, origen: "Hardcode" },
                "PES": { nombre: "Puesta en Servicio", previsto: 17.0, origen: "Hardcode" }
            };

            // ── Helpers ───────────────────────────────────────────────────────────
            var fnToDecimal = function (sTime) {
                if (!sTime) return null;
                var p = sTime.split(":");
                if (p.length < 2) return null;
                var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
                if (isNaN(h) || isNaN(m)) return null;
                if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
                return h + m / 60;
            };
            var fnToHHMM = function (fDec) {
                var h = Math.floor(fDec);
                var m = Math.round((fDec - h) * 60);
                if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
                return h + ":" + (m < 10 ? "0" : "") + m;
            };
            var fnDesvio = function (sHoraReal, fPrevisto) {
                var fHora = fnToDecimal(sHoraReal);
                if (fHora === null) return null;
                return Math.round((fHora - fPrevisto) * 60 * 10) / 10;
            };

            // ── Datos reales del Libro de Guardia (hardcode provisional) ─────────
            // Primeros 3 hitos: SOL COC, SOL TEC, AUT COC.
            // TODO: reemplazar con integración real al LG.
            var aLGData = [
                { codigo: "SOL COC", equipo: "LG-001", tiempo: "6:05" },
                { codigo: "SOL COC", equipo: "LG-002", tiempo: "5:58" },
                { codigo: "SOL COC", equipo: "LG-003", tiempo: "6:10" },
                { codigo: "SOL COC", equipo: "LG-004", tiempo: "5:55" },
                { codigo: "SOL COC", equipo: "LG-005", tiempo: "6:02" },
                { codigo: "SOL TEC", equipo: "LG-001", tiempo: "6:45" },
                { codigo: "SOL TEC", equipo: "LG-002", tiempo: "6:38" },
                { codigo: "SOL TEC", equipo: "LG-003", tiempo: "6:50" },
                { codigo: "SOL TEC", equipo: "LG-004", tiempo: "6:35" },
                { codigo: "SOL TEC", equipo: "LG-005", tiempo: "6:42" },
                { codigo: "AUT COC", equipo: "LG-001", tiempo: "6:55" },
                { codigo: "AUT COC", equipo: "LG-002", tiempo: "6:48" },
                { codigo: "AUT COC", equipo: "LG-003", tiempo: "7:02" },
                { codigo: "AUT COC", equipo: "LG-004", tiempo: "6:45" },
                { codigo: "AUT COC", equipo: "LG-005", tiempo: "6:52" },
                { codigo: "INI MAN", equipo: "LG-001", tiempo: "7:05" },
                { codigo: "INI MAN", equipo: "LG-002", tiempo: "6:58" },
                { codigo: "INI MAN", equipo: "LG-003", tiempo: "7:12" },
                { codigo: "INI MAN", equipo: "LG-004", tiempo: "6:55" },
                { codigo: "INI MAN", equipo: "LG-005", tiempo: "7:08" },
                { codigo: "COL PAT", equipo: "LG-001", tiempo: "7:50" },
                { codigo: "COL PAT", equipo: "LG-002", tiempo: "7:40" },
                { codigo: "COL PAT", equipo: "LG-003", tiempo: "7:55" },
                { codigo: "COL PAT", equipo: "LG-004", tiempo: "7:38" },
                { codigo: "COL PAT", equipo: "LG-005", tiempo: "7:48" },
                { codigo: "FIN MAN", equipo: "LG-001", tiempo: "7:52" },
                { codigo: "FIN MAN", equipo: "LG-002", tiempo: "7:42" },
                { codigo: "FIN MAN", equipo: "LG-003", tiempo: "8:00" },
                { codigo: "FIN MAN", equipo: "LG-004", tiempo: "7:40" },
                { codigo: "FIN MAN", equipo: "LG-005", tiempo: "7:50" },
                { codigo: "FIN LT", equipo: "LG-001", tiempo: "16:08" },
                { codigo: "FIN LT", equipo: "LG-002", tiempo: "15:55" },
                { codigo: "FIN LT", equipo: "LG-003", tiempo: "16:15" },
                { codigo: "FIN LT", equipo: "LG-004", tiempo: "15:52" },
                { codigo: "FIN LT", equipo: "LG-005", tiempo: "16:05" },
                { codigo: "RET PAT", equipo: "LG-001", tiempo: "16:22" },
                { codigo: "RET PAT", equipo: "LG-002", tiempo: "16:10" },
                { codigo: "RET PAT", equipo: "LG-003", tiempo: "16:28" },
                { codigo: "RET PAT", equipo: "LG-004", tiempo: "16:08" },
                { codigo: "RET PAT", equipo: "LG-005", tiempo: "16:18" },
                { codigo: "MAN PES", equipo: "LG-001", tiempo: "16:20" },
                { codigo: "MAN PES", equipo: "LG-002", tiempo: "16:12" },
                { codigo: "MAN PES", equipo: "LG-003", tiempo: "16:30" },
                { codigo: "MAN PES", equipo: "LG-004", tiempo: "16:10" },
                { codigo: "MAN PES", equipo: "LG-005", tiempo: "16:18" },
                { codigo: "PES", equipo: "LG-001", tiempo: "17:06" },
                { codigo: "PES", equipo: "LG-002", tiempo: "16:55" },
                { codigo: "PES", equipo: "LG-003", tiempo: "17:12" },
                { codigo: "PES", equipo: "LG-004", tiempo: "16:52" },
                { codigo: "PES", equipo: "LG-005", tiempo: "17:05" }
            ];

            // ── Acumular desvíos por código ───────────────────────────────────────
            // clave: código → [{ equipo, idLicencia, horaReal, desvio, origenDato }]
            var mDesvios = {};

            (oAccModel ? oAccModel.getData() || [] : []).forEach(function (oAcc) {
                var sCode = oAcc.accion;
                if (!mAcciones[sCode]) return;
                var fDev = fnDesvio(oAcc.turnoEntrega, mAcciones[sCode].previsto);
                if (fDev === null) return;
                if (!mDesvios[sCode]) mDesvios[sCode] = [];
                mDesvios[sCode].push({
                    equipo: oAcc.equipo || "",
                    idLicencia: oAcc.idLicencia || "",
                    horaReal: oAcc.turnoEntrega || "",
                    desvio: fDev,
                    origenDato: "Módulo Licencias"
                });
            });

            aLGData.forEach(function (oLG) {
                var sCode = oLG.codigo;
                if (!mAcciones[sCode]) return;
                var fDev = fnDesvio(oLG.tiempo, mAcciones[sCode].previsto);
                if (fDev === null) return;
                if (!mDesvios[sCode]) mDesvios[sCode] = [];
                mDesvios[sCode].push({
                    equipo: oLG.equipo || "",
                    idLicencia: "LG",
                    horaReal: oLG.tiempo,
                    desvio: fDev,
                    origenDato: "Libro de Guardia (hardcode)"
                });
            });

            // ── Solapa 1: Desvíos por Hito (resumen del gráfico) ─────────────────
            var aResumen = [["Código", "Hito", "Hora Prevista", "Origen datos reales",
                "N° Obs.", "Mín (min)", "Máx (min)", "Promedio |abs| (min)"]];
            Object.keys(mAcciones).forEach(function (sCode) {
                var aD = mDesvios[sCode] || [];
                var fMin = "Sin datos", fMax = "Sin datos", fProm = "Sin datos";
                if (aD.length) {
                    var aVals = aD.map(function (d) { return d.desvio; });
                    fMin = Math.round(Math.min.apply(null, aVals) * 10) / 10;
                    fMax = Math.round(Math.max.apply(null, aVals) * 10) / 10;
                    fProm = Math.round(aVals.reduce(function (s, v) { return s + Math.abs(v); }, 0)
                        / aVals.length * 10) / 10;
                }
                aResumen.push([
                    sCode,
                    mAcciones[sCode].nombre,
                    fnToHHMM(mAcciones[sCode].previsto),
                    mAcciones[sCode].origen,
                    aD.length,
                    fMin, fMax, fProm
                ]);
            });

            // ── Solapa 2: Acciones del Módulo (detalle) ───────────────────────────
            var aModDetalle = [["Equipo", "ID Licencia", "Código", "Hito",
                "Hora Prevista", "Hora Real", "Desvío (min)", "Periodo", "Fecha de Inicio"]];
            (oAccModel ? oAccModel.getData() || [] : []).forEach(function (oAcc) {
                var sCode = oAcc.accion;
                if (!mAcciones[sCode] || !oAcc.turnoEntrega) return;
                var fDev = fnDesvio(oAcc.turnoEntrega, mAcciones[sCode].previsto);
                if (fDev === null) return;
                var sPeriodo = oAcc.period === "D" ? "Diaria" : (oAcc.period === "C" ? "Continua" : (oAcc.period || ""));
                var sFechaInicio = "";
                if (oAcc.solbeg) {
                    var dSolbeg = oAcc.solbeg instanceof Date ? oAcc.solbeg : new Date(oAcc.solbeg);
                    if (!isNaN(dSolbeg)) {
                        sFechaInicio = String(dSolbeg.getDate()).padStart(2, "0") + "/" +
                            String(dSolbeg.getMonth() + 1).padStart(2, "0") + "/" +
                            dSolbeg.getFullYear();
                    }
                }
                aModDetalle.push([
                    oAcc.equipo || "",
                    oAcc.idLicencia || "",
                    sCode,
                    mAcciones[sCode].nombre,
                    fnToHHMM(mAcciones[sCode].previsto),
                    oAcc.turnoEntrega || "",
                    fDev,
                    sPeriodo,
                    sFechaInicio
                ]);
            });
            if (aModDetalle.length === 1) {
                aModDetalle.push(["Sin datos de módulo cargados"]);
            }

            // ── Solapa 3: Libro de Guardia (hardcode provisional) ─────────────────
            var aLGDetalle = [["Equipo", "ID Licencia", "Código", "Hito",
                "Hora Prevista", "Hora Real", "Desvío (min)", "Nota"]];
            aLGData.forEach(function (oLG) {
                var sCode = oLG.codigo;
                if (!mAcciones[sCode]) return;
                var fDev = fnDesvio(oLG.tiempo, mAcciones[sCode].previsto);
                if (fDev === null) return;
                aLGDetalle.push([
                    oLG.equipo || "",
                    "LG",
                    sCode,
                    mAcciones[sCode].nombre,
                    fnToHHMM(mAcciones[sCode].previsto),
                    oLG.tiempo,
                    fDev,
                    "Dato provisional — pendiente integración con LG"
                ]);
            });

            // ── Solapa 4: Licencias ───────────────────────────────────────────────
            var aLicDetalle = [["Equipo", "ID Licencia", "Estado", "Cond. Trabajo",
                "Turno", "Trabajo a Realizar", "Región"]];
            (oLicModel ? oLicModel.getData() || [] : []).forEach(function (lic) {
                aLicDetalle.push([
                    lic.Equnr || "",
                    lic.Id || "",
                    oFormatter.getEstado ? oFormatter.getEstado(lic.Equstat) : (lic.Equstat || ""),
                    oFormatter.getJobCond ? oFormatter.getJobCond(lic.Jobcond) : (lic.Jobcond || ""),
                    lic.TurnoAsignado || "",
                    lic.Comments || "",
                    oFormatter.getRegiones ? oFormatter.getRegiones(lic.Werks) : (lic.Werks || "")
                ]);
            });
            if (aLicDetalle.length === 1) {
                aLicDetalle.push(["Sin licencias cargadas en pantalla"]);
            }

            // ── Generar Excel ─────────────────────────────────────────────────────
            try {
                var Workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(Workbook, XLSX.utils.aoa_to_sheet(aResumen), "Desvíos por Hito");
                XLSX.utils.book_append_sheet(Workbook, XLSX.utils.aoa_to_sheet(aModDetalle), "Acciones Módulo");
                XLSX.utils.book_append_sheet(Workbook, XLSX.utils.aoa_to_sheet(aLGDetalle), "Libro de Guardia");
                XLSX.utils.book_append_sheet(Workbook, XLSX.utils.aoa_to_sheet(aLicDetalle), "Licencias");

                var sHoy = new Date().toISOString().slice(0, 10);
                XLSX.writeFile(Workbook, "Reporte_Desvios_" + sHoy + ".xlsx", { cellStyles: true });
                MessageToast.show("Reporte de desvíos descargado correctamente.");
            } catch (oError) {
                MessageBox.error("Error al generar el reporte: " + oError.message);
            }
        },

        // ─── GRÁFICO: cómputo del Promedio desde AccionesEntregaModel ───────────────

        /**
         * Lee AccionesEntregaModel, agrupa por código de acción y calcula
         * los desvíos en minutos respecto al horario previsto (hardcodeado).
         *   - DesvioMin / DesvioMax: con signo (positivo = tarde, negativo = antes)
         *   - Promedio: promedio de los valores absolutos de los desvíos
         * El previsto es la referencia (0 en el eje Y) y NO se grafica.
         * Los primeros 3 hitos (SOL TEC, AUT COC, INI MAN) vienen del
         * libro de guardia (actualmente hardcodeados, funcionalidad pendiente).
         */
        _computeChartFromAcciones: function () {
            var oView = this.getView();
            var oAccModel = oView.getModel("AccionesEntregaModel");
            var oChartModel = oView.getModel("chartModel");

            if (!oAccModel || !oChartModel) return;

            var aAcciones = oAccModel.getData() || [];

            // Si no hay acciones cargadas, vaciar el gráfico
            if (!aAcciones.length) {
                oChartModel.setProperty("/data", []);
                return;
            }

            // Mapa: código → nombre en el gráfico y hora prevista en horas decimales (hardcodeada)
            // El previsto se usa SOLO para calcular el desvío; no se grafica (equivale al 0).
            var mAcciones = {
                "SOL COC": { nombre: "Solicitud al COC", previsto: 6.0 }, // 6:00
                "SOL TEC": { nombre: "Solicitud técnica", previsto: 6.667 }, // 6:40
                "AUT COC": { nombre: "Autorización del COC", previsto: 6.833 }, // 6:50
                "INI MAN": { nombre: "Inicio de maniobras", previsto: 7.0 }, // 7:00
                "COL PAT": { nombre: "Colocación de PAT", previsto: 7.75 }, // 7:45
                "FIN MAN": { nombre: "Fin de maniobras", previsto: 7.75 }, // 7:45
                "FIN LT": { nombre: "Finalización de LT", previsto: 16.0 }, // 16:00
                "RET PAT": { nombre: "Retiro de PAT", previsto: 16.25 }, // 16:15
                "MAN PES": { nombre: "Maniobras para la PES", previsto: 16.25 }, // 16:15
                "PES": { nombre: "Puesta en Servicio", previsto: 17.0 }  // 17:00
            };

            // Helper: "HH:MM" → horas decimales
            // Los minutos van de 00 a 59; si superan 59 se normalizan a la hora siguiente.
            var fnToDecimal = function (sTime) {
                if (!sTime) return null;
                var aParts = sTime.split(":");
                if (aParts.length < 2) return null;
                var h = parseInt(aParts[0], 10);
                var m = parseInt(aParts[1], 10);
                if (isNaN(h) || isNaN(m)) return null;
                if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
                return h + m / 60;
            };

            // Fecha buscada actualmente (para filtrar continuas)
            var oDatePicker = this.byId("date");
            var oFechaBuscada = oDatePicker ? oDatePicker.getDateValue() : null;
            var fnIsSameDay = function (oDateA, oDateB) {
                if (!oDateA || !oDateB) return false;
                var dA = new Date(oDateA), dB = new Date(oDateB);
                return dA.getFullYear() === dB.getFullYear() &&
                    dA.getMonth() === dB.getMonth() &&
                    dA.getDate() === dB.getDate();
            };

            // Agrupar desvíos en minutos por código de acción
            // desvío = (hora real - hora prevista) * 60  →  positivo = tarde, negativo = antes
            var mDesviosPorCodigo = {};
            aAcciones.forEach(function (oAcc) {
                // Licencias continuas: solo participan si su entrega es de la fecha buscada
                if (oAcc.period === "C" && !fnIsSameDay(oAcc.dateturno, oFechaBuscada)) return;

                var sCode = oAcc.accion;
                if (!mAcciones[sCode]) return;
                var fHora = fnToDecimal(oAcc.turnoEntrega);
                if (fHora === null) return;
                var fDesvioMin = Math.round((fHora - mAcciones[sCode].previsto) * 60 * 10) / 10;
                if (!mDesviosPorCodigo[sCode]) mDesviosPorCodigo[sCode] = [];
                mDesviosPorCodigo[sCode].push(fDesvioMin);
            });

            // Construir el array solo con las acciones que tienen datos reales
            var aData = [];
            Object.keys(mAcciones).forEach(function (sCode) {
                var aDesvios = mDesviosPorCodigo[sCode];
                if (!aDesvios || !aDesvios.length) return;

                // Promedio con valor absoluto (evita cancelación entre desvíos opuestos)
                var fSumAbs = aDesvios.reduce(function (acc, v) { return acc + Math.abs(v); }, 0);
                var fPromedio = Math.round((fSumAbs / aDesvios.length) * 10) / 10;

                aData.push({
                    Accion: mAcciones[sCode].nombre,
                    _previsto: mAcciones[sCode].previsto, // solo para popup; no se grafica
                    _desvios: aDesvios,                  // valores individuales para popup
                    Promedio: fPromedio,
                    DesvioMin: Math.round(Math.min.apply(null, aDesvios) * 10) / 10,
                    DesvioMax: Math.round(Math.max.apply(null, aDesvios) * 10) / 10
                });
            });

            oChartModel.setProperty("/data", aData);
        },

        // ACCIONES PARA LA ENTREGA - RECALCULO DE HORAS

        // 🆕 FUNCIÓN DEFINITIVA según documentación completa (3 imágenes de tablas)
        _calcularHorarioAccion: function (sCodigoAccion, oLicencia, sTurnoBase) {
            // sTurnoBase = T Eq (el horario asignado en la tab Turno)

            if (!sTurnoBase || sTurnoBase.trim() === "") {
                console.warn("⚠️ No hay turno base (T Eq) para calcular horario de acción");
                return "";
            }

            console.log(`🕐 Calculando horario para acción ${sCodigoAccion} con T Eq = ${sTurnoBase}`);

            // Convertir T Eq (turnoBase) a minutos
            const [horas, minutos] = sTurnoBase.split(":").map(Number);
            const tEqMinutos = (horas * 60) + minutos;

            // Obtener T ManStd de la licencia
            const shiftInfo = Utils.getShiftInfo(oLicencia);
            const tManStd = shiftInfo.duration; // 45, 30, 20, 15 o 10 min

            console.log(`   📊 T ManStd para esta licencia: ${tManStd} min`);

            let horarioCalculadoMinutos = tEqMinutos;

            const T_AVISO = 60;
            const T_MANCOT = 15;
            const T_PES = 17 * 60; // Hora de puesta en servicio: 17:00 hs

            // 🔧 CALCULAR SEGÚN CÓDIGO DE ACCIÓN
            switch (sCodigoAccion) {
                case "SOL COC":
                    // Fórmula: T SOL COC = T Eq - T Aviso
                    horarioCalculadoMinutos = tEqMinutos - T_AVISO;
                    console.log(`   ✅ SOL COC: T Eq(${sTurnoBase}) - T Aviso(${T_AVISO}min)`);
                    break;

                case "SOL TEC":
                    // Fórmula: T SOL TEC = T Eq - 20 min
                    horarioCalculadoMinutos = tEqMinutos - 20;
                    console.log(`   ✅ SOL TEC: T Eq(${sTurnoBase}) - 20min`);
                    break;

                case "AUT COC":
                    // Fórmula: T AUT COC = T Eq - 10 min
                    horarioCalculadoMinutos = tEqMinutos - 10;
                    console.log(`   ✅ AUT COC: T Eq(${sTurnoBase}) - 10min`);
                    break;

                case "INI MAN":
                    // Fórmula: T Eq = F/S PR Horario del turno
                    // Es el turno base (sin cambios)
                    horarioCalculadoMinutos = tEqMinutos;
                    console.log(`   ✅ INI MAN: T Eq = ${sTurnoBase}`);
                    break;

                case "COL PAT":
                    // Fórmula: T COL PAT = T INI MAN + T ManStd
                    horarioCalculadoMinutos = tEqMinutos + tManStd;
                    console.log(`   ✅ COL PAT: T Eq(${sTurnoBase}) + T ManStd(${tManStd}min)`);
                    break;

                case "FIN MAN":
                    // Fórmula: T FIN MAN = T INI MAN + T ManStd + 0
                    horarioCalculadoMinutos = tEqMinutos + tManStd;
                    console.log(`   ✅ FIN MAN: T Eq(${sTurnoBase}) + T ManStd(${tManStd}min)`);
                    break;

                case "FIN LT":
                    horarioCalculadoMinutos = T_PES - T_MANCOT - tManStd;
                    console.log(`   ✅ FIN LT: T PES(17:00) - T ManCOT(${T_MANCOT}min) - T ManStd(${tManStd}min)`);
                    break;

                case "RET PAT":
                    horarioCalculadoMinutos = T_PES - T_MANCOT;
                    console.log(`   ✅ RET PAT: T PES(17:00) - T ManCOT(${T_MANCOT}min)`);
                    break;

                case "MAN PES":
                    horarioCalculadoMinutos = T_PES - T_MANCOT;
                    console.log(`   ✅ MAN PES: T PES(17:00) - T ManCOT(${T_MANCOT}min)`);
                    break;

                case "PES":
                case "FCS":
                    horarioCalculadoMinutos = T_PES;
                    console.log(`   ✅ PES/FCS: 17:00`);
                    break;

                default:
                    // Por defecto, usar T Eq
                    console.warn(`   ⚠️ Acción ${sCodigoAccion} sin fórmula definida - usando T Eq`);
                    horarioCalculadoMinutos = tEqMinutos;
            }

            // Convertir de vuelta a formato HH:mm
            const horasResultado = Math.floor(horarioCalculadoMinutos / 60);
            const minutosResultado = horarioCalculadoMinutos % 60;

            const horarioFinal =
                String(horasResultado).padStart(2, '0') + ":" +
                String(minutosResultado).padStart(2, '0');

            console.log(`   🎯 Horario calculado: ${horarioFinal}\n`);

            return horarioFinal;
        },

        // Función auxiliar para convertir minutos a formato HH:mm (para logs)
        _minutosAHora: function (minutos) {
            const h = Math.floor(minutos / 60);
            const m = minutos % 60;
            return String(h).padStart(2, '0') + ":" + String(m).padStart(2, '0');
        },

        // -------------------- UPDATE ACCIONES PARA LA ENTREGA -------------------------------

        // 🆕 SOLUCIÓN HÍBRIDA: $batch + fallback individual cuando es necesario

        _saveAccionesEnBackendOptimizado: function (aAcciones) {
            const oDataModel = this.getView().getModel();
            const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

            if (!oFechaTurno) {
                MessageBox.error("No se pudo obtener la fecha del turno");
                return Promise.reject("No hay fecha de turno");
            }

            if (!aAcciones || aAcciones.length === 0) {
                return Promise.resolve();
            }

            console.log("💾 Guardando acciones con $batch optimizado...");

            // Normalizar fecha
            const year = oFechaTurno.getFullYear();
            const month = oFechaTurno.getMonth();
            const day = oFechaTurno.getDate();
            const oFechaUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

            // Separar operaciones en dos grupos:
            // 1. Operaciones seguras para $batch (CREATE nuevos, UPDATE de turnos)
            // 2. Operaciones con fallback (adjuntos que pueden necesitar CREATE si falla UPDATE)

            const aBatchOperations = [];  // Para $batch
            const aFallbackPromises = [];  // Para UPDATE-o-CREATE individual

            // Configurar $batch
            oDataModel.setUseBatch(true);
            const sGroupId = "saveAccionesGroup_" + Date.now();
            oDataModel.setDeferredGroups([sGroupId]);

            let iOperacionesBatch = 0;
            let iOperacionesFallback = 0;

            // Procesar cada acción
            aAcciones.forEach(accion => {
                if (!accion.accion || !accion.idLicencia) {
                    console.warn("⚠️ Acción incompleta");
                    return;
                }

                const aIds = accion.idLicencia.split(" / ").map(id => id.trim());

                // 🔑 CASO 1: Acción CON adjuntos
                if (accion.Attachments && accion.Attachments.length > 0) {
                    accion.Attachments.forEach((att, attIdx) => {
                        const bEsAdjuntoNuevo = !att._guardado;
                        const bCambioContenido = att._snapshotOriginal &&
                            att.Attachment !== att._snapshotOriginal.Attachment;

                        if (!bEsAdjuntoNuevo && !bCambioContenido) {
                            console.log(`   ⏭️ Adjunto sin cambios: ${att.AttachmentName}`);
                            return;
                        }

                        let base64Data = att.Attachment || "";
                        if (base64Data.includes(',')) {
                            base64Data = base64Data.split(',')[1];
                        }

                        const bAdjuntoExiste = att.Id && att.Empresa && att.Tipo &&
                            att.Anio && att.Dateturno && att.Codigo;

                        const payload = {
                            Id: att.Id || aIds[0],
                            Empresa: accion.empresa || "100",
                            Tipo: accion.tipo || "L",
                            Anio: accion.anio || new Date().getFullYear().toString(),
                            Dateturno: oFechaUTC,
                            Codigo: (accion.accion || "").substring(0, 10),
                            Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                            Descripcion: accion.trabajoRealizar || "Sin descripción",
                            Equnr: (accion.equipo || "").substring(0, 18),
                            Equstat: accion.equstat || "A",
                            Jobcond: (accion.condicion || "01").substring(0, 2),
                            Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                            Comments: (att.AttachmentName || `Adjunto ${attIdx + 1}`).substring(0, 255),
                            Licstat: (accion.estado || "01").substring(0, 2),
                            Attachment: base64Data
                        };

                        if (bAdjuntoExiste) {
                            // ⚠️ Adjunto existente: Puede necesitar fallback UPDATE→CREATE
                            // NO usar $batch, usar promesa individual con fallback
                            aFallbackPromises.push(
                                new Promise((resolve, reject) => {
                                    const sKey = oDataModel.createKey("/CatalogoEntregaSet", {
                                        Id: att.Id,
                                        Empresa: att.Empresa,
                                        Tipo: att.Tipo,
                                        Anio: att.Anio,
                                        Dateturno: att.Dateturno,
                                        Codigo: att.Codigo
                                    });

                                    oDataModel.update(sKey, payload, {
                                        success: () => {
                                            console.log(`   📝 UPDATE adjunto: ${att.AttachmentName}`);
                                            resolve();
                                        },
                                        error: () => {
                                            // Fallback: Si UPDATE falla, intentar CREATE
                                            console.log(`   🔄 UPDATE falló, intentando CREATE: ${att.AttachmentName}`);
                                            oDataModel.create("/CatalogoEntregaSet", payload, {
                                                success: () => {
                                                    console.log(`   ➕ CREATE adjunto (fallback): ${att.AttachmentName}`);
                                                    resolve();
                                                },
                                                error: () => {
                                                    console.error(`   ❌ Error adjunto: ${att.AttachmentName}`);
                                                    reject();
                                                }
                                            });
                                        }
                                    });
                                })
                            );
                            iOperacionesFallback++;
                        } else {
                            // ✅ Adjunto nuevo: Seguro para $batch
                            oDataModel.create("/CatalogoEntregaSet", payload, {
                                groupId: sGroupId
                            });
                            console.log(`   ➕ CREATE adjunto nuevo en $batch: ${att.AttachmentName}`);
                            iOperacionesBatch++;
                        }
                    });

                    // Verificar si solo cambió el turno (sin cambios en adjuntos)
                    const bCambioTurno = accion._snapshotOriginal &&
                        accion.turnoEntrega !== accion._snapshotOriginal.turnoEntrega;

                    const bAlgunAdjuntoCambio = accion.Attachments.some(att => {
                        const bEsNuevo = !att._guardado;
                        const bCambio = att._snapshotOriginal && att.Attachment !== att._snapshotOriginal.Attachment;
                        return bEsNuevo || bCambio;
                    });

                    if (bCambioTurno && !bAlgunAdjuntoCambio) {
                        console.log(`   🔄 Solo cambió turno: ${accion._snapshotOriginal.turnoEntrega} → ${accion.turnoEntrega}`);

                        aIds.forEach(sId => {
                            const payload = {
                                Id: sId,
                                Empresa: accion.empresa || "100",
                                Tipo: accion.tipo || "L",
                                Anio: accion.anio || new Date().getFullYear().toString(),
                                Dateturno: oFechaUTC,
                                Codigo: (accion.accion || "").substring(0, 10),
                                Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                Descripcion: accion.trabajoRealizar || "Sin descripción",
                                Equnr: (accion.equipo || "").substring(0, 18),
                                Equstat: accion.equstat || "A",
                                Jobcond: (accion.condicion || "01").substring(0, 2),
                                Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                Comments: `Adjuntos: ${accion.Attachments.length}`,
                                Licstat: (accion.estado || "01").substring(0, 2),
                                Attachment: ""
                            };

                            const sKey = oDataModel.createKey("/CatalogoEntregaSet", {
                                Id: sId,
                                Empresa: accion.empresa || "100",
                                Tipo: accion.tipo || "L",
                                Anio: accion.anio || new Date().getFullYear().toString(),
                                Dateturno: oFechaUTC,
                                Codigo: accion.accion
                            });

                            // ✅ UPDATE de turno: Seguro para $batch
                            oDataModel.update(sKey, payload, {
                                groupId: sGroupId
                            });
                            console.log(`   📝 UPDATE turno en $batch: ${sId} / ${accion.turnoEntrega}`);
                            iOperacionesBatch++;
                        });
                    }

                } else {
                    // 🔑 CASO 2: Acción SIN adjuntos
                    const bCambioTurno = !accion._snapshotOriginal ||
                        accion.turnoEntrega !== accion._snapshotOriginal.turnoEntrega;

                    const bEsNueva = !accion._estadoGuardado;

                    if (!bEsNueva && !bCambioTurno) {
                        console.log(`   ⏭️ Acción sin cambios: ${accion.idLicencia} / ${accion.accion}`);
                        return;
                    }

                    if (accion._estadoGuardado) {
                        // ✅ UPDATE: un request por ID en $batch (cada registro tiene su propia clave)
                        aIds.forEach(sId => {
                            const payload = {
                                Id: sId,
                                Empresa: accion.empresa || "100",
                                Tipo: accion.tipo || "L",
                                Anio: accion.anio || new Date().getFullYear().toString(),
                                Dateturno: oFechaUTC,
                                Codigo: (accion.accion || "").substring(0, 10),
                                Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                Descripcion: accion.trabajoRealizar || "Sin descripción",
                                Equnr: (accion.equipo || "").substring(0, 18),
                                Equstat: accion.equstat || "A",
                                Jobcond: (accion.condicion || "01").substring(0, 2),
                                Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                Comments: "Sin adjuntos",
                                Licstat: (accion.estado || "01").substring(0, 2),
                                Attachment: ""
                            };

                            const sKey = oDataModel.createKey("/CatalogoEntregaSet", {
                                Id: sId,
                                Empresa: accion.empresa || "100",
                                Tipo: accion.tipo || "L",
                                Anio: accion.anio || new Date().getFullYear().toString(),
                                Dateturno: oFechaUTC,
                                Codigo: accion.accion
                            });

                            oDataModel.update(sKey, payload, {
                                groupId: sGroupId
                            });
                            console.log(`   📝 UPDATE en $batch: ${sId} / ${accion.turnoEntrega}`);
                            iOperacionesBatch++;
                        });
                    } else {
                        // ⚠️ CREATE bulk: deep insert, NO soportado en $batch → request individual
                        aFallbackPromises.push(
                            new Promise((resolve, reject) => {
                                const payload = {
                                    Empresa: accion.empresa || "100",
                                    Tipo: accion.tipo || "L",
                                    Anio: accion.anio || new Date().getFullYear().toString(),
                                    Dateturno: oFechaUTC,
                                    Codigo: (accion.accion || "").substring(0, 10),
                                    Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                    Descripcion: accion.trabajoRealizar || "Sin descripción",
                                    Equnr: (accion.equipo || "").substring(0, 18),
                                    Equstat: accion.equstat || "A",
                                    Jobcond: (accion.condicion || "01").substring(0, 2),
                                    Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                    Comments: "Sin adjuntos",
                                    Licstat: (accion.estado || "01").substring(0, 2),
                                    Attachment: "",
                                    EstadoGuardado: true,
                                    ToIDs: aIds.map(sId => ({ Id: sId }))
                                };

                                // setUseBatch(false) sync para que este create salga fuera del $batch
                                // (OData v2 no soporta deep insert con ToIDs dentro de changeset)
                                oDataModel.setUseBatch(false);
                                oDataModel.create("/CatalogoEntregaBulkSet", payload, {
                                    success: () => {
                                        console.log(`   ➕ CREATE bulk OK: [${aIds.join(", ")}] / ${accion.turnoEntrega}`);
                                        resolve();
                                    },
                                    error: (oError) => {
                                        console.error(`   ❌ CREATE bulk error: [${aIds.join(", ")}]`, oError);
                                        reject(oError);
                                    }
                                });
                                oDataModel.setUseBatch(true); // restaurar sync antes de continuar
                            })
                        );
                        iOperacionesFallback++;
                    }
                }
            });

            // Ejecutar operaciones
            console.log(`📦 $batch: ${iOperacionesBatch} operaciones | Individual: ${iOperacionesFallback} operaciones`);

            const aPromesas = [];

            // 1. Ejecutar $batch si hay operaciones
            if (iOperacionesBatch > 0) {
                aPromesas.push(
                    new Promise((resolve, reject) => {
                        oDataModel.submitChanges({
                            groupId: sGroupId,
                            success: (oData) => {
                                console.log("✅ $batch exitoso");
                                resolve(oData);
                            },
                            error: (oError) => {
                                console.error("❌ Error en $batch:", oError);
                                reject(oError);
                            }
                        });
                    })
                );
            }

            // 2. Agregar promesas de fallback
            aPromesas.push(...aFallbackPromises);

            if (aPromesas.length === 0) {
                console.log("✅ No hay cambios para guardar");
                oDataModel.setUseBatch(false);
                return Promise.resolve();
            }

            // Ejecutar todas las promesas en paralelo
            return Promise.all(aPromesas)
                .then(() => {
                    oDataModel.setUseBatch(false);
                    console.log("✅ Guardado completo exitoso");

                    // Actualizar snapshots
                    aAcciones.forEach(accion => {
                        accion._estadoGuardado = true;
                        accion._snapshotOriginal = {
                            turnoEntrega: accion.turnoEntrega,
                            attachmentsCount: accion.Attachments ? accion.Attachments.length : 0
                        };

                        if (accion.Attachments) {
                            accion.Attachments.forEach(att => {
                                att._guardado = true;
                                att._snapshotOriginal = {
                                    Attachment: att.Attachment,
                                    AttachmentName: att.AttachmentName
                                };
                            });
                        }
                    });
                })
                .catch((error) => {
                    oDataModel.setUseBatch(false);
                    console.error("❌ Error al guardar:", error);
                    throw error;
                });
        },

        // ----------------- GENERAR ACCIONES AUTOMATICAS PARA LICENCIAS CON MANIOBRAS ------
        onRegenerarAccionesAutomaticas: function () {
            MessageBox.confirm(
                "¿Generar acciones automáticas para todas las licencias con maniobras?\n\n" +
                "Esto agregará las acciones faltantes (SOL TEC, AUT COC, INI MAN, COL PAT, FIN MAN).",
                {
                    title: "Generar Acciones Automáticas",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._generarAccionesAutomaticas();
                        }
                    }
                }
            );
        },

        _generarAccionesAutomaticas: function () {
            const oView = this.getView();
            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const oAccionesModel = oView.getModel("AccionesEntregaModel");

            const aLicencias = oLicencesModel.getData() || [];
            let aAccionesExistentes = oAccionesModel.getData() || [];

            if (aLicencias.length === 0) {
                console.log("⚠️ No hay licencias para procesar");
                return;
            }

            console.log("🤖 ════════════════════════════════════════════");
            console.log("🤖 GENERACIÓN AUTOMÁTICA DE ACCIONES");
            console.log("════════════════════════════════════════════\n");

            // 🔍 Filtrar licencias CON maniobras
            const aLicenciasConManiobras = aLicencias.filter(licencia => {
                const info = Utils.getShiftInfo(licencia);

                const esConManiobras =
                    info.category === "ConsignacionLinea" ||
                    info.category === "ConsignacionEquipo" ||
                    info.category === "ManiobrasSinConsignacion";

                return esConManiobras;
            });

            console.log(`📊 Licencias totales: ${aLicencias.length}`);
            console.log(`✅ Licencias CON maniobras: ${aLicenciasConManiobras.length}`);
            console.log(`⏭️ Licencias SIN maniobras: ${aLicencias.length - aLicenciasConManiobras.length}\n`);

            if (aLicenciasConManiobras.length === 0) {
                console.log("⚠️ No hay licencias con maniobras para generar acciones");
                MessageToast.show("No hay licencias con maniobras");
                return;
            }

            // 👥 Agrupar licencias por grupo
            const mLicenciasPorGrupo = {};

            aLicenciasConManiobras.forEach(licencia => {
                const sGrupo = licencia.Grupo || licencia.Id;

                if (!mLicenciasPorGrupo[sGrupo]) {
                    mLicenciasPorGrupo[sGrupo] = [];
                }

                mLicenciasPorGrupo[sGrupo].push(licencia);
            });

            console.log(`👥 Grupos identificados: ${Object.keys(mLicenciasPorGrupo).length}\n`);

            let iAccionesGeneradas = 0;
            let iAccionesOmitidas = 0;

            // 🔄 Para cada grupo, generar acciones
            Object.keys(mLicenciasPorGrupo).forEach(sGrupo => {
                const aLicenciasGrupo = mLicenciasPorGrupo[sGrupo];
                const oLicenciaPrincipal = aLicenciasGrupo[0];

                // 🔍 Obtener categoría de la licencia
                const info = Utils.getShiftInfo(oLicenciaPrincipal);
                const esConsignacion = info.category === "ConsignacionLinea" ||
                    info.category === "ConsignacionEquipo";

                // IDs del grupo
                const aIdsGrupo = aLicenciasGrupo.map(lic => lic.Id);
                const sIdsGrupo = aIdsGrupo.join(" / ");

                console.log(`📌 Grupo: ${sIdsGrupo}`);
                console.log(`   Categoría: ${info.category}`);
                console.log(`   Equipo: ${oLicenciaPrincipal.Equnr || 'N/A'}`);
                console.log(`   Turno: ${oLicenciaPrincipal.TurnoAsignado || 'N/A'}`);

                // 📋 Definir acciones según categoría
                let aAccionesAutomaticas;

                if (esConsignacion) {
                    // ✅ CONSIGNACIÓN: Todas las 9 acciones (incluye COL PAT y RET PAT)
                    console.log(`   ✅ Consignación → Genera 9 acciones (con COL PAT y RET PAT)`);
                    aAccionesAutomaticas = [
                        { codigo: "SOL TEC", descripcion: "El técnico confirmará los trabajos al COT" },
                        { codigo: "AUT COC", descripcion: "El COC y agentes involucrados autorizan" },
                        { codigo: "INI MAN", descripcion: "Comienzo de maniobras - F/S Programado" },
                        { codigo: "COL PAT", descripcion: "El Técnico confirmará la colocación de PAT" },
                        { codigo: "FIN MAN", descripcion: "Finalización de maniobras - Entrega LT" },
                        { codigo: "FIN LT", descripcion: "El Técnico confirmará la finalización de los trabajos" },
                        { codigo: "RET PAT", descripcion: "El Técnico confirmará el retiro de PAT" },
                        { codigo: "MAN PES", descripcion: "El Técnico confirmará la normalización de la instalación - El COT comienza las maniobras para la PES" },
                        { codigo: "PES", descripcion: "Puesta en servicio efectivo" }
                    ];
                } else {
                    // ⚠️ MANIOBRAS SIN CONSIGNACIÓN: 7 acciones (SIN COL PAT ni RET PAT)
                    console.log(`   ⚠️ Sin Consignación → Genera 7 acciones (sin COL PAT ni RET PAT)`);
                    aAccionesAutomaticas = [
                        { codigo: "SOL TEC", descripcion: "El técnico confirmará los trabajos al COT" },
                        { codigo: "AUT COC", descripcion: "El COC y agentes involucrados autorizan" },
                        { codigo: "INI MAN", descripcion: "Comienzo de maniobras - F/S Programado" },
                        { codigo: "FIN MAN", descripcion: "Finalización de maniobras - Entrega LT" },
                        { codigo: "FIN LT", descripcion: "El Técnico confirmará la finalización de los trabajos" },
                        { codigo: "MAN PES", descripcion: "El Técnico confirmará la normalización de la instalación - El COT comienza las maniobras para la PES" },
                        { codigo: "PES", descripcion: "Puesta en servicio efectivo" }
                    ];
                }

                // Verificar acciones existentes para este grupo
                const aAccionesExistentesGrupo = aAccionesExistentes.filter(accion => {
                    const sIdLicencia = accion.idLicencia || "";
                    const aIdsAccion = sIdLicencia.split(" / ").map(id => id.trim());
                    return aIdsAccion.some(id => aIdsGrupo.includes(id));
                });

                const aCodigosExistentes = aAccionesExistentesGrupo.map(a => a.accion);
                console.log(`   Acciones existentes: ${aCodigosExistentes.length} (${aCodigosExistentes.join(', ') || 'ninguna'})`);

                // Generar acciones faltantes
                aAccionesAutomaticas.forEach(accionDef => {
                    const sCodigo = accionDef.codigo;

                    if (aCodigosExistentes.includes(sCodigo)) {
                        console.log(`      ⏭️ ${sCodigo} ya existe`);
                        iAccionesOmitidas++;
                        return;
                    }

                    // Calcular horario automáticamente
                    const sTurnoBase = oLicenciaPrincipal.TurnoAsignado || "";

                    if (!sTurnoBase || sTurnoBase.trim() === "") {
                        console.log(`      ⚠️ ${sCodigo} - SIN turno asignado, omitiendo`);
                        iAccionesOmitidas++;
                        return;
                    }

                    const sTurnoCalculado = this._calcularHorarioAccion(sCodigo, oLicenciaPrincipal, sTurnoBase);

                    // Obtener descripción larga del catálogo
                    const sDescripcionLarga = this._getDescripcionDesdeCategologo(sCodigo);

                    // Crear nueva acción
                    const oNuevaAccion = {
                        accion: sCodigo,
                        descripcion: accionDef.descripcion,
                        descripcionLarga: sDescripcionLarga || accionDef.descripcion,
                        idLicencia: sIdsGrupo,
                        idLicenciaOriginal: oLicenciaPrincipal.Id,
                        equipo: oLicenciaPrincipal.Equnr || "",
                        equipoCompleto: oLicenciaPrincipal.EquipoCompleto || oLicenciaPrincipal.Equnr || "",
                        trabajoRealizar: sDescripcionLarga || accionDef.descripcion,
                        turnoEntrega: sTurnoCalculado,
                        estado: oLicenciaPrincipal.Licstat || "01",
                        condicion: oLicenciaPrincipal.Jobcond || "01",
                        equstat: oLicenciaPrincipal.Equstat || "A",
                        empresa: oLicenciaPrincipal.Empresa || "100",
                        tipo: oLicenciaPrincipal.Tipo || "L",
                        anio: oLicenciaPrincipal.Anio || new Date().getFullYear().toString(),
                        _licenciaId: oLicenciaPrincipal.Id,
                        _estadoGuardado: false,
                        _snapshotOriginal: {
                            turnoEntrega: sTurnoCalculado,
                            attachmentsCount: 0
                        },
                        Attachments: []
                    };

                    aAccionesExistentes.push(oNuevaAccion);
                    iAccionesGeneradas++;

                    console.log(`      ➕ ${sCodigo} generada - Turno: ${sTurnoCalculado}`);
                });

                console.log("");
            });

            // Ordenar acciones por grupo y hora
            const aAccionesOrdenadas = this._ordenarAccionesPorGrupoYHora(aAccionesExistentes);

            // Actualizar modelo
            oAccionesModel.setData(aAccionesOrdenadas);
            oAccionesModel.refresh();

            console.log("════════════════════════════════════════════");
            console.log("✅ RESULTADO:");
            console.log(`   Acciones generadas: ${iAccionesGeneradas}`);
            console.log(`   Acciones omitidas (ya existían): ${iAccionesOmitidas}`);
            console.log(`   Total acciones ahora: ${aAccionesOrdenadas.length}`);
            console.log("════════════════════════════════════════════\n");

            if (iAccionesGeneradas > 0) {
                MessageToast.show(`${iAccionesGeneradas} acciones generadas automáticamente`, {
                    duration: 3000
                });
            } else if (iAccionesOmitidas > 0) {
                MessageToast.show("Todas las acciones ya existen", {
                    duration: 2000
                });
            }
        },

        // ----------- LISTADO CRONOLOGICO CON ADJUNTOS Y COMENTARIOS ---------
        // ════════════════════════════════════════════════════════════════
        // SOLUCIÓN CORREGIDA: Los adjuntos ya están en las licencias
        // No se necesita consultar /CatalogoEntregaSet
        // ════════════════════════════════════════════════════════════════

        // 1️⃣ MARCAR LICENCIAS CON ADJUNTOS al crear el Listado Cronológico

        _marcarAdjuntosEnListadoCronologico: function () {
            const oView = this.getView();
            const oListCronoModel = oView.getModel("listCronoTreeModel");
            const oData = oListCronoModel.getData() || [];

            if (oData.length === 0) {
                console.log("⚠️ No hay datos en listado cronológico");
                return;
            }

            console.log("📎 Marcando licencias con adjuntos en Listado Cronológico...");

            let iTotalAdjuntos = 0;

            // Función recursiva para recorrer el árbol (post-order: hijos primero para que
            // el padre pueda leer los flags ya calculados de sus hijos)
            const marcarNodos = (aNodes) => {
                aNodes.forEach(node => {
                    // 1. Primero recursar para que los hijos ya tengan sus flags
                    if (node.children && node.children.length > 0) {
                        marcarNodos(node.children);
                    }

                    if (node._isGroup === false) {
                        // Es una licencia (nodo hijo) — marcar sus propios adjuntos
                        const aAdjuntos = node.AttachmentXLicencia_nav?.results ||
                            node.AttachmentXLicencia_nav ||
                            node.Attachments ||
                            [];

                        node._tieneAdjuntos = aAdjuntos.length > 0;
                        node._adjuntos = aAdjuntos;
                        node._cantidadAdjuntos = aAdjuntos.length;

                        if (aAdjuntos.length > 0) {
                            console.log(`      ✅ ${node.Id}: ${aAdjuntos.length} adjunto(s)`);
                            iTotalAdjuntos += aAdjuntos.length;
                        }
                    } else if (node._isGroup === true) {
                        // Es un grupo (nodo padre) — propagar flags desde los hijos
                        const aHijos = node.children || [];
                        node._tieneAdjuntosHijos = aHijos.some(h => h._tieneAdjuntos);
                        node._totalAdjuntosHijos = aHijos.reduce((acc, h) => acc + (h._cantidadAdjuntos || 0), 0);
                        node._tieneComentariosHijos = aHijos.some(h => h.Comentarios && h.Comentarios.trim() !== "");
                    }
                });
            };

            marcarNodos(oData);

            console.log(`   📎 Total de adjuntos en Listado Cronológico: ${iTotalAdjuntos}`);

            // Refrescar modelo
            oListCronoModel.refresh();
        },

        // 2️⃣ EVENTO del botón "Ver Adjuntos"

        onVerAdjuntosListadoCronologico: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("listCronoTreeModel");

            if (!oContext) {
                MessageToast.show("No se pudo obtener el contexto");
                return;
            }

            const oLicencia = oContext.getObject();

            // Obtener adjuntos
            const aAdjuntos = oLicencia.AttachmentXLicencia_nav?.results ||
                oLicencia.AttachmentXLicencia_nav ||
                oLicencia.Attachments ||
                [];

            if (aAdjuntos.length === 0) {
                MessageToast.show("No hay adjuntos para esta licencia");
                return;
            }

            console.log(`📎 Mostrando adjuntos para licencia: ${oLicencia.Id}`);
            console.log(`   Cantidad: ${aAdjuntos.length}`);

            // Crear modelo para el popup
            const oAdjuntosModel = new JSONModel({
                licenciaId: oLicencia.Id,
                equipo: oLicencia.Equnr || oLicencia.DescEquipo,
                fecha: this._getSelectedDateString(),
                adjuntos: aAdjuntos
            });

            // Crear o abrir popup
            if (!this._adjuntosListadoCronoDialog) {
                this._adjuntosListadoCronoDialog = sap.ui.xmlfragment(
                    "transener.sistemadeturnos.view.fragments.AdjuntosListadoCronologico",
                    this
                );
                this.getView().addDependent(this._adjuntosListadoCronoDialog);
            }

            this._adjuntosListadoCronoDialog.setModel(oAdjuntosModel, "adjuntosModel");
            this._adjuntosListadoCronoDialog.open();
        },

        // 3️⃣ CERRAR popup

        onCerrarAdjuntosListadoCrono: function () {
            if (this._adjuntosListadoCronoDialog) {
                this._adjuntosListadoCronoDialog.close();
            }
        },

        // 4️⃣ DESCARGAR adjunto

        onDescargarAdjuntoListadoCrono: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("adjuntosModel");

            if (!oContext) {
                MessageToast.show("No se pudo obtener el adjunto");
                return;
            }

            const oAdjunto = oContext.getObject();

            console.log(`📥 Descargando adjunto: ${oAdjunto.Filename || oAdjunto.AttachmentName || "archivo"}`);

            // Obtener datos del adjunto
            const sBase64 = oAdjunto.Attachment || oAdjunto.Content;
            const sFilename = oAdjunto.Filename || oAdjunto.AttachmentName || "adjunto";
            const sMimeType = oAdjunto.Mimetype || "application/octet-stream";

            if (!sBase64) {
                MessageToast.show("No se pudo obtener el contenido del archivo");
                return;
            }

            try {
                // Crear blob y descargar
                const byteCharacters = atob(sBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: sMimeType });

                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = sFilename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                MessageToast.show(`Descargando: ${sFilename}`);
            } catch (error) {
                console.error("Error al descargar:", error);
                MessageBox.error("Error al descargar el archivo");
            }
        },

        // 5️⃣ HELPER: Formatear tamaño de archivo (si no existe en formatter.js)

        formatFileSize: function (iBytes) {
            if (!iBytes || iBytes === 0) return "0 B";

            const k = 1024;
            const sizes = ["B", "KB", "MB", "GB"];
            const i = Math.floor(Math.log(iBytes) / Math.log(k));

            return Math.round(iBytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
        },

        // Handler del indicador de adjuntos en nodo padre — expande el grupo
        onAdjuntosParentFromTree: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("listCronoTreeModel");
            if (!oContext) { return; }
            this._expandTreeRowByContext("cronoTreeTable", "listCronoTreeModel", oContext);
        },

        // Abre un Popover con el listado de licencias al hacer click en el Link
        onMostrarLicenciasDetalle: function (oEvent) {
            const oSource = oEvent.getSource();

            // Intentar obtener idLicencia por binding context (tabla plana)
            let sIdLicencia = "";
            const oCtx = oSource.getBindingContext("AccionesEntregaModel")
                || oSource.getBindingContext("accionesTreeModel");
            if (oCtx) {
                sIdLicencia = oCtx.getProperty("idLicencia") || "";
            }

            // Fallback: customData (TreeTable donde el contexto puede no resolver)
            if (!sIdLicencia) {
                const oCD = oSource.getCustomData().find(function (cd) {
                    return cd.getKey() === "idLicencia";
                });
                if (oCD) { sIdLicencia = oCD.getValue() || ""; }
            }

            if (!sIdLicencia) { return; }

            const aIds = sIdLicencia.split(" / ").filter(Boolean);

            const aItems = aIds.map(function (sId) {
                return new sap.m.StandardListItem({ title: sId });
            });

            const oList = new sap.m.List({ items: aItems });

            if (!this._oLicenciasPopover) {
                this._oLicenciasPopover = new sap.m.Popover({
                    title: "Licencias",
                    contentWidth: "200px",
                    placement: sap.m.PlacementType.Auto
                });
                this._oLicenciasPopover.addStyleClass("licenciasPopover");
            }

            this._oLicenciasPopover.destroyContent();
            this._oLicenciasPopover.addContent(oList);
            this._oLicenciasPopover.openBy(oSource);
        },

        // Formatea el idLicencia (ej: "L01 / L02 / L03") como "3 LLTT"
        formatLicenciasCount: function (sIdLicencia) {
            if (!sIdLicencia) { return ""; }
            const n = sIdLicencia.split(" / ").filter(Boolean).length;
            return n + " LLTT";
        },

        // Formatea la fecha de inicio (Solbeg) como dd/MM/yyyy
        formatSolbeg: function (oDate) {
            if (!oDate) return "";
            var d = oDate instanceof Date ? oDate : new Date(oDate);
            if (isNaN(d)) return "";
            var day = String(d.getDate()).padStart(2, "0");
            var month = String(d.getMonth() + 1).padStart(2, "0");
            return day + "/" + month + "/" + d.getFullYear();
        },

        // Devuelve el idLicencia como lista separada por saltos de línea para tooltip
        formatLicenciasTooltip: function (sIdLicencia) {
            if (!sIdLicencia) { return ""; }
            return sIdLicencia.split(" / ").filter(Boolean).join("\n");
        },

        // Handler del indicador de adjuntos en nodo padre del árbol de acciones — expande el grupo
        onAdjuntosParentFromAccionesTree: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("accionesTreeModel");
            if (!oContext) { return; }
            this._expandTreeRowByContext("accionesCronoTreeTable", "accionesTreeModel", oContext);
        },

        // Handler del indicador de comentarios en nodo padre — expande el grupo
        onComentariosParentFromTree: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("listCronoTreeModel");
            if (!oContext) { return; }
            this._expandTreeRowByContext("cronoTreeTable", "listCronoTreeModel", oContext);
        },

        // Helper: expande la fila del TreeTable cuyo contexto coincide con oContext
        _expandTreeRowByContext: function (sTableId, sModelName, oContext) {
            const oTreeTable = this.byId(sTableId);
            if (!oTreeTable) { return; }
            const sPath = oContext.getPath();
            const aRows = oTreeTable.getRows();
            for (let i = 0; i < aRows.length; i++) {
                const oRowCtx = aRows[i].getBindingContext(sModelName);
                if (oRowCtx && oRowCtx.getPath() === sPath) {
                    oTreeTable.expand(aRows[i].getIndex());
                    return;
                }
            }
        },

        onViewAttachmentFromTree: function (oEvent) {
            const oButton = oEvent.getSource();
            const oTreeContext = oButton.getBindingContext("listCronoTreeModel");

            if (!oTreeContext) {
                MessageToast.show("No se pudo obtener el contexto");
                return;
            }

            const oNodeData = oTreeContext.getObject();

            // Buscar licencia en LicencesJsonModel
            const oLicencesModel = this.getView().getModel("LicencesJsonModel");
            const aLicencias = oLicencesModel.getData() || [];
            const oLicencia = aLicencias.find(lic => lic.Id === oNodeData.Id);

            if (!oLicencia) {
                MessageToast.show("No se encontró la licencia");
                return;
            }

            // Crear contexto para reutilizar onViewAttachment
            const sPath = "/" + aLicencias.indexOf(oLicencia);
            const oLicenciaContext = oLicencesModel.createBindingContext(sPath);

            const oFakeEvent = {
                getSource: () => ({
                    getBindingContext: () => oLicenciaContext
                })
            }

            // Reutilizar función existente
            this.onViewAttachment(oFakeEvent);
        },
        sendMailCammesa: function () {
            var oView = this.getView();
            var oComponent = this.getOwnerComponent();

            // Obtener datos del ReporteModel
            var oReporteModel = oView.getModel("ReporteModel");
            var aReporte = oReporteModel ? oReporteModel.getData() : [];

            if (!aReporte || aReporte.length === 0) {
                sap.m.MessageBox.warning("No hay datos de reporte para enviar.");
                return;
            }

            // Obtener fecha del turno
            var oDatePicker = this.byId("date");
            var oFecha = oDatePicker ? oDatePicker.getDateValue() : null;
            var sFecha = "";
            if (oFecha) {
                var oFormatter = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                sFecha = oFormatter.format(oFecha);
            }

            // Obtener rango horario del reporte
            var oDateRangeControl = this.byId("reporteDateRange");
            var sRangoHorario = oDateRangeControl ? oDateRangeControl.getText() : "";

            // Obtener totales desde la vista
            var oCountsModel = oView.getModel("countsModel");
            var oTotales = oCountsModel ? oCountsModel.getData() : {};

            // Destinatarios hardcodeados
            var aDestinatarios = [
                "guillermo27@gmail.com",
                "juan.adaro@altromondo.com.ar",
                "chiara.signori@altromondo.com.ar"
            ];

            // Aplanar filas del reporte como campos individuales (SAP WF no soporta arrays en templates)
            var oFilas = {};
            var iMaxFilas = 30;
            for (var i = 1; i <= iMaxFilas; i++) {
                if (i <= aReporte.length) {
                    var oItem = aReporte[i - 1];
                    oFilas["R" + i + "S"] = "";
                    oFilas["R" + i + "E"] = oItem.Equipo || "";
                    oFilas["R" + i + "H"] = oItem.Hora || "";
                    oFilas["R" + i + "T"] = oItem.TipoIntervencion || "";
                    oFilas["R" + i + "C"] = oItem.Comentarios || "";
                } else {
                    oFilas["R" + i + "S"] = "display:none";
                }
            }

            sap.m.MessageBox.confirm("Se enviará el resumen de maniobras a CAMMESA (" + aDestinatarios.length + " destinatarios). ¿Desea continuar?", {
                title: "Confirmar envío",
                onClose: function (oAction) {
                    if (oAction !== sap.m.MessageBox.Action.OK) {
                        return;
                    }

                    sap.ui.core.BusyIndicator.show(0);

                    MailService.getCSRFToken(oComponent).then(function (csrfToken) {
                        var aPromises = aDestinatarios.map(function (sDestinatario) {
                            var oData = {
                                Destinatario: sDestinatario,
                                Fecha: sFecha,
                                Filas: oFilas,
                                Totales: oTotales,
                                RangoHorario: sRangoHorario
                            };
                            return MailService.sendMailCammesa(oData, oComponent, csrfToken);
                        });

                        return Promise.all(aPromises);
                    }).then(function () {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageToast.show("Mail enviado a CAMMESA correctamente");
                    }).catch(function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        sap.m.MessageBox.error("Error al enviar mail a CAMMESA: " + oError.message);
                    });
                }.bind(this)
            });
        }

    });
});
