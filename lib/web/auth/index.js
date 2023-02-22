'use strict'

const Router = require('express').Router
const passport = require('passport')

const config = require('../../config')
const logger = require('../../logger')
const models = require('../../models')

const authRouter = module.exports = Router()

// serialize and deserialize
passport.serializeUser(function (user, done) {
  logger.info('serializeUser: ' + user.id)
  return done(null, user.id)
})

passport.deserializeUser(function (id, done) {
  models.User.findOne({
    where: {
      id
    }
  }).then(function (user) {
    // Don't die on non-existent user
    if (user == null) {
      return done(null, false, { message: 'Invalid UserID' })
    }

    logger.info('deserializeUser: ' + user.id)
    return done(null, user)
  }).catch(function (err) {
    logger.error(err)
    return done(err, null)
  })
})

if (config.isOAuth2Enable) authRouter.use(require('./oauth2'))
if (config.isEmailEnable) authRouter.use(require('./email'))
if (config.isOpenIDEnable) authRouter.use(require('./openid'))

// logout
authRouter.get('/logout', function (req, res) {
  if (config.debug && req.isAuthenticated()) {
    logger.debug('user logout: ' + req.user.id)
  }
  req.logout(() => {
    res.redirect(config.serverURL + '/')
  })
})
