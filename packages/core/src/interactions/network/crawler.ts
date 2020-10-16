import type Hopr from '../../'
import type HoprCoreConnector from '@hoprnet/hopr-core-connector-interface'

import type { Handler } from '../../@types/transport'

import debug from 'debug'
const log = debug('hopr-core:crawler')
const verbose = debug('hopr-core:verbose:crawl-interaction')

import pipe from 'it-pipe'
import chalk from 'chalk'

import type { AbstractInteraction } from '../abstractInteraction'

import { PROTOCOL_CRAWLING } from '../../constants'
import PeerId from 'peer-id'
import Multiaddr from 'multiaddr'

import { CrawlResponse, CrawlStatus } from '../../messages'

class Crawler<Chain extends HoprCoreConnector> implements AbstractInteraction {
  protocols: string[] = [PROTOCOL_CRAWLING]

  constructor(public node: Hopr<Chain>) {
    this.node.handle(this.protocols, this.handler.bind(this))
  }

  handler(struct: Handler) {
    pipe(this.node.network.crawler.handleCrawlRequest(struct.connection), struct.stream)
  }

  interact(counterparty: PeerId, options: { signal: AbortSignal }): Promise<Multiaddr[]> {
    verbose('crawl interact', counterparty.toB58String())
    return new Promise<Multiaddr[]>(async (resolve) => {
      let resolved = false
      const onAbort = () => {
        options.signal.removeEventListener('abort', onAbort)

        if (!resolved) {
          resolve([])
          resolved = true
        }
      }
      options.signal.addEventListener('abort', () => resolve([]))

      let struct: Handler

      try {
        struct = await this.node
          .dialProtocol(counterparty, this.protocols[0], { signal: options.signal })
          .catch(async (_: Error) => {
            const peerInfo = await this.node.peerRouting.findPeer(counterparty)

            return await this.node.dialProtocol(peerInfo, this.protocols[0], { signal: options.signal })
          })
      } catch (err) {
        log(`Could not ask node ${counterparty.toB58String()} for other nodes. Error was: ${chalk.red(err.message)}.`)

        if (!resolved) {
          return resolve([])
        }
        return
      }

      const addresses = []
      for await (const encodedResponse of struct.stream.source) {
        let decodedResponse: any
        try {
          decodedResponse = new CrawlResponse(encodedResponse.slice())
        } catch {
          continue
        }

        if (decodedResponse.status !== CrawlStatus.OK) {
          continue
        }

        addresses.push(...(await decodedResponse.addresses))
      }

      if (!resolved) {
        return resolve(addresses)
      }
    })
  }
}

export { Crawler }
