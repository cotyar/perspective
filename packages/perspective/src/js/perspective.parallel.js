/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {ScriptPath, detectNode} from "./utils.js";

import {TYPE_AGGREGATES, AGGREGATE_DEFAULTS, TYPE_FILTERS, FILTER_DEFAULTS, SORT_ORDERS} from "./defaults.js";

import {worker} from "./api.js";

var __SCRIPT_PATH__ = new ScriptPath();
__webpack_public_path__ = __SCRIPT_PATH__.path();

import wasm_worker from "./perspective.wasm.js";
import asmjs_worker from "./perspective.asmjs.js";

/******************************************************************************
 *
 * Utilities
 *
 */


// https://github.com/kripken/emscripten/issues/6042
function detect_iphone() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

class WebWorker extends worker {
    constructor() {
        super();
        let w;
        if (typeof WebAssembly === "undefined" || detect_iphone()) {
            w = new asmjs_worker();
        } else {
            w = new wasm_worker();
        }
        for (var key in this._worker) {
            w[key] = this._worker[key];
        }
        this._worker = w;
        this._worker.addEventListener("message", this._handle.bind(this));
        this._worker.postMessage({cmd: "init", path: __SCRIPT_PATH__.path()});
        this._detect_transferable();
    }

    send(msg) {
        if (this._worker.transferable && msg.args && msg.args[0] instanceof ArrayBuffer) {
            this._worker.postMessage(msg, msg.args);
        } else {
            this._worker.postMessage(msg);
        }
    }

    terminate() {
        this._worker.terminate();
        this._worker = undefined;
    }

    _detect_transferable() {
        var ab = new ArrayBuffer(1);
        this._worker.postMessage(ab, [ab]);
        this._worker.transferable = ab.byteLength === 0;
        if (!this._worker.transferable) {
            console.warn("Transferable support not detected");
        } else {
            console.log("Transferable support detected");
        }
    }
}

class WebSocketWorker extends worker {
    constructor(url) {
        super();
        this._ws = new WebSocket(url);
        this._ws.onopen = () => {
            this.send({id: -1, cmd: "init"});
        };
        this._ws.onmessage = msg => {
            this._handle({data: JSON.parse(msg.data)});
        };
    }

    send(msg) {
        this._ws.send(JSON.stringify(msg));
    }

    terminate() {
        this._ws.close();
    }
}

let mod;

if (detectNode()) {
    // eslint-disable-next-line no-undef
    mod = eval(`require("./perspective.node.js")`);
} else {
    mod = {
        worker: function(url) {
            if (url) {
                return new WebSocketWorker(url);
            } else {
                return new WebWorker();
            }
        },

        TYPE_AGGREGATES: TYPE_AGGREGATES,

        TYPE_FILTERS: TYPE_FILTERS,

        AGGREGATE_DEFAULTS: AGGREGATE_DEFAULTS,

        FILTER_DEFAULTS: FILTER_DEFAULTS,

        SORT_ORDERS: SORT_ORDERS
    };
}

for (let prop of Object.keys(mod)) {
    exports[prop] = mod[prop];
}
