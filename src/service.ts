import { Service, ServiceConfig } from 'mzen';
import ServerApiConfig from './api-config';

export interface ServerServiceConfig extends ServiceConfig
{
  api?: ServerApiConfig;
}

export class ServerService extends Service 
{
  constructor(options?: ServerServiceConfig)
  {
    super(options);
  }
}

export default ServerService;
