sap.ui.define([
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (MessageBox, MessageToast) {
    "use strict";

    return {
      
        sendLicenseEmail: function (oLicencia, oComponent, csrfToken, onTokenExpired) {
            if (!oLicencia || !oComponent) {
                return Promise.reject(new Error("Datos de licencia o componente faltantes"));
            }

            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);

            // Si ya tenemos el token, usarlo directamente. Si no, obtenerlo
            const tokenPromise = csrfToken 
                ? Promise.resolve(csrfToken)
                : this._fetchCSRFToken(sBaseURL);

            return tokenPromise.then((token) => {
                const sPostURL = sBaseURL + "/workflow-instances";
                const asunto = "Turno de maniobra - COT | " + oLicencia.Equnr + " " + oLicencia.Equstat + " Licencia: " + oLicencia.Id + " / " + oLicencia.Anio
                const context = {
                    Asunto: asunto,
                    society: oLicencia.society,
                    Destinatario: oLicencia.Destinatario || oLicencia.Email || "",
                    IdLicencia: oLicencia.Id || "",
                    Equipo: oLicencia.Equnr || "",
                    EstadoEquipo: oLicencia.Equstat || "",
                    CondTrabajo: oLicencia.Jobcond || "",
                    FechaTurno: oLicencia.Fecha,
                    Turno: oLicencia.Turno || oLicencia.TurnoAsignado || "",
                    Comentarios: oLicencia.Comments || "",
                    DescripcionEquipo: oLicencia.DescEquipo || "",
                    Consola: oLicencia.Consola || "",
                    // INI MOD TRNS #TT-390
                    // Period: oLicencia.Period
                    Period: oLicencia.Period,
                    // Empresas que tramitan la licencia, mismo formato que el mail de LLTT
                    empresasTextoPlano: oLicencia.empresasTextoPlano || ""
                    // FIN MOD TRNS #TT-390
                };

                const data = {
                    definitionId: "transener.wfturnos",
                    context: context
                };

                return new Promise((resolve, reject) => {
                    jQuery.ajax({
                        url: sPostURL,
                        method: "POST",
                        contentType: "application/json",
                        timeout: 60000,
                        headers: {
                            "X-CSRF-Token": token
                        },
                        data: JSON.stringify(data),
                        success: function (result) {
                            resolve(result);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            let errorMessage = "Error al enviar mail";
                            let isTokenExpired = false;
                            
                          
                            if (jqXHR) {
                             
                                if (jqXHR.status === 403) {
                                    isTokenExpired = true;
                                }
                                
                                if (jqXHR.responseText) {
                                    try {
                                        const errorResponse = JSON.parse(jqXHR.responseText);
                                        errorMessage = errorResponse.error?.message ||
                                            errorResponse.message ||
                                            errorMessage;
                                        
                                        // Verificar mensajes específicos de token expirado
                                        const errorText = errorMessage.toLowerCase();
                                        if (errorText.includes("csrf") || 
                                            errorText.includes("token") || 
                                            errorText.includes("expired") ||
                                            errorText.includes("invalid")) {
                                            isTokenExpired = true;
                                        }
                                    } catch (e) {
                                        errorMessage = errorThrown || textStatus || errorMessage;
                                    }
                                }
                            }
                            
                            const error = new Error(errorMessage);
                            error.isTokenExpired = isTokenExpired;
                            error.statusCode = jqXHR ? jqXHR.status : null;
                            
                          
                            if (isTokenExpired && onTokenExpired && typeof onTokenExpired === 'function') {
                                onTokenExpired()
                                    .then((newToken) => {
                                     
                                        return this.sendLicenseEmail(oLicencia, oComponent, newToken);
                                    })
                                    .then(resolve)
                                    .catch(reject);
                            } else {
                                reject(error);
                            }
                        }
                    });
                });
            });
        },

     
        sendMultipleLicenseEmails: function (aLicencias, oComponent) {
            if (!aLicencias || !Array.isArray(aLicencias) || aLicencias.length === 0) {
                return Promise.reject(new Error("Se requiere un array de licencias válido"));
            }

            if (!oComponent) {
                return Promise.reject(new Error("Componente faltante"));
            }

            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);

            // Obtener el token CSRF una sola vez
            return this._fetchCSRFToken(sBaseURL)
                .then((csrfToken) => {
                    console.log("✅ Token CSRF obtenido, reutilizando para", aLicencias.length, "envíos");

                    // Enviar todos los mails usando el mismo token
                    const aPromises = aLicencias.map((oLicencia) => {
                        return this.sendLicenseEmail(oLicencia, oComponent, csrfToken)
                            .then((result) => {
                                return {
                                    success: true,
                                    licenciaId: oLicencia.Id || "N/A",
                                    result: result
                                };
                            })
                            .catch((error) => {
                                return {
                                    success: false,
                                    licenciaId: oLicencia.Id || "N/A",
                                    error: error
                                };
                            });
                    });

                    return Promise.all(aPromises);
                });
        },

        getWorkflowRuntimeBaseURL: function (oComponent) {
            return this._getWorkflowRuntimeBaseURL(oComponent);
        },

        getCSRFToken: function (oComponent) {
            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);
            return this._fetchCSRFToken(sBaseURL);
        },

        _getWorkflowRuntimeBaseURL: function (oComponent) {
            const appId = oComponent.getManifestEntry("/sap.app/id");
            const appPath = appId.replaceAll(".", "/");
            // INI MOD TRNS #TT-390
            // Igual que LLTT (MailHelper._getWorkflowRuntimeBaseURL): el path del módulo tal cual.
            // Con destinations a nivel subcuenta el path ya no trae el prefijo "<GUID>." y el
            // fallback a window.location.pathname daría la URL del site de Work Zone.
            // let appModulePath = jQuery.sap.getModulePath(appPath);
            //
            // const uuidWithDotPattern = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([^\/]+.*)/;
            // const match = appModulePath.match(uuidWithDotPattern);
            //
            // if (match && match[2]) {
            //     appModulePath = "/" + match[2];
            // } else {
            //     const currentPath = window.location.pathname;
            //     const pathMatch = currentPath.match(/\/(?:[0-9a-f-]+\.)?([^\/]+.*)/);
            //     if (pathMatch && pathMatch[1]) {
            //         appModulePath = "/" + pathMatch[1];
            //     }
            // }
            //
            // if (!appModulePath.startsWith("/")) {
            //     appModulePath = "/" + appModulePath;
            // }
            //
            // return appModulePath + "/bpmworkflowruntime/v1";
            const appModulePath = jQuery.sap.getModulePath(appPath);

            return appModulePath + "/bpmworkflowruntime/v1";
            // FIN MOD TRNS #TT-390
        },

        sendMailCammesa: function (oData, oComponent, csrfToken, onTokenExpired) {
            if (!oData || !oComponent) {
                return Promise.reject(new Error("Datos o componente faltantes"));
            }

            const sBaseURL = this._getWorkflowRuntimeBaseURL(oComponent);

            const tokenPromise = csrfToken
                ? Promise.resolve(csrfToken)
                : this._fetchCSRFToken(sBaseURL);

            return tokenPromise.then((token) => {
                const sPostURL = sBaseURL + "/workflow-instances";
                const context = Object.assign({
                    isCammesa: true,
                    // INI MOD TRNS #TT-390
                    // Asunto: "Resumen de Maniobras CAMMESA | " + oData.Fecha,
                    Asunto: "Maniobras " + oData.Fecha,
                    // La plantilla arma el encabezado con header-${context.society}-short.jpg
                    society: oData.society || "",
                    // "Total de Maniobras: ${context.TotalManiobras}" en la plantilla, como la pantalla Resumen
                    TotalManiobras: oData.TotalManiobras || 0,
                    // FIN MOD TRNS #TT-390
                    Destinatario: oData.Destinatario || "",
                    Fecha: oData.Fecha || "",
                    Totales: oData.Totales || {},
                    RangoHorario: oData.RangoHorario || ""
                }, oData.Filas || {});

                const data = {
                    definitionId: "transener.wfturnos",
                    context: context
                };

                return new Promise((resolve, reject) => {
                    jQuery.ajax({
                        url: sPostURL,
                        method: "POST",
                        contentType: "application/json",
                        timeout: 60000,
                        headers: {
                            "X-CSRF-Token": token
                        },
                        data: JSON.stringify(data),
                        success: function (result) {
                            resolve(result);
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            let errorMessage = "Error al enviar mail Cammesa";
                            let isTokenExpired = false;

                            if (jqXHR) {
                                if (jqXHR.status === 403) {
                                    isTokenExpired = true;
                                }
                                if (jqXHR.responseText) {
                                    try {
                                        const errorResponse = JSON.parse(jqXHR.responseText);
                                        errorMessage = errorResponse.error?.message ||
                                            errorResponse.message ||
                                            errorMessage;
                                        const errorText = errorMessage.toLowerCase();
                                        if (errorText.includes("csrf") ||
                                            errorText.includes("token") ||
                                            errorText.includes("expired") ||
                                            errorText.includes("invalid")) {
                                            isTokenExpired = true;
                                        }
                                    } catch (e) {
                                        errorMessage = errorThrown || textStatus || errorMessage;
                                    }
                                }
                            }

                            const error = new Error(errorMessage);
                            error.isTokenExpired = isTokenExpired;
                            error.statusCode = jqXHR ? jqXHR.status : null;

                            if (isTokenExpired && onTokenExpired && typeof onTokenExpired === 'function') {
                                onTokenExpired()
                                    .then((newToken) => {
                                        return this.sendMailCammesa(oData, oComponent, newToken);
                                    })
                                    .then(resolve)
                                    .catch(reject);
                            } else {
                                reject(error);
                            }
                        }
                    });
                });
            });
        },

        _fetchCSRFToken: function (sBaseURL) {
            const sURL = sBaseURL + "/xsrf-token";

            return new Promise((resolve, reject) => {
                jQuery.ajax({
                    url: sURL,
                    method: "GET",
                    timeout: 30000,
                    headers: {
                        "X-CSRF-Token": "Fetch"
                    },
                    success: function (data, textStatus, jqXHR) {
                        const csrfToken = jqXHR.getResponseHeader("X-CSRF-Token");
                        if (csrfToken) {
                            resolve(csrfToken);
                        } else {
                            reject(new Error("No se pudo obtener el token CSRF"));
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        reject(new Error("Error al obtener token CSRF: " + (errorThrown || textStatus)));
                    }
                });
            });
        }
    };
});
