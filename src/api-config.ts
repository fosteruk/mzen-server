import { Schema } from 'mzen';

export interface ServerApiConfigEndpointArg
{
  srcKey?: string; 
  src?: string; 
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
  groups?: Array<string>;
  method?: string;
  verbs?: Array<string>;
  args?: Array<ServerApiConfigEndpointArg>;
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
  endpointsDisable?: {[key: string]: boolean};
  endpointGroupsDisable?: {default?: boolean, [key: string]: boolean};
  acl?: ServerApiConfigAcl;
  endpoints?: {[key: string]: ServerApiConfigEndpoint};
  maxResults?: number;
}

export default ServerApiConfig;
