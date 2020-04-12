"use strict"

const fs = require('fs')

const FLIPPER_ABI = require('./abis/flipper-abi')
const OSM_ABI = require('./abis/osm-abi')
const CAT_ABI = require('./abis/cat-abi')

const FLIPPER_EVENTS_RAW_FILE = 'data/flip-events-raw.json'
const OSMPRICE_EVENTS_RAW_FILE = 'data/osm-events-raw.json'
const BLOCK_INFO_FILE = 'data/blockInfo.json'

const FLIPPER_START_BLOCK = 8800000

const ETH_FLIP_ADDRESS = "0xd8a04f5412223f513dc55f839574430f5ec15531"
const OSM_ADDRESS = "0x81FE72B5A8d1A857d176C3E7d5Bd2679A9B85763"
const CAT_ADDRESS = "0x78F2c2AF65126834c51822F56Be0d7469D7A523E"
const FLIP_ILK = "0x4554482d41000000000000000000000000000000000000000000000000000000"

const Web3 = require('web3')
const parseEvents = require('./parse')

const infura = "wss://mainnet.infura.io/ws/v3/52bd875c563a4d6abff4d396bac8a8a5"
const provider = new Web3.providers.WebsocketProvider(infura)
const web3 = new Web3(provider)
console.log("Using infura web3 provider")

const flipContract = new web3.eth.Contract(FLIPPER_ABI, ETH_FLIP_ADDRESS)
const osmContract = new web3.eth.Contract(OSM_ABI, OSM_ADDRESS);
const catContract = new web3.eth.Contract(CAT_ABI, CAT_ADDRESS);

let lastBlockNr

function getFlipEvents(fromBlock, toBlock) {
    return flipContract.getPastEvents("allEvents", {
        fromBlock: fromBlock,
        toBlock: toBlock
    },
    function (err, result) {
        if (!err) {
            return result
        } else {
            console.err(err)
            return []
        }
    })
}

// too big [fromBlock,toBlock] block ranges cause provider crash.
// here are experemental
function dynamicChunkLen(fromBlock) {
    let blocks    = [8000000, 9655000, 9657000, 9657500, 9661000, 9661125, 10000000]
    let chunkLen =  [100000,  500,     100,     50,      25,      5000,    20000]
    let idx = blocks.findIndex(e=>e>fromBlock)-1
    let step = chunkLen[idx]
    return Math.min(step, blocks[idx+1]-fromBlock)
}

let flipperEvents = []
// read existing events file to append and returns block number next to last saved.
function readFetchedFlipEvents() {
    if (fs.existsSync(FLIPPER_EVENTS_RAW_FILE)) {
        let eventsJson = fs.readFileSync(FLIPPER_EVENTS_RAW_FILE)
        flipperEvents = JSON.parse(eventsJson)
        let unseedBlockNr = flipperEvents.reduce((a,b)=>a.blockNumber>b.blockNumber?a.blockNumber:b.blockNumber,0) + 1 // return 1st unseen block
        console.log('Appending existing file', FLIPPER_EVENTS_RAW_FILE, 'starting from block', unseedBlockNr)
        return unseedBlockNr
    } else {
        console.log('File', FLIPPER_EVENTS_RAW_FILE, 'not found. Fetching from block', FLIPPER_START_BLOCK)
        return FLIPPER_START_BLOCK
    }
}

async function fetchFlipperFeed(startingBlock) {
    console.log('\nstart fetching FLIPPER events from block', startingBlock)
    let fromBlock=startingBlock
    while(fromBlock<lastBlockNr) {
        let chunkLen = dynamicChunkLen(fromBlock)
        let toBlock = fromBlock+chunkLen-1
        if (toBlock>=lastBlockNr) toBlock = 'latest'
        let result = await getFlipEvents(fromBlock, toBlock)
        console.log('FLIPPER: from:', fromBlock, 'chunkLen:', chunkLen, 'toBlock:', toBlock, 'fetched events: ', result.length)
        flipperEvents.push(...result)
        if (toBlock=='latest') break
        else fromBlock+=chunkLen
    }
    fs.writeFileSync(FLIPPER_EVENTS_RAW_FILE,JSON.stringify(flipperEvents, null, 4))
    console.log(" ", flipperEvents.length,"flip events were saved to the file ", FLIPPER_EVENTS_RAW_FILE)
    return flipperEvents
}

// Get the price in the given block number and populate last price global variable
var osmPrice = 0;
async function fetchOsmPriceFeed(startingBlock) {
    let osmEvents = []
    const CHUNK_LEN = 600000
    console.log('\nstart fetching OSM events from blockNr:', startingBlock, 'with chunkLen:', CHUNK_LEN)
    for(let fromBlock=startingBlock; fromBlock<lastBlockNr; fromBlock+=CHUNK_LEN) {
        let toBlock = fromBlock + CHUNK_LEN - 1
        if (toBlock > lastBlockNr) toBlock = 'latest'
        let chunk = await osmContract.getPastEvents("LogValue", {
                fromBlock: fromBlock,
                toBlock: toBlock
            },
            function (err, result) {
                if (!err) {
                    return result
                } else {
                    console.log(err);
                }
            })
        console.log('OSM: from:', fromBlock, 'toBlock:', toBlock, 'fetched events:', chunk.length)
        osmEvents.push(...chunk)
    }
    fs.writeFileSync(OSMPRICE_EVENTS_RAW_FILE, JSON.stringify(osmEvents, null, 4))
    console.log(" ", osmEvents.length,"osm events were saved to the file ", OSMPRICE_EVENTS_RAW_FILE)
}

// Get the price in the given block number and populate last price global variable
async function fetchBlockInfo() {
    let block = await web3.eth.getBlock(9838165)
    let blockNumbers = flipperEvents.map(e=>e.blockNumber)
    let uniqs = [...new Set(blockNumbers)]
    console.log('blockNrs: ', blockNumbers.length, 'uniqs: ',uniqs.length)
    let p_blocks = uniqs.map(blockNr => web3.eth.getBlock(blockNr))
    console.log(p_blocks)
    let blocks = await Promise.all(p_blocks)
    fs.writeFileSync(BLOCK_INFO_FILE, JSON.stringify(blocks, null, 4))
    console.log(" ", blockNumbers.length,"blocks were saved to the file ", BLOCK_INFO_FILE)
}

(async function() {
    lastBlockNr = await web3.eth.getBlockNumber()
    console.log('lastBlockNr:', lastBlockNr)
    let latestFetchedBlock = readFetchedFlipEvents()
    await fetchFlipperFeed(latestFetchedBlock)
    await fetchBlockInfo()
    await fetchOsmPriceFeed(FLIPPER_START_BLOCK) 
    provider.disconnect()
    console.log('DONE!')
})()
