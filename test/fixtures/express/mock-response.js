"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ExpressMockResponse {
    construct() {
        this.mockData = null;
        this.mockCode = 200;
    }
    json(data) {
        this.send(data);
        return this;
    }
    ;
    send(data) {
        this.mockData = data;
        return this;
    }
    status(code) {
        this.mockCode = code;
        return this;
    }
}
exports.ExpressMockResponse = ExpressMockResponse;
exports.default = ExpressMockResponse;
