'use strict'

const archiver = require('archiver')
const sanitizeFilename = require('sanitize-filename')
const async = require('async')
const Router = require('express').Router
const errors = require('../errors')
const config = require('../config')
const { jsonParser } = require('./utils')
const models = require('../models')
const logger = require('../logger')
const { generateAvatar } = require('../letter-avatars')

const UserRouter = module.exports = Router()

// get me info
UserRouter.get('/me', function (req, res) {
  if (req.isAuthenticated()) {
    models.User.findOne({
      where: {
        id: req.user.id
      }
    }).then(function (user) {
      if (!user) { return errors.errorNotFound(res) }
      const profile = models.User.getProfile(user, true)
      res.send({
        status: 'ok',
        id: req.user.id,
        name: profile.name,
        templates: profile.templates ?? '[]',
        photo: profile.photo
      })
    }).catch(function (err) {
      logger.error('read me failed: ' + err)
      return errors.errorInternalError(res)
    })
  } else {
    res.send({
      status: 'forbidden'
    })
  }
})
UserRouter.post('/me/set_templates', jsonParser, function (req, res) {
  if (!req.isAuthenticated() || req.body.templates == null || !req.user?.id) {
    return res.status(404).json({ error: 'user not found.' })
  }

  try {
    models.User.findOne({
      where: {
        id: req.user.id
      }
    }).then(function (user) {
      if (!user) {
        return res.status(404).json({ error: 'user / templates not found' })
      }
      models.User.update({
        templates: JSON.stringify(req.body.templates)
      }, {
        where: {
          id: req.user.id
        }
      }).then(function (user2) {
        return res.json({ templates: req.body.templates })
      })
    })
  } catch (err) {
    logger.error('read templates failed: ' + err)
    return res.status(404).json({ error: 'templates not found' })
  }
})

// delete the currently authenticated user
UserRouter.get('/me/delete/:token?', function (req, res) {
  if (req.isAuthenticated()) {
    models.User.findOne({
      where: {
        id: req.user.id
      }
    }).then(function (user) {
      if (!user) {
        return errors.errorNotFound(res)
      }
      if (user.deleteToken === req.params.token + 'deletion_disabled') {
        user.destroy().then(function () {
          res.redirect(config.serverURL + '/')
        })
      } else {
        return errors.errorForbidden(res)
      }
    }).catch(function (err) {
      logger.error('delete user failed: ' + err)
      return errors.errorInternalError(res)
    })
  } else {
    return errors.errorForbidden(res)
  }
})

// export the data of the authenticated user
UserRouter.get('/me/export', function (req, res) {
  if (req.isAuthenticated()) {
    // let output = fs.createWriteStream(__dirname + '/example.zip');
    const archive = archiver('zip', {
      zlib: { level: 3 } // Sets the compression level.
    })
    res.setHeader('Content-Type', 'application/zip')
    res.attachment('archive.zip')
    archive.pipe(res)
    archive.on('error', function (err) {
      logger.error('export user data failed: ' + err)
      return errors.errorInternalError(res)
    })
    models.User.findOne({
      where: {
        id: req.user.id
      }
    }).then(function (user) {
      models.Note.findAll({
        where: {
          ownerId: user.id
        }
      }).then(function (notes) {
        const filenames = {}
        async.each(notes, function (note, callback) {
          const basename = sanitizeFilename(note.title, { replacement: '_' })
          let filename
          let suffix = ''
          do {
            const seperator = typeof suffix === 'number' ? '-' : ''
            filename = basename + seperator + suffix + '.md'
            suffix++
          } while (filenames[filename])
          filenames[filename] = true

          logger.debug('Write: ' + filename)
          archive.append(Buffer.from(note.content), { name: filename, date: note.lastchangeAt })
          callback(null, null)
        }, function (err) {
          if (err) {
            return errors.errorInternalError(res)
          }

          archive.finalize()
        })
      })
    }).catch(function (err) {
      logger.error('export user data failed: ' + err)
      return errors.errorInternalError(res)
    })
  } else {
    return errors.errorForbidden(res)
  }
})

UserRouter.get('/user/:username/avatar.svg', function (req, res, next) {
  res.setHeader('Content-Type', 'image/svg+xml')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.send(generateAvatar(req.params.username))
})
