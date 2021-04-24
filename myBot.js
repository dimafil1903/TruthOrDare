const {Telegraf} = require('telegraf')
const {Router, Markup} = Telegraf

const connection = require('./db');

const bot = new Telegraf(process.env.apikey)
bot.use(async (ctx, next) => {
    console.time(`Processing update ${ctx.update.update_id}`)
    await next() // runs next middleware

    console.timeEnd(`Processing update ${ctx.update.update_id}`)
    connection.then(client => {
        const user = ctx.from
        const chat = ctx.chat
        const db = client.db('tg_bot')

        const users = db.collection('users')
        if (user)
            users.update({id: user.id}, user, {upsert: true})
        const chats = db.collection('chats')
        if (chat)
            chats.update({id: chat.id}, chat, {upsert: true})

        // console.log(ctx)
        if (chat && user)
            if (chat.type !== 'private') {
                const chat_users = db.collection('chat_users')
                let chat_user = {
                    chat_id: chat.id,
                    user_id: user.id
                }
                chat_users.update(chat_user, chat_user, {upsert: true})
            }

    })
})

bot.start(async (ctx) => {

    return ctx.reply('Welcome')

})

// bot.on('text', (ctx) => ctx.replyWithHTML('<b>Hello</b>'))

bot.on('callback_query', async (ctx) => {
    // отвечаем телеграму что получили от него запрос
    let parsedData = ctx.callbackQuery.data.split('_')
    console.log(parsedData)
    if (parsedData[0] === 'join') {
        let gender = parsedData[1];
        let chat_id = parsedData[2];
        let user_id = parsedData[3];
        if (parseInt(user_id) !== ctx.from.id)
            return ctx.answerCbQuery("Это не твой выбор", {show_alert: true})
        await ctx.answerCbQuery();
        // удаляем сообщение
        // ctx.deleteMessage();
        // отвечаем на нажатие кнопки
        connection.then(async client => {
            const db = client.db('tg_bot')

            console.log(chat_id)
            let query = {chat_id: parseInt(chat_id)};
            let gameCollection = db.collection("game");
            let game = await gameCollection.findOne(query)
            if (!game) {
                let NewGame = {
                    chat_id: parseInt(chat_id),
                    members: [],
                    used_questions: []
                }
                await gameCollection.insertOne(NewGame)
            }
            let userExist = await checkPlayerExist(ctx, client, gender)
            if (userExist === false) return userExist
        });
        await ctx.deleteMessage()

    } else if (parsedData[0] === 'newPlayer') {
        await ctx.answerCbQuery();
        chooseGender(ctx)
    } else if (parsedData[0] === 'answer') {
        let type = parsedData[1]
        let chat_id = parsedData[2];
        let user_id = parsedData[3];
        console.log(parsedData)
        if (parseInt(user_id) !== ctx.from.id)
            return ctx.answerCbQuery("Сейчас не твой ход", {show_alert: true})
        await ctx.answerCbQuery();
        await ctx.deleteMessage()
        connection.then(async client => {
            await SendQuestion(ctx, client,type)
        })
    } else if (parsedData[0] === 'done') {
        await ctx.deleteMessage()

        connection.then(async client => {
            await nextPlayer(ctx, client)
        })

        await ctx.answerCbQuery();



    }else if (parsedData[0] === 'gameStart') {
        await startGame(ctx)
        await ctx.answerCbQuery();



    }

});

