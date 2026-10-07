/* =========================================================
   AUTH MESSAGE
========================================================= */

const authMessage =
    document.getElementById('auth-message');


function showMessage(message, type) {

    if (!authMessage) {
        return;
    }


    authMessage.textContent = message;

    authMessage.className =
        'auth-message';


    if (type === 'success') {

        authMessage.classList.add(
            'success'
        );

    } else {

        authMessage.classList.add(
            'error'
        );
    }
}


function clearMessage() {

    if (!authMessage) {
        return;
    }


    authMessage.textContent = '';

    authMessage.className =
        'auth-message';
}


/* =========================================================
   REGISTER
========================================================= */

const registerForm =
    document.getElementById(
        'register-form'
    );


const registerButton =
    document.getElementById(
        'register-btn'
    );


if (registerForm) {

    registerForm.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();

            clearMessage();


            const name =
                document
                    .getElementById('name')
                    .value
                    .trim();


            const username =
                document
                    .getElementById('username')
                    .value
                    .trim();


            const email =
                document
                    .getElementById('email')
                    .value
                    .trim();


            const password =
                document
                    .getElementById('password')
                    .value;


            const confirmPassword =
                document
                    .getElementById(
                        'confirmPassword'
                    )
                    .value;


            if (
                !name ||
                !username ||
                !email ||
                !password ||
                !confirmPassword
            ) {

                showMessage(
                    'All fields are required',
                    'error'
                );

                return;
            }


            if (password.length < 8) {

                showMessage(
                    'Password must be at least 8 characters',
                    'error'
                );

                return;
            }


            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    'Passwords do not match',
                    'error'
                );

                return;
            }


            const usernamePattern =
                /^[a-zA-Z0-9_]{3,30}$/;


            if (
                !usernamePattern.test(
                    username
                )
            ) {

                showMessage(
                    'Username can contain only letters, numbers and underscore',
                    'error'
                );

                return;
            }


            setRegisterLoading(true);


            try {

                const response =
                    await fetch(
                        '/api/auth/register',
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify({
                                    name,
                                    username,
                                    email,
                                    password,
                                    confirmPassword
                                })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    showMessage(
                        data.message ||
                        'Registration failed',
                        'error'
                    );

                    setRegisterLoading(false);

                    return;
                }


                showMessage(
                    data.message ||
                    'Registration successful',
                    'success'
                );


                registerForm.reset();


                setRegisterLoading(false);


                /*
                   After successful registration,
                   user can go to login.
                */

                setTimeout(() => {

                    window.location.href =
                        '/login.html';

                }, 1200);

            } catch (error) {

                console.error(
                    'Registration error:',
                    error
                );


                showMessage(
                    'Unable to connect to the server',
                    'error'
                );


                setRegisterLoading(false);
            }
        }
    );
}


function setRegisterLoading(
    isLoading
) {

    if (!registerButton) {
        return;
    }


    registerButton.disabled =
        isLoading;


    registerButton.textContent =
        isLoading
            ? 'Creating Account...'
            : 'Create Account';
}


/* =========================================================
   LOGIN
========================================================= */

const loginForm =
    document.getElementById(
        'login-form'
    );


const loginButton =
    document.getElementById(
        'login-btn'
    );


if (loginForm) {

    loginForm.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();

            clearMessage();


            const email =
                document
                    .getElementById('email')
                    .value
                    .trim();


            const password =
                document
                    .getElementById('password')
                    .value;


            if (!email || !password) {

                showMessage(
                    'Email and password are required',
                    'error'
                );

                return;
            }


            setLoginLoading(true);


            try {

                const response =
                    await fetch(
                        '/api/auth/login',
                        {
                            method: 'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            credentials: 'same-origin',

                            body:
                                JSON.stringify({
                                    email,
                                    password
                                })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    showMessage(
                        data.message ||
                        'Login failed',
                        'error'
                    );

                    setLoginLoading(false);

                    return;
                }


                showMessage(
                    'Login successful',
                    'success'
                );


                setTimeout(() => {

                    window.location.href =
                        '/';

                }, 600);

            } catch (error) {

                console.error(
                    'Login error:',
                    error
                );


                showMessage(
                    'Unable to connect to the server',
                    'error'
                );


                setLoginLoading(false);
            }
        }
    );
}


function setLoginLoading(
    isLoading
) {

    if (!loginButton) {
        return;
    }


    loginButton.disabled =
        isLoading;


    loginButton.textContent =
        isLoading
            ? 'Logging in...'
            : 'Login';
}