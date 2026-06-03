/*
 * Minimal CSInterface shim — enough to run ExtendScript from a CEP panel.
 * The full Adobe CSInterface.js is ~1000 lines; this panel only needs
 * evalScript + getHostEnvironment, both backed by the __adobe_cep__ global
 * that CEP injects into the panel's page.
 */
function CSInterface() {}

CSInterface.prototype.evalScript = function (script, callback) {
    if (callback === null || callback === undefined) {
        callback = function () {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getHostEnvironment = function () {
    return JSON.parse(window.__adobe_cep__.getHostEnvironment());
};

CSInterface.prototype.getApplicationID = function () {
    return this.getHostEnvironment().appId;
};
