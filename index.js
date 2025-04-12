const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const OpenAI = require("openai");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = process.env.PORT || 3000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

app.use(express.static(path.join(__dirname, 'public')));

let numUsers = 0;

io.on('connection', handleConnection);

function handleConnection(socket) {
  let addedUser = false;

  socket.on('new message', handleNewMessage);
  socket.on('add user', handleAddUser);
  socket.on('gpt type', handleGPTType);
  socket.on('disconnect', handleDisconnect);

  function handleNewMessage(data) {
    const history = getChatHistory(socket, data);

    openai.chat.completions.create({
      model: socket.gpt,
      messages: history,
      max_tokens: 128,
      temperature: 0.5,
    })
      .then(handleResponse)
      .catch(handleError);
  }

  function handleResponse(response) {
    const message = response.choices[0].message.content;
    const history = getChatHistory(socket, message);
    history.push({ role: 'assistant', content: message });

    socket.emit('new message', {
      username: "Lunar - AI Copilot",
      message: message
    });
  }

  function handleError(err) {
    console.error('Error generating response:', err);
  }

  function handleAddUser(username) {
    if (addedUser) return;

    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', { numUsers: numUsers });

    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  }

  function handleGPTType(gpt) {
    socket.gpt = gpt;
  }

  function handleDisconnect() {
    if (addedUser) {
      --numUsers;
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  }

  function getChatHistory(socket, message) {
    const history = [
      { role: 'system', content: `You are an assistant. Keep your talk short and neat, under 4 sentences if possible. Also, you are speaking to ${socket.username}` },
      { role: "user", content: message }
    ];

    return history;
  }
}