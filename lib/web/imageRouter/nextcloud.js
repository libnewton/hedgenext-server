'use strict'
const config = require('../../config')
const logger = require('../../logger')
const fetch = require('node-fetch')
const fs = require('fs')
const  {randomBytes} = require('crypto')

exports.uploadImage = function (imagePath, callback) {
  if (!callback || typeof callback !== 'function') {
    logger.error('Callback has to be a function')
    return
  }

  if (!imagePath || typeof imagePath !== 'string') {
    callback(new Error('Image path is missing or wrong'), null)
    return
  }
  if (!config.ncUser || !config.ncPassword || !config.ncFolder || !config.oauth2.baseURL) {
    callback(new Error('Nextcloud credentials are missing'), null)
    return
  }
  const fname = randomBytes(10).toString('hex') + "." + imagePath.split('.').pop();
  const url = config.oauth2.baseURL + '/remote.php/dav/files/' + config.ncUser + '/' + config.ncFolder + '/' + fname
  const readStream = fs.readFileSync(imagePath)
  const options = {
    method: 'PUT',
    headers: {
      Authorization: 'Basic ' + Buffer.from(config.ncUser + ':' + config.ncPassword).toString('base64')
    },
    body: readStream
  }
  fetch(url, options).then(function (res) {
    if (res.status < 400) {
      fetch(config.oauth2.baseURL + '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json', {
        method: 'POST',
        headers: {
           Authorization: 'Basic ' + Buffer.from(config.ncUser + ':' + config.ncPassword).toString('base64'),
            'Content-Type': 'application/json',
            'OCS-APIRequest': 'true',
            Accept: 'application/json'
        },
        body: JSON.stringify({
          path: config.ncFolder + '/' + fname,
          shareType: 3,
          permissions: 1
        })
      }).then(function (res1) {
        if (res1.status < 400) {
          res1.json().then(function (json) {
            if (json.ocs?.data?.url) {
              callback(null, json.ocs.data.url + '/preview')
            } else {
              console.log(res1)
              callback(new Error('Error while sharing image 1 '), null)
            }
          })
        } else {
          callback(new Error('Error while sharing image 2 '), null)
        }
      })
    } else {

      callback(new Error('Error while uploading image 3 '), null)
    }
  })
}
