// es5, 6, and 7 polyfills, powered by babel
require("babel-polyfill")

// fetch method, returns es6 promises
// if you uncomment 'universal-utils' below, you can comment out this line
// require("isomorphic-fetch")

// universal utils: cache, fetch, store, resource, fetcher, router, vdom, etc
import * as u from 'universal-utils'

const {mount, m, update, store, container, rAF, debounce, qs, router, fetch:_fetch, channel} = u

// the following line, if uncommented, will enable browserify to push
// a changed file to you, with source maps (reverse map from compiled
// code line # to source code line #), in realtime via websockets

// Commented out due to potential conflicts with p2p
// if (module.hot) {
//     module.hot.accept()
//     module.hot.dispose(() => {
//         // app()
//         update()
//     })
// }

var Babel = require('babel-core')
var presets = [
        require('babel-preset-es2015'),
        require('babel-preset-stage-0'),
        require('babel-preset-react')
    ]

// import {container, resolver, m} from 'mithril-resolver'
let codemirror = require('codemirror'),
    jsmode = require('codemirror/mode/javascript/javascript'),
    comment = require('codemirror/addon/comment/comment'),
    sublime = require('codemirror/keymap/sublime')

String.prototype.hashCode = function() {
    var hash = 0, i, chr, len;
    if (this.length == 0) return hash;
    for (i = 0, len = this.length; i < len; i++) {
        chr   = this.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

const directions = `/* (1) code your JS as normal.
 * (2) parsing and operational errors will be displayed in a popover.
 * (3) CMD+S to share a link to your code.
 *
 * Other things to note: this tool compiles es7/6 (es2015/2016) into es5, sends it
 * to an iframe, and polyfills most missing functionality. Thus, for built-in AJAX,
 * you can use fetch(), and for built-in Promises you can use the es6 Promise() spec.
 *
 * What else works with Arbiter? ... Everything! Arbiter uses babel-core to transpile
 * JavaScript right here, in your browser. You can see the latest and
 * greatest Babel features at https://babeljs.io/docs/learn-es2015/.
 *
 * require() any package like so:
 *
 * --------
 * require('react', 'lodash').then() => // load multiple libs, too!
 *     let React = react
 *     // ... use React as normal
 * )
 *
 * or require any specific version with semver:
 * require('lodash@^3.0.1')
 * require('react@0.14.1')
 * --------
 *
 * Built with love by @matthiasak
 * - http://mkeas.org
 * - http://github.com/matthiasak
 * */`

 // Check for ServiceWorker support before trying to install it
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./serviceworker.js').then(() => {
    // Registration was successful
  }).catch(() => {
    // Registration failed
  });
} else {
  // No ServiceWorker Support
}

let program = unescape(window.location.hash.slice(1)) || `${directions}

let canvas = document.createElement('canvas'),
    {body} = document,
    c = canvas.getContext('2d')

body.appendChild(canvas)

canvas.width = body.offsetWidth
canvas.height = body.offsetHeight

c.fillStyle = '#f449f0'
c.fillRect(0,0,500,400)

c.fillStyle = 'white'
c.fillRect(50,50,20,20)
`

function prepEnvironment() {
    // Disable Context Menu
    document.oncontextmenu = function() {
        return false
    }

    // Disable dragging of HTML elements
    document.ondragstart = function() {
        return false
    }
}

prepEnvironment()

const key = 'AIzaSyC70EBqy70L7fzc19pm_CBczzBxOK-JnhU'
const urlShortener = () => {
    googleShortener(window.location.toString())
}
const googleShortener = (longUrl) =>
    fetch(`https://www.googleapis.com/urlshortener/v1/url?key=${key}`,
        {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({longUrl})
        }
    ).then((r) => r.json()).then((data) => {
        window.prompt("Copy URL to clipboard:", data.id)
    })

/**
 * TRANSDUCER stuff
 */

// resources
const clone = (data) => typeof data === 'undefined' ? data : JSON.parse(JSON.stringify(data))
const concat = (arr, x) => arr.concat([x])
const compose = (f, g) => (x) => f(g(x))
const each = (c, cb) => c.forEach(cb)
const c = compose
const map = (c, transform) => c.map(transform)
const reduce = (c, reducer, initial) => c.reduce(reducer, initial)
const filter = (c, pred) => c.filter(pred)
const ident = (x) => x
const until = (c, pred, hasBeenReached = false) =>
    c.reduce((a, v) => {
        !hasBeenReached && !(hasBeenReached = pred(v)) && a.push(v)
        return a
    }, [])
const last = (c) => c[c.length > 1 ? c.length-1 : 0]
const head = (c) => c[0]
const rest = (c) => c.slice(1)
const find = (c, pred) => {
    for(var i = 0, len = c.length; i < len; i++) {
        let r = c[i]
        if(pred(r)) return r
    }
    return null
}
const concatAll = (cc) => [].concat(...cc)
const ignores = (c, ignore) => filter(c, (x) => ignore.indexOf(x) === -1)
const count = (a) => a.length

