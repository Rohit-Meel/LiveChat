const socket = io({ transports: ['websocket', 'polling'] });

const $ = id => document.getElementById(id);

const groupScreen = $('group-chat-screen');
const groupMessages = $('group-messages');
const groupForm = $('send-container');
const groupInput = $('message-input');
const groupTyping = $('group-typing');
const groupScrollLatest = $('group-scroll-latest');

const privateScreen = $('private-chat-screen');
const privateMessages = $('private-messages');
const privateForm = $('private-send-container');
const privateInput = $('private-message-input');
const privateBack = $('private-back-btn');
const privateTitle = $('private-chat-title');
const privateChatProfileBtn = $('private-chat-title-btn');
const privateStatus = $('private-chat-status');
const privateTyping = $('private-typing');
const privateBlockButton = $('private-block-btn');
const privateScrollLatest = $('private-scroll-latest');

const chatUserName = $('chat-user-name');
const chatUserUsername = $('chat-user-username');
const chatUserProfileBtn = $('chat-user-profile-btn');

const contactsBtn = $('contacts-btn');
const contactsModal = $('contacts-modal');
const contactsClose = $('contacts-modal-close');
const usersList = $('contacts-list');
const contactsCount = $('contacts-count');
const contactsUnreadBadge = $('contacts-unread-badge');
const logoutBtn = $('logout-btn');
const notificationSound = $('notification-sound');

const groupActionsBtn = $('group-message-actions-btn');
const groupActionMenu = $('group-message-action-menu');
const privateActionsBtn = $('private-message-actions-btn');
const privateActionMenu = $('private-message-action-menu');

const replyBar = $('private-reply-bar');
const replyLabel = $('private-reply-name');
const replyPreview = $('private-reply-text');
const replyCancel = $('private-reply-close');
const groupReplyBar = $('group-reply-bar');
const groupReplyLabel = $('group-reply-name');
const groupReplyPreview = $('group-reply-text');
const groupReplyCancel = $('group-reply-close');

const profileModal = $('profile-modal');
const profileModalClose = $('profile-modal-close');
const profileModalAvatar = $('profile-modal-avatar');
const profileModalName = $('profile-modal-name');
const profileModalUsername = $('profile-modal-username');
const profileModalStatus = $('profile-modal-status');
const profileModalBio = $('profile-modal-bio');
const profileModalChat = $('profile-modal-chat');

/* ===== PROFILE EDIT SELECTORS ===== */

const profileViewCard = $('profile-view-card');
const profileModalEdit = $('profile-modal-edit');
const profileEditCard = $('profile-edit-card');
const profileEditClose = $('profile-edit-close');
const profileEditForm = $('profile-edit-form');
const profileEditName = $('profile-edit-name');
const profileEditUsername = $('profile-edit-username');
const profileEditBio = $('profile-edit-bio');
const profileEditError = $('profile-edit-error');
const profileEditSave = $('profile-edit-save');

/* ===== STATE ===== */

let currentUser = null;
let allUsers = [];
let selectedChatUser = null;
let currentConversationId = null;
let currentScreen = 'group';
let unreadCounts = {};
let selectedMessageIds = new Set();
let selectedMessageData = new Map();
let replyTarget = null;
let profileTarget = null;
let groupTypingUsers = new Map();
let groupTypingTimer = null;
let privateTypingTimer = null;
let privateTypingSent = false;
let activePrivateTypingTimer = null;

let currentBlockStatus = {
    blockedByMe: false,
    blockedByThem: false,
    canMessage: true
};

/* ===== HELPERS ===== */

function userId(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return String(value._id || value.id || '');
}

function getUserInitial(user) {
    return user?.name ? user.name.charAt(0).toUpperCase() : '?';
}

function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatLastSeen(lastSeen) {
    if (!lastSeen) return 'Offline';
    const date = new Date(lastSeen);
    if (Number.isNaN(date.getTime())) return 'Offline';
    return 'Last seen ' + date.toLocaleString([], {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isMine(message) {
    return userId(message?.senderId || message?.sender || message?.userId) === userId(currentUser);
}

function normalizePrivateMessage(message) {
    return {
        ...message,
        senderId: userId(message.senderId || message.sender),
        receiverId: userId(message.receiverId || message.receiver),
        senderName: message.senderName || message.sender?.name || '',
        reactions: message.reactions || {}
    };
}

function normalizeGroupMessage(message) {
    return {
        ...message,
        senderId: userId(message.senderId || message.userId),
        senderName: message.senderName || message.name || 'User',
        reactions: message.reactions || {}
    };
}

async function loadCurrentUser() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) {
            window.location.replace('/login.html');
            return false;
        }
        const data = await response.json();
        if (!data.success || !data.user) {
            window.location.replace('/login.html');
            return false;
        }
        currentUser = data.user;
        chatUserName.textContent = currentUser.name;
        chatUserUsername.textContent = '@' + currentUser.username;
        return true;
    } catch (error) {
        console.error('Current user error:', error);
        return false;
    }
}