// bot.help((ctx) => ctx.reply('Send me a sticker'))
// bot.on('sticker', (ctx) => ctx.reply('👍'))
// bot.hears('hi', (ctx) => ctx.reply('Hey there'))
bot.command('newGame', async ctx => {
    if (ctx.chat.type === 'private')
        return ctx.reply("Sorry but u need group chat")
    await connection.then(async client => {
        const db = client.db('tg_bot')
        let gameCollection = db.collection("game");

        await gameCollection.deleteOne({chat_id: ctx.chat.id})

    })
    await join(ctx)
})
bot.command('players', ctx => {
    if (ctx.chat.type === 'private')
        return ctx.reply("Эта команда только для группового чата")
    connection.then(async client => {
        const chat = ctx.chat
        const db = client.db('tg_bot')

        let query = {chat_id: chat.id};
        let gameCollection = db.collection("game");
        let game = await gameCollection.findOne(query)
        if (!game || game.members.length === 0)
            return ctx.reply("Никто не играет, что очень плохо")


        let reply = `С нами в игре:\n\n`


        let i = 0;
        await db.collection("users").find({
            id: {
                $in: game.members.map(function (u) {
                    return u.id;
                })
            }
        }).forEach(function (myDoc) {
            console.log(myDoc, i)

            function isThisId(player) {
                return player.id === myDoc.id;
            }

            let this_player = game.members.find(isThisId)
            let emoji = "👽"
            if (this_player.gender === 'male') {
                emoji = "🙎‍♂️‍"
            } else if (this_player.gender === 'female')
                emoji = "🙍‍♀️"
            i++;

            reply += `${i}. ${myDoc.first_name}  ${emoji} \n\n`

        });
        reply += `всего игроков: ${game.members.length} `


        return ctx.reply(reply)

    })

})

//
// bot.command('truth', ctx => {
//     if (ctx.chat.type === 'private')
//         return ctx.reply("Ой, играть можно только в групповом чате")
//     connection.then(async client => {
//         await SendQuestion(ctx, client)
//     })
// })

bot.command('join', ctx => {
    if (ctx.chat.type === 'private')
        return ctx.reply("Ой, играть можно только в групповом чате")
     chooseGender(ctx)

})
bot.command('leave', async ctx => {


    connection.then(async client => {

        if (ctx.chat.type === 'private')
            return saveBotMessage(await ctx.reply("Эта команда только для группового чата"))

        const db = client.db('tg_bot')
        let gameCollection = db.collection("game");
        let query = {
            chat_id: ctx.chat.id,
            'members.id': ctx.from.id,
        };

        if (await gameCollection.findOne(query)) {
            gameCollection.updateOne(
                query,
                {$pull: {'members': {id: ctx.from.id}}}
            )
            saveBotMessage(await ctx.reply("Вы вышли из игры", {reply_to_message_id: ctx.message.message_id}))
        } else
            saveBotMessage(await ctx.reply("Вы не в игре", {reply_to_message_id: ctx.message.message_id}))

        gameCollection.remove({
            chat_id: ctx.chat.id,
            members: {$size: 0},
        }).then(async res => {
            if (res.result.n)
                saveBotMessage(await ctx.reply("Игра закончилась. Все участники вышли"))

        })

    })


})
bot.command('startGame', async ctx => {
    if (ctx.chat.type === 'private')
        return ctx.reply("Ой, играть можно только в групповом чате")

    await startGame(ctx);
})


async function askTruthOrAction(ctx, client) {
    const db = client.db('tg_bot')
    let query = {chat_id: ctx.chat.id};


    let gameCollection = db.collection("game");
    let game = await gameCollection.findOne(query)
    console.log(game.members[game.current_player].id)
     let user=await db.collection("users").findOne({
        id: {
            $in: [game.members[game.current_player].id]
            }

    })

    const TruthOrActionKeyboard = [[
        {text: 'Правда️', callback_data: 'answer_truth_' + ctx.chat.id + '_' + game.members[game.current_player].id},
        {text: '️Действие️', callback_data: 'answer_action_' + +ctx.chat.id + '_' + game.members[game.current_player].id}
    ]];
    return saveBotMessage(await ctx.reply(
        `[${user.first_name}](tg://user?id=${game.members[game.current_player].id}), Правда или Действие?`,
        {parse_mode: "markdown", reply_markup: JSON.stringify({inline_keyboard: TruthOrActionKeyboard})}))
}

