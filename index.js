"use strict"

const fs = require('fs')
const parseEvents = require('./parse')

const FLIPPER_EVENTS_RAW_FILE = 'data/flip-events-raw.json'
const FLIPPER_EVENTS_FILE = 'data/flip-events.json'
const RESULT_FILE = 'data/flip-events-RESULT.json'
const OSMPRICE_EVENTS_RAW_FILE = 'data/osm-events-raw.json'
const BLOCK_INFO_FILE = 'data/block-info.json'
const TX_INFO_FILE = 'data/tx-info.json'


// Get instance of contracts
const flipperRawEvents = JSON.parse( fs.readFileSync(FLIPPER_EVENTS_RAW_FILE) )
const flipperEvents = parseEvents(flipperRawEvents)
console.log('FLIPPER events parsed and saved: ',flipperEvents.length)

const blockInfo = JSON.parse( fs.readFileSync(BLOCK_INFO_FILE) )
    .reduce((blockInfo,block) => ((blockInfo[block.number] = {
        timestamp: block.timestamp,
    }),blockInfo),{})

const txInfo = JSON.parse( fs.readFileSync(TX_INFO_FILE) )
    .reduce((txInfo,tx) => ((txInfo[tx.hash] = {
        from: tx.from,
        gasPrice: tx.gasPrice
    }),txInfo),{})

const result = flipperEvents.map(e=>({
    ...e,
    ...txInfo[e.txHash], 
    ...blockInfo[e.blockNumber],
}))    
fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 4))
console.log('DONE: ',result.length,'FLIPPER RESULT events parsed and saved into: ', RESULT_FILE)