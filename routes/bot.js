
var express = require('express');
var router = express.Router();
const { Telegraf } = require('telegraf')

const bot = new Telegraf(process.env.apikey)

/* GET users listing. */
router.get('/', async function(req, res, next) {

       let b   = await   bot.telegram.deleteWebhook()

        console.log(b.valueOf())
        res.send('respond with a resource');

});

module.exports = router;
