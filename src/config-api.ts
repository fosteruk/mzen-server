import { Schema } from 'mzen';

export interface ServerConfigApiEndpointArg
{
  srcKey?: string; 
  src?: string; 
  required?: boolean; 
  notNull?: boolean; 
  notEmpty?: boolean;
  defaultValue?: any;
}

export interface ServerConfigApiAclRule
{
  allow?: boolean;
  role?: string;
}

export interface ServerConfigApiAcl
{
  rules?: Array<ServerConfigApiAclRule>
}

export interface ServerConfigApiEndpointResponse
{
  http?: {
    code?: number, 
    contentType?: string
  };
}

export interface ServerConfigApiEndpointResponseError extends ServerConfigApiEndpointResponse
{
  schema?: Schema
}

export interface ServerConfigApiEndpoint
{
  path?: string;
  method?: string;
  verbs?: Array<string>;
  args?: Array<ServerConfigApiEndpointArg>;
  acl?: ServerConfigApiAcl;
  priority?: number,
  response?: {
    success?: ServerConfigApiEndpointResponse,
    error?: {[key: string]: ServerConfigApiEndpointResponseError}
  }
}

export interface ServerConfigApi
{
  enable?: boolean;
  endpointGroupsDisable?: {default?: boolean, [key: string]: boolean};
  acl?: ServerConfigApiAcl;
  endpoints?: {[key: string]: ServerConfigApiEndpoint};
  maxResults?: number;
}

export default ServerConfigApi;
