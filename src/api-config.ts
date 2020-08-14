import { Schema } from 'mzen';

export interface ServerApiConfigEndpointData
{
  // if name is not specified defaults to srcPath
  name?: string; 
  srcPath?: string; 
  src?:
    'param'|'query'|'header'|'body'|'request'
    | 'response'|'aclContext'|'aclConditions'
    | string; 
  required?: boolean; 
  notNull?: boolean; 
  notEmpty?: boolean;
  defaultValue?: any;
  type?: any
}

export interface ServerApiConfigAclRule
{
  allow?: boolean;
  role?: string;
}

export interface ServerApiConfigAcl
{
  rules?: Array<ServerApiConfigAclRule>
}

export interface ServerApiConfigEndpointResponse
{
  http?: {
    code?: number, 
    contentType?: string
  };
  schema?: Schema;
}

export interface ServerApiConfigEndpoint
{
  path?: string;
  groups?: Array<'default'|'read'|'write'|string>;
  method?: string;
  verbs?: Array<'get'|'put'|'post'|'delete'|string>;
  bodyParser?: {
    json?: {enable?:boolean, limit?: string, type?: string},
    urlencoded?: {enable?:boolean, limit?: string, extended?: boolean, type?: string},
    text?: {enable?:boolean, limit?: string, type?: string},
    raw?: {enable?:boolean, limit?: string, type?: string},
  };
  data?: {[key: string]: ServerApiConfigEndpointData};
  acl?: ServerApiConfigAcl;
  priority?: number,
  response?: {
    success?: ServerApiConfigEndpointResponse,
    error?: {[key: string]: ServerApiConfigEndpointResponse}
  }
}

export interface ServerApiConfig
{
  object?: any;
  repo?: string;
  service?: string;
  enable?: boolean;
  path?: string|null;
  disable?: {[key: string]: boolean};
  disableGroup?: {default?: boolean, [key: string]: boolean};
  acl?: ServerApiConfigAcl;
  maxResults?: number;
  endpoints?: {[key: string]: ServerApiConfigEndpoint};
}

export default ServerApiConfig;
