"use strict"

const fs = require('fs')
const { parseFlipEvents, parseOsmEvent, parseGQLPriceFeed } = require('./parse')

const FLIPPER_EVENTS_RAW_FILE = 'data/flip-events-raw.json'
const AUCTIONS_FILE = 'data/auctions.json'
const RESULT_FILE = 'data/flip-events-RESULT.json'
const OSMPRICE_EVENTS_RAW_FILE = 'data/osm-events-raw.json'
const BLOCK_INFO_FILE = 'data/block-info.json'
const TX_INFO_FILE = 'data/tx-info.json'
const DAIUSD_GQL_PRICEFEED_FILES = [
    "data_feeds/daiusd-pricefeed-santiment-201911.json",
    "data_feeds/daiusd-pricefeed-santiment-201912.json",
    "data_feeds/daiusd-pricefeed-santiment-202001.json",
    "data_feeds/daiusd-pricefeed-santiment-202002.json",
    "data_feeds/daiusd-pricefeed-santiment-202003.json",
    "data_feeds/daiusd-pricefeed-santiment-202004up15.json"
]
const ETHUSD_GQL_PRICEFEED_FILES = [
    "data_feeds/ethusd-pricefeed-santiment-201911.gql",
    "data_feeds/ethusd-pricefeed-santiment-201912.gql",
    "data_feeds/ethusd-pricefeed-santiment-202001.gql",
    "data_feeds/ethusd-pricefeed-santiment-202002.gql",
    "data_feeds/ethusd-pricefeed-santiment-202003.gql",
    "data_feeds/ethusd-pricefeed-santiment-202004up13.gql"
]


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
        let price  =  parseFloat(osmPriceFeed[p-1].price) + k * (osmPriceFeed[p].price - osmPriceFeed[p-1].price)
        return price
    }
}

function interpolate(priceFeed, p0, field1, field2) {
    let idx = priceFeed.findIndex(e=>e[field1]>p0)
    if (idx == 0) {
        return priceFeed[0][field2]
    } if (idx == -1) {
        return priceFeed[priceFeed.length-1][field2]
    } else {
        let k = (p0 - priceFeed[idx-1][field1]) / (priceFeed[idx][field1] - priceFeed[idx-1][field1])
        return  parseFloat(priceFeed[idx-1][field2]) + k * (priceFeed[idx][field2] - priceFeed[idx-1][field2])
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
    osm_price_ethusd: estimatePrice(e.blockNumber, osmPriceFeed)
}))


fs.writeFileSync(RESULT_FILE, JSON.stringify(allFlipperEvents, null, 4))
console.log('DONE: ',allFlipperEvents.length,'FLIPPER RESULT events parsed and saved into: ', RESULT_FILE)

const auctions = {}
allFlipperEvents.forEach(e=> {
    if (e.flipId && !auctions[e.flipId]) auctions[e.flipId] = { id: e.flipId }
  if (e.type == "DEAL") {
        auctions[e.flipId] = { 
            ... auctions[e.flipId],
            gasPrice_GWei: e.gasPrice / 10 ** 9,
            timestamp: e.timestamp,
            datetime: new Date(e.timestamp * 1000),
            blockNumber: e.blockNumber,
            lastbid_blocks_before:  auctions[e.flipId].lastbid_blockNumber - e.blockNumber,
            osm_price_ethusd: e.osm_price_ethusd,
            txCost:  e.osm_price_ethusd * 51285 / 10 ** 9 * e.gasPrice / 10 ** 9, 
            state: "CLOSED"
        }
    } else {
        if (e.type == "TEND" || e.type == "DENT") {
            let auction = auctions[e.flipId]
            if (auction.state == "CLOSED") {
                throw new Error('DENT/TEND to closed auction')
            }
            let bid_price = e.bid / e.lot
            let best_price = auction.best_price_ethdai
            if (!best_price || best_price < bid_price) { 
                auction.state == "RUNNING"
                auction.best_price_ethdai = bid_price
                auction.lastbid_osm_price_ethusd = e.osm_price_ethusd
                auction.osm_price_ethusd = e.osm_price_ethusd //WORKAROUND HACK
                auction.lot = e.lot
                auction.lastbid_timestamp = e.timestamp
                auction.lastbid_datetime = new Date(e.timestamp * 1000)
                auction.lastbid_blockNumber = e.blockNumber
                auction.bidCount = (auction.bidCount || 0 )  + 1
                auction.lastbid_txHash = e.txHash  
                auction.lastbid_txCost_USD = e.osm_price_ethusd * 99657 / 10 ** 9 * e.gasPrice / 10 ** 9 
            } else if (e.blockNumber >= auction.blockNumber) {
                throw new Error(' later bid has lowered the price!')
            } else {
                // earlier bids with lower price got processed later - just ignore them
            }
    }
    }
})

let ethusd_feed = parseGQLPriceFeed(ETHUSD_GQL_PRICEFEED_FILES.map(f=>JSON.parse(fs.readFileSync(f))))
let daiusd_feed = parseGQLPriceFeed(DAIUSD_GQL_PRICEFEED_FILES.map(f=>JSON.parse(fs.readFileSync(f))))

Object.values(auctions).map(auction=>{
    auction.san_price_ethusd = interpolate(ethusd_feed, auction.timestamp, "timestamp", "value")
    auction.san_price_daiusd = interpolate(daiusd_feed, auction.timestamp, "timestamp", "value")
    auction.osm_profit = auction.osm_price_ethusd - auction.best_price_ethdai
    auction.osm_profit_ratio = auction.osm_profit / auction.osm_price_ethusd
    auction.san_profit = auction.san_price_ethusd - auction.best_price_ethdai
    auction.san_profit_ratio = auction.san_profit / auction.san_price_ethusd
    auction.sanosm_price_diff = Math.abs(auction.san_price_ethusd - auction.osm_price_ethusd)
})

fs.writeFileSync(AUCTIONS_FILE, JSON.stringify(auctions, null, 4))

const { parse } = require('json2csv');
const fields = [
    "state",
    "best_price",
    "osm_price_ethusd",
    "lot",
    "lastbid_timestamp",
    "lastbid_datetime", 
    "lastbid_blockNumber", 
    "bidCount",
    "lastbid_txHash",
    "lastbid_txCost_USD",
    "gasPrice_GWei",
    "timestamp",
    "datetime",
    "blockNumber",
    "lastbid_blocks_before",
    "txCost",
    "profit",
    "profit_ratio",
]
const csv = Object.keys(auctions).map(id=>({
    "id" : id,
    ... auctions[id]
}))
const csvData = parse(csv, fields);
fs.writeFileSync(AUCTIONS_FILE.replace('json','csv'), csvData)