async function nextPlayer(ctx, client) {
    const db = client.db('tg_bot')
    let query = {chat_id: ctx.chat.id};
    let gameCollection = db.collection("game");
    let game = await gameCollection.findOne(query)
    console.log(game)
    if (game.members.length <= game.current_player + 1)
        await gameCollection.update(
            {id: game.id},
            {$set: {current_player: 0}}
        )
    else
        await gameCollection.update(
            {id: game.id},
            {$set: {current_player: game.current_player + 1}}
        )
    console.log(game.current_player)
    await askTruthOrAction(ctx, client)
}

async function SendQuestion(ctx, client,type) {
    const chat = ctx.chat
    const db = client.db('tg_bot')

    let query = {chat_id: chat.id};
    let gameCollection = db.collection("game");
    let game = await gameCollection.findOne(query)
    if (game && !game.members.some(item => item.id === ctx.from.id))
        return saveBotMessage(await ctx.reply(`[${ctx.from.first_name}](tg://user?id=${ctx.from.id}) ты не состоишь в игре`, {parse_mode: 'markdown'}))
    let questionCollection = db.collection("questions");

    function isThisId(player) {
        return player.id === ctx.from.id;
    }

    let this_player = game.members.find(isThisId)



    let question
    let i = 0;
    let q;
    do {
        q = (await questionCollection.aggregate([
            {
                $match: {
                    type: type,
                    gender: {$in: [genderToInt(this_player.gender), "0"]},
                    id: {$nin: game.used_questions}
                    // id: "81" debug
                }
            },
            {$sample: {size: 1}}
        ]).toArray())[0]
        question = formatQuestion(q.question, await filterResponder(this_player, game.members, db.collection('users')))
        i++;
        if (i === 100) {
            return ctx.reply("Произошли небольшие технические шоколадки")

        }
    } while (!question)

    gameCollection.updateOne(query,
        {
            $push: {
                used_questions: q.id
            }
        }
    )
    console.log(this_player)


    ctx.reply(`[${ctx.from.first_name}](tg://user?id=${ctx.from.id}) ` + question, {
        reply_markup: JSON.stringify({
            inline_keyboard: [[
                {text: 'Готово', callback_data: 'done'},
            ]],


        }), parse_mode: 'markdown'
    })


}

function genderToInt(gender) {
    if (gender === 'male')
        return "1"
    if (gender === 'female')
        return "2"
    if (!gender)
        return "0"
}

function formatQuestion(question, members) {
    console.log("items", members)

    try {


        if (question.includes('%@m')) {
            let rand_male = random_item(members.filter(member => member.gender === 'male'))
            question = question.replace('%@m', `[${rand_male.first_name}](tg://user?id=${rand_male.id})`)
        }
        if (question.includes('%@f')) {
            let rand_female = random_item(members.filter(member => member.gender === 'female'))
            question = question.replace('%@f', `[${rand_female.first_name}](tg://user?id=${rand_female.id})`)
        }
        if (question.includes('%@a')) {
            let rand = random_item(members)
            question = question.replace('%@a', `[${rand.first_name}](tg://user?id=${rand.id})`)
        }
        return question;
    } catch (e) {
        return false;
    }
}


async function filterResponder(this_player, members, userCollection) {


    let mem = await members.filter(member => member.id !== this_player.id);
    let m = await userCollection.find().toArray()
    mem = mem.map(
        member => {
            let player = m.find(element => element.id === member.id)
            member.first_name = player.first_name;
            return member
        })
    return mem
}


