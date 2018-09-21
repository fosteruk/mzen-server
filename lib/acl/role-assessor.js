'use strict'

class ServerAclRoleAssessor
{
  constructor(role)
  {
    this.role = role ? role : '';
    this.repos = {};
  }
  async initContext(request, context)
  {
  }
  async hasRole(user, context)
  {
  }
  setRepos(repos)
  {
    this.repos = repos;
  }
}

module.exports = ServerAclRoleAssessor;
