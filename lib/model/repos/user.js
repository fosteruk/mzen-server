'use strict'
var clone = require('clone');
var Repo = require('mzen/lib/repo');
var Schema = require('mzen/lib/schema');
var bcrypt = require('bcrypt');
var crypto = require('crypto');

class ErrorNotFound extends Error {}
class ErrorInvalid extends Error {}


class RepoUser extends Repo
{
  constructor(options = {}) 
  {
    super({
      name: 'user',
      schema: {
        _id: {$type: Schema.types.ObjectID, $validate: {required: true}},
        email: {$type: String, $validate: {required: true}},
        password: {$type: String, $validate: {required: true}},
        accessToken: {accessToken: String, ttl: Number, created: Date, expires: Date},
        created: {$type: Date, $filter: {defaultValue: 'now'}}
      }
    });
  }
}

module.exports = RepoUser;
