// Connect to the same host that serves the frontend.
// This removes the localhost dependency and works on Render/production.
const socket = io();

const form = document.getElementById('send-container');
const messageInput = document.getElementById('messageinp');
const messageContainer = document.querySelector('.container');

const audio = new Audio('/ding.mp3');

audio.preload = 'auto';

const append = (message, position) => {
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messageElement.classList.add('message', position);
    messageContainer.append(messageElement);
    messageContainer.scrollTop = messageContainer.scrollHeight;

    if (position === 'left') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
};

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    append(`You : ${message}`, 'right');
    socket.emit('send', message);
    messageInput.value = '';
});

let name = prompt('Enter your name to join') || 'Anonymous';
name = name.trim().slice(0, 30) || 'Anonymous';
socket.emit('new-user-joined', name);

socket.on('user-joined', (userName) => {
    append(`${userName} joined the chat`, 'left');
});

socket.on('receive', (data) => {
    append(`${data.name}: ${data.message}`, 'left');
});

socket.on('leave', (userName) => {
    if (userName) append(`${userName} left the chat`, 'left');
});

socket.on('connect_error', () => {
    append('Unable to connect to the chat server. Please refresh and try again.', 'left');
});
