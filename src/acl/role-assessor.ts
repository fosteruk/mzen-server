export class ServerAclRoleAssessor 
{
  role: string;
  repos: {[key: string]: any};
  
  constructor(role?)
  {
    this.role = role ? role : '';
    this.repos = {};
  }
  
  // @ts-ignore - 'request' is declared but its value is never read
  async initContext(request, context?)
  {
  }
  
  // @ts-ignore - 'user' is declared but its value is never read. 
  async hasRole(user, context?)
  {
  }
  
  setRepos(repos)
  {
    this.repos = repos;
  }
}

export default ServerAclRoleAssessor;
