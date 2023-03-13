const noteUtil = require('./util')
const errors = require('../../errors')
const config = require('../../config')

// exports.publishSlideActions = function (req, res, next) {
//   noteUtil.findNote(req, res, function (note) {
//     const action = req.params.action
//     if (action === 'edit') {
//       res.redirect(config.serverURL + '/' + (note.alias ? note.alias : models.Note.encodeNoteId(note.id)) + '?both')
//     } else { res.redirect(config.serverURL + '/p/' + note.shortid) }
//   })
// }

exports.showPublishSlide = function (req, res, next) {
  // const include = [{
  //   model: models.User,
  //   as: 'owner'
  // }, {
  //   model: models.User,
  //   as: 'lastchangeuser'
  // }]
  noteUtil.findNote(req, res, true, function (note) {
    // force to use short id
    const shortid = req.params.shortid
    if ((note.alias && shortid !== note.alias) || (!note.alias && shortid !== note.shortid)) {
      return res.redirect(config.serverURL + '/p/' + (note.alias || note.shortid))
    }
    if (!note) {
      return errors.errorNotFound(res)
    }

    noteUtil.getPublishData(req, res, note, (data) => {
      res.set({
        'Cache-Control': 'private', // only cache by client
        'X-Robots-Tag': 'noindex, nofollow' // prevent crawling

      })
      return res.render('slide.ejs', data)
    })
  }, null, false)
}