function playNotificationSound() {
    if (!notificationSound) return;
    notificationSound.currentTime = 0;
    notificationSound.play().catch(() => {});
}

function scrollToBottom(container, smooth = false) {
    container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

function nearBottom(container) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < 80;
}

function updateScrollButton(container, button) {
    if (!button) return;
    const shouldShow = !nearBottom(container) && container.scrollHeight > container.clientHeight + 40;
    button.hidden = !shouldShow;
}

/* ===== SELECTION ===== */

function clearSelection() {
    selectedMessageIds.clear();
    selectedMessageData.clear();
    document.querySelectorAll('.message.message-selected').forEach(el => el.classList.remove('message-selected'));
    updateSelectionUI();
}

function toggleMessageSelection(element) {
    const id = element?.dataset?.messageId;
    if (!id) return;

    if (selectedMessageIds.has(id)) {
        selectedMessageIds.delete(id);
        selectedMessageData.delete(id);
        element.classList.remove('message-selected');
    } else {
        selectedMessageIds.add(id);
        selectedMessageData.set(id, element);
        element.classList.add('message-selected');
    }

    updateSelectionUI();
}

function currentSelection() {
    return [...selectedMessageIds]
        .map(id => selectedMessageData.get(id))
        .filter(Boolean)
        .map(element => element.__messageData)
        .filter(Boolean);
}

function selectedAllMine() {
    const items = currentSelection();
    return items.length > 0 && items.every(item => isMine(item));
}

function updateSelectionUI() {
    const hasSelection = selectedMessageIds.size > 0;
    const single = selectedMessageIds.size === 1;
    const allMine = selectedAllMine();

    const activeButton = currentScreen === 'group' ? groupActionsBtn : privateActionsBtn;
    const activeMenu = currentScreen === 'group' ? groupActionMenu : privateActionMenu;
    const inactiveButton = currentScreen === 'group' ? privateActionsBtn : groupActionsBtn;
    const inactiveMenu = currentScreen === 'group' ? privateActionMenu : groupActionMenu;

    if (inactiveButton) inactiveButton.hidden = true;
    if (inactiveMenu) inactiveMenu.classList.remove('show');
    if (activeButton) activeButton.hidden = !hasSelection;

    if (!hasSelection || !activeMenu) {
        activeMenu?.classList.remove('show');
        return;
    }

    const edit = activeMenu.querySelector('[data-action="edit"]');
    const reply = activeMenu.querySelector('[data-action="reply"]');
    const react = activeMenu.querySelector('[data-action="react"]');
    const deleteEveryone = activeMenu.querySelector('[data-action="delete-everyone"]');

    if (edit) edit.hidden = !(single && allMine);
    if (reply) reply.hidden = !single;
    if (react) react.hidden = !single;
    if (deleteEveryone) deleteEveryone.hidden = !allMine;
}

function closeActionMenus() {
    groupActionMenu?.classList.remove('show');
    privateActionMenu?.classList.remove('show');
}

function setupActionMenu(button, menu) {
    button?.addEventListener('click', event => {
        event.stopPropagation();
        updateSelectionUI();
        menu.classList.toggle('show');
    });

    menu?.addEventListener('click', async event => {
        const buttonElement = event.target.closest('[data-action]');
        if (!buttonElement) return;
        event.stopPropagation();
        await handleSelectionAction(buttonElement.dataset.action);
    });
}

async function handleSelectionAction(action) {
    const items = currentSelection();
    if (!items.length) return;

    closeActionMenus();

    if (action === 'clear') {
        clearSelection();
        return;
    }

    if (action === 'edit') {
        if (items.length !== 1 || !isMine(items[0])) return;
        const current = String(items[0].message || '');
        const next = window.prompt('Edit message', current);
        if (next === null) return;
        const clean = next.trim();
        if (!clean || clean.length > 500) return;
        socket.emit('edit-message', {
            messageId: String(items[0]._id),
            message: clean
        });
        return;
    }

    if (action === 'reply') {
        if (items.length !== 1) return;
        setReplyTarget(items[0]);
        return;
    }

    if (action === 'react') {
        if (items.length !== 1) return;
        const emoji = window.prompt('Reaction (❤️ 👍 😂 😮 😢 🔥)', '❤️');
        if (!emoji?.trim()) return;
        const messageId = String(items[0]._id);
        if (currentScreen === 'group') {
            socket.emit('group-reaction', { messageId, emoji: emoji.trim() });
        } else {
            socket.emit('private-reaction', { messageId, emoji: emoji.trim() });
        }
        return;
    }

    if (action === 'delete-me') {
        items.forEach(item => {
            socket.emit('delete-message', {
                messageId: String(item._id),
                deleteType: 'me'
            });
        });
        return;
    }

    if (action === 'delete-everyone') {
        if (!selectedAllMine()) return;
        items.forEach(item => {
            socket.emit('delete-message', {
                messageId: String(item._id),
                deleteType: 'everyone'
            });
        });
    }
}

