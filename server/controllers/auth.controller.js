const User = require('../models/User');
const Session = require('../models/Session');

const {
    hashPassword,
    comparePassword
} = require('../utils/password');

const {
    validateRegistration
} = require('../utils/validation');

const {
    generateSessionToken,
    hashToken
} = require('../utils/token');


const SESSION_DAYS = 7;


/* =========================================================
   COOKIE HELPERS
========================================================= */

function setSessionCookie(res, token, expiresAt) {

    const isProduction = process.env.NODE_ENV === 'production';

    const cookie = [
        `session_token=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}`,
        isProduction ? 'Secure' : ''
    ]
        .filter(Boolean)
        .join('; ');

    res.setHeader('Set-Cookie', cookie);
}


function clearSessionCookie(res) {

    const cookie = [
        'session_token=',
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0'
    ].join('; ');

    res.setHeader('Set-Cookie', cookie);
}


function getCookie(req, name) {

    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(';');

    for (const cookie of cookies) {

        const [key, ...valueParts] = cookie.trim().split('=');

        if (key === name) {
            return decodeURIComponent(valueParts.join('='));
        }
    }

    return null;
}


/* =========================================================
   REGISTER
========================================================= */

async function register(req, res) {

    try {

        const {
            name,
            username,
            email,
            password,
            confirmPassword
        } = req.body;


        const validationError = validateRegistration({
            name,
            username,
            email,
            password,
            confirmPassword
        });


        if (validationError) {

            return res.status(400).json({
                success: false,
                message: validationError
            });
        }


        const cleanUsername =
            username.trim().toLowerCase();

        const cleanEmail =
            email.trim().toLowerCase();

        const cleanName =
            name.trim();


        const existingUser = await User.findOne({
            $or: [
                {
                    username: cleanUsername
                },
                {
                    email: cleanEmail
                }
            ]
        });


        if (existingUser) {

            if (existingUser.username === cleanUsername) {

                return res.status(409).json({
                    success: false,
                    message: 'Username already exists'
                });
            }


            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }


        const hashedPassword =
            await hashPassword(password);


        const user = await User.create({

            name: cleanName,

            username: cleanUsername,

            email: cleanEmail,

            password: hashedPassword
        });


        return res.status(201).json({

            success: true,

            message: 'Registration successful',

            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email
            }

        });

    } catch (error) {

        console.error(
            'Registration error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error during registration'
        });
    }
}


/* =========================================================
   LOGIN
========================================================= */

async function login(req, res) {

    try {

        const {
            email,
            password
        } = req.body;


        if (!email || !password) {

            return res.status(400).json({

                success: false,

                message:
                    'Email and password are required'
            });
        }


        const cleanEmail =
            email.trim().toLowerCase();


        const user = await User.findOne({
            email: cleanEmail
        });


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    'Invalid email or password'
            });
        }


        const passwordValid =
            await comparePassword(
                password,
                user.password
            );


        if (!passwordValid) {

            return res.status(401).json({

                success: false,

                message:
                    'Invalid email or password'
            });
        }


        /* -----------------------------------------
           REMOVE OLD EXPIRED SESSIONS
        ----------------------------------------- */

        await Session.deleteMany({
            expiresAt: {
                $lte: new Date()
            }
        });


        /* -----------------------------------------
           CREATE NEW SESSION
        ----------------------------------------- */

        const sessionToken =
            generateSessionToken();

        const tokenHash =
            hashToken(sessionToken);


        const expiresAt =
            new Date(
                Date.now() +
                SESSION_DAYS * 24 * 60 * 60 * 1000
            );


        await Session.create({

            user: user._id,

            tokenHash,

            expiresAt
        });


        /* -----------------------------------------
           UPDATE USER STATUS
        ----------------------------------------- */

        user.isOnline = true;

        user.lastSeen = null;

        await user.save();


        /* -----------------------------------------
           COOKIE
        ----------------------------------------- */

        setSessionCookie(
            res,
            sessionToken,
            expiresAt
        );


        return res.status(200).json({

            success: true,

            message: 'Login successful',

            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                bio: user.bio,
                isOnline: user.isOnline
            }

        });

    } catch (error) {

        console.error(
            'Login error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error during login'
        });
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout(req, res) {

    try {

        const sessionToken =
            getCookie(
                req,
                'session_token'
            );


        if (sessionToken) {

            const tokenHash =
                hashToken(sessionToken);


            const session =
                await Session.findOne({
                    tokenHash
                });


            if (session) {

                await User.findByIdAndUpdate(
                    session.user,
                    {
                        isOnline: false,
                        lastSeen: new Date()
                    }
                );


                await Session.deleteOne({
                    _id: session._id
                });
            }
        }


        clearSessionCookie(res);


        return res.status(200).json({

            success: true,

            message:
                'Logout successful'
        });

    } catch (error) {

        console.error(
            'Logout error:',
            error
        );

        clearSessionCookie(res);


        return res.status(200).json({

            success: true,

            message:
                'Logout successful'
        });
    }
}


/* =========================================================
   CURRENT USER
========================================================= */

async function me(req, res) {

    try {

        const sessionToken =
            getCookie(
                req,
                'session_token'
            );


        if (!sessionToken) {

            return res.status(401).json({

                success: false,

                message:
                    'Not authenticated'
            });
        }


        const tokenHash =
            hashToken(sessionToken);


        const session =
            await Session.findOne({
                tokenHash
            });


        if (!session) {

            clearSessionCookie(res);

            return res.status(401).json({

                success: false,

                message:
                    'Session expired'
            });
        }


        if (
            session.expiresAt.getTime() <=
            Date.now()
        ) {

            await Session.deleteOne({
                _id: session._id
            });

            clearSessionCookie(res);

            return res.status(401).json({

                success: false,

                message:
                    'Session expired'
            });
        }


        const user =
            await User.findById(
                session.user
            ).select('-password');


        if (!user) {

            await Session.deleteOne({
                _id: session._id
            });

            clearSessionCookie(res);

            return res.status(401).json({

                success: false,

                message:
                    'User account not found'
            });
        }


        return res.status(200).json({

            success: true,

            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                bio: user.bio,
                isOnline: user.isOnline,
                lastSeen: user.lastSeen
            }

        });

    } catch (error) {

        console.error(
            'Current user error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Server error'
        });
    }
}


module.exports = {
    register,
    login,
    logout,
    me
};