const prop = (val, onSet) => {
    return function(x){
        if(!arguments.length) return val
        val = x
        onSet instanceof Function && onSet(x, val)
        return val
    }
}

// const chan = () => {
//     const dests = new Set(),
//         pipe = (...args) => {
//             for(var x of dests) x(...args)
//         }

//     return {
//         from: cb => cb(pipe),
//         to: cb => dests.add(cb),
//         unto: cb => dests.remove(cb),
//         send: (...args) => pipe(...args)
//     }
// }

const channels = {
    codeEdited: channel(),
    codeChanged: channel(),
    updatePrepared: channel(),
    logEmitted: channel(),
    codeCleared: channel(),
    errorOccurred: channel(),
    codeAnalyzed: channel()
}

const computable = fn => {
    return (...args) => {
        // m.startComputation()
        let val = fn(...args)
        update()
        // m.endComputation()
        return val
    }
}

const prefix_code = (code) => `
const _log = (arg) => {
    if(typeof arg === 'function') return arg+''
    if(arg instanceof Object) return JSON.stringify(arg)
    return arg
}

const range = (min, max) =>
    min + Math.floor(Math.random() * (max - min + 1))

const reset = () => window.parent.reset()

const each = (c, fn) => c.forEach(fn)

const assert = (...args) => window.parent.assert(...args)

// https://wzrd.in/standalone/semver
// https://npmcdn.com/semver

const r = (semver, url='https://wzrd.in/standalone/') =>
    ((localStorage && (url+semver) in localStorage) ?
        new Promise((res,rej) => res(localStorage[url+semver])) :
        fetch(url+semver).then(x => x.text()).then(x => localStorage[url+semver] = x))
        .then(x => eval(x))
        .catch((e) => log(e+' --- '+url+semver))

const require = (...libs) =>
    Promise.all(libs.map(l =>
        r(l)))

const clearAll = () =>
    Object.keys(localStorage).map(x =>
        localStorage.clear(x))

const log = (...args) => {
    let x = args.map(_log)
    each(x, i => {
        window.parent.addLog(i)
    })
}

${code}
`

const iframe_el = prop()

const analyze = program => {
    try{
        window.location.hash = `#${escape(program.trim())}`

        const result = Babel.transform(prefix_code(program), {presets}),
              {code} = result

        channels.codeAnalyzed.spawn(function*(put,take) {
            yield put(code)
        })

        channels.errorOccurred.spawn(function*(put,take) {
            yield put(false)
        })
    } catch(e){
        let {stackFrame, message} = e,
            x = {stackFrame, message}

        channels.codeCleared.spawn(function*(put,take) {
            put(true)
        })

        channels.errorOccurred.spawn(function*(put,take) {
            put(x)
        })
    }

}

const execCode = debounce(
    transpiled => {
        codeframe.contentWindow.location.reload()
        channels.codeCleared.spawn(function*(put,take) {
            put(true)
        })
        codeframe.onload = () => {
            try {
                iframe_el().contentWindow.eval(transpiled)
            } catch(e) {
                let {stackFrame, message} = e,
                    x = {stackFrame, message}

                if(typeof e === 'string') x = {message: e}

                if(!x.stackFrame && !x.message){
                    let message = `Error thrown, however the value thrown is not handled as an instance of Error().`
                    x = {message}
                }

                channels.errorOccurred.spawn(function*(put,take) { put(x) })
            }
        }
    }
 , 250)

channels.codeEdited.spawn(function*(put,take) {
    while(true) {
        analyze(take()[1])
        yield
    }
})

channels.codeAnalyzed.spawn(function*(put,take) {
    while (true){
        let [status, transpiled] = take()
        transpiled && execCode(transpiled)
        yield
    }
})

const TwoPainz = () =>
    m('.grid.grid-2-800', Code, Results)

const edit = (cm, change) => {
    channels.codeEdited.spawn(function*(put,take) {
        put(editor.getValue())
    })
    channels.codeChanged.spawn(function* (put, take) {
        put(change)
    })
}

let editor = null

const Code = () => {
    const config = el => {
        editor = codemirror.fromTextArea(el, {
            lineNumbers: true,
            lineWrapping: true,
            indentUnit: 4,
            fixedGutter: true,
            mode: "javascript",
            keyMap: "sublime",
            extraKeys: {
                "Cmd-S": urlShortener,
                "Ctrl-S": urlShortener,
                "Ctrl-Space": displayPeerId
            },
            // foldGutter: true,
            inputStyle: "textarea",
            autofocus: true,
            theme: 'material'
        })
        editor.on('change', edit)
        rAF(_ => edit)
        channels.updatePrepared.spawn(function* (put, take) {
            while (true) {
                let value = take()[1]
                if (value !== void(0) && value !== null)
                    editor.setValue(value)
                yield
            }
        })
    }

    return m('div', {shouldUpdate: () => 0}, m('textarea', {config}, program))
}

