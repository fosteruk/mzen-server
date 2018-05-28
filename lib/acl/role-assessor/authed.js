'use strict'
var ServerAclRoleAssessor = require('../role-assessor');

class ServerAclRoleAssessorAuthed extends ServerAclRoleAssessor
{
  constructor(role)
  {
    super('authed');
  }
  initContext(request, context)
  {
    var result = Promise.resolve();
    var accessToken = request.get('Authorization');
    if (accessToken) {
      result = this.repos['user'].findOne({
        'accessToken.accessToken': accessToken,
        'accessToken.expires': {$gt: new Date}
      }).then((user) => {
        if (user) {
          context['user'] = user;
        }
      });
    }
    return result;
  }
  async hasRole(context)
  {
    var user = context.user ? context.user : {};
    return (user._id != undefined);
  }
}

module.exports = ServerAclRoleAssessorAuthed;
