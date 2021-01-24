/// <reference path="./@types/it-handshake.ts" />

import debug from 'debug'
const log = debug('hopr-connect')
const error = debug('hopr-connect:error')
const verbose = debug('hopr-connect:verbose:error')

import AbortController from 'abort-controller'
import chalk from 'chalk'
import libp2p from 'libp2p'
import { WebRTCUpgrader } from './webrtc'

import handshake from 'it-handshake'

import Multiaddr from 'multiaddr'
import PeerId from 'peer-id'

import {
  RELAY_CIRCUIT_TIMEOUT,
  RELAY,
  DELIVERY,
  OK,
  FAIL,
  FAIL_COULD_NOT_REACH_COUNTERPARTY,
  FAIL_COULD_NOT_IDENTIFY_PEER,
  //FAIL_LOOPBACKS_ARE_NOT_ALLOWED,
  FAIL_INVALID_PUBLIC_KEY
} from './constants'

import { u8aCompare, u8aEquals, pubKeyToPeerId } from '@hoprnet/hopr-utils'

import { RelayContext } from './relayContext'

import { RelayConnection } from './relayConnection'
import { WebRTCConnection } from './webRTCConnection'

import type { Connection, DialOptions, Handler, Stream } from 'libp2p'
import { AbortError } from 'abortable-iterator'

type Libp2pStream = {
  protocol: string
  stream: Stream
}
class Relay {
  private _dialer: libp2p['dialer']
  private _registrar: libp2p['registrar']
  private _dht: libp2p['_dht']
  private _peerId: PeerId
  private _streams: Map<string, { [index: string]: RelayContext }>
  private _webRTCUpgrader?: WebRTCUpgrader

  constructor(libp2p: libp2p, webRTCUpgrader?: WebRTCUpgrader) {
    this._dialer = libp2p.dialer
    this._registrar = libp2p.registrar
    this._dht = libp2p._dht
    this._peerId = libp2p.peerId

    this._streams = new Map<string, { [index: string]: RelayContext }>()

    this._webRTCUpgrader = webRTCUpgrader

    libp2p.handle(RELAY, this.handleRelay.bind(this))
  }

  async establishRelayedConnection(
    ma: Multiaddr,
    relays: Multiaddr[],
    onReconnect: (newStream: RelayConnection, counterparty: PeerId) => Promise<void>,
    options?: DialOptions
  ): Promise<RelayConnection> {
    const destination = PeerId.createFromCID(ma.getPeerId())

    const invalidPeerIds = [ma.getPeerId(), this._peerId.toB58String()]

    for (const potentialRelay of relays) {
      if (options?.signal?.aborted) {
        throw new AbortError()
      }

      if (invalidPeerIds.includes(potentialRelay.getPeerId())) {
        log(`Skipping ${potentialRelay.getPeerId()} because we cannot use destination as relay node.`)
        continue
      }

      let relayConnection = await this._tryPotentialRelay(potentialRelay, destination, onReconnect, options)

      if (relayConnection != undefined) {
        return relayConnection as RelayConnection
      }
    }

    throw Error(
      `Unable to establish a connection to any known relay node. Tried ${chalk.yellow(
        relays
          .filter((ma) => invalidPeerIds.includes(ma.getPeerId()))
          .map((potentialRelay: Multiaddr) => potentialRelay.toString())
          .join(`, `)
      )}`
    )
  }

