// load the environment file if present
require('dotenv').config()

const express = require('express')
const http = require('http')
const bodyParser = require('body-parser')
const Botkit = require('botkit')

const webManager = require('./src/web-manager')
const websocket = require(('./src/websocket'))
const encryption = require('./src/encryption')

const port = process.env.PORT || 8888

// express configuration
const app = express()

// parsing application/json and urlencoded
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
// dynamic pages
webManager.config(app)
// the http server
const server = http.createServer(app)

const contexts = new Map()

const onWebsocketMessage = (message) => {
  if (message.userId) {
    // this is a message to deliver
    const context = contexts.get(message.userId)
    if (context) {
      // send via botkit
      bot.startConversation(context, (err, convo) => {
        if (err) {
          throw err
        }
        switch (message.type) {
          case 'text':
            convo.say(message.text)
            break
          // request_location
          case 'request_location':
            // ask the user for their location, using native channel data
            if (message.userId.startsWith('facebook')) {
              const fbChannelData = {
                quick_replies: [{
                  content_type: 'location'
                }]
              }
              convo.say({
                text: message.text,
                channelData: fbChannelData
              })
            } else if (message.userId.startsWith('telegram')) {
              const telegramChannelData = {
                method: 'sendMessage',
                parameters: {
                  // text parameter (compulsory) is specified below
                  reply_markup: JSON.stringify({
                    one_time_keyboard: true,
                    keyboard: [[{
                      text: 'send location',
                      request_location: true
                    }]]
                  })
                }
              }
              console.log(telegramChannelData)
              convo.say({
                // this is a required field
                text: message.text,
                channelData: telegramChannelData
              })
            } else {
              convo.say(message.text)
            }
            break
          // map for the location
          case 'map':

            const loc = message.markers[0].latitude + ',' + message.markers[0].longitude
            const buttons = (message.buttons || []).map(el => {
              switch (el.type) {
                // a button that on click sends a message with the value
                case 'text':
                  return {
                    type: 'imBack',
                    title: el.value,
                    value: el.value
                  }
                // a button that on click opens a link in the browser
                case 'link':
                  return {
                    type: 'openUrl',
                    title: el.title || el.value,
                    value: el.value
                  }
              }
            })
            buttons.unshift({
              type: 'openUrl',
              title: 'open in map',
              value: 'https://www.google.com/maps/place/' + loc
            })
            convo.say({
              // text: message.text,
              attachments: [
                {
                  contentType: 'application/vnd.microsoft.card.hero',
                  content: {
                    // title: 'Results',
                    text: message.text,
                    images: [{
                      url: 'https://maps.googleapis.com/maps/api/staticmap?center=' + loc + '&zoom=13&size=400x400&markers=' + loc + '&key=' + process.env.MAPS_TOKEN,
                      alt: 'location',
                      tap: {
                        type: 'openUrl',
                        value: 'https://www.google.com/maps/place/' + loc
                      }
                    }],
                    buttons: buttons
                  }
                }
              ]
            })
            break
          // display a button to the user asking facebook login
          case 'login':
            convo.say({
              attachments: [{
                contentType: 'application/vnd.microsoft.card.signin',
                content: {
                  text: message.text,
                  buttons: [{
                    type: 'openUrl',
                    title: 'login with facebook',
                    value: 'https://www.facebook.com/v2.10/dialog/oauth?client_id=1253230874729964&redirect_uri=https%3A//botcycle-botkit.herokuapp.com/fb_logged%3Fid%3D' + encryption.encrypt(message.userId) + '&scope=user_likes,user_location,user_tagged_places'
                  }]
                }
              }]
            })
            break
          default:
            break
        }
        // TODO
        convo.next()
      })
    } else {
      // the context does not exist
      throw new Error('no context for this chat. Maybe this user never sent a message to the bot?')
    }
  }
}
websocket.config(server, onWebsocketMessage)

// configuration of botkit
const controller = Botkit.botframeworkbot({ port: port })

const bot = controller.spawn({
  appId: process.env.app_id,
  appPassword: process.env.app_password
})

// configuration of the the webser endpoints
controller.createWebhookEndpoints(app, bot, function () {
  console.log('This bot is online!!!')
})

// message received from botframework
controller.on('message_received', (bot, message) => {
  console.log(message)

  // set the context to be able to send back to the user
  contexts.set(message.user, message)
  // preprocess message
  const position = message.entities && message.entities.find((el) => { if (el.geo) return true })
  const websocketMsg = {
    userId: message.user,
    text: message.text,
    position: position && position.geo,
    attachments: message.attachments
  }
  // deliver the message to the brain
  if (!websocket.send(websocketMsg)) {
    // TODO store the message for future connection with brain?
    bot.reply(message, 'my brain is offline!')
  }
})

// finally start listening on the port
server.listen(port, () => {
  console.log('Listening on %d', server.address().port)
})
