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

export class ERC777SenderRecipientMock extends Contract {
  constructor(jsonInterface: any[], address?: string, options?: ContractOptions)
  clone(): ERC777SenderRecipientMock
  methods: {
    burn(token: string, amount: number | string, data: string | number[]): TransactionObject<void>

    canImplementInterfaceForAddress(interfaceHash: string | number[], account: string): TransactionObject<string>

    recipientFor(account: string): TransactionObject<void>

    registerRecipient(recipient: string): TransactionObject<void>

    registerSender(sender: string): TransactionObject<void>

    send(token: string, to: string, amount: number | string, data: string | number[]): TransactionObject<void>

    senderFor(account: string): TransactionObject<void>

    setShouldRevertReceive(shouldRevert: boolean): TransactionObject<void>

    setShouldRevertSend(shouldRevert: boolean): TransactionObject<void>

    tokensReceived(
      operator: string,
      from: string,
      to: string,
      amount: number | string,
      userData: string | number[],
      operatorData: string | number[]
    ): TransactionObject<void>

    tokensToSend(
      operator: string,
      from: string,
      to: string,
      amount: number | string,
      userData: string | number[],
      operatorData: string | number[]
    ): TransactionObject<void>
  }
  events: {
    TokensReceivedCalled: ContractEvent<{
      operator: string
      from: string
      to: string
      amount: string
      data: string
      operatorData: string
      token: string
      fromBalance: string
      toBalance: string
      0: string
      1: string
      2: string
      3: string
      4: string
      5: string
      6: string
      7: string
      8: string
    }>
    TokensToSendCalled: ContractEvent<{
      operator: string
      from: string
      to: string
      amount: string
      data: string
      operatorData: string
      token: string
      fromBalance: string
      toBalance: string
      0: string
      1: string
      2: string
      3: string
      4: string
      5: string
      6: string
      7: string
      8: string
    }>
    allEvents: (options?: EventOptions, cb?: Callback<EventLog>) => EventEmitter
  }
}
