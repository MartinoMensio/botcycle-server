const express = require('express')
const Botkit = require('botkit')

// this function maps a list of express sub-applications to different paths, chosen by the language code
const createBots = (rootApp, callback) => {
  // languages is a list of language codes, comma separated. Example LANGUAGES=EN,IT
  const languages = (process.env.LANGUAGES || 'EN').split(',')

  // configuration of botkit
  const controller = Botkit.botframeworkbot()

  const bots = {}
  languages.forEach(lang => {
    // for each of the languages, define BOT_ID_{LANGUAGE} and BOT_PWD_{LANGUAGE} as environment variables
    const botId = process.env[`BOT_ID_${lang}`]
    const botPwd = process.env[`BOT_PWD_${lang}`]
    // spawn a bot
    const bot = controller.spawn({appId: botId, appPassword: botPwd})

    const subApp = express()
    const path = `/${lang.toLowerCase()}`
    // register the sub-application to the path, example: /en
    rootApp.use(path, subApp)

    // configuration of the the webser endpoints
    controller.createWebhookEndpoints(subApp, bot, () => {
      console.log(`bot registred webhook on path ${path}`)
    })
    // store the language in the bot and also put the bot in the result object under the key of the language
    bot.language = lang
    bots[lang] = bot
  })
  return {
    bots: bots,
    controller: controller,
    languages: languages
  }
}

module.exports = { createBots }
