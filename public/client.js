$(function () {

var token = (sessionStorage.getItem("token"))
console.log("client.js loaded");

var socket = io({
    query: {
        token: token,
    }
});

var myName;
var title = document.title;

$('#notification').hide();

$('#s-words').hide();
$('#s-players').hide();
$('#s-games').show();

  
$('#form-word').submit(function(e){
  e.preventDefault(); // prevents page reloading
  socket.emit('send word', $('#m').val());
  return false;
});

$('#form-playername').submit(function(e){
  e.preventDefault(); // prevents page reloading
  socket.emit('join', $('#pn').val(), $('#select-games').val());
  return false;
});

$('#form-creategame').submit(function(e){
  e.preventDefault(); // prevents page reloading
  socket.emit('create', $('#pn').val(), $('#gn').val());
  return false;
});

$('#button-start').on("click", function(){
    socket.emit('start');
});

$('#button-leave').on("click", function(){
    socket.emit('leave');
});

socket.on('token', function(token){
    sessionStorage.setItem("token", token);
});

socket.on('success', function(){
  $('#m').val('');
});

socket.on('word add', function(msg){
  $('#words').append($('<li>').text(msg));
    w = $('#words-wrap').get(0);
    w.scrollTop = w.scrollHeight 
});

socket.on('gamelist', function(games){
    let sel = $('#select-games');
    sel.empty();
    sel = sel.get(0);

    for(let i = 0; i < games.length; i++)
    {
	let opt = document.createElement('option');
	opt.value = games[i];
	opt.innerText = games[i];
	sel.appendChild(opt);
    }
});

socket.on('wordlist', function(words){
    $('#words').empty();
    for(let i = 0; i < words.length; i++)
    {
        $('#words').append($('<li>').text(words[i]));
    }
    w = $('#words-wrap').get(0);
    w.scrollTop = w.scrollHeight 
});

socket.on('playerlist', function(players, playerActive){

    $('#players').empty();
    for(let i = 0; i < players.length; i++)
    {
        let playerClass = myName === players[i] ? "player-me" : "player";
        playerClass += playerActive === players[i] ? " player-active" : "";
        $('#players').append($('<li>').toggleClass(playerClass).text(players[i]));
    }
});

socket.on('welcome', function(playerName, gameName){
    myName = playerName;
    $('#playername').text(playerName);
    $('#gamename').text(gameName);
    document.title = title + " | " + myName + " | " + gameName;
    $('#s-games').hide();
    $('#s-words').show();
    $('#s-players').show();
});

socket.on('bye', function(){
    myName = "";
    $('#playername').text("Ніхто");
    $('#gamename').text("не в грі");
    document.title = title;
    $('#s-words').hide();
    $('#s-players').hide();
    $('#s-games').show();
});

socket.on('notify', function(msg){
    let notif = $('#notification')
    notif.text(msg);
    notif.finish();
    notif.show();
    notif.fadeOut(4000);
});
    
});
