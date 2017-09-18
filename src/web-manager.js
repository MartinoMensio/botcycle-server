const express = require('express')
const path = require('path')
const encryption = require('./encryption')
const websocket = require('./websocket')

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
        // TODO use another message formatting
        websocket.send({ type: 'login', userId: chatId, code: code })
        // TODO get user name in address.user.name
        res.render('fb_logged', { name: 'test' })
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

module.exports = { config }
