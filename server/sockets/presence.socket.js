const User = require('../models/User');

function setupPresenceSocket(io, socket) {

    socket.on(
        'new-user-joined',
        async () => {

            try {

                const userId =
                    socket.user._id;


                await User.findByIdAndUpdate(
                    userId,
                    {
                        isOnline: true,
                        lastSeen: null
                    }
                );


                socket.broadcast.emit(
                    'user-online',
                    {
                        userId:
                            userId.toString(),

                        isOnline:
                            true,

                        lastSeen:
                            null
                    }
                );

            }

            catch (error) {

                console.error(
                    'User online error:',
                    error
                );

            }

        }
    );

}

module.exports = {
    setupPresenceSocket
};