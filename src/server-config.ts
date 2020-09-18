import {
  ModelManagerConfig 
} from 'mzen';

export interface ServerConfig
{
  path?: string;
  port?: number;
  appDir?: string;
  model?: ModelManagerConfig; 
  [key: string]: any; // Any custom config options
}

export default ServerConfig;