/* ===== REPLY ===== */

function setReplyTarget(message) {
    replyTarget = message;
    const label = isMine(message) ? 'Reply to your message' : `Reply to ${message.senderName || message.name || 'User'}`;
    const preview = message.message || 'This message was deleted';
    replyBar.hidden = currentScreen !== 'private';
    groupReplyBar.hidden = currentScreen !== 'group';
    replyLabel.textContent = label;
    replyPreview.textContent = preview;
    groupReplyLabel.textContent = label;
    groupReplyPreview.textContent = preview;
    (currentScreen === 'private' ? privateInput : groupInput)?.focus();
}

function clearReplyTarget() {
    replyTarget = null;
    replyBar.hidden = true;
    groupReplyBar.hidden = true;
    replyPreview.textContent = '';
    groupReplyPreview.textContent = '';
}

function replyData(message) {
    if (!message) return null;
    return {
        id: String(message._id),
        message: String(message.message || '').slice(0, 160),
        senderName: message.senderName || message.name || (isMine(message) ? currentUser?.name : 'User')
    };
}

/* ===== RENDER HELPERS ===== */

function renderReactions(message) {
    const reactions = message.reactions || {};
    const entries = Object.entries(reactions)
        .filter(([, ids]) => Array.isArray(ids) && ids.length)
        .map(([emoji, ids]) => `<button type="button" class="reaction-chip" data-reaction="${escapeHtml(emoji)}">${escapeHtml(emoji)} <span>${ids.length}</span></button>`)
        .join('');

    return entries ? `<div class="message-reactions">${entries}</div>` : '';
}

function renderReplyPreview(message) {
    const reply = message.replyTo;
    if (!reply) return '';
    const text = typeof reply === 'object' ? reply.message : reply.message;
    const name = typeof reply === 'object' ? (reply.senderName || reply.sender?.name || '') : '';
    if (!text && !name) return '';
    return `<div class="message-reply-preview"><strong>${escapeHtml(name || 'Reply')}</strong><span>${escapeHtml(text || 'This message was deleted')}</span></div>`;
}

/* ===== MESSAGE STATUS (SENT / DELIVERED / SEEN) ===== */

function messageStatusMarkup(message) {
    if (!isMine(message)) return '';

    const isGroup = String(message._id).startsWith('group_');

    // ===== GROUP CHAT =====
    // Only Sent / Delivered (no Seen concept)
    if (isGroup) {
        const someoneOnline = allUsers.some(
            u => u.isOnline && String(u._id) !== String(currentUser?._id)
        );

        if (someoneOnline) {
            return '<span class="message-status delivered" title="Delivered">✓✓</span>';
        }

        return '<span class="message-status sent" title="Sent">✓</span>';
    }

    // ===== PRIVATE CHAT =====
    if (message.isRead) {
        return '<span class="message-status read" title="Seen">✓✓</span>';
    }

    if (message.deliveredAt) {
        return '<span class="message-status delivered" title="Delivered">✓✓</span>';
    }

    return '<span class="message-status sent" title="Sent">✓</span>';
}

/* ===== BUILD MESSAGE ELEMENT ===== */

