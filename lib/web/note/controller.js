'use strict'

const models = require('../../models')
const config = require('../../config')
const errors = require('../../errors')

const noteUtil = require('./util')
const noteActions = require('./actions')

// exports.publishNoteActions = function (req, res, next) {
//   noteUtil.findNote(req, res, function (note) {
//     const action = req.params.action
//     switch (action) {
//       case 'download':
//         exports.downloadMarkdown(req, res, note)
//         break
//       case 'raw':
//         exports.downloadRaw(req, res, note)
//         break
//       case 'edit':
//         res.redirect(config.serverURL + '/' + (note.alias ? note.alias : models.Note.encodeNoteId(note.id)) + '?both')
//         break
//       default:
//         res.redirect(config.serverURL + '/s/' + note.shortid)
//         break
//     }
//   })
// }

exports.showPublishNote = function (req, res, next) {
  noteUtil.findNote(req, res, true, function (note) {
    // force to use short id
    const shortid = req.params.shortid
    if ((note.alias && shortid !== note.alias) || (!note.alias && shortid !== note.shortid)) {
      return res.redirect(config.serverURL + '/s/' + (note.alias || note.shortid))
    }
    if (!note) {
      return errors.errorNotFound(res)
    }
    noteUtil.getPublishData(req, res, note, (data) => {
      res.set({
        'Cache-Control': 'private', // only cache by client
        'X-Robots-Tag': 'noindex, nofollow' // prevent crawling

      })
      return res.render('pretty.ejs', data)
    })
  }, null, false)
}

exports.showNote = function (req, res, next) {
  noteUtil.findNote(req, res, false, function (note) {
    // force to use note id
    const noteId = req.params.noteId
    const id = models.Note.encodeNoteId(note.id)
    if ((note.alias && noteId !== note.alias) || (!note.alias && noteId !== id)) {
      return res.redirect(config.serverURL + '/' + (note.alias || id))
    }
    const body = note.content
    const extracted = models.Note.extractMeta(body)
    const meta = models.Note.parseMeta(extracted.meta)
    let title = models.Note.decodeTitle(note.title)
    title = models.Note.generateWebTitle(meta.title || title)
    const opengraph = models.Note.parseOpengraph(meta, title)
    res.set({
      'Cache-Control': 'private', // only cache by client
      'X-Robots-Tag': 'noindex, nofollow' // prevent crawling
    })
    return res.render('hedgedoc.ejs', {
      title,
      opengraph
    })
  })
}
exports.showNoteHandoff = async function (req, res, next) {
  if (!req.query.handoff) return res.redirect(config.serverURL + '/' + req.params.noteId)
  noteUtil.findNote(req, res, false, async function (note) {
    // force to use note id
    const noteId = req.params.noteId
    const id = models.Note.encodeNoteId(note.id)
    if ((note.alias && noteId !== note.alias) || (!note.alias && noteId !== id)) {
      return res.redirect(config.serverURL + '/handoff/' + (note.alias || id))
    }
    const body = note.content
    noteUtil.save_to_nextcloud(req.query.handoff, id, body)
    return res.redirect(config.serverURL + '/' + (note.alias || id))
  })
}
exports.createFromPOST = function (req, res, next) {
  let body = ''
  if (req.body && req.body.length > config.documentMaxLength) {
    return errors.errorTooLong(res)
  } else if (req.body) {
    body = req.body
  }
  body = body.replace(/[\r]/g, '')
  return noteUtil.newNote(req, res, body)
}

exports.createFromPOSThandoff = function (req, res, next) {
  return noteUtil.newNote(req, res, '')
}

exports.doAction = function (req, res, next) {
  const noteId = req.params.noteId
  noteUtil.findNote(req, res, false, function (note) {
    const action = req.params.action
    switch (action) {
      case 'publish':
      case 'pretty': // pretty deprecated
        res.redirect(config.serverURL + '/s/' + (note.alias || note.shortid))
        break
      case 'slide':
        res.redirect(config.serverURL + '/p/' + (note.alias || note.shortid))
        break
      case 'download':
        exports.downloadMarkdown(req, res, note)
        break
      case 'raw':
        exports.downloadRaw(req, res, note)
        break
      case 'info':
        noteActions.getInfo(req, res, note)
        break
      case 'gist':
        noteActions.createGist(req, res, note)
        break
      case 'revision':
        noteActions.getRevision(req, res, note)
        break
      default:
        return res.redirect(config.serverURL + '/' + noteId)
    }
  }, null, false)
}

exports.downloadMarkdown = function (req, res, note) {
  const body = note.content
  let filename = models.Note.decodeTitle(note.title)
  filename = encodeURIComponent(filename)
  res.set({
    'Access-Control-Allow-Origin': '*', // allow CORS as API
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Cache-Control, Content-Encoding, Content-Range',
    'Content-Type': 'text/markdown; charset=UTF-8',
    'Cache-Control': 'private',
    'Content-disposition': 'attachment; filename=' + filename + '.md',
    'X-Robots-Tag': 'noindex, nofollow' // prevent crawling
  })
  res.send(body)
}
exports.downloadRaw = function (req, res, note) {
  const body = note.content
  res.set({
    'Access-Control-Allow-Origin': '*', // allow CORS as API
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Cache-Control, Content-Encoding, Content-Range',
    'Content-Type': 'text/plain; charset=UTF-8',
    'Cache-Control': 'private',
    'X-Robots-Tag': 'noindex, nofollow' // prevent crawling
  })
  res.send(body)
}
