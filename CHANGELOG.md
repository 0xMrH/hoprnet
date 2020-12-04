<a name="0.1"></a>

## [0.1](https://github.com/hoprnet/hopr-connect/compare/0.0.8...0.1) (2020-12-04)

### Features

- implements [PeerDiscovery](https://github.com/libp2p/js-libp2p-interfaces/tree/master/src/peer-discovery)
- type-checking for implemented interfaces, namely Connection, Transport, PeerDiscovery
- minor improvements

- resolve multiaddrs before dial ([#782](https://github.com/libp2p/js-libp2p/issues/782)) ([093c0ea](https://github.com/libp2p/js-libp2p/commit/093c0ea))

## Initial release

### Features

- automatic usage of WebRTC
- integration of STUN & TURN
- automatic handover between WebRTC and relayed connection
- proper handling of reconnects
