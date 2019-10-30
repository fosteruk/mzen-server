import { Schema } from 'mzen';

export interface ServerApiConfigEndpointArg
{
  name?: string; // if name is not specified defaults to srcKey
  srcKey?: string; 
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
  args?: Array<ServerApiConfigEndpointArg> | {[key: string]: ServerApiConfigEndpointArg};
  acl?: ServerApiConfigAcl;
  priority?: number,
  response?: {
    success?: ServerApiConfigEndpointResponse,
    error?: {[key: string]: ServerApiConfigEndpointResponse}
  }
}

export interface ServerApiConfig
{
  enable?: boolean;
  path?: string|null;
  endpoint?: {
    disable?: {[key: string]: boolean},
    disableGroup?: {default?: boolean, [key: string]: boolean}
  };
  acl?: ServerApiConfigAcl;
  maxResults?: number;
  endpoints?: {[key: string]: ServerApiConfigEndpoint};
}

export default ServerApiConfig;
