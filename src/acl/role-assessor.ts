export class ServerAclRoleAssessor 
{
  role:string;
  repos:{[key:string]:any};
  priority:number;
  
  constructor(role?)
  {
    this.role = role ? role : '';
    this.repos = {};
    this.priority = 0;
  }
  
  async initContext(_request, _context?, _remoteObject?):Promise<any>
  {
  }
  
  async hasRole(_context):Promise<any|boolean>
  {
    return Promise.resolve(true);
  }
  
  setRepos(repos)
  {
    this.repos = repos;
  }
}

export default ServerAclRoleAssessor;
