const Session = require('../models/Session');
const User = require('../models/User');

const {
    hashToken
} = require('../utils/token');


/* =========================================================
   GET COOKIE
========================================================= */

function getCookie(req, name) {

    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    const cookies =
        cookieHeader.split(';');


    for (const cookie of cookies) {

        const [
            key,
            ...valueParts
        ] = cookie.trim().split('=');


        if (key === name) {

            return decodeURIComponent(
                valueParts.join('=')
            );
        }
    }


    return null;
}


/* =========================================================
   GET AUTHENTICATED USER
========================================================= */

async function getAuthenticatedUser(req) {

    try {

        const sessionToken =
            getCookie(
                req,
                'session_token'
            );


        if (!sessionToken) {
            return null;
        }


        const tokenHash =
            hashToken(sessionToken);


        const session =
            await Session.findOne({
                tokenHash
            });


        if (!session) {
            return null;
        }


        if (
            session.expiresAt.getTime() <=
            Date.now()
        ) {

            await Session.deleteOne({
                _id: session._id
            });

            return null;
        }


        const user =
            await User.findById(
                session.user
            ).select('-password');


        if (!user) {

            await Session.deleteOne({
                _id: session._id
            });

            return null;
        }


        return user;

    } catch (error) {

        console.error(
            'Authentication error:',
            error
        );

        return null;
    }
}


/* =========================================================
   EXPRESS AUTH MIDDLEWARE
========================================================= */

async function requireAuth(
    req,
    res,
    next
) {

    const user =
        await getAuthenticatedUser(req);


    if (!user) {

        return res.status(401).json({

            success: false,

            message:
                'Authentication required'
        });
    }


    req.user = user;

    next();
}


module.exports = {
    getCookie,
    getAuthenticatedUser,
    requireAuth
};