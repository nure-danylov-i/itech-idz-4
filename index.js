var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');

app.use(express.static('public'));

var games = new Map();
var tokens = new Map();
var timeouts = new Map();

function queryDatabase(word, callback) {

    let sql = "select name from cities where name = " + mysql.escape(word);
    con.query(sql, function(err, result) {
        if (err) throw err;
        //console.log("database query result:");
        //console.log(result);
    
        if(result[0])
        {
	    return callback(true)
        }
	else
	{
	    return callback(false);
	}
    });
}

function createGame(gameName) {
    if(games.has(gameName))
    {
	return false;
    }
    else
    {
	games.set(gameName, 
	    {
		words: [],
		players: [],
		playerActive: "",
		playerAuthor: "",
		started: false,
	    });
	return true;
    }
}

function updatePlayerActive(game) {
    let playerActiveIndex = (game.players.indexOf(game.playerActive) + 1) % (game.players.length);
    game.playerActive = game.players[playerActiveIndex];
    console.log("Active player: #" + playerActiveIndex + ": " + game.playerActive);
}

function kickPlayer(socket) {
	if (!tokens.has(socket.token))
	{
	    socket.emit('notify', "Ви і так не в грі");
	    return;
	}
	
	gameName = socket.game;
	game = games.get(socket.game);
	console.log("player " + socket.player + " left the game");
	io.to(socket.game).emit('notify', "Гравець " + socket.player + " покинув гру");


	// Сказати йому, що він більше не грає
	socket.emit('bye');

	// Якщо він активний, зробити активним наступного
	if(socket.player === game.playerActive)
	{
	    updatePlayerActive(game);
	}

	// Видалити його взагалі
	game.players.splice(game.players.indexOf(socket.player), 1);

	// Список оновився
	io.to(socket.game).emit('playerlist', game.players, game.playerActive);

	// Прибрати його з кімнати
	socket.leave(socket.game);

	socket.player = ""
	socket.game = ""

	// І токен його видалити теж
	tokens.delete(socket.token);
	socket.token = ""
	
	if (game.players.length === 1)
	{
	    let playerWon = game.players[0];
	    setTimeout(function() {
		io.to(gameName).emit('notify', playerWon + " переміг! Вітання!");
	    }, 2000);
	}

	if (game.players.length === 0 && game.started)
	{
	    games.delete(gameName);
	    let gameList = Array.from(games.keys());
	    io.emit('gamelist', gameList);
	}

}



function joinPlayer(socket, playerName, gameName) {

	playerName = playerName.trim();

	if(!playerName)
	{
	    socket.emit('notify', "Щоб приєднатися, введіть ім'я");
	    return;
	}

	if(!gameName)
	{
	    socket.emit('notify', "Щоб приєднатися, оберіть гру");
	    return;
	}

	if(tokens.has(socket.token))
	{
	    socket.emit('notify', "Ви вже приєдналися як " + socket.player);
	    return;
	}

	if(!games.has(gameName))
	{
	    socket.emit('notify', "Такої гри не існує");
	    return;
	}

	game = games.get(gameName);
    
	if(game.started)
	{
	    socket.emit('notify', "Гра вже почалась");
	    return;
	}

	playerName = playerName.trim();

	if(game.players.includes(playerName))
	{
	    socket.emit('notify', "Це ім'я вже зайняте");
	    return;
	}
	else
	{
	    // Створити нового граця(його раніше не було)
    	    game.players.push(playerName);
    	    socket.player = playerName;
	    socket.game = gameName;
	    // Додати його в кімнату
	    socket.join(gameName);
	    // Відправити йому дані про те хто він і де
    	    socket.emit('welcome', playerName, gameName);

	    if (game.players.length === 1) {
	        game.playerActive = playerName;
	        game.playerAuthor = playerName;
	    }

	    // Запам'ятати токен з іменем.
	    let newToken = crypto.randomUUID();

	    tokens.set(newToken, {playerName: playerName, gameName: gameName});
	    socket.emit('token', newToken);

	    socket.token = newToken;

	    io.to(gameName).emit('playerlist', game.players, game.playerActive);
	    io.to(gameName).emit('notify', playerName + " приєднався до гри");
	    socket.emit('wordlist', game.words);
	    console.log("player " + playerName + " joined");
	}
}


var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "mista"
});

con.connect(function(err) {
    if (err) throw err;
    console.log("Connected to database!");
});


app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});


http.listen(3001, function() {
  console.log('listening on *:3001');
});

