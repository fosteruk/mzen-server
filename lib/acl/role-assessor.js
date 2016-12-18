'use strict'

class ServerAclRoleAssessor
{
  constructor(role) 
  {
    this.role = role ? role : '';
    this.repos = {};
  }
  hasRole(user, context) 
  {
    return Promise.resolve(true);
  }
}

module.exports = ServerAclRoleAssessor;
