const url = require('url')
const WebSocket = require('ws')
const sendHeartbeats = require('ws-heartbeats')

const authorizationHeader = process.env.WEBSOCKET_TOKEN || 'pizza'

// this is a flag that reflects the status of the connection with the brain
let brainConnected = false
let websocket = null

const config = (httpServer, onMessage) => {
  // configuration of the websocket for communication with the brain
  const wss = new WebSocket.Server({ server: httpServer })
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
          // call the callback
          onMessage(message)
        } catch (error) {
          console.log(error)
        }
      })
      ws.on('close', (message) => {
        // closed connection with the brain
        brainConnected = false
        websocket = null
      })
    }
  })
}

const send = (message) => {
  // check if brain connected
  if (brainConnected) {
    // deliver the message to the brain
    websocket.send(JSON.stringify(message))
    return true
  } else {
    return false
  }
}

module.exports = {
  config,
  send
}