io.on('connection', function(socket){

    let clientToken = socket.handshake.query.token
    console.log(clientToken);
    
    for (key of tokens.keys()){
    console.log(tokens);
    }

    // think about it 
    let gameList = Array.from(games.keys());
    socket.emit('gamelist', gameList);

    if (tokens.has(clientToken))
    {
	playerName = tokens.get(clientToken).playerName;
	gameName = tokens.get(clientToken).gameName;
	game = games.get(gameName);

	socket.emit('notify', "Ви перепідключилися як " + playerName);
    	socket.player = playerName;
	socket.game = gameName
	socket.token = clientToken;
	// Додати його в кімнату
	socket.join(gameName);
	// Нагадати, хто він і де знаходиться
    	socket.emit('welcome', playerName, gameName);

	io.to(gameName).emit('playerlist', game.players, game.playerActive);
	socket.emit('wordlist', game.words);
	console.log("player " + playerName + " reconnected");

	clearTimeout(timeouts.get(playerName));
    }

    socket.on('join', function(playerName, gameName) {
	joinPlayer(socket, playerName, gameName);
    });

    socket.on('leave', function() {
	kickPlayer(socket);
    });

    socket.on('create', function(playerName, gameName) {
	gameName = gameName.trim();
	playerName = playerName.trim();

	if (!gameName)
	{
	    socket.emit('notify', "Введіть назву гри, яку хочете створити");
	    return;
	}
	
	if(!playerName)
	{
	    socket.emit('notify', "Введіть ім'я");
	    return;
	}

	if(tokens.has(socket.token))
	{
	    socket.emit('notify', "Щоб створити гру, вийдіть з поточної");
	    return;
	}

	createGame(gameName);
	joinPlayer(socket, playerName, gameName);
	let gameList = Array.from(games.keys());
	io.emit('gamelist', gameList);
    });

    socket.on('start', function() {

	game = games.get(socket.game);

	if (!game) return;

	if(game.started) return;

	if(socket.player === game.playerAuthor)
	{
	    if (game.players.length > 1)
	    {
		io.to(socket.game).emit('notify', "Гра почалась!");
	    	game.started = true;
	    }
	    else
	    {
		socket.emit('notify', "Замало гравців щоб почати");
	    }
	}
	else
	{
	    socket.emit('notify', "Tiльки автор може почати гру");
	}
    });

    socket.on('send word', function(msg) {

	// Порожнє слово
	if(msg.length === 0) return;

	// Гравець без гри
	game = games.get(socket.game);

	if (!game)
	{
	    socket.emit("notify", "Ви не є учасником гри");
	    return;
	}
	
	// Гравець не приєднався
	if(!game.players.includes(socket.player))
	{
	    socket.emit("notify", "Ви не є учасником гри");
	    return;
	}

	// Гра ще не почалась
	if(!game.started)
	{
	    socket.emit('notify', "Гра ще не почалась");
	    return;
	}

	msg = msg.toUpperCase().trim();
	
	// Не той гравець
	if(socket.player !== game.playerActive) 
	{
	    console.log("it is not your turn, " + socket.player);
	    socket.emit("notify", "Зараз не ваш хід");
	}
	else
	{

	    let match = false;

	    // Якщо це не перше слово, перевіряємо останню букву (або передостанню)
	    if(game.words.length > 0)
	    {
		let lastWord = game.words[game.words.length - 1];
		let lastLetter = lastWord[lastWord.length - 1];

		if(lastLetter === 'Ь' || lastLetter === 'И')
		{
		    lastLetter = lastWord[lastWord.length - 2];
		}

		if(msg[0] === lastLetter)
		{
		    match = true;
		}
	    }
	    
	    // Буква співпала, або це перше слово (буква не важлива)
	    if(game.words.length === 0 || match) 
	    {
		// Таке слово вже було
		if(game.words.includes(msg))
		{
		    console.log("this word was already used");
		    socket.emit("notify", "Таке місто вже було");
		}

		// Слово підійшло (але ми ще не знаємо чи є таке місто)
		else
		{
		    // Перевіряємо по базі

	    	    queryDatabase(msg, function(hasCity) {
	    	    
			console.log(hasCity);

	    	    	if (!hasCity)
	    	    	{
	    	    	    socket.emit("notify", "Такого міста немає в списку");
	    	    	    return
	    	    	}

		    	console.log(socket.player + " entered a word!");
			game.words.push(msg);
	    	    	io.to(socket.game).emit('word add', msg);
	    	    	socket.emit('success');
		    	updatePlayerActive(game);
		    	io.to(socket.game).emit('playerlist', game.players, game.playerActive);
		    });
		}
	    } 
		
	    // Буква не співпала
	    else 
	    {
		console.log(socket.player + "`s word is incorrect! Try again!");
		socket.emit("notify", "Перша буква не підходить");
	    }
	}
  });

    socket.on('disconnect', function(){
	if(socket.player)
	{
	    console.log("player " + socket.player + " disconnected");
	    timeouts.set(socket.player, setTimeout(kickPlayer, 3000, socket));
	}
  });

});