function buildMessageElement(message, type, insertUnreadSeparator = false) {
    const normalized = type === 'group' ? normalizeGroupMessage(message) : normalizePrivateMessage(message);
    const mine = isMine(normalized);
    const deleted = normalized.deletedForEveryone === true || normalized.isDeletedForEveryone === true;
    const position = mine ? 'right' : 'left';

    const div = document.createElement('div');
    div.className = `message ${position}`;
    div.dataset.messageId = String(normalized._id);
    div.dataset.senderId = normalized.senderId;
    div.dataset.receiverId = normalized.receiverId || '';
    div.dataset.senderName = normalized.senderName || '';
    div.__messageData = normalized;

    if (deleted) div.classList.add('message-deleted');

    const content = document.createElement('div');
    content.className = 'message-content-wrap';

    if (type === 'group' && !mine) {
        const nameButton = document.createElement('button');
        nameButton.type = 'button';
        nameButton.className = 'group-sender-name';
        nameButton.textContent = normalized.senderName || 'User';
        nameButton.addEventListener('click', event => {
            event.stopPropagation();
            const user = allUsers.find(item => String(item._id) === normalized.senderId);
            openProfileModal(user || {
                _id: normalized.senderId,
                name: normalized.senderName,
                username: normalized.senderUsername || ''
            });
        });
        content.appendChild(nameButton);
    }

    if (normalized.replyTo && !deleted) {
        const reply = document.createElement('div');
        reply.className = 'message-reply-preview';
        const r = normalized.replyTo;
        reply.innerHTML = `<strong>${escapeHtml(r.senderName || r.sender?.name || 'Reply')}</strong><span>${escapeHtml(r.message || 'This message was deleted')}</span>`;
        content.appendChild(reply);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const text = document.createElement('span');
    text.className = type === 'group' ? 'group-message-text' : 'private-message-text';
    text.textContent = deleted ? 'This message was deleted' : String(normalized.message || '');
    bubble.appendChild(text);

    const meta = document.createElement('span');
    meta.className = 'message-meta';
    if (!deleted && normalized.isEdited) meta.innerHTML += '<span class="edited-label">edited</span>';
    meta.innerHTML += `<span class="message-time">${escapeHtml(formatTime(normalized.createdAt))}</span>`;
    meta.innerHTML += messageStatusMarkup(normalized);
    bubble.appendChild(meta);

    content.appendChild(bubble);

    const reactions = document.createElement('div');
    reactions.className = 'reaction-holder';
    reactions.innerHTML = renderReactions(normalized);
    content.appendChild(reactions);

    div.appendChild(content);

    if (insertUnreadSeparator) {
        const separator = document.createElement('div');
        separator.className = 'unread-separator';
        separator.textContent = 'New messages';
        div.dataset.hasUnreadSeparator = 'true';
        div.insertAdjacentElement('beforebegin', separator);
    }

    return div;
}

function appendGroupMessage(message, playSound = false) {
    const near = nearBottom(groupMessages);
    const div = buildMessageElement(message, 'group');
    groupMessages.appendChild(div);
    bindMessageInteractions(div);
    if (near) scrollToBottom(groupMessages);
    else if (playSound) groupScrollLatest.hidden = false;
    if (playSound) playNotificationSound();
    return div;
}

function appendPrivateMessage(message, playSound = false, unreadSeparator = false) {
    const near = nearBottom(privateMessages);
    const div = buildMessageElement(message, 'private', unreadSeparator);
    privateMessages.appendChild(div);
    bindMessageInteractions(div);
    if (near || !playSound) scrollToBottom(privateMessages);
    else privateScrollLatest.hidden = false;
    if (playSound) playNotificationSound();
    return div;
}

function appendGroupSystemMessage(text) {
    const near = nearBottom(groupMessages);
    const div = document.createElement('div');
    div.className = 'group-system-message';
    div.textContent = text;
    groupMessages.appendChild(div);
    if (near) scrollToBottom(groupMessages);
    else groupScrollLatest.hidden = false;
}

function bindMessageInteractions(element) {
    element.addEventListener('click', event => {
        if (event.target.closest('.group-sender-name')) return;
        if (event.target.closest('.reaction-chip')) {
            const emoji = event.target.closest('.reaction-chip').dataset.reaction;
            if (element.dataset.messageId.startsWith('group_')) {
                socket.emit('group-reaction', { messageId: element.dataset.messageId, emoji });
            } else {
                socket.emit('private-reaction', { messageId: element.dataset.messageId, emoji });
            }
            return;
        }
        toggleMessageSelection(element);
    });
}

function renderGroupMessages(messages) {
    groupMessages.innerHTML = '';
    messages.forEach(message => appendGroupMessage(message));
    scrollToBottom(groupMessages);
}

function renderPrivateHistory(messages) {
    privateMessages.innerHTML = '';
    let unreadSeparatorAdded = false;

    messages.forEach(message => {
        const normalized = normalizePrivateMessage(message);
        const unread = !normalized.isRead && !isMine(normalized);
        appendPrivateMessage(normalized, false, unread && !unreadSeparatorAdded);
        if (unread) unreadSeparatorAdded = true;
    });

    scrollToBottom(privateMessages);
}

/* ===== USERS ===== */

async function loadUsers() {
    try {
        const response = await fetch('/api/users', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!data.success) return;
        allUsers = data.users || [];
        renderUsers();
    } catch (error) {
        console.error('Load users error:', error);
    }
}

async function loadUnreadCounts() {
    try {
        const response = await fetch('/api/chat/unread', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        unreadCounts = {};
        (data.unreadCounts || []).forEach(row => {
            unreadCounts[String(row.userId)] = row.count;
        });
        updateContactsBadge();
        renderUsers();
    } catch (error) {
        console.error('Unread count error:', error);
    }
}

function updateContactsBadge() {
    const total = Object.values(unreadCounts).reduce((sum, count) => sum + Number(count || 0), 0);
    contactsUnreadBadge.textContent = total > 99 ? '99+' : String(total);
    contactsUnreadBadge.classList.toggle('show', total > 0);
}

function renderUsers() {
    usersList.innerHTML = '';
    contactsCount.textContent = `(${allUsers.length})`;

    if (!allUsers.length) {
        usersList.innerHTML = '<div class="no-users">No other users found.</div>';
        return;
    }

    allUsers.forEach(user => {
        const row = document.createElement('div');
        row.className = 'user-row';

        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = getUserInitial(user);
        avatar.addEventListener('click', () => openProfileModal(user));

        const details = document.createElement('div');
        details.className = 'user-details';
        details.addEventListener('click', () => openProfileModal(user));

        const name = document.createElement('button');
        name.type = 'button';
        name.className = 'user-name profile-link-button';
        name.textContent = user.name;
        name.addEventListener('click', event => {
            event.stopPropagation();
            openProfileModal(user);
        });

        const username = document.createElement('button');
        username.type = 'button';
        username.className = 'user-username profile-link-button';
        username.textContent = '@' + user.username;
        username.addEventListener('click', event => {
            event.stopPropagation();
            openProfileModal(user);
        });

        const status = document.createElement('div');
        status.className = user.isOnline ? 'user-status online-status' : 'user-status offline-status';
        status.textContent = user.isOnline ? '● Online' : formatLastSeen(user.lastSeen);

        details.append(name, username, status);

        const chatButton = document.createElement('button');
        chatButton.type = 'button';
        chatButton.className = 'user-chat-btn';
        chatButton.textContent = 'Chat';
        chatButton.addEventListener('click', event => {
            event.stopPropagation();
            contactsModal.classList.remove('show');
            openPrivateChat(user);
        });

        row.append(avatar, details);

        const unread = unreadCounts[String(user._id)] || 0;
        if (unread > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread-count';
            badge.textContent = unread > 99 ? '99+' : String(unread);
            row.appendChild(badge);
        }

        row.appendChild(chatButton);
        usersList.appendChild(row);
    });
}

function updateUserStatus(id, online, lastSeen) {
    const user = allUsers.find(item => String(item._id) === String(id));
    if (!user) return;
    user.isOnline = online;
    user.lastSeen = lastSeen;
    renderUsers();
    if (selectedChatUser && String(selectedChatUser._id) === String(id)) {
        selectedChatUser.isOnline = online;
        selectedChatUser.lastSeen = lastSeen;
        updatePrivateHeader();
    }
}

/* ===== PRIVATE CHAT ===== */

function updatePrivateHeader() {
    if (!selectedChatUser) return;
    privateTitle.textContent = selectedChatUser.name;
    privateStatus.textContent = selectedChatUser.isOnline ? 'Online' : formatLastSeen(selectedChatUser.lastSeen);
    privateBlockButton.disabled = Boolean(currentBlockStatus.blockedByThem);

    if (currentBlockStatus.blockedByMe) {
        privateBlockButton.textContent = 'Unblock';
        privateBlockButton.classList.add('unblock');
    } else if (currentBlockStatus.blockedByThem) {
        privateBlockButton.textContent = 'Blocked';
        privateBlockButton.classList.add('blocked');
    } else {
        privateBlockButton.textContent = 'Block';
        privateBlockButton.classList.remove('unblock', 'blocked');
    }

    privateInput.disabled = !currentBlockStatus.canMessage;
    privateForm.querySelector('button[type="submit"]').disabled = !currentBlockStatus.canMessage;
    privateInput.placeholder = currentBlockStatus.canMessage ? 'Type a message...' : 'You cannot message this user';
}

async function toggleBlockUser() {
    if (!selectedChatUser || currentBlockStatus.blockedByThem) return;
    const unblock = currentBlockStatus.blockedByMe;
    privateBlockButton.disabled = true;

    try {
        const response = await fetch(`/api/blocks/${selectedChatUser._id}`, {
            method: unblock ? 'DELETE' : 'POST',
            credentials: 'include'
        });
        const data = await response.json();
        if (response.ok && data.success) {
            currentBlockStatus = data.blockStatus || {
                blockedByMe: !unblock,
                blockedByThem: false,
                canMessage: unblock
            };
            currentBlockStatus.canMessage = !currentBlockStatus.blockedByMe && !currentBlockStatus.blockedByThem;
            selectedChatUser.blockedByMe = currentBlockStatus.blockedByMe;
            updatePrivateHeader();
            loadUsers();
        }
    } catch (error) {
        console.error('Block error:', error);
    } finally {
        updatePrivateHeader();
    }
}

async function openPrivateChat(user) {
    if (!user || !currentUser) return;

    clearSelection();
    clearReplyTarget();
    selectedChatUser = user;
    currentScreen = 'private';
    groupScreen.style.display = 'none';
    privateScreen.style.display = 'flex';

    try {
        const response = await fetch(`/api/chat/conversation/${user._id}`, { credentials: 'include' });
        if (!response.ok) {
            if (response.status === 401) window.location.replace('/login.html');
            return;
        }
        const data = await response.json();
        if (!data.success) return;

        currentConversationId = data.conversation?._id || null;
        selectedChatUser = data.conversation?.participant || user;
        currentBlockStatus = data.blockStatus || {
            blockedByMe: false,
            blockedByThem: false,
            canMessage: true
        };
        currentBlockStatus.canMessage = !currentBlockStatus.blockedByMe && !currentBlockStatus.blockedByThem;

        updatePrivateHeader();
        renderPrivateHistory(data.messages || []);

        unreadCounts[String(user._id)] = 0;
        updateContactsBadge();
        renderUsers();

        if (currentConversationId) {
            socket.emit('mark-read', { conversationId: currentConversationId });
        }

        privateInput.focus();
    } catch (error) {
        console.error('Open private chat error:', error);
    }
}

privateBack.addEventListener('click', () => {
    clearSelection();
    clearReplyTarget();
    currentScreen = 'group';
    currentConversationId = null;
    selectedChatUser = null;
    privateScreen.style.display = 'none';
    groupScreen.style.display = 'block';
    groupInput.focus();
});

privateBlockButton.addEventListener('click', toggleBlockUser);

contactsBtn.addEventListener('click', async () => {
    await loadUsers();
    await loadUnreadCounts();
    contactsModal.classList.add('show');
});

contactsClose.addEventListener('click', () => contactsModal.classList.remove('show'));
contactsModal.addEventListener('click', event => {
    if (event.target === contactsModal) contactsModal.classList.remove('show');
});

/* ===== PROFILE MODAL ===== */

function openProfileModal(user) {
    if (!user) return;
    profileTarget = user;
    profileModalAvatar.textContent = getUserInitial(user);
    profileModalName.textContent = user.name || 'User';
    profileModalUsername.textContent = user.username ? '@' + user.username : '';
    profileModalStatus.textContent = user.isOnline ? '● Online' : formatLastSeen(user.lastSeen);
    profileModalBio.textContent = user.bio || 'No bio added.';

    const isSelf = currentUser && String(user._id) === String(currentUser._id);

    profileModalChat.hidden = !currentUser || isSelf;
    profileModalEdit.hidden = !isSelf;

    profileViewCard.hidden = false;
    profileEditCard.hidden = true;
    profileEditError.hidden = true;

    profileModal.hidden = false;
}

function closeProfileModal() {
    profileModal.hidden = true;
    profileViewCard.hidden = false;
    profileEditCard.hidden = true;
    profileEditError.hidden = true;
    profileTarget = null;
}

profileModalClose.addEventListener('click', closeProfileModal);
profileModal.addEventListener('click', event => {
    if (event.target === profileModal) closeProfileModal();
});
profileModalChat.addEventListener('click', () => {
    if (!profileTarget) return;
    closeProfileModal();
    contactsModal.classList.remove('show');
    openPrivateChat(profileTarget);
});
chatUserProfileBtn.addEventListener('click', () => openProfileModal(currentUser));
privateActionsBtn.addEventListener('click', event => event.stopPropagation());
groupActionsBtn.addEventListener('click', event => event.stopPropagation());
setupActionMenu(groupActionsBtn, groupActionMenu);
setupActionMenu(privateActionsBtn, privateActionMenu);

/* ===== PROFILE EDIT ===== */

profileModalEdit.addEventListener('click', () => {
    if (!currentUser) return;

    profileEditName.value = currentUser.name || '';
    profileEditUsername.value = currentUser.username || '';
    profileEditBio.value = currentUser.bio || '';
    profileEditError.hidden = true;

    profileViewCard.hidden = true;
    profileEditCard.hidden = false;
    profileEditName.focus();
});

profileEditClose.addEventListener('click', () => {
    profileEditCard.hidden = true;
    profileViewCard.hidden = false;
});

profileEditForm.addEventListener('submit', async event => {
    event.preventDefault();
    profileEditError.hidden = true;

    const name = profileEditName.value.trim();
    const username = profileEditUsername.value.trim().toLowerCase();
    const bio = profileEditBio.value.trim();

    if (!name || name.length < 2) {
        profileEditError.textContent = 'Name must be at least 2 characters';
        profileEditError.hidden = false;
        return;
    }

    if (!username) {
        profileEditError.textContent = 'Username is required';
        profileEditError.hidden = false;
        return;
    }

    profileEditSave.disabled = true;
    profileEditSave.textContent = 'Saving...';

    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, bio })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            profileEditError.textContent = data.message || 'Update failed';
            profileEditError.hidden = false;
            return;
        }

        currentUser = data.user;

        chatUserName.textContent = currentUser.name;
        chatUserUsername.textContent = '@' + currentUser.username;

        profileModalName.textContent = currentUser.name;
        profileModalUsername.textContent = '@' + currentUser.username;
        profileModalBio.textContent = currentUser.bio || 'No bio added.';
        profileModalAvatar.textContent = getUserInitial(currentUser);

        loadUsers();

        profileEditCard.hidden = true;
        profileViewCard.hidden = false;
    } catch (error) {
        console.error('Update profile error:', error);
        profileEditError.textContent = 'Network error';
        profileEditError.hidden = false;
    } finally {
        profileEditSave.disabled = false;
        profileEditSave.textContent = 'Save Changes';
    }
});