let state = {
    logs: [],
    error: ''
}

const addLog = window.addLog = (...m) =>
    channels.logEmitted.spawn(function*(put,take) {
        put(m)
    })

const reset = window.reset = () =>
    channels.codeCleared.spawn(function*(put,take) {
        put(true)
    })

let clear = computable(() => state.logs = []),
    log = computable((...m) => state.logs = [...state.logs, ...m]),
    err = computable(e => state.error = e || '')

channels.codeCleared.spawn(function*(put, take) {
    while(true){
        take()
        clear()
        yield
    }
})

channels.logEmitted.spawn(function*(put, take) {
    while(true){
        let [s, val] = take()
        val && log(...val)
        yield
    }
})

channels.errorOccurred.spawn(function*(put, take) {
    while(true){
        err(take()[1])
        yield
    }
})

const Results = () => {
    const iframe = el => iframe_el(el) && edit()

    const getError = () =>
        state.error &&
        `${state.error}\n---------\n${state.error.codeFrame || state.error.message}`

    return m('.right-pane',
            m('iframe#codeframe',
                {src: './worker.html', config: iframe, shouldUpdate: _ => false}),
            m(`textarea.errors${state.error ? '.active' : ''}`,
                {readonly:true, value: getError() }),
            m(`textarea.logs${state.logs.length ? '.active' : ''}`,
                {readonly:true, value: state.logs.join('\n') }))

}

const app = () => {
    mount(TwoPainz, qs('.container'))
}

app()

// OT additions
const Peer = require('peerjs')
const OTP2PModel = require('ot-p2p-model').OTP2PModel
const queryString = require('query-string')
const query = queryString.parse(location.search)
const model = new OTP2PModel(program)
const p2p = new Peer(query.pid, { host: 'localhost', port: 3000, path: '/ot' });
const peers = new Set()

const displayPeerId = () => window.prompt('Copy pid to clipboard:', p2p.id)

var suppress = false

function addConn(conn) {
    conn.on('data', handleMessage)
    peers.add(conn)
}

p2p.on('open', id => {
    history.pushState(
        null,
        document.title,
        location.pathname + '?' +
        queryString.stringify(Object.assign({}, query, { pid: id })) +
        location.hash
    )
    if (query.room) {
        let conn = p2p.connect(query.room)
        conn.on('open', () => addConn(conn))
    }
})

p2p.on('connection', conn =>
    conn.on('open', () => {
        addConn(conn)
        sendPeerInit(conn)
    }))

const updateModelWithChange = change => {
    var { from, to, origin } = change
    var text = change.text.join('\n')
    var lines = model.get().split('\n')
    var lengths = lines.map((x, i) => ((i < lines.length - 1) && (lines.length > 1)) ? x.length + 1 : x.length)
    var pos = [
        lengths.reduce((a, x, i) => i < from.line ? a + x : a, 0) + from.ch,
        lengths.reduce((a, x, i) => i < to.line ? a + x : a, 0) + to.ch
    ];

    switch (origin) {
        case '+input':
            model.insert(pos[0], text)
            break
        case '+delete':
            model.delete(pos[0], pos[1] - pos[0])
            break
        case 'paste':
            model.delete(pos[0], pos[1] - pos[0])
            model.insert(pos[0], text)
            break
    }
}

channels.codeChanged.spawn(function* (put, take) {
    while (true) {
        let change = take()[1]
        // If suppress is `true`, we have already updated the model via remote op.
        // This doesn't matter currently, because we are using a weaksauce `setValue`
        // call to update the editor. `setValue` changes have the origin `setValue`,
        // but soon we will be applying explicit inserts/deletes because `setValue`
        // causes remote clients' cursors to jump to the start of the editor.
        if (change && !suppress) {
            updateModelWithChange(change)
        }
        yield
    }
})

const sendPeerInit = conn =>
    conn.send({
        type: 'init',
        model: model.exportModel(),
        history: model.exportHistory(),
        peers: [...peers].map(x => x.peer)
    })

const updateWithModel = () =>
    channels.updatePrepared.spawn(function* (put) {
        yield put(model.get())
    })

const remoteOp = op => {
    console.log('consuming op from peer', op)
    model.remoteOp(op.revision, op.op)
    suppress = true
    updateWithModel()
    suppress = false
}

const handlePeerInit = data => {
    var currIds = new Set([...peers].map(x => x.peer))
    model.importModel(data.model)
    model.importHistory(data.history)
    data.peers
        .filter(x => !currIds.has(x))
        .forEach(x => {
            let conn = p2p.connect(x)
            conn.on('open', () => addConn(conn))
        })
    updateWithModel()
}

const handleMessage = msg => {
    switch (msg.type) {
        case 'op':
            remoteOp(msg.op)
            break
        case 'init':
            handlePeerInit(msg)
            break
    }
}

model.on('broadcast', (op) => peers.forEach(x => x.send({ type: 'op', op })))