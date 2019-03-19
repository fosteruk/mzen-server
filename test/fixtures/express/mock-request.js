"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ExpressMockRequest {
    constructor(config) {
        config = config ? config : {};
        this.query = config.query ? config.query : {};
        this.body = config.body ? config.body : {};
        this.params = config.params ? config.params : {};
        this.headers = config.headers ? config.headers : {};
    }
    get(key) {
        return this.headers[key];
    }
}
exports.ExpressMockRequest = ExpressMockRequest;
exports.default = ExpressMockRequest;
