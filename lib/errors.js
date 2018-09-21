'use strict'

class ErrorServer extends Error
{
  constructor(data)
  {
    super();
    data = typeof data == 'string' ? {message: data} : data;
    Object.assign(this, data);
    this.name = 'ErrorServer';
  }
}

class ErrorInternalServer extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorInternalServer';
  }
} // 500

class ErrorBadRequest extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorBadRequest';
  }
} // 400

class ErrorUnauthorized extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorUnauthorized';
  }
} // 401

class ErrorForbidden extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorForbidden';
  }
} // 403

class ErrorNotFound extends ErrorServer
{
  constructor(data)
  {
    this.name = 'ErrorNotFound';
  }
} // 404

class ErrorMethodNotAllowed extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorMethodNotAllowed';
  }
} // 405

class ErrorTooManyRequests extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorTooManyRequests';
  }
} // 429

module.exports = {
  ErrorInternalServer,
  ErrorBadRequest,
  ErrorUnauthorized,
  ErrorForbidden,
  ErrorNotFound,
  ErrorMethodNotAllowed,
  ErrorTooManyRequests
};

module.exports.endpoints = {
  ErrorInternalServer: {http: {code: 500}},
  ErrorBadRequest: {http: {code: 400}},
  ErrorUnauthorized: {http: {code: 401}},
  ErrorForbidden: {http: {code: 403}},
  ErrorNotFound: {http: {code: 404}},
  ErrorMethodNotAllowed: {http: {code: 405}},
  ErrorTooManyRequests: {http: {code: 429}}
};