  private async _tryPotentialRelay(
    potentialRelay: Multiaddr,
    destination: PeerId,
    onReconnect: (newStream: RelayConnection, counterparty: PeerId) => Promise<void>,
    options?: DialOptions
  ): Promise<RelayConnection | WebRTCConnection | undefined> {
    let relayConnection: Connection
    try {
      relayConnection = await this.connectToRelay(potentialRelay, options)
    } catch (err) {
      error(err)
      return
    }

    let stream: Stream
    try {
      stream = await this.performHandshake(
        relayConnection,
        PeerId.createFromCID(potentialRelay.getPeerId()),
        destination
      )
    } catch (err) {
      error(err)
      return
    }

    if (stream == null) {
      error(`Handshake led to empty stream. Giving up.`)
      return
    }

    if (options?.signal?.aborted) {
      throw new AbortError()
    }

    if (this._webRTCUpgrader != undefined) {
      let channel = this._webRTCUpgrader.upgradeOutbound()

      let newConn = new RelayConnection({
        stream,
        self: this._peerId,
        counterparty: destination,
        onReconnect,
        webRTC: {
          channel,
          upgradeInbound: this._webRTCUpgrader.upgradeInbound.bind(this._webRTCUpgrader)
        }
      })

      return new WebRTCConnection(
        {
          conn: newConn,
          self: this._peerId,
          counterparty: destination,
          channel
        },
        options
      )
    } else {
      return new RelayConnection({
        stream,
        self: this._peerId,
        counterparty: destination,
        onReconnect
      })
    }
  }

  async handleRelayConnection(
    conn: Handler,
    onReconnect: (newStream: RelayConnection, counterparty: PeerId) => Promise<void>
  ): Promise<RelayConnection | WebRTCConnection | undefined> {
    const handShakeResult = await this.handleHandshake(conn.stream)

    if (handShakeResult == undefined) {
      return
    }

    log(`incoming connection from ${handShakeResult.counterparty.toB58String()}`)

    log(`counterparty relayed connection established`)

    if (this._webRTCUpgrader != undefined) {
      let channel = this._webRTCUpgrader.upgradeInbound()

      let newConn = new RelayConnection({
        stream: handShakeResult.stream,
        self: this._peerId,
        counterparty: handShakeResult.counterparty,
        onReconnect,
        webRTC: {
          channel,
          upgradeInbound: this._webRTCUpgrader.upgradeInbound.bind(this._webRTCUpgrader)
        }
      })

      return new WebRTCConnection({
        conn: newConn,
        self: this._peerId,
        counterparty: handShakeResult.counterparty,
        channel
      })
    } else {
      return new RelayConnection({
        stream: handShakeResult.stream,
        self: this._peerId,
        counterparty: handShakeResult.counterparty,
        onReconnect
      })
    }
  }

  private async connectToRelay(relay: Multiaddr, options?: DialOptions): Promise<Connection> {
    let relayConnection = this._registrar.getConnection(PeerId.createFromCID(relay.getPeerId()))

    if (relayConnection == undefined || relayConnection == null) {
      try {
        relayConnection = await this._dialer.connectToPeer(relay, { signal: options?.signal })
      } catch (err) {
        log(`Could not reach potential relay ${relay.getPeerId()}. Error was: ${err}`)
        if (this._dht != null && (options == null || options.signal == null || !options.signal.aborted)) {
          let newAddress = await this._dht.peerRouting.findPeer(PeerId.createFromCID(relay.getPeerId()))

          try {
            relayConnection = await this._dialer.connectToPeer(newAddress.multiaddrs[0], { signal: options?.signal })
          } catch (err) {
            throw new Error(`Dialling potential relay ${relay.getPeerId()} after querying DHT failed. Error was ${err}`)
          }
        } else {
          throw Error(
            `Could not reach relay ${relay.toString()} and we have no opportunity to find out a more recent address.`
          )
        }
      }

      if (options?.signal?.aborted) {
        if (relayConnection != null) {
          try {
            await relayConnection.close()
          } catch (err) {
            error(err)
          }
        }
        throw new Error()
      }
    }

    return relayConnection
  }

