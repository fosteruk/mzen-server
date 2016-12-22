'use strict'

var Repo = require('mzen/lib/repo');
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
      }).then(function(user){
        if (user) {
          context['user'] = user;
        }
      });
    }
    return result;
  }
  hasRole(context) 
  {
    var user = context['user'] ? context['user'] : {};
    return Promise.resolve(user['_id'] != undefined);
  }
}

module.exports = ServerAclRoleAssessorAuthed;
