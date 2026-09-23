sap.ui.define([
    "sap/m/MessageBox"
], function (
    MessageBox
) {
    "use strict";

    // Work Zone cierra la sesión a los 20 minutos de inactividad (Opciones del sitio).
    // Se avisa al usuario 5 minutos antes para que guarde o continúe trabajando.
    const WARNING_AFTER_MS = 15 * 60 * 1000;

    // Solo interacciones explícitas reinician el contador: es preferible avisar
    // de más que tarde si Work Zone no registra algún tipo de actividad.
    const ACTIVITY_EVENTS = ["pointerdown", "keydown"];

    return {

        _oComponent: null,
        _iTimer: null,
        _bWarningOpen: false,
        _fnOnActivity: null,

        start: function (oComponent) {
            this._oComponent = oComponent;
            this._fnOnActivity = this._onActivity.bind(this);

            ACTIVITY_EVENTS.forEach((sEvent) => {
                document.addEventListener(sEvent, this._fnOnActivity, true);
            });

            this._resetTimer();
        },

        stop: function () {
            clearTimeout(this._iTimer);
            if (this._fnOnActivity) {
                ACTIVITY_EVENTS.forEach((sEvent) => {
                    document.removeEventListener(sEvent, this._fnOnActivity, true);
                });
            }
        },

        _onActivity: function () {
            // Mientras el aviso está abierto, solo el botón del aviso reinicia el contador
            if (this._bWarningOpen) {
                return;
            }
            this._resetTimer();
        },

        _resetTimer: function () {
            clearTimeout(this._iTimer);
            this._iTimer = setTimeout(this._showWarning.bind(this), WARNING_AFTER_MS);
        },

        _showWarning: function () {
            const oResourceBundle = this._oComponent.getModel("i18n").getResourceBundle();
            const sContinuar = oResourceBundle.getText("sessionWarningContinue");

            this._bWarningOpen = true;

            MessageBox.warning(oResourceBundle.getText("sessionWarningText"), {
                title: oResourceBundle.getText("sessionWarningTitle"),
                actions: [sContinuar],
                emphasizedAction: sContinuar,
                styleClass: "sapUiSizeCompact",
                onClose: () => {
                    this._bWarningOpen = false;
                    this._keepAlive();
                    this._resetTimer();
                }
            });
        },

        // Hace una petición liviana al backend para mantener viva la sesión del approuter
        _keepAlive: function () {
            const oModel = this._oComponent.getModel();
            if (oModel && oModel.refreshSecurityToken) {
                oModel.refreshSecurityToken(null, null, true);
            }
        }
    };
});
