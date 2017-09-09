const express = require('express')
const http = require('http')
const url = require('url')
const WebSocket = require('ws')
const sendHeartbeats = require('ws-heartbeats')
const path = require('path')
const bodyParser = require('body-parser')
const Botkit = require('botkit')

// load the environment file if present
require('dotenv').config()

const port = process.env.PORT || 8888
const authorizationHeader = process.env.WEBSOCKET_TOKEN || 'pizza'

// express configuration
const app = express()
// public folder for static content
app.use(express.static(path.join(__dirname, '/public')))
// parsing application/json and urlencoded
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
// the http server
const server = http.createServer(app)

// this is a flag that reflects the status of the connection with the brain
let brainConnected = false
let websocket = null

const contexts = new Map()

// configuration of the websocket for communication with the brain
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws, request) => {
  console.log('request received')
  const urlParsed = url.parse(request.url, true)
  // check the connection request inside resource
  if (urlParsed.pathname !== '/brain') {
    // path
    ws.close(3001, 'please connect on the path /brain')
    return
  }
  if (urlParsed.query['jwt'] !== authorizationHeader) {
    // and authentication of brain
    ws.close(3002, 'authentication of brain failed')
    return
  }
  if (brainConnected) {
    // the brain is already connected
    ws.close(3003, 'a brain is already connected')
    console.log('the brain is already connected. Rejected connection request ' + request)
  } else {
    console.log(new Date() + ' - accepted brain connection from ' + request.headers['user-agent'])

    brainConnected = true
    websocket = ws

    // enable heartbeats to keep the connection alive
    sendHeartbeats(ws)

    ws.on('message', (messageStr) => {
      // message from brain received
      console.log('Received Message from brain: ' + messageStr)
      try {
        const message = JSON.parse(messageStr)
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
                        text: message.text,
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
                      // TODO check
                      // text: 'send your location',
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
      } catch (err) {
        if (!(err instanceof SyntaxError)) {
          console.log(err)
        }
      }
    })

    ws.on('close', (message) => {
      // closed connection with the brain
      brainConnected = false
      websocket = null
    })
  }
})

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
  // check if brain connected
  if (brainConnected) {
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
    websocket.send(JSON.stringify(websocketMsg))
  } else {
    // TODO store the message for future connection with brain?
    bot.reply(message, 'my brain is offline!')
  }
})

// finally start listening on the port
server.listen(port, () => {
  console.log('Listening on %d', server.address().port)
})
