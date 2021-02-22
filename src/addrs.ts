import { networkInterfaces, NetworkInterfaceInfo } from 'os'
import Multiaddr from 'multiaddr'

import Debug from 'debug'
const log = Debug('hopr-connect')

import { isLocalhost, ipToU8aAddress, isPrivateAddress} from './utils'

export function getAddrs(
  port: number,
  peerId: string,
  options?: {
    interface?: string
    useIPv4?: boolean
    useIPv6?: boolean
    includeLocalIPv4?: boolean
    includeLocalIPv6?: boolean
    includeLocalhostIPv4?: boolean
    includeLocalhostIPv6?: boolean
  }
) {
  let interfaces: (NetworkInterfaceInfo[] | undefined)[]

  if (options?.interface != undefined) {
    let _tmp = networkInterfaces()[options.interface]

    if (_tmp == undefined) {
      log(
        `Interface <${options.interface}> does not exist on this machine. Available are <${Object.keys(
          networkInterfaces()
        ).join(', ')}>`
      )
      return []
    }
    interfaces = [_tmp]
  } else {
    interfaces = Object.values(networkInterfaces())
  }

  const multiaddrs: Multiaddr[] = []

  for (const iface of interfaces) {
    if (iface == undefined) {
      continue
    }

    for (const address of iface) {
      const u8aAddr = ipToU8aAddress(address.address, address.family)
      if (isPrivateAddress(u8aAddr, address.family)) {
        if (address.family === 'IPv4' && (options == undefined || options.includeLocalIPv4 != true)) {
          continue
        }
        if (address.family === 'IPv6' && (options == undefined || options.includeLocalIPv6 != true)) {
          continue
        }
      }

      if (isLocalhost(u8aAddr, address.family)) {
        if (address.family === 'IPv4' && (options == undefined || options.includeLocalhostIPv4 != true)) {
          continue
        }
        if (address.family === 'IPv6' && (options == undefined || options.includeLocalhostIPv6 != true)) {
          continue
        }
      }

      if (address.family === 'IPv4' && options != undefined && options.useIPv4 == false) {
        continue
      }

      if (address.family === 'IPv6' && options != undefined && options.useIPv6 == false) {
        continue
      }

      multiaddrs.push(
        Multiaddr.fromNodeAddress(
          {
            ...address,
            port: port.toString()
          },
          'tcp'
        ).encapsulate(`/p2p/${peerId}`)
      )
    }
  }

  return multiaddrs
}
