'use strict'

const config = require('../../config')

module.exports = function (req, res, next) {
  res.set({
    'HedgeNext-Version': config.version
  })
  return next()
}
