const express = require('express')
const path = require('path')
const encryption = require('./encryption')
const websocket = require('./websocket')
const request = require('request-promise')

// load soon those values, so that if some are missing it fails now
const paramValues = {
  client_id: process.env.FB_CLIENT_ID,
  redirect_uri: process.env.MYSELF + '/fb_logged',
  client_secret: process.env.FB_CLIENT_SECRET,
  fb_graph_url: 'https://graph.facebook.com/v2.10/oauth/access_token'
}

const config = (app) => {
  console.log('web manager called')
  // public folder for static content
  app.use(express.static(path.join(__dirname, '../public')))
  // pug templating engine
  app.set('view engine', 'pug')
  // the user arrives there after logging in with facebook
  app.get('/fb_logged', (req, res) => {
    const code = req.query.code
    const chatIdEnc = req.query.id
    if (!code || !chatIdEnc) {
      res.render('error')
    } else {
      try {
        const chatId = encryption.decrypt(chatIdEnc)
        getLongAccessToken(code, chatIdEnc).then(token => {
          websocket.send({ type: 'login', userId: chatId, token: token })
          // TODO get user name in address.user.name
          return res.render('fb_logged', { name: 'test' })
        }).catch(errorAsync => {
          console.log(errorAsync.message)
          return res.render('error')
        })
      } catch (error) {
        console.log(error)
        res.render('error')
      }
    }
  })
  // rewrited URL interceptor
  // TODO need a callback from the app.js to send message to brain
  app.get('/forward', (req, res) => {
    console.log(req.query)
    const userId = req.query.id
    // TODO decrypt
    const destination = req.query.destination
    if (userId && destination) {
      console.log('got id ' + userId + ' going to ' + destination)
      res.redirect(destination)
    } else {
      console.log('missing parameters')
      res.render('error')
    }
  })
}

const getLongAccessToken = (code, chatIdEnc) => {
  const params = {
    client_id: paramValues.client_id,
    redirect_uri: paramValues.redirect_uri + '?id=' + chatIdEnc,
    client_secret: paramValues.client_secret,
    code: code
  }
  return request.get({ uri: paramValues.fb_graph_url, qs: params, json: true }).then(result => {
    const longTermParams = {
      grant_type: 'fb_exchange_token',
      client_id: paramValues.client_id,
      client_secret: paramValues.client_secret,
      fb_exchange_token: result.access_token
    }
    return request.get({ uri: paramValues.fb_graph_url, qs: longTermParams, json: true })
  }).then(result => {
    return result.access_token
  })
}

module.exports = { config }
