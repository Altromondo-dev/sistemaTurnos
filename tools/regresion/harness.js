// Carga el código REAL de la app en Node stubbeando sap.ui.define.
//
// No es parte de la app: vive fuera de sistemadeturnos/webapp/, así que
// ni `ui5 build` ni el build de la MTA lo toman. Ver README.md.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.resolve(__dirname, "..", "..", "sistemadeturnos", "webapp");

const cache = {};

function stubFor(dep) {
    // Dependencias sap.* => objeto laxo
    const handler = {
        get(t, k) {
            if (k === "extend") return (name, obj) => obj;
            if (k === Symbol.toPrimitive || k === "toString") return () => "stub";
            if (!(k in t)) t[k] = new Proxy(function () { }, handler);
            return t[k];
        },
        apply() { return new Proxy(function () { }, handler); }
    };
    return new Proxy(function () { }, handler);
}

function loadModule(depName) {
    if (cache[depName]) return cache[depName];

    const local = depName.replace("transener/sistemadeturnos/", "");
    const file = path.join(APP, local + ".js");
    if (!fs.existsSync(file)) {
        return (cache[depName] = stubFor(depName));
    }

    const src = fs.readFileSync(file, "utf8");
    let result;
    const sandbox = {
        console,
        Date, Math, JSON, Object, Array, String, Number, Boolean, Promise, Map, Set, RegExp, Error, isNaN, parseInt, parseFloat,
        jQuery: stubFor("jQuery"),
        window: {},
        document: { createElement: () => ({ style: {}, appendChild() { }, getBoundingClientRect: () => ({}) }) },
        XLSX: undefined,
        sap: {
            ui: {
                define: function (deps, factory) {
                    if (typeof deps === "function") { result = deps(); return; }
                    result = factory.apply(null, deps.map(loadModule));
                },
                require: () => { },
                getCore: () => stubFor("core")
            }
        }
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: file });
    return (cache[depName] = result);
}

module.exports = { loadModule, APP };
