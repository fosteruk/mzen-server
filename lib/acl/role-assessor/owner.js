'use strict'

var ServerAclRoleAssessor = require('../role-assessor');

class ServerAclRoleAssessorOwner extends ServerAclRoleAssessor
{
  constructor(role) 
  {
    super('owner');
  }
  hasRole(context) 
  {
    // This method returns an object of conditions
    // - that is, the user will only be considered to have the role if the returned conditions are met
    // - its down to the remote object to decide if the user meets the conditions or not
    // The acl role assessor 'authed' populates 'user' on to the context if the user was authed
    const user = context['user'] ? context['user'] : null;
    const result = user ? {userId: user['_id']} : false;
    return Promise.resolve(result);
  }
}

module.exports = ServerAclRoleAssessorOwner;
