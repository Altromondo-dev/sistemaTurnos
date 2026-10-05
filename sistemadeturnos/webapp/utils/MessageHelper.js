// INI MOD TRNS #SistemaDeTurno-6
sap.ui.define([
    "sap/m/MessageToast"
], function (MessageToast) {
    "use strict";

    // Por defecto los toasts salen arriba al centro, más anchos y durante más tiempo,
    // para que no se confundan con el footer azul de la página
    const DEFAULT_OPTIONS = {
        my: "center top",
        at: "center top",
        of: window,
        offset: "0 50",
        width: "25em",
        duration: 5000
    };

    return {
        show: function (sMessage, mOptions) {
            MessageToast.show(sMessage, Object.assign({}, DEFAULT_OPTIONS, mOptions));
        }
    };
});
// FIN MOD TRNS #SistemaDeTurno-6
