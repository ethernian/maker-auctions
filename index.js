"use strict"

const fs = require('fs')
const parseEvents = require('./parse')

const FLIPPER_EVENTS_RAW_FILE = 'data/flip-events-raw.json'
const FLIPPER_EVENTS_FILE = 'data/flip-events.json'


// Get instance of contracts
const flipperRawEvents = JSON.parse( fs.readFileSync(FLIPPER_EVENTS_RAW_FILE) )
const flipperEvents = parseEvents(flipperRawEvents)
fs.writeFileSync(FLIPPER_EVENTS_FILE, JSON.stringify(flipperEvents, null, 4))
console.log('DONE: FLIPPER events parsed and saved: ',flipperEvents.length)
