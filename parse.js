// Events types signatures to be processed
const TEND = "0x4b43ed1200000000000000000000000000000000000000000000000000000000"
const DENT = "0x5ff3a38200000000000000000000000000000000000000000000000000000000"
const DEAL = "0xc959c42b00000000000000000000000000000000000000000000000000000000"
const TICK = "0xfc7b6aee00000000000000000000000000000000000000000000000000000000"
const FILE = "0x29ae811400000000000000000000000000000000000000000000000000000000"
const DENY = "0x9c52a7f100000000000000000000000000000000000000000000000000000000"
const RELY = "0x65fae35e00000000000000000000000000000000000000000000000000000000"

// FILE subtype constants
const BEG = "0x6265670000000000000000000000000000000000000000000000000000000000"
const TAU = "0x7461750000000000000000000000000000000000000000000000000000000000"
const TTL = "0x74746c0000000000000000000000000000000000000000000000000000000000"

function parseFlipEvent(event) {
    // Event types cases
    if (event.event === "Kick") {
        return {
            type: "KICK",
            flipId: parseInt(event.returnValues.id, 10),
            lot: event.returnValues.lot / 10 ** 18,
            tab: event.returnValues.tab / 10 ** 27 / 10 ** 18,
        }
    } else if (event.raw.topics[0] === TEND) {
        let raw = event.raw.data.slice(289, -248)
        return {
            type: "TEND",
            flipId: parseInt(event.raw.topics[2], 16),
            lot: parseInt(event.raw.topics[3], 16) / 10 ** 18,
            raw: raw,
            bid: parseInt(raw, 16) / 10 ** 27 / 10 ** 18,
        }
    } else if (event.raw.topics[0] === DENT) {
        let raw = event.raw.data.slice(289, -248)
        return {
            type: "DENT",
            flipId: parseInt(event.raw.topics[2], 16),
            lot: parseInt(event.raw.topics[3], 16) / 10 ** 18,
            raw: raw,
            bid: parseInt(raw, 16) / 10 ** 27 / 10 ** 18, //in DAI
        }    
    } else if (event.raw.topics[0] === DEAL) {
        return {
            type: "DEAL",
            flipId: parseInt(event.raw.topics[2], 16),
        }
    } else if (event.raw.topics[0] === TICK) {
        return {
            type: "TICK",
            flipId: parseInt(event.raw.topics[2], 16)
        }    
    } else if (event.raw.topics[0] === FILE) {
        if (event.raw.topics[2] === BEG) {
            let value = parseInt(event.raw.topics[3]) / 10 ** 18
            value = (value - 1) * 100
            return {
                type: "FILE",
                name: "BEG",
                value: value 
            }
        } else if (event.raw.topics[2] === TAU) {
            let value = parseInt(event.raw.topics[3])
            value = value / 60 / 60
            return {
                type: "FILE",
                name: "TAU",
                value: value 
            }
        } else if (event.raw.topics[2] === TTL) {
            let value = parseInt(event.raw.topics[3])
            value = value / 60
            return {
                type: "FILE",
                name: "TTL",
                value: value 
            }
        } else {
            console.log('UNKNOWN FILE topic', event.raw.topics)
            return undefined
        }
    } else if (event.raw.topics[0] === RELY) {
        let usr = event.raw.topics[2]
        return {
            type: "RELY",
            value: "0x" + usr.slice(-40)
        }
    } else if (event.raw.topics[0] === DENY) {
        let usr = event.raw.topics[2]
        return {
            type: "DENY",
            value: "0x" + usr.slice(-40)
        }
    } else {
        console.log("Unknown event", event)
        return undefined
    }
}

const web3 = new require('web3')
module.exports = {
    parseFlipEvents: function (events) {
        return events.map((event, i) => {
            let e = parseFlipEvent(event)
            if (e) return {
                ...e,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash,
            }
        }).filter(e=>e)  //filter out undefined (unknown) events
    },
    parseOsmEvent : function (osmEvent) {
        var priceInWei = web3.utils.toBN(osmEvent.returnValues[0])
        return {
            blockNumber: osmEvent.blockNumber,
            price: web3.utils.fromWei(priceInWei)
        }
    }
}