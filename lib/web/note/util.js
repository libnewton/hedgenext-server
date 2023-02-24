/* eslint-disable camelcase */
const models = require('../../models')
const logger = require('../../logger')
const config = require('../../config')
const errors = require('../../errors')
const crypto = require('crypto')
const fetch = require('node-fetch')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

exports.findNote = function (req, res, callback, include, createIfNotFound = true) {
  const id = req.params.noteId || req.params.shortid
  models.Note.parseNoteId(id, function (err, _id) {
    if (err) {
      logger.error(err)
      return errors.errorInternalError(res)
    }
    models.Note.findOne({
      where: {
        id: _id
      },
      include: include || null
    }).then(function (note) {
      if (!note && createIfNotFound) {
        return exports.newNote(req, res, '')
      }
      if (!note && !createIfNotFound) {
        return errors.errorNotFound(res)
      }
      if (!exports.checkViewPermission(req, note)) {
        return errors.errorForbidden(res)
      } else {
        return callback(note)
      }
    }).catch(function (err) {
      logger.error(err)
      return errors.errorInternalError(res)
    })
  })
}

exports.checkViewPermission = function (req, note) {
  if (note.permission === 'private') {
    return !(!req.isAuthenticated() || note.ownerId !== req.user.id)
  } else if (note.permission === 'limited' || note.permission === 'protected') {
    return req.isAuthenticated()
  } else {
    return true
  }
}
exports.save_to_nextcloud = async function (handoff_data, note_id, body) {
  try {
    const { iv, c, tag } = JSON.parse(Buffer.from(decodeURIComponent(handoff_data), 'base64').toString('utf-8'))
    const key = Buffer.from(config.ncSecret.split('_').join('=').split('-').join('/').split('^').join('+'), 'base64')
    const realiv = Buffer.from(iv, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, realiv)
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    const decrypted = decipher.update(c, 'base64', 'utf8') + decipher.final('utf8')
    const { fid, userid, nonce } = JSON.parse(Buffer.from(decrypted, 'base64').toString('utf-8'))
    const payload = {
      nonce,
      userid,
      fid,
      hedgecode: note_id,
      content: body
    }
    const newIV = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, newIV)
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]).toString('base64')
    const tag2 = cipher.getAuthTag().toString('base64')
    const ciphertextJSON = JSON.stringify({ iv: newIV.toString('base64'), c: ciphertext, tag:tag2 })
    const ciphertextBase64 = Buffer.from(ciphertextJSON).toString('base64')


    const form = new FormData()

    form.append('handin', encodeURIComponent(ciphertextBase64))
    const resp = await fetch(config.ncHost + '/apps/hedgenext/hedge/post', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    })
  } catch (e) {
    console.error(e)
  }
}

exports.newNote = async function (req, res, body) {
  const handoff_data = req.query.handoff ? req.query.handoff : null
  let owner = null
  const noteId = req.params.noteId ? req.params.noteId : null
  if (req.isAuthenticated()) {
    owner = req.user.id
  } else if (!config.allowAnonymous) {
    return res.redirect('/auth/oauth2?redirect=' + encodeURIComponent(req.originalUrl))
  }
  if (noteId) {
    if (config.allowFreeURL && !config.forbiddenNoteIDs.includes(noteId) && (!config.requireFreeURLAuthentication || req.isAuthenticated())) {
      req.alias = noteId
    } else {
      return req.method === 'POST' ? errors.errorForbidden(res) : errors.errorNotFound(res)
    }
    try {
      const count = await models.Note.count({
        where: {
          alias: req.alias
        }
      })
      if (count > 0) {
        return errors.errorConflict(res)
      }
    } catch (err) {
      logger.error('Error while checking for possible duplicate: ' + err)
      return errors.errorInternalError(res)
    }
  }
  models.Note.create({
    ownerId: owner,
    alias: req.alias ? req.alias : null,
    content: body,
    title: models.Note.parseNoteTitle(body)
  }).then(async function (note) {
    const noteCode = (note.alias ? note.alias : models.Note.encodeNoteId(note.id))
    if (handoff_data) {
      await exports.save_to_nextcloud(handoff_data, noteCode, '')
    }
    return res.redirect(config.serverURL + '/' + noteCode)
  }).catch(function (err) {
    logger.error('Note could not be created: ' + err)
    return errors.errorInternalError(res)
  })
}

exports.getPublishData = function (req, res, note, callback) {
  const body = note.content
  const extracted = models.Note.extractMeta(body)
  let markdown = extracted.markdown
  const meta = models.Note.parseMeta(extracted.meta)
  // extractMeta() will remove the meta part from markdown,
  // so we need to re-add the `breaks` option for proper rendering
  if (typeof extracted.meta.breaks === 'boolean') {
    markdown = '---\nbreaks: ' + extracted.meta.breaks + '\n---\n' + markdown
  }
  const createtime = note.createdAt
  const updatetime = note.lastchangeAt
  let title = models.Note.decodeTitle(note.title)
  title = models.Note.generateWebTitle(meta.title || title)
  const ogdata = models.Note.parseOpengraph(meta, title)
  const data = {
    title,
    description: meta.description || (markdown ? models.Note.generateDescription(markdown) : null),
    lang: meta.lang || null,
    viewcount: note.viewcount,
    createtime,
    updatetime,
    body: markdown,
    theme: meta.slideOptions && isRevealTheme(meta.slideOptions.theme),
    meta: JSON.stringify(extracted.meta),
    owner: note.owner ? note.owner.id : null,
    ownerprofile: note.owner ? models.User.getProfile(note.owner) : null,
    lastchangeuser: note.lastchangeuser ? note.lastchangeuser.id : null,
    lastchangeuserprofile: note.lastchangeuser ? models.User.getProfile(note.lastchangeuser) : null,
    robots: meta.robots || false, // default allow robots
    GA: meta.GA,
    disqus: meta.disqus,
    cspNonce: res.locals.nonce,
    dnt: req.headers.dnt,
    opengraph: ogdata
  }
  callback(data)
}

function isRevealTheme (theme) {
  if (fs.existsSync(path.join(__dirname, '..', '..', '..', 'public', 'build', 'reveal.js', 'css', 'theme', theme + '.css'))) {
    return theme
  }
  return undefined
}
