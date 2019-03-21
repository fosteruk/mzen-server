import { ServerApiConfigEndpointResponse } from './api-config';

export class ServerError extends Error
{
  constructor(data?)
  {
    super();
    data = typeof data == 'string' ? {message: data} : data;
    Object.assign(this, data);
    this.name = 'ServerError';
  }
}

export class ServerErrorInternal extends ServerError
{
  constructor(data?)
  {
    super(data);
    this.name = 'ServerErrorInternal';
  }
} // 500

export class ServerErrorBadRequest extends ServerError
{
  constructor(data?)
  {
    super(data);
    this.name = 'ServerErrorBadRequest';
  }
} // 400

export class ServerErrorUnauthorized extends ServerError
{
  constructor(data?)
  {
    super(data);
    this.name = 'ServerErrorUnauthorized';
  }
} // 401

export class ServerErrorForbidden extends ServerError
{
  constructor(data?)
  {
    super(data);
    this.name = 'ServerErrorForbidden';
  }
} // 403

export class ServerErrorNotFound extends ServerError
{
  constructor(data?)
  {
    super(data);
    this.name = 'ServerErrorNotFound';
  }
} // 404

export class ServerErrorMethodNotAllowed extends ServerError
{
  constructor(data?)
  {
    super(data);
    this.name = 'ServerErrorMethodNotAllowed';
  }
} // 405

export class ServerErrorTooManyRequests extends ServerError
{
  constructor(data?)
  {
    super(data);
    this.name = 'ServerErrorTooManyRequests';
  }
} // 429

export const serverErrorApiEndpointResponseConfig = {
  ServerErrorInternal: {http: {code: 500}},
  ServerErrorBadRequest: {http: {code: 400}},
  ServerErrorUnauthorized: {http: {code: 401}},
  ServerErrorForbidden: {http: {code: 403}},
  ServerErrorNotFound: {http: {code: 404}},
  ServerErrorMethodNotAllowed: {http: {code: 405}},
  ServerErrorTooManyRequests: {http: {code: 429}}
} as {[key: string]: ServerApiConfigEndpointResponse};

export default ServerError;