/* ===== REPLY EVENTS ===== */

replyCancel.addEventListener('click', clearReplyTarget);
groupReplyCancel.addEventListener('click', clearReplyTarget);
privateChatProfileBtn?.addEventListener('click', () => {
    if (selectedChatUser) openProfileModal(selectedChatUser);
});

/* ===== TYPING ===== */

function sendTyping(type, isTyping) {
    if (type === 'group') {
        socket.emit('group-typing', isTyping);
    } else if (selectedChatUser) {
        socket.emit('private-typing', {
            receiverId: selectedChatUser._id,
            isTyping
        });
    }
}

groupInput.addEventListener('input', () => {
    if (!groupInput.value.trim()) {
        sendTyping('group', false);
        return;
    }
    sendTyping('group', true);
    clearTimeout(groupTypingTimer);
    groupTypingTimer = setTimeout(() => sendTyping('group', false), 1200);
});

privateInput.addEventListener('input', () => {
    if (!selectedChatUser) return;
    const typing = Boolean(privateInput.value.trim());
    if (typing !== privateTypingSent) {
        privateTypingSent = typing;
        sendTyping('private', typing);
    }
    clearTimeout(privateTypingTimer);
    privateTypingTimer = setTimeout(() => {
        privateTypingSent = false;
        sendTyping('private', false);
    }, 1200);
});

