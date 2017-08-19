const express = require('express')
const http = require('http')
const url = require('url')
const WebSocket = require('ws')
const sendHeartbeats = require('ws-heartbeats')
const path = require('path')
const bodyParser = require('body-parser')
const Botkit = require('botkit')
// const locationDialog = require('botbuilder-location')

const port = process.env.PORT || 8888
const authorizationHeader = process.env.BRAIN_JWT || 'pizza'

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
    console.log('accepting brain connection request' + request)

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
                case 'buttons':
                  // TODO platform-specific cards/attachments
                  const preparedButtons = message.buttons.map(btnText => {
                    return { type: 'imBack', title: btnText, value: btnText }
                  })
                  console.log(preparedButtons)
                  convo.say({
                    text: message.text,
                    attachments: [
                      {
                        contentType: 'application/vnd.microsoft.card.hero',
                        content: {
                          title: message.text,
                          subtitle: 'Pig Latin Wikipedia Page',
                          images: [],
                          buttons: preparedButtons
                        }
                      }
                    ]
                  })
                  break
                case 'map':
                // TODO send map
                  convo.say({
                    text: message.text,
                    attachments: [
                      {
                        contentType: 'image/png',
                        contentUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a6/Bender_Rodriguez.png',
                        name: 'Bender_Rodriguez.png'
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
