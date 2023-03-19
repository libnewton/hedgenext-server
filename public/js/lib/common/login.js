/* eslint-env browser, jquery */
/* global Cookies */

import { serverurl } from '../config'
let checkAuth = false
let profile = null
let lastLoginState = getLoginState()
let lastUserId = getUserId()
let loginStateChangeEvent = null
export function setloginStateChangeEvent (func) {
  loginStateChangeEvent = func
}

export function resetCheckAuth () {
  checkAuth = false
}

export function setLoginState (bool, id, templates) {
  window.LOGGED_IN = bool
  if (templates) {
    window.USER_TEMPLATES = templates
  }

  Cookies.set('loginstate', bool, {
    expires: 365,
    sameSite: window.cookiePolicy,
    secure: window.location.protocol === 'https:'
  })
  if (id) {
    Cookies.set('userid', id, {
      expires: 365,
      sameSite: window.cookiePolicy,
      secure: window.location.protocol === 'https:'
    })
  } else {
    Cookies.remove('userid', {
      sameSite: window.cookiePolicy,
      secure: window.location.protocol === 'https:'
    })
  }
  lastLoginState = bool
  lastUserId = id
  checkLoginStateChanged()
}

export function checkLoginStateChanged () {
  if (getLoginState() !== lastLoginState || (getUserId() !== lastUserId && lastUserId != null)) {
    if (loginStateChangeEvent) setTimeout(loginStateChangeEvent, 100)
    return true
  } else {
    return false
  }
}

export function getLoginState () {
  const state = Cookies.get('loginstate')
  return state === 'true' || state === true
}

export function getUserId () {
  return Cookies.get('userid')
}

export function clearLoginState () {
  Cookies.remove('loginstate')
}

export function checkIfAuth (yesCallback, noCallback) {
  const cookieLoginState = getLoginState()
  if (checkLoginStateChanged()) checkAuth = false
  const lastCheck = parseInt(window.localStorage.getItem('lastCheck') || 0)
  const currentTimestamp = Math.floor(Date.now() * 1000)
  if ((!checkAuth || typeof cookieLoginState === 'undefined') && (currentTimestamp - lastCheck) > 2000 * 1000) {
    window.localStorage.setItem('lastCheck', currentTimestamp)
    $.get(`${serverurl}/me`)
      .done(data => {
        if (data && data.status === 'ok') {
          profile = data
          yesCallback(profile)
          setLoginState(true, data.id, data.templates)
        } else {
          checkAuth = true
          noCallback()
          setLoginState(false, null, null)
        }
      })
      .fail(() => {
        noCallback()
      })
      .always(() => {
        checkAuth = true
      })
  } else if (cookieLoginState) {
    yesCallback(profile)
  } else {
    noCallback()
  }
}

export default {
  checkAuth,
  profile,
  lastLoginState,
  lastUserId,
  loginStateChangeEvent
}