/* ===== SEND ===== */

groupForm.addEventListener('submit', event => {
    event.preventDefault();
    const message = groupInput.value.trim();
    if (!message) return;
    socket.emit('send', {
        message,
        replyTo: currentScreen === 'group' ? replyData(replyTarget) : null
    });
    groupInput.value = '';
    sendTyping('group', false);
    clearReplyTarget();
});

privateForm.addEventListener('submit', event => {
    event.preventDefault();
    const message = privateInput.value.trim();
    if (!message || !selectedChatUser || !currentBlockStatus.canMessage) return;

    socket.emit('private-message', {
        receiverId: selectedChatUser._id,
        message,
        replyTo: replyTarget && replyTarget._id ? String(replyTarget._id) : null
    });

    privateInput.value = '';
    privateTypingSent = false;
    sendTyping('private', false);
    clearReplyTarget();
});

/* ===== SCROLL ===== */

groupMessages.addEventListener('scroll', () => updateScrollButton(groupMessages, groupScrollLatest));
privateMessages.addEventListener('scroll', () => updateScrollButton(privateMessages, privateScrollLatest));
groupScrollLatest.addEventListener('click', () => {
    scrollToBottom(groupMessages, true);
    groupScrollLatest.hidden = true;
});
privateScrollLatest.addEventListener('click', () => {
    scrollToBottom(privateMessages, true);
    privateScrollLatest.hidden = true;
});

