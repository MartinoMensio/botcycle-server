const Botkit = require('botkit')
// const locationDialog = require('botbuilder-location')
const controller = Botkit.botframeworkbot({})

const bot = controller.spawn({
  appId: process.env.app_id,
  appPassword: process.env.app_password
})

// this is a flag that reflects the status of the connection with the brain
let brainConnected = false

// TODO configuration of the websocket for communication with the brain

// configuration of the the webser endpoints
controller.setupWebserver(process.env.PORT, (err, webserver) => {
  if (err) {
    throw err
  }
  controller.createWebhookEndpoints(controller.webserver, bot, function () {
    console.log('This bot is online!!!')
  })
})

controller.on('message_received', (bot, message) => {
  console.log(message)
  // TODO preprocess message
  // TODO check if brain connected
  if (brainConnected) {
    // deliver the message to the brain
    // TODO
    bot.reply(message, 'sent to the brain')
  } else {
    // TODO store the message for future connection with brain?
    bot.reply(message, 'my brain is offline!')
  }
})

/*
// user said hello
controller.hears(['hello'], 'message_received', function(bot, message) {

    bot.reply(message, 'Hey there.');

});

controller.hears(['location'], 'message_received', function(bot, message) {
    bot.reply(message, {
        attachments: [{
            contentType: 'application/vnd.microsoft.card.hero',
            content: {
                title: "I'm a hero card",
                subtitle: "Pig Latin Wikipedia Page",
                images: [{
                        url: "https://<ImageUrl1>"
                    },
                    {
                        url: "https://<ImageUrl2>"
                    }
                ],
                buttons: [{
                    type: "openUrl",
                    title: "WikiPedia Page",
                    value: "https://en.wikipedia.org/wiki/Pig_Latin"
                }]
            }
        }]
    })
})

controller.hears(['cookies'], 'message_received', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.say('Did someone say cookies!?!!');
        convo.ask('What is your favorite type of cookie?', function(response, convo) {
            convo.say('Golly, I love ' + response.text + ' too!!!');
            convo.next();
        });
    });
});
*/
