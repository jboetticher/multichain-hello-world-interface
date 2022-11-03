import { Chain } from "@usedapp/core"
import { ContractFunctionNames, Falsy, TransactionOptions, TransactionStatus, TypedContract } from '@usedapp/core/dist/esm/src/model';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { Params } from '@usedapp/core';
import { LogDescription } from 'ethers/lib/utils';
import TransactionState from "./TransactionState";

abstract class ConnectedContractModule {
  /**
   * The chains that this connected contract module should be able to connect to.
   */
  abstract chains: Chain[];

  /**
   * The addresses of the deployed connected contracts in this provider (this is a peer-to-peer project)
   */
  abstract addresses: {[x: number]: string};

  /**
   * An extension of useDapp's useContractFunction that also monitors the cross-chain transaction state
   */
  abstract useCrossChainFunction: <T extends TypedContract, FN extends ContractFunctionNames<T>>(
    contract: T | Falsy,
    functionName: FN,
    options?: TransactionOptions
  ) => {
    originState: TransactionStatus,
    send: (...args: Params<T, FN>) => Promise<TransactionReceipt | undefined>,  // todo
    originEvents: LogDescription[],
    resetState: () => void,
    transactionState: TransactionState,
    gmp?: any,
    state?: any
  };
}
export default ConnectedContractModule;