'use strict'

const Router = require('express').Router
const bodyParser = require('body-parser')

const errors = require('../errors')
const realtime = require('../realtime')
const config = require('../config')
const models = require('../models')
const logger = require('../logger')
const fetch = require('node-fetch')

const { urlencodedParser } = require('./utils')

const statusRouter = module.exports = Router()

// get status
statusRouter.get('/status', function (req, res, next) {
  realtime.getStatus(function (data) {
    res.set({
      'Cache-Control': 'private', // only cache by client
      'X-Robots-Tag': 'noindex, nofollow', // prevent crawling
      'Content-Type': 'application/json'
    })
    res.send(data)
  })
})
// get status
statusRouter.get('/temp', function (req, res) {
  const host = req.get('host')
  if (config.allowOrigin.indexOf(host) === -1) {
    errors.errorForbidden(res)
  } else {
    const tempid = req.query.tempid
    if (!tempid) {
      errors.errorForbidden(res)
    } else {
      models.Temp.findOne({
        where: {
          id: tempid
        }
      }).then(function (temp) {
        if (!temp) {
          errors.errorNotFound(res)
        } else {
          res.header('Access-Control-Allow-Origin', '*')
          res.send({
            temp: temp.data
          })
          temp.destroy().catch(function (err) {
            if (err) {
              logger.error('remove temp failed: ' + err)
            }
          })
        }
      }).catch(function (err) {
        logger.error(err)
        return errors.errorInternalError(res)
      })
    }
  }
})
// post status
statusRouter.post('/temp', urlencodedParser, function (req, res) {
  const host = req.get('host')
  if (config.allowOrigin.indexOf(host) === -1) {
    errors.errorForbidden(res)
  } else {
    const data = req.body.data
    if (!data) {
      errors.errorForbidden(res)
    } else {
      logger.debug(`SERVER received temp from [${host}]: ${req.body.data}`)
      models.Temp.create({
        data
      }).then(function (temp) {
        if (temp) {
          res.header('Access-Control-Allow-Origin', '*')
          res.send({
            status: 'ok',
            id: temp.id
          })
        } else {
          errors.errorInternalError(res)
        }
      }).catch(function (err) {
        logger.error(err)
        return errors.errorInternalError(res)
      })
    }
  }
})

statusRouter.post('/pdfexport', bodyParser.urlencoded({ extended: true }), async function (req, res) {
  try {
    const resp = await fetch(`${config.browserlessURL}/pdf?token=${config.browserlessToken}&headless=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: req.body.url,
        gotoOptions: {
          waitUntil: 'networkidle2'
        },
        emulateMedia: 'print',
        options: {
          margin: {
            top: '20.2',
            bottom: '20.2',
            left: '20.2',
            right: '20.2'
          },
          displayHeaderFooter: false,
          format: 'A4'
        }
      })
    })
    const buffer = await resp.buffer()
    res.set({
      'Content-Type': 'application/pdf'
    })
    res.send(buffer)
  } catch (err) {
    console.error(err)
    res.send('This went wrong, contact the admin')
  }
})

statusRouter.get('/config', function (req, res) {
  const data = {
    domain: config.domain,
    urlpath: config.urlPath,
    debug: config.debug,
    version: config.fullversion,
    DROPBOX_APP_KEY: config.dropbox.appKey,
    allowedUploadMimeTypes: config.allowedUploadMimeTypes,
    linkifyHeaderStyle: config.linkifyHeaderStyle,
    cookiePolicy: config.cookiePolicy
  }
  res.set({
    'Cache-Control': 'private', // only cache by client
    'X-Robots-Tag': 'noindex, nofollow', // prevent crawling
    'Content-Type': 'application/javascript'
  })
  res.render('../js/lib/common/constant.ejs', data)
})
