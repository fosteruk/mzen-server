'use strict'
var { Repo } = require('mzen');
var clone = require('clone');
var bcrypt = require('bcrypt');
var crypto = require('crypto');

class RepoUser extends Repo
{
  constructor(options = {})
  {
    super({
      name: 'user',
      schema: {
        _id: {$type: 'ObjectID', $validate: {required: true}},
        email: {$type: String, $validate: {required: true}},
        password: {$type: String, $validate: {required: true}, $filter: {private: 'read'}},
        accessToken: [{accessToken: String, ttl: Number, created: Date, expires: Date}],
        created: {$type: Date, $filter: {defaultValue: 'now'}}
      },
      api: {
        disableEndpointGroups: {read: true}
      }
    });
  }
}

module.exports = RepoUser;
