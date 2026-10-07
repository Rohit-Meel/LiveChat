const express = require('express');

const {
    register,
    login,
    logout,
    me
} = require('../controllers/auth.controller');

const {
    requireAuth
} = require('../middleware/auth.middleware');


const router = express.Router();


/* =========================================================
   PUBLIC
========================================================= */

router.post(
    '/register',
    register
);

router.post(
    '/login',
    login
);

router.post(
    '/logout',
    logout
);


/* =========================================================
   AUTHENTICATED
========================================================= */

router.get(
    '/me',
    me
);


/* =========================================================
   PROTECTED TEST
========================================================= */

router.get(
    '/protected-test',
    requireAuth,
    (req, res) => {

        return res.status(200).json({

            success: true,

            message:
                'Authentication middleware is working',

            user: {
                id: req.user._id,
                name: req.user.name,
                username: req.user.username,
                email: req.user.email
            }
        });
    }
);


module.exports = router;