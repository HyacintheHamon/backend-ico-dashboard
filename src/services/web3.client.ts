const  Web3 = require('web3');
import { injectable } from 'inversify';
const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
import config from '../config';
import 'reflect-metadata';
const net = require('net');

interface TransactionInput {
  from: string;
  to: string;
  amount: string;
  gas: number;
}

export interface Web3ClientInterface {
  web3: any;
  sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string>;
  generateMnemonic(): string;
  getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any;
  addAddressToWhiteList(address: string): any;
  addAddressToWhiteListReferral(address: string, referral: string): any;
  isAllowed(account: string): any;
  getEthBalance(address: string): Promise<string>;
  getSoldIcoTokens(): Promise<string>;
  getJcrBalanceOf(address: string): Promise<string>;
  getEthCollected(): Promise<string>;
  getJcrEthPrice(): Promise<number>
}

@injectable()
export class Web3Client implements Web3ClientInterface {
  web3: any;
  whiteList: any;
  ico: any;
  jcrToken: any;

  constructor() {
    this.web3 = new Web3(new Web3.providers.IpcProvider('/home/ethereum/geth.ipc', net));
    this.whiteList = new this.web3.eth.Contract(config.contracts.whiteList.abi, config.contracts.whiteList.address);
    this.ico = new this.web3.eth.Contract(config.contracts.ico.abi, config.contracts.ico.address);
    this.jcrToken = new this.web3.eth.Contract(config.contracts.jcrToken.abi, config.contracts.jcrToken.address);

    /*this.web3.eth.subscribe('pendingTransactions', (error, data) => {
      if (error) {
        console.log(error);
      }
    }).on('data', data => {
      this.web3.eth.getTransactionReceipt('0xc716685a27b2d99f0c7814ee105da67b523c8dee6d64e19d9156640dbe4afe6c')
        .then(console.log);

      this.web3.eth.getTransactionReceipt('0x64828f521036af2005b70637f177ee17ac2a7699c35a05b0227f440090c3b1d6')
        .then(console.log);

      this.web3.eth.getTransactionReceipt('0xf83b0bb1a1df82e27b648350b922e04c8b7c3c1912edad25bd47e6102bb03e60')
        .then(console.log);
    });*/
  }

  sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string> {
    const privateKey = this.getPrivateKeyByMnemonicAndSalt(mnemonic, salt);

    const params = {
      value: this.web3.utils.toWei(input.amount),
      from: input.from,
      to: input.to,
      gas: 300000
    };

    return new Promise<string>((resolve, reject) => {
      this.web3.eth.accounts.signTransaction(params, privateKey).then(transaction => {
        console.log(transaction);

        this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
          .on('transactionHash', transactionHash => {
            resolve(transactionHash);
          });
      });
    });
  }

  generateMnemonic(): string {
    return bip39.generateMnemonic();
  }

  getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any {
    const privateKey = this.getPrivateKeyByMnemonicAndSalt(mnemonic, salt);
    return this.web3.eth.accounts.privateKeyToAccount(privateKey);
  }

  getPrivateKeyByMnemonicAndSalt(mnemonic: string, salt: string) {
    // get seed
    const hdWallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic, salt));

    // get first of available wallets
    const path = 'm/44\'/60\'/0\'/0/0';

    // get wallet
    const wallet = hdWallet.derivePath(path).getWallet();

    // get private key
    return '0x' + wallet.getPrivateKey().toString('hex');
  }

  addAddressToWhiteList(address: string) {
    console.log(address);
    return new Promise((resolve, reject) => {
      this.web3.eth.getAccounts().then(accounts => {

        this.whiteList.methods.addInvestorToWhiteList(address).send({
          from: accounts[0],
          gas: 50000,
          gasPrice: this.web3.utils.toWei(20, 'gwei')
        }).on('transactionHash', hash => {
          console.log('Transaction hash: ' + hash);
        }).on('receipt', receipt => {
          console.log(receipt);
          resolve();
        }).on('error', error => {
          console.error(error);
          reject();
        });
      });
    });
  }

  addAddressToWhiteListReferral(address: string, referral: string) {
    return new Promise((resolve, reject) => {
      this.web3.eth.getAccounts().then(function(accounts) {
        this.whiteList.methods.addInvestorToListReferral(address, referral).send({
          from: accounts[0],
          gas: 10000
        }, function(err, transactionHash) {
          resolve(transactionHash);
        });
      });
    });
  }

  async isAllowed(address: string) {
    return await this.whiteList.methods.investorWhiteList(address).call();
  }

  async getEthBalance(address: string): Promise<string> {
    return this.web3.utils.fromWei(
      await this.web3.eth.getBalance(address)
    );
  }

  async getSoldIcoTokens(): Promise<string> {
    return this.web3.utils.fromWei(
      await this.ico.methods.tokensSold().call()
    ).toString();
  }

  async getJcrBalanceOf(address: string): Promise<string> {
    return this.web3.utils.fromWei(
      await this.jcrToken.methods.balanceOf(address).call()
    ).toString();
  }

  async getEthCollected(): Promise<string> {
    return this.web3.utils.fromWei(
      await this.ico.methods.collected().call()
    ).toString();
  }

  async getJcrEthPrice(): Promise<number> {
    return await this.ico.methods.jcrEthRate().call();
  }
}

const Web3ClientType = Symbol('Web3ClientInterface');
export {Web3ClientType};