function random_item(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function startGame(ctx) {
    connection.then(async client => {
        const chat = ctx.chat
        const db = client.db('tg_bot')
        let query = {chat_id: chat.id};
        let gameCollection = db.collection("game");
        let game = await gameCollection.findOne(query)
        if (!game)
            return ctx.reply("Игра не зарегистрирована. Начни новую игру командой /newGame");

        if (game.members.length < 2) {
         await   gameCollection.update(
                query,
                {
                    $set:
                        {
                            status: 0
                        }
                }
            )
            return ctx.reply("Слишком мало участников чтобы начать");

        }
        if (game.status)
        return ctx.reply("Игра уже запущена");
        let current_player = 0
      await  gameCollection.update(
            query,
            {
                $set:
                    {
                        current_player: current_player,
                        status: 1
                    }
            }
        )
       await askTruthOrAction(ctx, client)
    })
}

async function join(ctx) {

    connection.then(async client => {
        let userExist = await checkPlayerExist(ctx, client)

        if (userExist === false) return userExist

        await ctx.telegram.sendMessage(
            ctx.chat.id,
            'Присоединяйся к игре \n"Правда или Действие"',
            {
                reply_markup: JSON.stringify({
                    inline_keyboard: [[
                        // {text: 'Присоединиться', url: 'http://t.me/' + username + '?start=' + chat_id},
                        {text: 'Присоединиться ✅', callback_data: 'newPlayer'},


                    ],[{text: 'Начать игру 🎲', callback_data: 'gameStart'},]]
                })
            })

    })
}

function chooseGender(ctx) {
    connection.then(async client => {
        const chat_id = ctx.chat.id
        const db = client.db('tg_bot')
        let query = {chat_id: parseInt(chat_id)};
        let gameCollection = db.collection("game");
        let game = await gameCollection.findOne(query)

        if (!game) {
            let NewGame = {
                chat_id: parseInt(chat_id),
                members: [],
                used_questions: [],
            }
            await gameCollection.insertOne(NewGame)
        }

        let userExist = await checkPlayerExist(ctx, client)
        if (userExist === false) return userExist
        const GenderKeyboard = [[
            {text: 'Я девушка 🙍‍♀️', callback_data: 'join_female_' + ctx.chat.id + '_' + ctx.from.id},
            {text: '️Я парень 🙎‍♂️', callback_data: 'join_male_' + +ctx.chat.id + '_' + ctx.from.id}
        ]];
        return saveBotMessage(await ctx.reply(
            'Отлично,'+` [${ctx.from.first_name}](tg://user?id=${ctx.from.id})`+' скажи мне кто ты, и я добавлю тебя в игру',
            {reply_markup: JSON.stringify({inline_keyboard: GenderKeyboard}),parse_mode:"markdown"}))
    })
}

function saveBotMessage(reply) {
    connection.then(async client => {
        const db = client.db('tg_bot')
        await db.collection("bot_messages").insertOne({
            chat_id: reply.chat.id,
            message_id: reply.message_id
        });
    })
}

async function checkPlayerExist(ctx, client, gender) {

    const chat = ctx.chat
    const db = client.db('tg_bot')
    let query = {chat_id: chat.id};
    let gameCollection = db.collection("game");

    let game = await gameCollection.findOne(query)
    if (game && game.members.some(item => item.id === ctx.from.id)) {

        let answer = `[${ctx.from.first_name}](tg://user?id=${ctx.from.id}) ты уже состоишь в игре`
        if (ctx.update.callback_query)
            await ctx.answerCbQuery("Ты уже состоишь в игре", {show_alert: true})
        if (ctx.update.message)
            saveBotMessage(await ctx.reply(answer, {parse_mode: 'markdown'}))
        return false

    } else if (game && !game.members.some(item => item.id === ctx.from.id) && gender) {
        gameCollection.updateOne(query,
            {
                $push: {
                    members: {
                        id: ctx.from.id,
                        gender: gender
                    }
                }
            }
        )
        if (ctx.update.callback_query)
            await ctx.answerCbQuery("Теперь ты в игре", {show_alert: true})
        let answer = `Теперь [${ctx.from.first_name}](tg://user?id=${ctx.from.id}) в игре`
        saveBotMessage(await ctx.reply(answer, {parse_mode: 'markdown'}))
        return true
    }
}

module.exports = bot;