  private async performHandshake(relayConnection: Connection, relay: PeerId, destination: PeerId): Promise<Stream> {
    let stream: Libp2pStream

    try {
      stream = await relayConnection.newStream([RELAY])
    } catch (err) {
      throw Error(`Failed to establish new stream on protocol ${RELAY} with ${relay.toB58String()}. Error was: ${err}`)
    }

    let shaker = handshake<Uint8Array>(stream.stream)

    shaker.write(destination.pubKey.marshal())

    let answer: Uint8Array | undefined
    try {
      answer = (await shaker.read())?.slice()
      log(`received answer ${new TextDecoder().decode(answer)}`)
    } catch (err) {
      throw Error(`Error while reading answer. Error was ${err}`)
    }

    shaker.rest()

    if (answer == undefined || answer == null || !u8aEquals(answer, OK)) {
      throw Error(
        `Could not establish relayed connection to ${chalk.blue(
          destination.toB58String()
        )} over relay ${relay.toB58String()}. Answer was: <${new TextDecoder().decode(answer)}>`
      )
    }

    return shaker.stream
  }

  private async handleHandshake(stream: Stream): Promise<{ stream: Stream; counterparty: PeerId } | undefined> {
    let shaker = handshake<Uint8Array>(stream)

    let pubKeySender: Uint8Array | undefined
    try {
      pubKeySender = (await shaker.read())?.slice()
    } catch (err) {
      error(err)
    }

    if (pubKeySender == undefined || pubKeySender == null) {
      error(`Received empty message. Ignoring connection ...`)
      shaker.write(FAIL)
      shaker.rest()
      return
    }

    let counterparty: PeerId
    try {
      counterparty = await pubKeyToPeerId(pubKeySender)
    } catch (err) {
      error(`Could not decode sender peerId. Error was: ${err}`)
      shaker.write(FAIL)
      shaker.rest()
      return
    }

    shaker.write(OK)
    shaker.rest()

    return { stream: shaker.stream, counterparty }
  }

  private async handleRelay({ stream, connection }: Handler): Promise<void> {
    log(`handle relay request`)
    const shaker = handshake<Uint8Array>(stream)

    let pubKeySender: Uint8Array | undefined

    try {
      pubKeySender = (await shaker.read())?.slice()
    } catch (err) {
      error(err)
    }

    if (connection == undefined || connection.remotePeer == undefined) {
      error(`Could not identify peer. Ending relayed connection.`)
      shaker.write(FAIL_COULD_NOT_IDENTIFY_PEER)
      shaker.rest()
      return
    }

    if (pubKeySender == undefined || pubKeySender == null) {
      error(
        `Received empty message from peer ${chalk.yellow(
          connection.remotePeer.toB58String()
        )}. Ending stream because we cannot identify counterparty.`
      )
      shaker.write(FAIL)
      shaker.rest()
      return
    }

    let counterparty: PeerId
    try {
      counterparty = await pubKeyToPeerId(pubKeySender)
    } catch (err) {
      error(
        `Peer ${chalk.yellow(
          connection.remotePeer.toB58String()
        )} asked to establish relayed connection to invalid counterparty. Error was ${err}. Received message ${pubKeySender}`
      )
      shaker.write(FAIL_INVALID_PUBLIC_KEY)
      shaker.rest()
      return
    }

    log(`counterparty identified as ${counterparty.toB58String()}`)

    // @TODO check if we should allow loopbacks
    // if (connection.remotePeer != null && counterparty.equals(connection.remotePeer)) {
    //   error(`Peer ${connection.remotePeer} is trying to loopback to itself. Dropping connection.`)
    //   shaker.write(FAIL_LOOPBACKS_ARE_NOT_ALLOWED)
    //   shaker.rest()
    //   return
    // }

    const channelId = getId(connection.remotePeer, counterparty)

    let contextEntry = this._streams.get(channelId)

    if (contextEntry != undefined) {
      verbose(`Relay context between ${connection.remotePeer.toB58String()} and ${counterparty.toB58String()} exists.`)

      const latency = await contextEntry[counterparty.toB58String()].ping()

      verbose(`Latency to ${connection.remotePeer.toB58String()}: ${latency}ms`)
      if (latency >= 0) {
        verbose(`stream to ${counterparty.toB58String()} is alive (latency: ${latency} ms). Using existing stream`)

        shaker.write(OK)
        shaker.rest()

        contextEntry[connection.remotePeer.toB58String()].update(shaker.stream)

        return
      }
      verbose(`stream to ${counterparty.toB58String()} is NOT alive. Establishing a new one`)
    }

    log(
      `${connection.remotePeer.toB58String()} to ${counterparty.toB58String()} had no connection. Establishing a new one`
    )

    let deliveryStream: Stream

    try {
      deliveryStream = await this.establishForwarding(connection.remotePeer, counterparty)
    } catch (err) {
      shaker.write(FAIL_COULD_NOT_REACH_COUNTERPARTY)
      shaker.rest()

      if (contextEntry != undefined) {
        // @TODO close previous instances
        this._streams.delete(channelId)
      }

      error(
        `Could not establish relayed connection because contacting ${counterparty.toB58String()} was not successful. Error was: ${err}`
      )

      // Break up connection attempt
      return
    }

    shaker.write(OK)
    shaker.rest()

    const senderContext = new RelayContext(shaker.stream)
    const counterpartyContext = new RelayContext(deliveryStream)

    senderContext.sink(counterpartyContext.source)
    counterpartyContext.sink(senderContext.source)

    contextEntry = {
      [connection.remotePeer.toB58String()]: senderContext,
      [counterparty.toB58String()]: counterpartyContext
    }

    this._streams.set(channelId, contextEntry)
  }

