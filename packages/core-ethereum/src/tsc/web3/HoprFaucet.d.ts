/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import BN from 'bn.js'
import { Contract, ContractOptions } from 'web3-eth-contract'
import { EventLog } from 'web3-core'
import { EventEmitter } from 'events'
import { ContractEvent, Callback, TransactionObject, BlockType } from './types'

interface EventOptions {
  filter?: object
  fromBlock?: BlockType
  topics?: string[]
}

export class HoprFaucet extends Contract {
  constructor(jsonInterface: any[], address?: string, options?: ContractOptions)
  clone(): HoprFaucet
  methods: {
    DEFAULT_ADMIN_ROLE(): TransactionObject<string>

    MINTER_ROLE(): TransactionObject<string>

    PAUSER_ROLE(): TransactionObject<string>

    getRoleAdmin(role: string | number[]): TransactionObject<string>

    getRoleMember(role: string | number[], index: number | string): TransactionObject<string>

    getRoleMemberCount(role: string | number[]): TransactionObject<string>

    grantRole(role: string | number[], account: string): TransactionObject<void>

    hasRole(role: string | number[], account: string): TransactionObject<boolean>

    hoprToken(): TransactionObject<string>

    mint(account: string, amount: number | string): TransactionObject<void>

    pause(): TransactionObject<void>

    paused(): TransactionObject<boolean>

    renounceRole(role: string | number[], account: string): TransactionObject<void>

    restrictMinting(): TransactionObject<boolean>

    revokeRole(role: string | number[], account: string): TransactionObject<void>

    unpause(): TransactionObject<void>
  }
  events: {
    Paused: ContractEvent<string>
    RoleGranted: ContractEvent<{
      role: string
      account: string
      sender: string
      0: string
      1: string
      2: string
    }>
    RoleRevoked: ContractEvent<{
      role: string
      account: string
      sender: string
      0: string
      1: string
      2: string
    }>
    Unpaused: ContractEvent<string>
    allEvents: (options?: EventOptions, cb?: Callback<EventLog>) => EventEmitter
  }
}