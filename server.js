require('babel-core/register')

var app = require('./express-instance'),
    app2 = require('express')(),
    http = require('http'),
    // http2 = require('http2')
    https = require('https'),
    config = require('./config.json'),
    appName = config.appName || '',
    root = config.sslroot || `/etc/letsencrypt/live/`,
    certfolder = `${root}${appName}`,
    keyname = config.keyname || 'privkey.pem',
    certname = config.certname || 'fullchain.pem',
    fs = require('fs'),
    io = require('socket.io'),
    server

try {
    server = https.createServer({
        key: fs.readFileSync(`${certfolder}/${keyname}`),
        cert: fs.readFileSync(`${certfolder}/${certname}`)
    }, app).listen(443, () => {
        console.log(`HTTPS Express server listening on port 443`)
    })

    app2.use('*', (req,res) => res.redirect('https://'+req.hostname+req.url))
    http.createServer(app2).listen(80, () => {
        console.log(`HTTP Express server listening on port 80`)
    })
} catch(e) {
    console.log('--------------------------------------------')
    console.log(e)
    console.log('--------------------------------------------')
    // likely the certs didn't exist, because we aren't on a deployed server
    server = http.createServer(app).listen(app.get('port'), () => {
        console.log(`HTTP Express server listening on port ${app.get('port')}`)
    })
}

var clients = {};

const std_id_regex = /^\/#/
const std_id = (id) => std_id_regex.test(id) ? id.replace(std_id_regex, '') : id

const p2pSocket = function p2pSocket (socket, next, room) {

    clients[std_id(socket.id)] = socket

    var connectedClients =
        typeof room === 'object' ?
            socket.adapter.rooms['/#' + room.name].sockets :
            clients

    socket.emit('numClients', Object.keys(connectedClients).length - 1)

    socket.on('disconnect', function () {
        delete clients[std_id(socket.id)]
        Object.keys(connectedClients).forEach(function (clientId, i) {
            var client = clients[std_id(clientId)]
            client.emit('peer-disconnect', {peerId: socket.id})
        })
    })

    socket.on('offers', function (data) {
        // send offers to everyone in a given room
        Object.keys(connectedClients).forEach(function (clientId, i) {
            var client = clients[std_id(clientId)]
            if (client !== socket) {
                var offerObj = data.offers[i]
                var emittedOffer = {fromPeerId: socket.id, offerId: offerObj.offerId, offer: offerObj.offer}
                client.emit('offer', emittedOffer)
            }
        })
    })

    socket.on('peer-signal', function (data) {
        var toPeerId = std_id(data.toPeerId)
        var client = clients[std_id(toPeerId)]
        data.fromPeerId = '/#' + std_id(data.fromPeerId)
        client.emit('peer-signal', data)
    })
    
    typeof next === 'function' && next()
}

io = io(server)

io.on('connection', (socket) => {
    socket.on('create-room', (roomId) => {
        roomId = std_id(roomId)
        p2pSocket(socket, null, { name: roomId })
    })
    socket.on('join-room', (roomId) => {
        roomId = std_id(roomId)

        if (!roomId in io.sockets.adapter.rooms)
            return socket.emit('invalid-room')

        var room = io.sockets.adapter.rooms[roomId] || io.sockets.adapter.rooms['/#' + roomId]
        var nClients = Object.keys(room).length
        if (nClients >= (config.maxRoomClients || 5))
            return socket.emit('full-room')

        socket.join(roomId)
        p2pSocket(socket, null, { name: roomId })

        console.log(io.sockets.adapter.rooms[roomId])
    })
})

process.title = 'nodejs - http listener'