  private async establishForwarding(initiator: PeerId, counterparty: PeerId): Promise<Stream> {
    let timeout: NodeJS.Timeout | undefined

    let newConn = this._registrar.getConnection(counterparty)

    if (newConn == undefined || newConn == null) {
      const abort = new AbortController()

      timeout = setTimeout(() => abort.abort(), RELAY_CIRCUIT_TIMEOUT)

      try {
        newConn = await this._dialer.connectToPeer(counterparty, { signal: abort.signal })
      } catch (err) {
        error(err)
        if (this._dht != null && !abort.signal.aborted) {
          try {
            let newAddress = await this._dht.peerRouting.findPeer(counterparty)

            newConn = await this._dialer.connectToPeer(newAddress.multiaddrs[0], { signal: abort.signal })
          } catch (err) {
            clearTimeout(timeout)

            throw Error(
              `Could not establish forwarding connection to ${counterparty.toB58String()} after querying the DHT. Error was: ${err}`
            )
          }
        }

        clearTimeout(timeout)

        throw Error(`Could not establish forwarding connection to ${counterparty.toB58String()}. Error was: ${err}`)
      }
    }

    const { stream: newStream } = await newConn.newStream([DELIVERY])

    if (timeout != undefined) {
      clearTimeout(timeout)
    }

    const toCounterparty = handshake<Uint8Array>(newStream)

    toCounterparty.write(initiator.pubKey.marshal())

    let answer: Uint8Array | undefined
    try {
      answer = (await toCounterparty.read())?.slice()
    } catch (err) {
      newConn.close()
      throw Error(`Error while trying to decode answer. Error was: ${err}`)
    }

    toCounterparty.rest()

    if (answer == undefined || answer == null || !u8aEquals(answer, OK)) {
      newConn.close()
      throw Error(`Could not relay to peer ${counterparty.toB58String()} because we are unable to deliver packets.`)
    }

    return toCounterparty.stream
  }
}

function getId(a: PeerId, b: PeerId) {
  const cmpResult = u8aCompare(a.pubKey.marshal(), b.pubKey.marshal())

  switch (cmpResult) {
    case 1:
      return `${a.toB58String()}${b.toB58String()}`
    default:
      return `${b.toB58String()}${a.toB58String()}`

    // @TODO check if we should allow loopbacks
    // default:
    //   throw Error(`Invalid compare result`)
  }
}

export default Relay
