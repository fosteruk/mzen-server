'use strict'

class ServerAclRoleAssessor
{
  constructor(role) 
  {
    this.role = role ? role : '';
  }
  initContext(request, context)
  {
    return Promise.resolve();
  }
  hasRole(user, context) 
  {
    return Promise.resolve(true);
  }
  setRepos(repos)
  {
    this.repos = repos;
  }
}

module.exports = ServerAclRoleAssessor;
