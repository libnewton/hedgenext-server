'use strict'

const Router = require('express').Router
const passport = require('passport')
const { Strategy, InternalOAuthError } = require('passport-oauth2')
const config = require('../../../config')
const logger = require('../../../logger')
const { passportGeneralCallback } = require('../utils')

const oauth2Auth = module.exports = Router()

class OAuth2CustomStrategy extends Strategy {
  constructor (options, verify) {
    options.customHeaders = options.customHeaders || {}
    super(options, verify)
    this.name = 'oauth2'
    this._userProfileURL = options.userProfileURL
    this._oauth2.useAuthorizationHeaderforGET(true)
  }

  userProfile (accessToken, done) {
    this._oauth2.get(this._userProfileURL, accessToken, function (err, body, res) {
      let json

      if (err) {
        return done(new InternalOAuthError('Failed to fetch user profile', err))
      }

      try {
        json = JSON.parse(body)
      } catch (ex) {
        return done(new Error('Failed to parse user profile'))
      }

      checkAuthorization(json, done)
      const profile = parseProfile(json)
      profile.provider = 'oauth2'

      done(null, profile)
    })
  }
}

function extractProfileAttribute (data, path) {
  // can handle stuff like `attrs[0].name`
  path = path.split('.')
  for (const segment of path) {
    const m = segment.match(/([\d\w]+)\[(.*)\]/)
    data = m ? data[m[1]][m[2]] : data[segment]
  }
  return data
}

function parseProfile (data) {
  // only try to parse the id if a claim is configured
  const id = undefined
  const username = extractProfileAttribute(data, 'ocs.data.id')
  const displayName = extractProfileAttribute(data, 'ocs.data.display-name')
  const email = extractProfileAttribute(data, 'ocs.data.email')

  return {
    id: id || username,
    username,
    displayName,
    emails: email ? [email] : []
  }
}

function checkAuthorization (data, done) {
  // a role the user must have is set in the config
  if (config.oauth2.accessRole) {
    // check if we know which claim contains the list of groups a user is in
    if (!config.oauth2.rolesClaim) {
      // log error, but accept all logins
      logger.error('oauth2: "accessRole" is configured, but "rolesClaim" is missing from the config. Can\'t check group membership!')
    } else {
      // parse and check role data
      const roles = extractProfileAttribute(data, config.oauth2.rolesClaim)
      if (!roles) {
        logger.error('oauth2: "accessRole" is configured, but user profile doesn\'t contain roles attribute. Permission denied')
        return done('Permission denied', null)
      }
      if (!roles.includes(config.oauth2.accessRole)) {
        const username = extractProfileAttribute(data, config.oauth2.userProfileUsernameAttr)
        logger.debug(`oauth2: user "${username}" doesn't have the required role. Permission denied`)
        return done('Permission denied', null)
      }
    }
  }
}

OAuth2CustomStrategy.prototype.userProfile = function (accessToken, done) {
  this._oauth2.get(this._userProfileURL, accessToken, function (err, body, res) {
    let json

    if (err) {
      return done(new InternalOAuthError('Failed to fetch user profile', err))
    }

    try {
      json = JSON.parse(body)
    } catch (ex) {
      return done(new Error('Failed to parse user profile'))
    }

    checkAuthorization(json, done)
    const profile = parseProfile(json)
    profile.provider = 'oauth2'

    done(null, profile)
  })
}

passport.use(new OAuth2CustomStrategy({
  authorizationURL: config.oauth2.baseURL + '/apps/oauth2/authorize',
  tokenURL: config.oauth2.baseURL + '/apps/oauth2/api/v1/token',
  clientID: config.oauth2.clientID,
  clientSecret: config.oauth2.clientSecret,
  callbackURL: config.serverURL + '/auth/oauth2/callback',
  userProfileURL: config.oauth2.baseURL + '/ocs/v2.php/cloud/user?format=json',
  scope: config.oauth2.scope,
  state: true
}, passportGeneralCallback))

oauth2Auth.get('/auth/oauth2', function (req, res, next) {
  if (req.query.redirect) {
    if (!req.session) {
      req.session = {}
    }
    req.session.returnTo = req.query.redirect
  }
  passport.authenticate('oauth2')(req, res, next)
})

// github auth callback
oauth2Auth.get('/auth/oauth2/callback', function (req, res, next) {
  const returnurl = req.session?.returnTo ?? (config.serverURL + '/')
  passport.authenticate('oauth2', {
    successReturnToOrRedirect: returnurl,
    failureRedirect: config.serverURL + '/'
  })(req, res, next)
})
