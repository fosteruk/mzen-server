import { Service, ServiceConfig } from 'mzen';
import ServerConfigApi from './config-api';

export interface ServerServiceConfig extends ServiceConfig
{
  api?: ServerConfigApi;
}

export class ServerService extends Service 
{
  constructor(options?: ServerServiceConfig)
  {
    super(options);
  }
}

export default ServerService;
