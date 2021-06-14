import type { RoutingChannel, Channel } from '@hoprnet/hopr-core-ethereum'
import { AcknowledgedTicket } from '@hoprnet/hopr-utils'
import PeerId from 'peer-id'
import BN from 'bn.js'
import {
  MINIMUM_REASONABLE_CHANNEL_STAKE,
  MAX_NEW_CHANNELS_PER_TICK,
  NETWORK_QUALITY_THRESHOLD,
  MAX_AUTO_CHANNELS
} from './constants'
import debug from 'debug'
import type NetworkPeers from './network/network-peers'
const log = debug('hopr-core:channel-strategy')

export type ChannelsToOpen = [PeerId, BN]
export type ChannelsToClose = PeerId
const dest = (c: ChannelsToOpen): PeerId => c[0]
const outgoingPeer = (c: RoutingChannel): PeerId => c[0]
const indexerDest = (c: RoutingChannel): PeerId => c[1]

/**
 * Staked nodes will likely want to automate opening and closing of channels. By
 * implementing the following interface, they can decide how to allocate their
 * stake to best attract traffic with a useful channel graph.
 *
 * Implementors should bear in mind:
 * - Churn is expensive
 * - Path finding will prefer high stakes, and high availability of nodes.
 */
export interface ChannelStrategy {
  name: string

  tick(
    balance: BN,
    newChannels: RoutingChannel[],
    currentChannels: RoutingChannel[],
    networkPeers: NetworkPeers,
    getRandomChannel: () => Promise<RoutingChannel>
  ): Promise<[ChannelsToOpen[], ChannelsToClose[]]>
  // TBD: Include ChannelsToClose as well.

  onChannelWillClose(c: Channel): Promise<void> // Before a channel closes
  onWinningTicket(t: AcknowledgedTicket, channel: Channel): Promise<void>
}


/*
 * Saves duplication of 'normal' behaviour.
 *
 * At present this does not take gas into consideration.
 */
abstract class SaneDefaults {
  async onWinningTicket(ack: AcknowledgedTicket, c: Channel) {
    log('auto redeeming')
    await c.redeemTicket(ack);
  }

  async onChannelWillClose(c: Channel) {
    log('auto redeeming')
    await c.redeemAllTickets()
  }
}

const logChannels = (c: ChannelsToOpen[]): string => c.map((x) => x[0].toB58String() + ':' + x[1].toString()).join(', ')
const logIndexerChannels = (c: RoutingChannel[]): string =>
  c.map((x) => x[1].toB58String() + ':' + x[2].toString()).join(', ')

// Don't auto open any channels
export class PassiveStrategy extends SaneDefaults implements ChannelStrategy {
  name = 'passive'

  async tick(
    _balance: BN,
    _n: RoutingChannel[],
    _c: RoutingChannel[],
    _p: NetworkPeers
  ): Promise<[ChannelsToOpen[], ChannelsToClose[]]> {
    return [[], []]
  }
}

// Open channel to as many peers as possible
export class PromiscuousStrategy extends SaneDefaults implements ChannelStrategy {
  name = 'promiscuous'

  async tick(
    balance: BN,
    _n: RoutingChannel[],
    currentChannels: RoutingChannel[],
    peers: NetworkPeers,
    getRandomChannel: () => Promise<RoutingChannel>
  ): Promise<[ChannelsToOpen[], ChannelsToClose[]]> {
    log('currently open', logIndexerChannels(currentChannels))
    let toOpen: ChannelsToOpen[] = []

    let i = 0
    let toClose = currentChannels
      .filter((x: RoutingChannel) => peers.qualityOf(indexerDest(x)) < 0.1)
      .map((x) => indexerDest(x))

    // First let's open channels to any interesting peers we have
    peers.all().forEach((peerId) => {
      if (
        balance.gtn(0) &&
        currentChannels.length + toOpen.length < MAX_AUTO_CHANNELS &&
        !toOpen.find((x) => dest(x).equals(peerId)) &&
        !currentChannels.find((x) => indexerDest(x).equals(peerId)) &&
        peers.qualityOf(peerId) > NETWORK_QUALITY_THRESHOLD
      ) {
        toOpen.push([peerId, MINIMUM_REASONABLE_CHANNEL_STAKE])
        balance.isub(MINIMUM_REASONABLE_CHANNEL_STAKE)
      }
    })

    // Now let's evaluate new channels
    while (
      balance.gtn(0) &&
      i++ < MAX_NEW_CHANNELS_PER_TICK &&
      currentChannels.length + toOpen.length < MAX_AUTO_CHANNELS
    ) {
      let randomChannel = await getRandomChannel()
      if (randomChannel === undefined) {
        log('no channel available')
        break
      }
      log('evaluating', outgoingPeer(randomChannel).toB58String())
      peers.register(outgoingPeer(randomChannel))
      if (
        !toOpen.find((x) => dest(x).equals(outgoingPeer(randomChannel))) &&
        !currentChannels.find((x) => indexerDest(x).equals(outgoingPeer(randomChannel))) &&
        peers.qualityOf(outgoingPeer(randomChannel)) > NETWORK_QUALITY_THRESHOLD
      ) {
        toOpen.push([outgoingPeer(randomChannel), MINIMUM_REASONABLE_CHANNEL_STAKE])
        balance.isub(MINIMUM_REASONABLE_CHANNEL_STAKE)
      }
    }
    log('Promiscuous toOpen: ', logChannels(toOpen))
    return [toOpen, toClose]
  }
}
