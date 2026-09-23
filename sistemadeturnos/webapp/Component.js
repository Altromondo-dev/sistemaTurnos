/**
 * eslint-disable @sap/ui5-jsdocs/no-jsdoc
 */

sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/Device",
        "transener/sistemadeturnos/model/models",
        "transener/sistemadeturnos/utils/SessionTimeoutHelper"
    ],
    function (UIComponent, Device, models, SessionTimeoutHelper) {
        "use strict";

        return UIComponent.extend("transener.sistemadeturnos.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");

                // aviso de expiración de sesión por inactividad
                SessionTimeoutHelper.start(this);
            },

            exit: function () {
                SessionTimeoutHelper.stop();
            }
        });
    }
);