/* ===== GLOBAL EVENTS ===== */

document.addEventListener('click', event => {
    if (!event.target.closest('.top-message-actions')) closeActionMenus();
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        contactsModal.classList.remove('show');
        closeProfileModal();
        closeActionMenus();
    }
});

/* ===== SOCKET EVENTS ===== */

socket.on('receive', data => {
    if (!data) return;
    appendGroupMessage(data, data.senderId !== userId(currentUser));
});

socket.on('private-message-sent', data => {
    if (!data) return;
    const normalized = normalizePrivateMessage(data);
    if (currentScreen === 'private' && selectedChatUser && normalized.receiverId === String(selectedChatUser._id)) {
        appendPrivateMessage(normalized, false);
    }
});

socket.on('private-message', data => {
    if (!data) return;
    const normalized = normalizePrivateMessage(data);
    const fromCurrentChat = currentScreen === 'private' && selectedChatUser && normalized.senderId === String(selectedChatUser._id);

    if (fromCurrentChat) {
        appendPrivateMessage(normalized, true);
        if (currentConversationId) {
            socket.emit('mark-read', { conversationId: currentConversationId });
        }
        return;
    }

    const senderId = normalized.senderId;
    unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    updateContactsBadge();
    renderUsers();
    playNotificationSound();
});

socket.on('private-message-notification', data => {
    if (!data?.senderId) return;
    if (currentScreen === 'private' && selectedChatUser && String(selectedChatUser._id) === String(data.senderId)) return;
    unreadCounts[String(data.senderId)] = Number(data.unreadCount || unreadCounts[String(data.senderId)] || 1);
    updateContactsBadge();
    renderUsers();
    playNotificationSound();
});

