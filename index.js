"use strict"

const fs = require('fs')
const { parseFlipEvents, parseOsmEvent } = require('./parse')

const FLIPPER_EVENTS_RAW_FILE = 'data/flip-events-raw.json'
const AUCTIONS_FILE = 'data/auctions.json'
const RESULT_FILE = 'data/flip-events-RESULT.json'
const OSMPRICE_EVENTS_RAW_FILE = 'data/osm-events-raw.json'
const BLOCK_INFO_FILE = 'data/block-info.json'
const TX_INFO_FILE = 'data/tx-info.json'


// Get instance of contracts
const flipperRawEvents = JSON.parse( fs.readFileSync(FLIPPER_EVENTS_RAW_FILE) )
const flipperEvents = parseFlipEvents(flipperRawEvents)
console.log('FLIPPER events parsed and saved: ',flipperEvents.length)

function estimatePrice(blockNumber, osmPriceFeed) {
    let p = osmPriceFeed.findIndex(e=>e.blockNumber>blockNumber)
    if (p == 0) {
        return osmPriceFeed[0].price
    } if (p == -1) {
        return osmPriceFeed[osmPriceFeed.length-1].price
    } else {
        let k = (blockNumber - osmPriceFeed[p-1].blockNumber) / (osmPriceFeed[p].blockNumber - osmPriceFeed[p-1].blockNumber)
        return osmPriceFeed[p-1].price + k * (osmPriceFeed[p].price - osmPriceFeed[p-1].price)
    }
}

const blockInfo = JSON.parse( fs.readFileSync(BLOCK_INFO_FILE) )
    .reduce((blockInfo,block) => ((blockInfo[block.number] = {
        timestamp: block.timestamp,
    }),blockInfo),{})

const txInfo = JSON.parse( fs.readFileSync(TX_INFO_FILE) )
    .reduce((txInfo,tx) => ((txInfo[tx.hash] = {
        from: tx.from,
        gasPrice: tx.gasPrice
    }),txInfo),{})

const osmPriceFeed = JSON.parse ( fs.readFileSync(OSMPRICE_EVENTS_RAW_FILE) )
    .map(e=>parseOsmEvent(e))
    .filter(e=> e.price > 0) //filter out zero price elements
    .sort((a, b) => a.blockNumber - b.blockNumber)

const allFlipperEvents = flipperEvents.map(e=>({
    ...e,
    ...txInfo[e.txHash], 
    ...blockInfo[e.blockNumber],
    market_price: estimatePrice(e.blockNumber, osmPriceFeed)
}))

fs.writeFileSync(RESULT_FILE, JSON.stringify(allFlipperEvents, null, 4))
console.log('DONE: ',allFlipperEvents.length,'FLIPPER RESULT events parsed and saved into: ', RESULT_FILE)

const auctions = {}
allFlipperEvents.forEach(e=> {
    if (e.flipId && !auctions[e.flipId]) auctions[e.flipId] = {}
    if (e.type == "DEAL") {
        auctions[e.flipId] = { 
            ... auctions[e.flipId],
            gasPrice: e.gasPrice,
            timestamp: e.timestamp,
            market_price: e.market_price
        }
    } else {
        if (e.type == "TEND" || e.type == "DENT") {
            let auction = auctions[e.flipId]
            let bid_price = e.bid / e.lot
            let best_price = auction.best_price
            if (!best_price || best_price < bid_price) { 
                auction.best_price = bid_price
            }
            auction.lot = e.lot
        }
    }
})

fs.writeFileSync(AUCTIONS_FILE, JSON.stringify(auctions, null, 4))
