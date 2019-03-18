export class ErrorServer extends Error
{
  constructor(data)
  {
    super();
    data = typeof data == 'string' ? {message: data} : data;
    Object.assign(this, data);
    this.name = 'ErrorServer';
  }
}

export class ErrorInternalServer extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorInternalServer';
  }
} // 500

export class ErrorBadRequest extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorBadRequest';
  }
} // 400

export class ErrorUnauthorized extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorUnauthorized';
  }
} // 401

export class ErrorForbidden extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorForbidden';
  }
} // 403

export class ErrorNotFound extends ErrorServer
{
  constructor(data)
  {
    this.name = 'ErrorNotFound';
  }
} // 404

export class ErrorMethodNotAllowed extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorMethodNotAllowed';
  }
} // 405

export class ErrorTooManyRequests extends ErrorServer
{
  constructor(data)
  {
    super(data);
    this.name = 'ErrorTooManyRequests';
  }
} // 429

export var endpoints = {
  ErrorInternalServer: {http: {code: 500}},
  ErrorBadRequest: {http: {code: 400}},
  ErrorUnauthorized: {http: {code: 401}},
  ErrorForbidden: {http: {code: 403}},
  ErrorNotFound: {http: {code: 404}},
  ErrorMethodNotAllowed: {http: {code: 405}},
  ErrorTooManyRequests: {http: {code: 429}}
};

var errors = {
  ErrorInternalServer,
  ErrorBadRequest,
  ErrorUnauthorized,
  ErrorForbidden,
  ErrorNotFound,
  ErrorMethodNotAllowed,
  ErrorTooManyRequests
};
export default errors;