socket.on('message-delivery', data => {
    const el = document.querySelector(`.message[data-message-id="${CSS.escape(String(data.messageId))}"]`);
    if (!el) return;

    el.__messageData.deliveredAt = data.deliveredAt || new Date();

    const meta = el.querySelector('.message-meta');
    if (!meta) return;

    let status = meta.querySelector('.message-status');
    if (status && status.classList.contains('read')) return;

    if (!status) {
        status = document.createElement('span');
        meta.appendChild(status);
    }

    status.className = 'message-status delivered';
    status.title = 'Delivered';
    status.textContent = '✓✓';
});

socket.on('message-read', data => {
    const el = document.querySelector(`.message[data-message-id="${CSS.escape(String(data.messageId))}"]`);
    if (!el) return;

    el.__messageData.isRead = true;
    el.__messageData.readAt = data.readAt;

    const meta = el.querySelector('.message-meta');
    if (!meta) return;

    let status = meta.querySelector('.message-status');
    if (!status) {
        status = document.createElement('span');
        meta.appendChild(status);
    }

    status.className = 'message-status read';
    status.title = 'Seen';
    status.textContent = '✓✓';
});

socket.on('message-reaction', data => {
    if (!data?.messageId) return;
    const el = document.querySelector(`.message[data-message-id="${CSS.escape(String(data.messageId))}"]`);
    if (!el) return;
    el.__messageData.reactions = data.reactions || {};
    const holder = el.querySelector('.reaction-holder');
    if (holder) holder.innerHTML = renderReactions(el.__messageData);
});

socket.on('message-deleted', data => {
    if (!data?.messageId) return;
    const el = document.querySelector(`.message[data-message-id="${CSS.escape(String(data.messageId))}"]`);
    if (!el) return;

    selectedMessageIds.delete(String(data.messageId));
    selectedMessageData.delete(String(data.messageId));
    el.classList.remove('message-selected');

    if (data.deleteType === 'me') {
        el.remove();
    } else if (data.deleteType === 'everyone') {
        const text = el.querySelector('.private-message-text, .group-message-text');
        if (text) text.textContent = 'This message was deleted';
        el.classList.add('message-deleted');
        el.__messageData.isDeletedForEveryone = true;
        el.querySelector('.message-reply-preview')?.remove();
        el.querySelector('.message-reactions')?.remove();
    }

    updateSelectionUI();
});

socket.on('message-edited', data => {
    if (!data?.messageId) return;
    const el = document.querySelector(`.message[data-message-id="${CSS.escape(String(data.messageId))}"]`);
    if (!el) return;
    const text = el.querySelector('.private-message-text, .group-message-text');
    if (!text) return;
    text.textContent = data.message;
    el.__messageData.message = data.message;
    el.__messageData.isEdited = true;
    let edited = el.querySelector('.edited-label');
    if (!edited) {
        edited = document.createElement('span');
        edited.className = 'edited-label';
        edited.textContent = 'edited';
        const meta = el.querySelector('.message-meta');
        meta?.prepend(edited);
    }
});

socket.on('group-typing', data => {
    if (!data?.userId || data.userId === userId(currentUser)) return;
    if (data.isTyping) groupTypingUsers.set(data.userId, data.name || 'Someone');
    else groupTypingUsers.delete(data.userId);
    const names = [...groupTypingUsers.values()];
    groupTyping.textContent = names.length ? `${names.slice(0, 2).join(', ')} ${names.length > 1 ? 'are' : 'is'} typing...` : '';
});

socket.on('private-typing', data => {
    if (!selectedChatUser || String(selectedChatUser._id) !== String(data?.senderId)) return;
    privateTyping.textContent = data.isTyping ? `${data.senderName || selectedChatUser.name} is typing...` : '';
    clearTimeout(activePrivateTypingTimer);
    if (data.isTyping) activePrivateTypingTimer = setTimeout(() => privateTyping.textContent = '', 2000);
});

socket.on('user-online', data => {
    if (data) updateUserStatus(data.userId, true, null);
});

socket.on('user-offline', data => {
    if (data) updateUserStatus(data.userId, false, data.lastSeen);
});

socket.on('user-joined', data => {
    if (!data || data.userId === userId(currentUser)) return;
    appendGroupSystemMessage(`${data.name || 'Someone'} joined the chat`);
    loadUsers();
});

socket.on('user-left', data => {
    if (!data || data.userId === userId(currentUser)) return;
    appendGroupSystemMessage(`${data.name || 'Someone'} left the chat`);
    loadUsers();
});

socket.on('private-message-error', data => {
    if (data?.message) console.error(data.message);
});

socket.on('connect', async () => {
    const ok = await loadCurrentUser();
    if (!ok) return;
    await loadUsers();
    await loadUnreadCounts();
});

socket.on('connect_error', error => {
    console.error('Socket connection error:', error.message);
    if (/unauthorized|authentication/i.test(error.message || '')) {
        window.location.replace('/login.html');
    }
});

/* ===== LOGOUT ===== */

logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        socket.disconnect();
        window.location.replace('/login.html');
    }
});