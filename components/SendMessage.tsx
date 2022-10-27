import React, { useState, useEffect } from 'react';
import { Button, Dropdown, DropdownItemProps, Grid, Input } from 'semantic-ui-react';
import {
  Chain, MoonbaseAlpha, FantomTestnet, AvalancheTestnet, Mumbai,
  useEthers, useCall
} from '@usedapp/core';
import { utils } from 'ethers';
import { Contract } from '@ethersproject/contracts';
import HelloWorldABI from '../ethereum/abi/HelloWorldMessage.json';
import addresses from '../ethereum/addresses';
import { AxelarQueryAPI, Environment, EvmChain } from '@axelar-network/axelarjs-sdk';
import { tokenName } from '../ethereum/axelar/axelarHelpers';
import useAxelarFunction, { AxelarTransactionState } from '../ethereum/axelar/useAxelarFunction';

/**
 * Converts a chainId to a string that Axelar's contract can interpet
 * @param chainId The chain ID of the chain you want to send to.
 * @returns The name of a chain that Axelar can interprets
 */
function chainIdToAxelar(chainId): EvmChain {
  switch (chainId) {
    case MoonbaseAlpha.chainId: return EvmChain.MOONBEAM;
    case FantomTestnet.chainId: return EvmChain.FANTOM;
    case AvalancheTestnet.chainId: return EvmChain.AVALANCHE;
    case Mumbai.chainId: return EvmChain.POLYGON;
  }
  throw new Error(`Chain ${chainId} is not supported!`);
}
/**
 * Converts a chainId to a faucet URL
 * @param chainId The chain ID of the chain you want to send to.
 */
 function chainIdToFaucet(chainId): string {
  switch (chainId) {
    case MoonbaseAlpha.chainId: return "https://apps.moonbeam.network/moonbase-alpha/faucet/";
    case FantomTestnet.chainId: return "https://faucet.fantom.network/";
    case AvalancheTestnet.chainId: return "https://faucet.avax.network/";
    case Mumbai.chainId: return "https://faucet.polygon.technology/";
    default: return null;
  }
}
const EMPTY_ADDRESS = '0x9999999999999999999999999999999999999999';

const SendMessage = () => {
  // State for sending the message
  const [message, setMessage] = useState<string>();
  const [destination, setDestination] = useState<number>();
  const [formError, setFormError] = useState<string>();
  const [isPending, setIsPending] = useState<boolean>();
  const { switchNetwork, chainId, account } = useEthers();

  // Set up network options
  const chains: Chain[] = [MoonbaseAlpha, FantomTestnet, AvalancheTestnet, Mumbai];
  const chainOptions: DropdownItemProps[] = [];
  chains.forEach(c => {
    chainOptions.push({ key: c.chainId, value: c.chainId, text: c.chainName, image: { avatar: true, src: `./logos/${c.chainName}.png` } });
  });
  const URL = chainIdToFaucet(chainId);

  // Basic form error handling
  useEffect(() => {
    if (chainId === destination) setFormError('Must send to a different chain.');
    else setFormError('');
  }, [chainId, destination]);
  const formIsValidated = destination != null && chainId != null && formError == '' && message != '' && message != null;

  // Submit transaction
  const helloWorldInterface = new utils.Interface(HelloWorldABI);
  const contract = new Contract(addresses[chainId ?? 0] ?? EMPTY_ADDRESS, helloWorldInterface);
  const { originState, send, transactionState, resetState } = useAxelarFunction(contract, 'sendMessage', { transactionName: 'Send Message' });
  async function sendTransaction() {
    // Reset state
    resetState();
    setIsPending(true);

    // Calculate potential cross-chain gas fee
    const axlearSDK = new AxelarQueryAPI({ environment: Environment.TESTNET });
    const estimateGasUsed = 200000;
    const crossChainGasFee = await axlearSDK.estimateGasFee(
      chainIdToAxelar(chainId),
      chainIdToAxelar(destination),
      tokenName(chainId),
      estimateGasUsed
    );

    // Send transaction
    const txReceipt = await send(message, addresses[destination], chainIdToAxelar(destination), { value: crossChainGasFee });
  }

  // Handle message reading from multiple chains
  const [networkToRead, setNetworkToRead] = useState<number>(MoonbaseAlpha.chainId);
  const readContract = new Contract(addresses[networkToRead], helloWorldInterface);
  const call = useCall({ contract: readContract, method: 'lastMessage', args: [account ?? EMPTY_ADDRESS] }, { chainId: networkToRead });
  const lastMessage: string = call?.value?.[0];

  useEffect(() => {
    if (originState.status != 'None' && originState.status != 'PendingSignature') setIsPending(false);
  }, [originState.status]);

  const buttonIsLoading = transactionState.isLoading || isPending;

  return (
    <div>
      <h3>Hello World Messaging</h3>
      <p>
        Send a string message from one chain to another. Select your destination and origin chains below.
      </p>
      <Grid centered divided='vertically' textAlign='center'>
        <Grid.Row centered columns={4} textAlign='center'>
          <Grid.Column>
            <h4>SEND</h4>
            <Input placeholder='Your message...' fluid onChange={(_, data) => setMessage(data?.value)} />
          </Grid.Column>
          <Grid.Column>
            <h4>FROM { URL ? <a href={URL}>(Faucet)</a> : <></> } </h4>
            <Dropdown
              placeholder='Select origin chain'
              options={chainOptions} fluid selection
              onChange={(_, data) => switchNetwork(data?.value as number)}
              value={chainId}
            />
          </Grid.Column>
          <Grid.Column>
            <h4>TO</h4>
            <Dropdown
              placeholder='Select destination chain'
              options={chainOptions} fluid selection
              onChange={(_, data) => setDestination(data?.value as number)}
            />
          </Grid.Column>
          <Grid.Column>
            <div className='h4-spacer' />
            <Button
              onClick={sendTransaction}
              disabled={!formIsValidated || buttonIsLoading}
              loading={buttonIsLoading}
            >
              Submit
            </Button>
            <p className='error-text'>{formError}</p>
          </Grid.Column>
        </Grid.Row>
        <br />
        <Grid.Row centered columns={4} textAlign='center'>
          <Grid.Column>
            <h4>{chains.find(x => x.chainId === chainId)?.chainName} Status</h4>
            <p className='wrp'>{originState?.transaction?.hash}</p>
            <p className='wrp'>{transactionState.originTxState}</p>
          </Grid.Column>
          <Grid.Column>
            <h4>Axelar Status</h4>
            <p className='wrp'>{originState?.transaction?.hash}</p>
            <p className='wrp'>{transactionState.middlemanTxState}</p>
          </Grid.Column>
          <Grid.Column>
            <h4>{chains.find(x => x.chainId === destination)?.chainName} Status</h4>
            <p className='wrp'>{transactionState.destTxState}</p>
          </Grid.Column>
        </Grid.Row>
      </Grid>
      <br />
      <br />
      {account == null ? <></> :
        <>
          <h3>Read Hello World Contracts</h3>
          <Grid centered divided='vertically' textAlign='center'>
            <Grid.Row centered columns={2} textAlign='center'>
              <Grid.Column>
                <Dropdown
                  placeholder='Select network to read'
                  options={chainOptions} fluid selection
                  onChange={(_, data) => setNetworkToRead(data?.value as number)}
                  value={networkToRead}
                />
              </Grid.Column>
              <Grid.Column>
                <h4>Message: "{lastMessage}"</h4>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </>
      }
    </div>
  );
};

export default SendMessage;
