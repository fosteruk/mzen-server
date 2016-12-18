'use strict'

class ExpressMockResponse
{ 
  construct()
  {
    this.data = 'test';
    this.code = 200;
  }
  json(data)
  {
    this.send(data);
    return this;
  };
  send(data)
  {
    this.data = data;
    return this;
  }
  status(code)
  {
    this.code = code;
    return this;
  }
}

module.exports = ExpressMockResponse;
