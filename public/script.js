$(function() {
  // Constants
  const FADE_TIME = 150;
  const TYPING_TIMER_LENGTH = 400;
  const COLORS = ['#19c37d', '#91580f', '#f8a700', '#f78b00', '#58dc00', '#287b00', '#a8f07a', '#4ae8c4', '#3b88eb', '#3824aa', '#a700ff', '#d300e7'];
  const API_KEY = 'YOUR API KEY';
  // DOM Elements
  const $window = $(window);
  const $usernameInput = $('.usernameInput');
  const $messages = $('.messages');
  const $inputMessage = $('.inputMessage');
  const $loginPage = $('.login.page');
  const $chatPage = $('.chat.page');
  const $enterButton = $('.enter');
  const $voice = $('.voice');
  const $header = $('li.login.page > div.form > h3.title');

  // Variables
  let username;
  let connected = false;
  let typing = false;
  let lastTypingTime;
  let $currentInput = $usernameInput.focus();
  let converter = new showdown.Converter();
  let history = [
    { role: 'system', content: `You are an assistant. Keep your talk short and neat, under 4 sentences if possible` }
  ];

  // Event Handlers
  $window.keydown(handleKeydown);
  $enterButton.click(handleEnterButtonClick);
  $inputMessage.on('input', handleInputMessage);

  $loginPage.click(handleLoginPageClick);
  $inputMessage.click(handleInputMessageClick);
  $voice.click(activateVoice);

  // Socket.io
  const socket = io();
  const params = new URLSearchParams(document.location.search);

  // Socket.io Event Listeners
  socket.on('login', handleLogin);
  socket.on('new message', handleNewMessage);
  socket.on('user joined', handleUserJoined);
  socket.on('user left', handleUserLeft);
  socket.on('disconnect', handleDisconnect);
  socket.io.on('reconnect', handleReconnect);
  socket.io.on('reconnect_error', handleReconnectError);

  if (params.get('admin')) {
    fetch(`https://admin.itproject2023.repl.co/api/auth/validate/${params.get('admin')}`)
    .then(response => response.json())
    .then(res => {
      if (res.valid) {
        username = `@${res.username}`;
        $loginPage.hide();
        $chatPage.show();
        $loginPage.off('click');
        $currentInput = $inputMessage.focus();

        socket.emit('add user', `@${username}`);
      } else {
        username = `@guest-user`;
        $loginPage.hide();
        $chatPage.show();
        $loginPage.off('click');
        $currentInput = $inputMessage.focus();

        socket.emit('add user', `@guest-user`);
      }
    });
  } else {
    username = `@guest-user`;
    $loginPage.hide();
    $chatPage.show();
    $loginPage.off('click');
    $currentInput = $inputMessage.focus();

    socket.emit('add user', `@guest-user`);
  }

  // Functions
  function handleKeydown(event) {
    if (!event.shiftKey && !(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }

    if (event.which === 13) {
      username ? sendMessage() : setUsername();
    }
  }

  function handleEnterButtonClick() {
    username ? sendMessage() : setUsername();
  }

  function handleInputMessage() {
    updateTyping();
  }

  function handleLoginPageClick() {
    $currentInput.focus();
  }

  function handleInputMessageClick() {
    $inputMessage.focus();
  }

  function handleChat(message) {
      return fetchAdminAPI().then(gpt => {
        history.push({ role: 'user', content: message });
          const apiUrl = 'https://api.openai.com/v1/chat/completions';

          const requestData = {
            model: gpt,
            messages: history,
            max_tokens: 128,
            temperature: 0.5,
          };

          return fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify(requestData),
          })
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
                console.log(response);
              }
              const res = response.json();
              console.log(res);
              return res;
            })
            .catch(error => {
              console.error('Fetch error:', error);
            });
      });
    }

  function activateVoice() {
    let mediaRecorder;
    let audioChunks = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(initiateMediaRecorder)
      .catch(error => console.error(error));

    function initiateMediaRecorder(stream) {
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.addEventListener('dataavailable', handleAudioDataAvailable);
      mediaRecorder.addEventListener('stop', handleAudioRecordingStop);

      if ($voice.attr('data-active') === "false") {
        startAudioRecording();
      } else if ($voice.attr('data-active') === "true") {
        stopAudioRecording();
      }
    }

    function startAudioRecording() {
      $voice.attr('data-active', 'true');
      $voice.find('img').attr('src', '/assets/mic_on.svg');
      mediaRecorder.start();

      const audio = new Audio('/assets/login.mp3');
      audio.play();

      const timeoutId = setTimeout(() => {
        stopAudioRecording();
      }, 10000);

      $voice.data('timeoutId', timeoutId);
    }

    function stopAudioRecording() {
      const timeoutId = $voice.data('timeoutId');

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      mediaRecorder.stop();
      $voice.attr('data-active', 'false');
      $voice.find('img').attr('src', '/assets/mic_off.svg');

      const audio = new Audio('/assets/login.mp3');
      audio.play();
    }


    function handleAudioDataAvailable(event) {
      audioChunks.push(event.data);
    }

    function handleAudioRecordingStop() {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      console.log(audioUrl);

      const audioFile = new File([audioBlob], 'temp-file.wav', {
        type: 'audio/wav'
      });

      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');

      fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: formData
      })
        .then(response => response.json())
        .then(data => {
          console.log('Transcription:', data);
          handleChat(data.text)
          .then(res => {
            const text = res.choices[0].message;
            history.push(text);
            addChatMessage({ username: 'Lunar - AI Copilot', message: text.content || 'Error' });
          });
          addChatMessage({ username, message: data.text });
        })
        .catch(error => {
          console.error('Error sending audio to Whisper API:', error);
        });
    }
  }

  function printMessage($element, message) {
    let i = 0;
    const intervalId = setInterval(() => {
      if (i === message.length) {
        clearInterval(intervalId);
      } else {
        $element.html(converter.makeHtml(message.slice(0, i + 1)));
        i++;
      }
    }, 60);
  }

  function addParticipantsMessage(data) {
    let message = data.numUsers === 1 ? `there's 1 participant` : `there are ${data.numUsers} participants`;
    // TODO: Add logic to display the message
  }

  function setUsername() {
    username = cleanInput($usernameInput.val().trim());

    if (params.get('admin')) {
      fetchAdminAPI();
    } else {
      socket.emit('gpt type', 'gpt-3.5-turbo-1106');
    }

    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      socket.emit('add user', username);
    }
  }

  function fetchAdminAPI() {
    if (params.get('admin')) {
      return fetch(`https://admin.itproject2023.repl.co/api/auth/validate/${params.get('admin')}`)
      .then(response => response.json())
      .then(res => {
        socket.emit('gpt type', res.valid ? 'gpt-4-1106-preview' : 'gpt-3.5-turbo-1106');
        return res.valid ? 'gpt-4-1106-preview' : 'gpt-3.5-turbo-1106';
      });
    } else {
      return 'gpt-3.5-turbo-1106';
    }
  }

  function sendMessage() {
    let message = cleanInput($inputMessage.val());
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({ username, message });
      handleChat(message)
        .then(res => {
          const text = res.choices[0].message;
          history.push(text);
          addChatMessage({ username: 'Lunar - AI Copilot', message: text.content || 'Error' });
        });
    }
  }

  function log(message, options) {
    const $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  function tts({ message, voice }, callback) {
    fetchTTSAPI(message, voice, callback);
  }

  function fetchTTSAPI(message, voice, callback) {
    fetch(`https://api.openai.com/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: message,
        voice: voice || 'echo'
      })
    })
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        return audio.play().then(callback ? callback : () => { });
      })
      .catch(err => console.log(err));
  }

  function addChatMessage(data, options = {}) {
    const $typingMessages = getTypingMessages(data);
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    const $messageBodyDiv = $('<span class="messageBody">');
    const isCurrentUser = username === data.username;

    if (!isCurrentUser) {
      tts({ message: data.message, voice: 'shimmer' }, () => {
        printMessage($messageBodyDiv, data.message);
      });
    }

    const $messageAvatar = createMessageAvatar(data.username, isCurrentUser);

    const $messageDiv = createMessageDiv(data, $messageBodyDiv, $messageAvatar, isCurrentUser);
    addMessageElement($messageDiv, options);

    if (isCurrentUser) {
      $messageBodyDiv.html(converter.makeHtml(data.message))
    }
  }

  function createMessageAvatar(username, isCurrentUser) {
    return isCurrentUser ?
      $(`<img src="https://api.dicebear.com/7.x/notionists-neutral/svg?seed=${username}&flip=true&scale=120" alt="avatar" />`).attr('class', 'avatar-you') :
      $(`<img src="/assets/lunar.png" alt="avatar" />`).attr('class', 'avatar');
  }

  function createMessageDiv(data, $messageBodyDiv, $messageAvatar, isCurrentUser) {
    return data.typing ?
      createTypingMessageDiv(data, $messageBodyDiv) :
      createRegularMessageDiv(data, $messageBodyDiv, $messageAvatar, isCurrentUser);
  }

  function createTypingMessageDiv(data, $messageBodyDiv) {
    return $('<li class="message"/>')
      .data('username', data.username)
      .addClass('typing')
      .append($messageBodyDiv)
      .attr('tooltip-text', data.username)
      .attr('user', username === data.username ? '(you)' : '(not)');
  }

  function createRegularMessageDiv(data, $messageBodyDiv, $messageAvatar, isCurrentUser) {
    return $('<li class="message"/>')
      .data('username', data.username)
      .append($messageBodyDiv)
      .append($messageAvatar)
      .attr('tooltip-text', data.username)
      .attr('user', isCurrentUser ? '(you)' : '(not)')
      .css('background', isCurrentUser ? '#8d2df2' : '#b100e8');
  }

  function addMessageElement(el, options) {
    const $el = $(el);
    options = options || {};
    const fade = options.fade !== undefined ? options.fade : true;
    const prepend = options.prepend || false;

    if (prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }

    if (fade) {
      $messages[0].scrollTop = $messages[0].scrollHeight;
    }
  }

  function cleanInput(input) {
    return $('<div/>').text(input).html();
  }

  function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(() => {
        const typingTimer = (new Date()).getTime();
        const timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  function getTypingMessages(data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  function getUsernameColor(username) {
    let hash = 7;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    const index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  function handleLogin(data) {
    connected = true;
    const message = 'Welcome to the Chat – ';
    addParticipantsMessage(data);
  }

  function handleNewMessage(data) {
    console.log(data);
    addChatMessage(data);
  }

  function handleUserJoined(data) {
    addParticipantsMessage(data);
  }

  function handleUserLeft(data) {
    addParticipantsMessage(data);
  }

  function handleDisconnect() {
    log('you have been disconnected');
  }

  function handleReconnect() {
    log('you have been reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  }

  function handleReconnectError() {
    log('attempt to reconnect has failed');
  }
});
