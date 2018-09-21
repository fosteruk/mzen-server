'use strict'
var ServerAclRoleAssessor = require('../role-assessor');

class ServerAclRoleAssessorAuthed extends ServerAclRoleAssessor
{
  constructor(role)
  {
    super('authed');
  }
  async initContext(request, context)
  {
    // we must overwrite any initial context value since context is initialised from request args
    // - which could potentially be used to inject invalid ACL context
    var user = context.user ? context.user : {};
    var accessToken = request.get('Authorization');
    if (accessToken) {
      try {
        var userFound = await this.repos.user.findOne({
          'accessToken.accessToken': accessToken,
          'accessToken.expires': {$gt: new Date}
        });
        if (userFound) user = userFound;
      } catch (error) {
        user = {};
        throw error;
      }
    }
    context.user = user;
  }
  async hasRole(context)
  {
    var user = context.user ? context.user : {};
    return (user._id != undefined);
  }
}

module.exports = ServerAclRoleAssessorAuthed;
