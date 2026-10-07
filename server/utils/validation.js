function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

function validateRegistration(data) {

    const {
        name,
        username,
        email,
        password,
        confirmPassword
    } = data;

    if (!name || !username || !email || !password || !confirmPassword) {
        return 'All fields are required';
    }

    if (name.trim().length < 2 || name.trim().length > 50) {
        return 'Name must be between 2 and 50 characters';
    }

    if (!isValidUsername(username.trim())) {
        return 'Username can contain only letters, numbers and underscore';
    }

    if (!isValidEmail(email.trim())) {
        return 'Please enter a valid email address';
    }

    if (password.length < 8) {
        return 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
        return 'Passwords do not match';
    }

    return null;
}

module.exports = {
    isValidEmail,
    isValidUsername,
    validateRegistration
};