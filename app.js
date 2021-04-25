var express = require('express');


const {Telegraf} = require('telegraf')
const rateLimit = require('telegraf-ratelimit')
const limitConfig = {
    window: 1000,
    limit: 30,
    // onLimitExceeded: (ctx, next) => ctx.reply('Rate limit exceeded')
}
require('dotenv').config()
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const botRouter = require('./routes/bot');
const MyBot = require('./myBot');

const app = express();
const bot = new Telegraf(process.env.apikey)

app.use('/', indexRouter);
app.use('/unset', botRouter)
app.use('/users', usersRouter);

console.log(process.env.apikey)

bot.telegram.setWebhook('https://02249c89ca9a.ngrok.io/hook')


app.use(bot.webhookCallback('/hook'))
bot.use(rateLimit(limitConfig))

bot.use(MyBot)





module.exports = app;


// Set the bot response

