export class ServerAclRoleAssessor 
{
  role:string;
  repos:{[key: string]: any};
  priority:number;
  
  constructor(role?)
  {
    this.role = role ? role : '';
    this.repos = {};
    this.priority = 0;
  }
  
  // @ts-ignore - 'request' is declared but its value is never read
  async initContext(request, context?): Promise<any>
  {
  }
  
  // @ts-ignore - 'user' is declared but its value is never read. 
  async hasRole(context): Promise<any | boolean>
  {
    return Promise.resolve(true);
  }
  
  setRepos(repos)
  {
    this.repos = repos;
  }
}

export default ServerAclRoleAssessor;
